import type { RankingEntry } from "../src/domain/protocol/types.js";

export interface RankingPlayer {
	playerId: string;
	name: string;
	totalScore: number;
	connected: boolean;
	lastAcceptedAtMs?: number | null;
}

export function computeRanking(players: Map<string, RankingPlayer> | RankingPlayer[]): RankingEntry[] {
	const list = Array.isArray(players) ? players : Array.from(players.values());
	return list
		.map((player) => ({
			playerId: player.playerId,
			name: player.name,
			totalScore: player.totalScore,
			connected: player.connected,
			lastAcceptedAtMs: player.lastAcceptedAtMs != null && Number.isFinite(player.lastAcceptedAtMs) ? player.lastAcceptedAtMs : null,
		}))
		.sort((a, b) => b.totalScore - a.totalScore || a.playerId.localeCompare(b.playerId));
}

export function bumpRankingVersion(room: { rankingVersion: number }): number {
	room.rankingVersion += 1;
	return room.rankingVersion;
}
