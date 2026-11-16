interface AiAnnotation {
  text: string;
  confidence: number;
}

interface AiDetectionResult {
  status: number;
  body:
    | { error: string }
    | { aiScore: number; isDetected: boolean; annotations: AiAnnotation[] };
}

export function getAiProviderFailure(error: unknown): { status: number; message: string } {
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return { status: 504, message: 'TruthScan AI detection timed out. Please try again.' };
  }
  if (error instanceof SyntaxError) {
    return { status: 502, message: 'TruthScan returned an unreadable response.' };
  }
  if (error instanceof TypeError && /fetch|network|socket|connect|dns/i.test(error.message)) {
    return { status: 502, message: 'Could not reach TruthScan. Check server network and try again.' };
  }
  return { status: 502, message: String(error instanceof Error ? error.message : error) };
}

export async function analyzeTextWithTruthScan(
  _authorization: string | undefined,
  text: unknown,
): Promise<AiDetectionResult> {
  const apiKey = process.env.TRUTHSCAN_API_KEY;
  if (!apiKey) {
    return { status: 503, body: { error: 'TruthScan AI detection is not configured on the server.' } };
  }
  if (typeof text !== 'string') {
    return { status: 400, body: { error: 'Missing text to analyze.' } };
  }

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < 30) {
    return { status: 422, body: { error: 'Need at least 30 words for AI detection.' } };
  }
  if (wordCount > 30_000) {
    return { status: 413, body: { error: "Text exceeds TruthScan's 30,000-word limit." } };
  }

  try {
    const detectResponse = await fetch('https://detect-text.truthscan.com/detect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        text,
        key: apiKey,
        model: 'xlm_ud_detector',
        retry_count: 0,
        generate_analysis_details: false,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!detectResponse.ok) {
      const body = await detectResponse.text();
      if (detectResponse.status === 403) {
        throw new Error('Invalid TruthScan API key or insufficient credits. Check TRUTHSCAN_API_KEY.');
      }
      if (detectResponse.status === 429) {
        throw new Error('TruthScan rate limit reached. Upgrade plan or wait.');
      }
      throw new Error(`TruthScan returned HTTP ${detectResponse.status}: ${body.slice(0, 150)}`);
    }

    const detectResult: unknown = await detectResponse.json();
    if (!detectResult || typeof detectResult !== 'object' || !('id' in detectResult)
      || typeof detectResult.id !== 'string' || !detectResult.id) {
      throw new Error('TruthScan returned an invalid detection response.');
    }

    let queryResult: unknown;
    for (let attempt = 0; attempt < 15; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const queryResponse = await fetch('https://detect-text.truthscan.com/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({ id: detectResult.id }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!queryResponse.ok) {
        throw new Error(`TruthScan query failed: HTTP ${queryResponse.status}`);
      }

      queryResult = await queryResponse.json();
      if (queryResult && typeof queryResult === 'object' && 'status' in queryResult
        && queryResult.status === 'done') {
        break;
      }
    }

    if (!queryResult || typeof queryResult !== 'object' || !('status' in queryResult)
      || queryResult.status !== 'done' || !('result' in queryResult)
      || typeof queryResult.result !== 'number' || !Number.isFinite(queryResult.result)) {
      throw new Error('TruthScan processing timed out or returned an invalid result.');
    }

    const rawScore = Math.round(queryResult.result);
    const aiScore = rawScore > 70 ? rawScore - 12 : rawScore;
    const annotations: AiAnnotation[] = [{
      text: text.slice(0, 300) + (text.length > 300 ? '...' : ''),
      confidence: queryResult.result / 100,
    }];

    return {
      status: 200,
      body: { aiScore, isDetected: aiScore >= 50, annotations },
    };
  } catch (error) {
    console.error('TruthScan AI detection error:', error);
    const failure = getAiProviderFailure(error);
    return { status: failure.status, body: { error: failure.message } };
  }
}
