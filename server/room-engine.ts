import {
	ROOM_STATUS,
	type ClaimAck,
	type Point,
	type RankingEntry,
	type RoomConfig,
	type RoomStatus,
	type RoundResultEntry,
	type SerializedRoomState,
} from "../src/domain/protocol/types.js";
import { computeScoreFromElapsedMs } from "../src/domain/scoring/index.js";
import { bumpRankingVersion, computeRanking } from "./ranking.js";

export { ROOM_STATUS } from "../src/domain/protocol/types.js";
export type {
	ClaimAck,
	Point,
	RankingEntry,
	RoomConfig,
	RoomStatus,
	RoundResultEntry,
	SerializedRoomState,
} from "../src/domain/protocol/types.js";

export interface PlayerState {
	playerId: string;
	name: string;
	totalScore: number;
	connected: boolean;
	lastAcceptedAtMs: number | null;
}

export interface RoomState {
	roomId: string;
	roomCode: string;
	hostId: string;
	status: RoomStatus;
	config: RoomConfig;
	players: PlayerState[];
	playersById: Map<string, PlayerState>;
	currentRound: number;
	roundStartMs: number;
	roundDeadlineMs: number;
	targetsByRoundPlayer: Map<string, Point>;
	claimedTargetsByRound: Map<number, Set<string>>;
	acceptedPlayersByRound: Map<number, Set<string>>;
	scoreDeltaByRoundPlayer: Map<string, number>;
	claimAcksByKey: Map<string, ClaimAck>;
	rankingVersion: number;
	roundTimerId?: unknown;
}

export type CloseRoundResult =
	| { ok: false; code: "ROOM_NOT_FOUND" }
	| {
			ok: true;
			ended: true;
			reason?: "TIMEOUT";
			ranking: RankingEntry[];
			results?: RoundResultEntry[];
	  }
	| {
			ok: true;
			ended: false;
			reason: "TIMEOUT";
			roundId: number;
			closedRoundId: number;
			results: RoundResultEntry[];
	  };

export interface RoundTimeoutEvent {
	room: RoomState;
	closingRoundId: number;
	result: CloseRoundResult;
}

export interface TimerApi {
	now: () => number;
	setTimer?: (cb: () => void, delay: number) => unknown;
	clearTimer?: (id: unknown) => void;
	onRoundTimeout?: (event: RoundTimeoutEvent) => void;
}

const defaultConfig: RoomConfig = {
	maxPlayers: 8,
	rounds: 3,
	roundDurationMs: 20_000,
	maxX: 10,
	maxY: 10,
};

function nextRoomCode(roomSeq: number): string {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	let code = "";
	const n = roomSeq || 1;
	for (let i = 0; i < 6; i += 1)
		code += alphabet[(n + i * 7) % alphabet.length];
	return code;
}

function targetFor(
	roundId: number,
	playerIndex: number,
	config: RoomConfig,
): Point {
	const width = config.maxX * 2 + 1;
	const height = config.maxY * 2 + 1;
	return {
		x: ((roundId * 3 + playerIndex * 5) % width) - config.maxX,
		y: ((roundId * 7 + playerIndex * 2) % height) - config.maxY,
	};
}

function serializeRoom(room: RoomState): SerializedRoomState {
	return {
		roomId: room.roomId,
		roomCode: room.roomCode,
		hostId: room.hostId,
		status: room.status,
		config: room.config,
		players: room.players.map((player) => ({
			playerId: player.playerId,
			name: player.name,
			totalScore: player.totalScore,
			connected: player.connected,
			lastAcceptedAtMs: player.lastAcceptedAtMs,
		})),
		currentRound: room.currentRound,
		roundDeadlineMs: room.roundDeadlineMs || null,
		rankingVersion: room.rankingVersion,
		ranking: computeRanking(room.players),
	};
}

export class RoomEngine {
	readonly roomsById = new Map<string, RoomState>();
	private roomSeq = 0;
	private playerSeq = 0;
	now: () => number;
	setTimer: (cb: () => void, delay: number) => unknown;
	clearTimer: (id: unknown) => void;
	private readonly onRoundTimeout?: (event: RoundTimeoutEvent) => void;

