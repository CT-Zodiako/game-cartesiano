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
  target: { x: number; y: number };
  sentAtClientMs?: number;
}

export interface PingPayload {
  reqId: string;
}

// ── Outgoing events (C2S) ─────────────────────────────────────────────────

export type C2SEventType =
  | 'CREATE_ROOM'
  | 'JOIN_ROOM'
  | 'START_GAME'
  | 'SUBMIT_CLAIM'
  | 'PING';

export interface C2SCreateRoom {
  type: 'CREATE_ROOM';
  reqId: string;
  playerName: string;
}

export interface C2SJoinRoom {
  type: 'JOIN_ROOM';
  reqId: string;
  playerName: string;
  roomCode: string;
  reconnectToken?: string;
}

export interface C2SStartGame {
  type: 'START_GAME';
  reqId: string;
  roomId: string;
}

export interface C2SSubmitClaim {
  type: 'SUBMIT_CLAIM';
  reqId: string;
  roomId: string;
  roundId: number;
  playerId: string;
  target: { x: number; y: number };
  sentAtClientMs: number;
}

export type C2SMessage =
  | C2SCreateRoom
  | C2SJoinRoom
  | C2SStartGame
  | C2SSubmitClaim;

// ── Incoming events (S2C) ───────────────────────────────────────────────────

export type S2CEventType =
  | 'ROOM_SNAPSHOT'
  | 'ROUND_STARTED'
  | 'CLAIM_ACK'
  | 'LATE_ALERT'
  | 'RANKING_UPDATED'
  | 'ROUND_ENDED'
  | 'GAME_ENDED'
  | 'ERROR'
  | 'PONG';

export interface RoomSnapshotEvent {
  type: 'ROOM_SNAPSHOT';
  reqId: string;
  eventId: string;
  serverTsMs: number;
  roomState: RoomState;
}

export interface RoundStartedEvent {
  type: 'ROUND_STARTED';
  reqId: string;
  eventId: string;
  serverTsMs: number;
  roundId: number;
  deadlineMs: number;
  target: { x: number; y: number };
}

export interface ClaimAckEvent {
  type: 'CLAIM_ACK';
  reqId: string;
  eventId: string;
  serverTsMs: number;
  status: 'ACCEPTED' | 'REJECTED';
  reason: string | null;
  scoreDelta: number;
}

export interface LateAlertEvent {
  type: 'LATE_ALERT';
  reqId: string;
  eventId: string;
  serverTsMs: number;
  code: string;
  message: string;
  roundId: number;
  playerId: string;
}

export interface RankingUpdatedEvent {
  type: 'RANKING_UPDATED';
  reqId: string;
  eventId: string;
  serverTsMs: number;
  rankingVersion: number;
  ranking: RankingEntry[];
}

export interface RoundEndedEvent {
  type: 'ROUND_ENDED';
  reqId: string;
  eventId: string;
  serverTsMs: number;
  roundId: number;
  results: RoundResultEntry[];
}

export interface GameEndedEvent {
  type: 'GAME_ENDED';
  reqId: string;
  eventId: string;
  serverTsMs: number;
  finalRanking: RankingEntry[];
}

export interface ErrorEvent {
  type: 'ERROR';
  reqId: string;
  code: string;
  message: string;
  eventId: string;
  serverTsMs: number;
}

export interface PongEvent {
  type: 'PONG';
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

// ── Shared domain types ─────────────────────────────────────────────────────

export type RoomStatus = 'LOBBY' | 'ROUND_ACTIVE' | 'ROUND_RESULT' | 'FINAL';

export interface PlayerInfo {
  playerId: string;
  name: string;
  connected: boolean;
  totalScore: number;
  lastAcceptedAtMs?: number | null;
}

export interface RoomState {
  roomId: string;
  roomCode: string;
  hostId: string;
  status: RoomStatus;
  currentRound: number;
  roundDeadlineMs: number | null;
  rankingVersion: number;
  players: PlayerInfo[];
}

export interface RankingEntry {
  playerId: string;
  name: string;
  totalScore: number;
  connected: boolean;
  lastAcceptedAtMs: number | null;
}

export interface RoundResultEntry {
  playerId: string;
  result: 'WIN' | 'LOSS';
  scoreDelta: number;
  reason: string;
}
