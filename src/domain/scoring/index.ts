const DEFAULT_ROUND_DURATION_MS = 20_000;
const MAX_SCORE = 1_000;
const SCORE_DECAY = 900;

export function computeScoreFromElapsedMs(elapsedMs: number, roundDurationMs = DEFAULT_ROUND_DURATION_MS): number {
  if (elapsedMs > roundDurationMs) return 0;
  return Math.max(0, Math.floor(MAX_SCORE - (elapsedMs / roundDurationMs) * SCORE_DECAY));
}
