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

interface AiorNotTextResponse {
  report: {
    ai_text: {
      confidence: number;
      is_detected: boolean;
      annotations?: unknown;
    };
  };
}

export function getAiProviderFailure(error: unknown): { status: number; message: string } {
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return { status: 504, message: 'AI or Not detection timed out. Please try again.' };
  }
  if (error instanceof SyntaxError) {
    return { status: 502, message: 'AI or Not returned an unreadable response.' };
  }
  if (error instanceof TypeError && /fetch|network|socket|connect|dns/i.test(error.message)) {
    return { status: 502, message: 'Could not reach AI or Not. Check server network and try again.' };
  }
  return { status: 502, message: String(error instanceof Error ? error.message : error) };
}

function isAiorNotTextResponse(value: unknown): value is AiorNotTextResponse {
  if (!value || typeof value !== 'object' || !('report' in value)) return false;
  const report = value.report;
  if (!report || typeof report !== 'object' || !('ai_text' in report)) return false;
  const aiText = report.ai_text;
  return Boolean(
    aiText
    && typeof aiText === 'object'
    && 'confidence' in aiText
    && typeof aiText.confidence === 'number'
    && Number.isFinite(aiText.confidence)
    && aiText.confidence >= 0
    && aiText.confidence <= 1
    && 'is_detected' in aiText
    && typeof aiText.is_detected === 'boolean'
  );
}

function parseAnnotations(value: unknown): AiAnnotation[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error('AI or Not returned invalid text annotations.');
  }

  return value.map(annotation => {
    if (
      !Array.isArray(annotation)
      || annotation.length !== 2
      || typeof annotation[0] !== 'string'
      || typeof annotation[1] !== 'number'
      || !Number.isFinite(annotation[1])
      || annotation[1] < 0
      || annotation[1] > 1
    ) {
      throw new Error('AI or Not returned invalid text annotations.');
    }
    return { text: annotation[0], confidence: annotation[1] };
  });
}

export async function analyzeTextWithAiorNot(
  _authorization: string | undefined,
  text: unknown,
): Promise<AiDetectionResult> {
  const apiKey = process.env.AIORNOT_API_KEY;
  if (!apiKey) {
    return { status: 503, body: { error: 'AI or Not detection is not configured on the server.' } };
  }
  if (typeof text !== 'string') {
    return { status: 400, body: { error: 'Missing text to analyze.' } };
  }
  if (text.trim().length < 250) {
    return { status: 422, body: { error: 'Need at least 250 characters for AI detection.' } };
  }
  if (text.length > 500_000) {
    return { status: 413, body: { error: "Text exceeds AI or Not's 500,000-character limit." } };
  }

  try {
    const formData = new FormData();
    formData.set('text', text);
    const response = await fetch('https://api.aiornot.com/v2/text/sync?include_annotations=true', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        accept: 'application/json',
      },
      body: formData,
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const body = await response.text();
      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid AI or Not API key or insufficient API access. Check AIORNOT_API_KEY.');
      }
      if (response.status === 429) {
        throw new Error('AI or Not rate limit reached. Please try again later.');
      }
      throw new Error(`AI or Not returned HTTP ${response.status}: ${body.slice(0, 150)}`);
    }

    const result: unknown = await response.json();
    if (!isAiorNotTextResponse(result)) {
      throw new Error('AI or Not returned an invalid detection response.');
    }

    const aiText = result.report.ai_text;
    const annotations = parseAnnotations(aiText.annotations);

    return {
      status: 200,
      body: {
        aiScore: Math.round(aiText.confidence * 100),
        isDetected: aiText.is_detected,
        annotations,
      },
    };
  } catch (error) {
    console.error('AI or Not detection error:', error);
    const failure = getAiProviderFailure(error);
    return { status: failure.status, body: { error: failure.message } };
  }
}
