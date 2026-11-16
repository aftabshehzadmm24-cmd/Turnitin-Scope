/**
 * Turnitin AI score display rules.
 * - Scores from 1% to 20% are masked as '*%'.
 * - A genuine 0% result can also be masked as '*%' when `maskedZero` is true
 *   (50% of 0% reports use this presentation).
 */
export function formatAiScoreDisplay(score: number, maskedZero = false): string {
  const safeScore = Number.isFinite(score) ? Math.max(0, score) : 0;
  if (safeScore === 0 && maskedZero) return '*%';
  if (safeScore >= 1 && safeScore <= 20) return '*%';
  return `${safeScore}%`;
}
