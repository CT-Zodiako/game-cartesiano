function compareRankingRows(a, b) {
  if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
  const aTs = Number.isFinite(a.lastAcceptedAtMs) ? a.lastAcceptedAtMs : Number.POSITIVE_INFINITY;
  const bTs = Number.isFinite(b.lastAcceptedAtMs) ? b.lastAcceptedAtMs : Number.POSITIVE_INFINITY;
  if (aTs !== bTs) return aTs - bTs;
  return String(a.playerId).localeCompare(String(b.playerId));
}

export function computeRanking(playersMap) {
  const ranking = Array.from(playersMap.values())
    .map((p) => ({
      playerId: p.playerId,
      name: p.name,
      totalScore: p.totalScore,
      connected: p.connected,
      lastAcceptedAtMs: p.lastAcceptedAtMs ?? null,
    }))
    .sort(compareRankingRows);
  return ranking;
}

export function bumpRankingVersion(room) {
  room.rankingVersion = (room.rankingVersion ?? 0) + 1;
  return room.rankingVersion;
}