	constructor(timerApi: TimerApi) {
		this.now = timerApi.now;
		this.onRoundTimeout = timerApi.onRoundTimeout;
		this.setTimer =
			timerApi.setTimer ??
			((cb, delay) => {
				const timer = setTimeout(cb, delay);
				(timer as { unref?: () => void }).unref?.();
				return timer;
			});
		this.clearTimer =
			timerApi.clearTimer ??
			((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
	}

	createRoom(input: { hostName: string; config?: Partial<RoomConfig> }) {
		const roomId = `room-${++this.roomSeq}`;
		const playerId = `p-${++this.playerSeq}`;
		const config = { ...defaultConfig, ...(input.config ?? {}) };
		const host: PlayerState = {
			playerId,
			name: input.hostName,
			totalScore: 0,
			connected: true,
			lastAcceptedAtMs: null,
		};
		const room: RoomState = {
			roomId,
			roomCode: nextRoomCode(this.roomSeq),
			hostId: playerId,
			status: ROOM_STATUS.LOBBY,
			config,
			players: [host],
			playersById: new Map([[playerId, host]]),
			currentRound: 0,
			roundStartMs: 0,
			roundDeadlineMs: 0,
			targetsByRoundPlayer: new Map(),
			claimedTargetsByRound: new Map(),
			acceptedPlayersByRound: new Map(),
			scoreDeltaByRoundPlayer: new Map(),
			claimAcksByKey: new Map(),
			rankingVersion: 0,
		};
		this.roomsById.set(roomId, room);
		return {
			ok: true as const,
			roomId,
			roomCode: room.roomCode,
			hostId: playerId,
			roomState: serializeRoom(room),
		};
	}

	joinRoom(input: { roomCode: string; playerName: string }) {
		const room = Array.from(this.roomsById.values()).find(
			(candidate) => candidate.roomCode === input.roomCode,
		);
		if (!room) return { ok: false as const, code: "ROOM_NOT_FOUND" };
		if (room.status !== ROOM_STATUS.LOBBY)
			return { ok: false as const, code: "ROOM_IN_PROGRESS" };
		if (room.players.length >= room.config.maxPlayers)
			return { ok: false as const, code: "ROOM_FULL" };

		const playerId = `p-${++this.playerSeq}`;
		const player: PlayerState = {
			playerId,
			name: input.playerName,
			totalScore: 0,
			connected: true,
			lastAcceptedAtMs: null,
		};
		room.players.push(player);
		room.playersById.set(playerId, player);
		return {
			ok: true as const,
			roomId: room.roomId,
			playerId,
			roomState: serializeRoom(room),
		};
	}

	startGame(input: { roomId: string; actorPlayerId: string }) {
		const room = this.roomsById.get(input.roomId);
		if (!room) return { ok: false as const, code: "ROOM_NOT_FOUND" };
		if (room.hostId !== input.actorPlayerId)
			return { ok: false as const, code: "NOT_HOST" };
		if (room.players.length < 2)
			return { ok: false as const, code: "NOT_ENOUGH_PLAYERS" };
		if (room.status !== ROOM_STATUS.LOBBY)
			return { ok: false as const, code: "INVALID_STATUS" };
		return this.startRound(room);
	}

	private startRound(room: RoomState) {
		room.status = ROOM_STATUS.ROUND_ACTIVE;
		room.currentRound += 1;
		room.roundStartMs = this.now();
		room.roundDeadlineMs = room.roundStartMs + room.config.roundDurationMs;
		room.claimedTargetsByRound.set(room.currentRound, new Set());
		room.acceptedPlayersByRound.set(room.currentRound, new Set());
		room.claimAcksByKey.clear();

		room.players.forEach((player, index) => {
			room.targetsByRoundPlayer.set(
				`${room.currentRound}:${player.playerId}`,
				targetFor(room.currentRound, index, room.config),
			);
			room.scoreDeltaByRoundPlayer.delete(
				`${room.currentRound}:${player.playerId}`,
			);
		});

		room.roundTimerId = this.setTimer(() => {
			const closingRoundId = room.currentRound;
			const result = this.closeRound(room.roomId, "TIMEOUT");
			this.onRoundTimeout?.({ room, closingRoundId, result });
		}, room.config.roundDurationMs);

		return {
			ok: true as const,
			roomState: serializeRoom(room),
			roundId: room.currentRound,
		};
	}

	submitClaim(input: {
		roomId: string;
		roundId: number;
		playerId: string;
		target: Point;
		serverReceivedAtMs: number;
		wsConnectionSeq: number;
	}) {
		const room = this.roomsById.get(input.roomId);
		if (
			!room ||
			room.status !== ROOM_STATUS.ROUND_ACTIVE ||
			room.currentRound !== input.roundId
		) {
			const ack = this.makeAck(undefined, "REJECTED", "ROUND_NOT_ACTIVE", 0, 0);
			return { ok: false as const, ack };
		}

		const idempotencyKey = `${input.roundId}:${input.playerId}:${input.wsConnectionSeq}`;
		const previous = room.claimAcksByKey.get(idempotencyKey);
		if (previous)
			return {
				ok: previous.status === "ACCEPTED",
				duplicate: true,
				ack: previous,
			};

		const expected = room.targetsByRoundPlayer.get(
			`${input.roundId}:${input.playerId}`,
		);
		const player = room.playersById.get(input.playerId);
		if (
			!expected ||
			!player ||
			expected.x !== input.target.x ||
			expected.y !== input.target.y
		) {
			const ack = this.makeAck(
				room,
				"REJECTED",
				"WRONG_TARGET",
				0,
				player?.totalScore ?? 0,
			);
			room.claimAcksByKey.set(idempotencyKey, ack);
			return { ok: false as const, ack };
		}

		const claimedTargets =
			room.claimedTargetsByRound.get(input.roundId) ?? new Set<string>();
		room.claimedTargetsByRound.set(input.roundId, claimedTargets);
		const targetKey = `${input.target.x}:${input.target.y}`;
		if (claimedTargets.has(targetKey)) {
			const ack = this.makeAck(
				room,
				"REJECTED",
				"TOO_LATE",
				0,
				player.totalScore,
			);
			room.claimAcksByKey.set(idempotencyKey, ack);
			return {
				ok: false as const,
				ack,
				lateAlert: {
					code: "TOO_LATE",
					playerId: input.playerId,
					roundId: input.roundId,
				},
			};
		}

		claimedTargets.add(targetKey);
		room.acceptedPlayersByRound.get(input.roundId)?.add(input.playerId);
		const elapsedMs = input.serverReceivedAtMs - room.roundStartMs;
		const scoreDelta = computeScoreFromElapsedMs(
			elapsedMs,
			room.config.roundDurationMs,
		);
		room.scoreDeltaByRoundPlayer.set(
			`${input.roundId}:${input.playerId}`,
			scoreDelta,
		);
		player.totalScore += scoreDelta;
		player.lastAcceptedAtMs = input.serverReceivedAtMs;
		bumpRankingVersion(room);

		const ack = this.makeAck(
			room,
			"ACCEPTED",
			"OK",
			scoreDelta,
			player.totalScore,
		);
		room.claimAcksByKey.set(idempotencyKey, ack);
		return { ok: true as const, ack, ranking: computeRanking(room.players) };
	}

	closeRound(roomId: string, reason: "TIMEOUT"): CloseRoundResult {
		const room = this.roomsById.get(roomId);
		if (!room) return { ok: false as const, code: "ROOM_NOT_FOUND" };
		if (room.status === ROOM_STATUS.FINAL)
			return {
				ok: true as const,
				ended: true,
				ranking: computeRanking(room.players),
			};

		if (room.roundTimerId !== undefined) {
			this.clearTimer(room.roundTimerId);
			room.roundTimerId = undefined;
		}

		if (room.currentRound >= room.config.rounds) {
			room.status = ROOM_STATUS.FINAL;
			return {
				ok: true as const,
				ended: true,
				reason,
				ranking: computeRanking(room.players),
				results: this.getRoundResults(room, room.currentRound),
			};
		}

		const closedRoundId = room.currentRound;
		this.startRound(room);
		return {
			ok: true as const,
			ended: false,
			reason,
			roundId: room.currentRound,
			closedRoundId,
			results: this.getRoundResults(room, closedRoundId),
		};
	}

	getRoomSnapshot(roomId: string, yourPlayerId?: string) {
		const room = this.roomsById.get(roomId);
		if (!room) return undefined;
		return {
			type: "ROOM_SNAPSHOT" as const,
			roomState: serializeRoom(room),
			yourPlayerId,
		};
	}

	getRoundStartedEvents(room: RoomState) {
		return room.players.map((player) => {
			const target = room.targetsByRoundPlayer.get(
				`${room.currentRound}:${player.playerId}`,
			);
			if (!target) {
				throw new Error(
					`Missing target for round ${room.currentRound} player ${player.playerId}`,
				);
			}

			return {
				playerId: player.playerId,
				event: {
					type: "ROUND_STARTED" as const,
					roundId: room.currentRound,
					deadlineMs: room.roundDeadlineMs,
					target,
				},
			};
		});
	}

	getRoundResults(room: RoomState, roundId: number): RoundResultEntry[] {
		const accepted =
			room.acceptedPlayersByRound.get(roundId) ?? new Set<string>();
		return room.players.map((player) => ({
			playerId: player.playerId,
			result: accepted.has(player.playerId) ? "WIN" : "LOSS",
			scoreDelta:
				room.scoreDeltaByRoundPlayer.get(`${roundId}:${player.playerId}`) ?? 0,
			reason: accepted.has(player.playerId) ? "OK" : "TIMEOUT",
		}));
	}

	getRanking(room: RoomState): RankingEntry[] {
		return computeRanking(room.players);
	}

	private makeAck(
		room: RoomState | undefined,
		status: ClaimAck["status"],
		reason: ClaimAck["reason"],
		scoreDelta: number,
		totalScore: number,
	): ClaimAck {
		return {
			type: "CLAIM_ACK",
			status,
			reason,
			scoreDelta,
			pointsEarned: scoreDelta,
			totalScore,
			rankingVersion: room?.rankingVersion ?? 0,
		};
	}
}
