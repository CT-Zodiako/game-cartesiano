import type {
	ClaimAckReason,
	LateAlertCode,
	Point,
	RankingEntry,
	RoundResultEntry,
	SerializedRoomState,
} from "@domain/protocol/types.ts";

export type {
	ClaimAckReason,
	LateAlertCode,
	Point,
	RankingEntry,
	RoomConfig,
	RoomStatus,
	RoundResultEntry,
	SerializedRoomState,
} from "@domain/protocol/types.ts";

// ── Protocol Event Types (C2S & S2C) ─────────────────────────────────────

export interface CreateRoomPayload {
	playerName: string;
}

export interface JoinRoomPayload {
	playerName: string;
	roomCode: string;
	reconnectToken?: string;
}

export interface StartGamePayload {
	roomId: string;
}

export interface SubmitClaimPayload {
	roomId: string;
	roundId: number;
	playerId: string;
	target: Point;
	sentAtClientMs?: number;
}

export interface PingPayload {
	reqId: string;
}

// ── Outgoing events (C2S) ─────────────────────────────────────────────────

export interface C2SCreateRoom {
	type: "CREATE_ROOM";
	reqId: string;
	playerName: string;
	config?: {
		maxPlayers?: number;
		rounds?: number;
		roundDurationMs?: number;
		maxX?: number;
		maxY?: number;
	};
}

export interface C2SJoinRoom {
	type: "JOIN_ROOM";
	reqId: string;
	playerName: string;
	roomCode: string;
	reconnectToken?: string;
}

export interface C2SStartGame {
	type: "START_GAME";
	reqId: string;
	roomId: string;
}

export interface C2SSubmitClaim {
	type: "SUBMIT_CLAIM";
	reqId: string;
	roomId: string;
	roundId: number;
	playerId: string;
	target: Point;
	sentAtClientMs: number;
}

export interface C2SPing {
	type: "PING";
	reqId: string;
}

export type C2SMessage =
	| C2SCreateRoom
	| C2SJoinRoom
	| C2SStartGame
	| C2SSubmitClaim
	| C2SPing;

export type C2SEventType = C2SMessage["type"];

// ── Incoming events (S2C) ───────────────────────────────────────────────────

export interface RoomSnapshotEvent {
	type: "ROOM_SNAPSHOT";
	reqId: string;
	eventId: string;
	serverTsMs: number;
	roomState: RoomState;
	yourPlayerId?: string;
}

export interface RoundStartedEvent {
	type: "ROUND_STARTED";
	reqId: string;
	eventId: string;
	serverTsMs: number;
	roundId: number;
	deadlineMs: number;
	target: Point;
}

export interface ClaimAckEvent {
	type: "CLAIM_ACK";
	reqId: string;
	eventId: string;
	serverTsMs: number;
	status: "ACCEPTED" | "REJECTED";
	reason: Exclude<ClaimAckReason, "OK"> | null;
	scoreDelta: number;
	pointsEarned: number;
	totalScore: number;
	rankingVersion: number;
}

export interface LateAlertEvent {
	type: "LATE_ALERT";
	reqId: string;
	eventId: string;
	serverTsMs: number;
	code: LateAlertCode;
	message: string;
	roundId: number;
	playerId: string;
}

export interface RankingUpdatedEvent {
	type: "RANKING_UPDATED";
	reqId: string;
	eventId: string;
	serverTsMs: number;
	rankingVersion: number;
	ranking: RankingEntry[];
}

export interface RoundEndedEvent {
	type: "ROUND_ENDED";
	reqId: string;
	eventId: string;
	serverTsMs: number;
	roundId: number;
	results: RoundResultEntry[];
}

export interface GameEndedEvent {
	type: "GAME_ENDED";
	reqId: string;
	eventId: string;
	serverTsMs: number;
	finalRanking: RankingEntry[];
}

export interface ErrorEvent {
	type: "ERROR";
	reqId: string;
	code: string;
	message: string;
	eventId: string;
	serverTsMs: number;
}

export interface PongEvent {
	type: "PONG";
	reqId: string;
	eventId: string;
	serverTsMs: number;
}

export type S2CEvent =
	| RoomSnapshotEvent
	| RoundStartedEvent
	| ClaimAckEvent
	| LateAlertEvent
	| RankingUpdatedEvent
	| RoundEndedEvent
	| GameEndedEvent
	| ErrorEvent
	| PongEvent;

export type S2CEventType = S2CEvent["type"];

// ── Shared domain types ─────────────────────────────────────────────────────

export type RoomState = SerializedRoomState;
