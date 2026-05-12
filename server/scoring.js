export const ROUND_DURATION_MS = 20_000;
export const SCORE_MAX = 1000;
export const SCORE_MIN = 100;

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function computeScoreFromElapsedMs(elapsedMs) {
  if (!Number.isFinite(elapsedMs) || elapsedMs > ROUND_DURATION_MS) return 0;
  const elapsed = clamp(elapsedMs, 0, ROUND_DURATION_MS);
  const timeFactor = 1 - elapsed / ROUND_DURATION_MS;
  return Math.floor(SCORE_MIN + (SCORE_MAX - SCORE_MIN) * timeFactor);
}

export function computeScoreFromServerTimes(roundStartMs, serverReceivedAtMs) {
  if (!Number.isFinite(roundStartMs) || !Number.isFinite(serverReceivedAtMs)) return 0;
  return computeScoreFromElapsedMs(serverReceivedAtMs - roundStartMs);
}
