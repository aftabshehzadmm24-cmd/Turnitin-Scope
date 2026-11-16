/**
 * Plagiarism Detection - Mock/Random Logic
 * 
 * Generates realistic-looking plagiarism reports without external APIs
 * 
 * Score Distribution:
 * - 80% of reports: 0-12% plagiarism (low/safe)
 * - 20% of reports: 13-40% plagiarism (medium/high)
 * 
 * No API keys needed - works offline
 */

interface PlagiarismMatch {
  text: string;
  sourceTitle: string;
  sourceUrl?: string;
  similarity: number;
  startOffset: number;
  endOffset: number;
}

interface PlagiarismResult {
  status: number;
  body:
    | { error: string }
    | { 
        plagiarismScore: number; 
        isDetected: boolean; 
        matches: PlagiarismMatch[];
        totalSources: number;
        overallSimilarity: number;
      };
}

/**
 * Generate random plagiarism score based on distribution:
 * - 80% chance: 0-12% (low plagiarism)
 * - 20% chance: 13-40% (medium/high plagiarism)
 */
function generateRandomPlagiarismScore(): number {
  const random = Math.random();
  
  if (random < 0.8) {
    // 80% of reports: 0-12%
    return Math.floor(Math.random() * 13); // 0 to 12
  } else {
    // 20% of reports: 13-40%
    return Math.floor(Math.random() * 28) + 13; // 13 to 40
  }
}

/**
 * Generate realistic fake matches for plagiarism report
 */
function generateFakeMatches(text: string, plagScore: number): PlagiarismMatch[] {
  if (plagScore < 5) return []; // Very low score = no matches
  
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const numMatches = Math.min(Math.ceil(plagScore / 10), sentences.length);
  
  const matches: PlagiarismMatch[] = [];
  const fakeSources = [
    'Wikipedia - Free Encyclopedia',
    'ResearchGate Publication',
    'Academia.edu Paper',
    'Medium Article',
    'Scientific Journal Archive',
    'Educational Resource Database',
    'Open Access Repository',
    'Digital Library Collection',
    'Academic Database',
    'Online Knowledge Base'
  ];
  
  for (let i = 0; i < numMatches && i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    if (sentence.length < 20) continue;
    
    matches.push({
      text: sentence,
      sourceTitle: fakeSources[Math.floor(Math.random() * fakeSources.length)],
      sourceUrl: `https://example.com/source-${i + 1}`,
      similarity: Math.floor(Math.random() * 30) + 70, // 70-100% similarity
      startOffset: text.indexOf(sentence),
      endOffset: text.indexOf(sentence) + sentence.length,
    });
  }
  
  return matches;
}

export async function analyzeTextForPlagiarism(text: unknown): Promise<PlagiarismResult> {
  if (typeof text !== 'string') {
    return { status: 400, body: { error: 'Missing text to analyze.' } };
  }
  
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < 30) {
    return { status: 422, body: { error: 'Need at least 30 words for plagiarism detection.' } };
  }
  
  if (text.length > 100_000) {
    return { status: 413, body: { error: 'Text exceeds 100,000-character limit.' } };
  }

  try {
    console.log('\n📚 Generating MOCK plagiarism report (random logic)');
    console.log(`   Text length: ${text.length} characters, ~${wordCount} words`);

    // Simulate processing delay (realistic feel)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Generate random plagiarism score based on distribution
    const plagiarismScore = generateRandomPlagiarismScore();
    
    // Generate fake matches
    const matches = generateFakeMatches(text, plagiarismScore);
    const totalSources = matches.length > 0 ? Math.ceil(matches.length / 2) : 0;

    console.log(`✅ MOCK PLAGIARISM SCORE: ${plagiarismScore}%`);
    console.log(`   Distribution: ${plagiarismScore <= 12 ? '80% group (0-12%)' : '20% group (13-40%)'}`);
    console.log(`   Fake sources: ${totalSources}`);
    console.log(`   Fake matches: ${matches.length}`);

    return {
      status: 200,
      body: { 
        plagiarismScore,
        isDetected: plagiarismScore >= 15, // 15%+ considered plagiarism
        matches,
        totalSources,
        overallSimilarity: plagiarismScore,
      },
    };
  } catch (error) {
    console.error('Mock plagiarism detection error:', error);
    return { 
      status: 500, 
      body: { error: 'Failed to generate plagiarism report.' } 
    };
  }
}
