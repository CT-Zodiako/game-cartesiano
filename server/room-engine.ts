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
	countdownStartsAtMs: number;
	countdownSourceStatus?: typeof ROOM_STATUS.LOBBY | typeof ROOM_STATUS.FINAL;
	countdownTimerId?: unknown;
	countdownVersion: number;
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

export type RoomClosureReason = "HOST_LEFT";

export type AbortRoomResult =
	| { ok: false; code: "ROOM_NOT_FOUND" | "NOT_HOST" | "ROOM_NOT_ACTIVE" }
	| { ok: true; reason: RoomClosureReason };

export interface RoundTimeoutEvent {
	room: RoomState;
	closingRoundId: number;
	result: CloseRoundResult;
}

export interface CountdownTimeoutEvent {
	room: RoomState;
	started: boolean;
	resetScores: boolean;
}

export interface TimerApi {
	now: () => number;
	setTimer?: (cb: () => void, delay: number) => unknown;
	clearTimer?: (id: unknown) => void;
	onRoundTimeout?: (event: RoundTimeoutEvent) => void;
	onCountdownTimeout?: (event: CountdownTimeoutEvent) => void;
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
		countdownStartsAtMs: room.countdownStartsAtMs || null,
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
	private readonly onCountdownTimeout?: (event: CountdownTimeoutEvent) => void;

	constructor(timerApi: TimerApi) {
		this.now = timerApi.now;
		this.onRoundTimeout = timerApi.onRoundTimeout;
		this.onCountdownTimeout = timerApi.onCountdownTimeout;
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
		// Drop explicit undefined overrides: spreading them would clobber
		// defaults (undefined maxX/maxY produce NaN targets, which serialize
		// as null over JSON and make every claim invalid).
		const overrides = Object.fromEntries(
			Object.entries(input.config ?? {}).filter(([, v]) => v !== undefined),
		);
		const config = { ...defaultConfig, ...overrides };
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
			countdownStartsAtMs: 0,
			countdownVersion: 0,
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
		if (!this.isConnectedPlayer(room, input.actorPlayerId))
			return { ok: false as const, code: "NOT_CONNECTED" };
		if (this.connectedPlayers(room).length < 2)
			return { ok: false as const, code: "NOT_ENOUGH_PLAYERS" };
		if (room.status !== ROOM_STATUS.LOBBY)
			return { ok: false as const, code: "INVALID_STATUS" };
		return this.beginCountdown(room, ROOM_STATUS.LOBBY);
	}

	startRematch(input: { roomId: string; actorPlayerId: string }) {
		const room = this.roomsById.get(input.roomId);
		if (!room) return { ok: false as const, code: "ROOM_NOT_FOUND" };
		if (room.hostId !== input.actorPlayerId)
			return { ok: false as const, code: "NOT_HOST" };
		if (!this.isConnectedPlayer(room, input.actorPlayerId))
			return { ok: false as const, code: "NOT_CONNECTED" };
		if (room.status !== ROOM_STATUS.FINAL)
			return { ok: false as const, code: "INVALID_STATUS" };
		if (this.connectedPlayers(room).length < 2)
			return { ok: false as const, code: "NOT_ENOUGH_PLAYERS" };

		return this.beginCountdown(room, ROOM_STATUS.FINAL);
	}

	disconnectPlayer(input: { roomId: string; playerId: string }) {
		const room = this.roomsById.get(input.roomId);
		if (!room) return { ok: false as const, code: "ROOM_NOT_FOUND" };
		const player = room.playersById.get(input.playerId);
		if (!player) return { ok: false as const, code: "PLAYER_NOT_FOUND" };
		player.connected = false;
		if (room.status === ROOM_STATUS.COUNTDOWN) this.cancelCountdown(room);
		return { ok: true as const, roomState: serializeRoom(room) };
	}

	private beginCountdown(
		room: RoomState,
		sourceStatus: typeof ROOM_STATUS.LOBBY | typeof ROOM_STATUS.FINAL,
	) {
		this.clearRoomTimers(room);
		room.status = ROOM_STATUS.COUNTDOWN;
		room.countdownSourceStatus = sourceStatus;
		room.countdownStartsAtMs = this.now() + 3_000;
		const version = ++room.countdownVersion;
		this.scheduleCountdownTimer(room, version);
		return {
			ok: true as const,
			startsAtMs: room.countdownStartsAtMs,
			roomState: serializeRoom(room),
		};
	}

