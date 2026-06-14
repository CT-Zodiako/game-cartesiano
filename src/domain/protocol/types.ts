export const ROOM_STATUS = {
	LOBBY: "LOBBY",
	ROUND_ACTIVE: "ROUND_ACTIVE",
	FINAL: "FINAL",
} as const;

export type RoomStatus = (typeof ROOM_STATUS)[keyof typeof ROOM_STATUS];

export interface Point {
	x: number;
	y: number;
}

export interface RoomConfig {
	maxPlayers: number;
	rounds: number;
	roundDurationMs: number;
	maxX: number;
	maxY: number;
}

export type RoundResultReason = "OK" | "TIMEOUT";
export type ClaimAckReason = "OK" | "WRONG_TARGET" | "TOO_LATE" | "ROUND_NOT_ACTIVE";
export type LateAlertCode = "TOO_LATE";

export interface ClaimAck {
	type: "CLAIM_ACK";
	status: "ACCEPTED" | "REJECTED";
	reason: ClaimAckReason;
	scoreDelta: number;
	pointsEarned: number;
	totalScore: number;
	rankingVersion: number;
}

export interface RoundResultEntry {
	playerId: string;
	result: "WIN" | "LOSS";
	scoreDelta: number;
	reason: RoundResultReason;
}

export interface RankingEntry {
	playerId: string;
	name: string;
	totalScore: number;
	connected: boolean;
	lastAcceptedAtMs: number | null;
}

export interface SerializedPlayerState {
	playerId: string;
	name: string;
	totalScore: number;
	connected: boolean;
	lastAcceptedAtMs: number | null;
}

export interface SerializedRoomState {
	roomId: string;
	roomCode: string;
	hostId: string;
	status: RoomStatus;
	config: RoomConfig;
	players: SerializedPlayerState[];
	currentRound: number;
	roundDeadlineMs: number | null;
	rankingVersion: number;
	ranking: RankingEntry[];
}