	private scheduleCountdownTimer(room: RoomState, version: number): void {
		const remainingMs = Math.max(0, room.countdownStartsAtMs - this.now());
		room.countdownTimerId = this.setTimer(() => {
			if (
				this.roomsById.get(room.roomId) !== room ||
				room.status !== ROOM_STATUS.COUNTDOWN ||
				room.countdownVersion !== version
			)
				return;
			if (this.now() < room.countdownStartsAtMs) {
				this.scheduleCountdownTimer(room, version);
				return;
			}

			const sourceStatus = room.countdownSourceStatus;
			const canStart =
				sourceStatus !== undefined &&
				this.isConnectedPlayer(room, room.hostId) &&
				this.connectedPlayers(room).length >= 2;
			if (!canStart) {
				this.cancelCountdown(room);
				this.onCountdownTimeout?.({ room, started: false, resetScores: false });
				return;
			}

			const resetScores = sourceStatus === ROOM_STATUS.FINAL;
			this.clearCountdownTimer(room);
			if (resetScores) this.resetForRematch(room);
			this.startRound(room);
			this.onCountdownTimeout?.({ room, started: true, resetScores });
		}, remainingMs);
	}

	private resetForRematch(room: RoomState): void {
		room.currentRound = 0;
		room.roundStartMs = 0;
		room.roundDeadlineMs = 0;
		room.targetsByRoundPlayer.clear();
		room.claimedTargetsByRound.clear();
		room.acceptedPlayersByRound.clear();
		room.scoreDeltaByRoundPlayer.clear();
		room.claimAcksByKey.clear();
		room.rankingVersion = 0;
		for (const player of room.players) {
			player.totalScore = 0;
			player.lastAcceptedAtMs = null;
		}
	}

	private startRound(room: RoomState) {
		room.status = ROOM_STATUS.ROUND_ACTIVE;
		room.countdownStartsAtMs = 0;
		room.countdownSourceStatus = undefined;
		room.currentRound += 1;
		room.roundStartMs = this.now();
		room.roundDeadlineMs = room.roundStartMs + room.config.roundDurationMs;
		room.claimedTargetsByRound.set(room.currentRound, new Set());
		room.acceptedPlayersByRound.set(room.currentRound, new Set());
		room.claimAcksByKey.clear();

		this.connectedPlayers(room).forEach((player, index) => {
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

	abortRoom(input: {
		roomId: string;
		actorPlayerId: string;
	}): AbortRoomResult {
		const room = this.roomsById.get(input.roomId);
		if (!room) return { ok: false, code: "ROOM_NOT_FOUND" };
		if (room.hostId !== input.actorPlayerId)
			return { ok: false, code: "NOT_HOST" };
		if (
			room.status !== ROOM_STATUS.COUNTDOWN &&
			room.status !== ROOM_STATUS.ROUND_ACTIVE &&
			room.status !== ROOM_STATUS.FINAL
		)
			return { ok: false, code: "ROOM_NOT_ACTIVE" };

		this.clearRoomTimers(room);
		this.roomsById.delete(room.roomId);
		return { ok: true, reason: "HOST_LEFT" };
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

		this.clearRoundTimer(room);

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

	getGameCountdownEvent(room: RoomState) {
		if (room.status !== ROOM_STATUS.COUNTDOWN || !room.countdownStartsAtMs)
			throw new Error("Room is not counting down");
		return {
			type: "GAME_COUNTDOWN" as const,
			startsAtMs: room.countdownStartsAtMs,
		};
	}

	getRoundStartedEvents(room: RoomState) {
		return this.connectedPlayers(room).map((player) => {
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

	private connectedPlayers(room: RoomState): PlayerState[] {
		return room.players.filter((player) => player.connected);
	}

	private isConnectedPlayer(room: RoomState, playerId: string): boolean {
		return room.playersById.get(playerId)?.connected === true;
	}

	private cancelCountdown(room: RoomState): void {
		this.clearCountdownTimer(room);
		room.status = room.countdownSourceStatus ?? ROOM_STATUS.LOBBY;
		room.countdownSourceStatus = undefined;
		room.countdownStartsAtMs = 0;
	}

	private clearCountdownTimer(room: RoomState): void {
		if (room.countdownTimerId !== undefined) {
			this.clearTimer(room.countdownTimerId);
			room.countdownTimerId = undefined;
		}
		room.countdownVersion += 1;
	}

	private clearRoundTimer(room: RoomState): void {
		if (room.roundTimerId === undefined) return;
		this.clearTimer(room.roundTimerId);
		room.roundTimerId = undefined;
	}

	private clearRoomTimers(room: RoomState): void {
		this.clearCountdownTimer(room);
		this.clearRoundTimer(room);
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
