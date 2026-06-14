import {
	RoomEngine,
	type ClaimAck,
	type RoomState,
	type RoundTimeoutEvent,
} from "./room-engine.js";

interface Sender {
	send: (event: unknown) => void;
}

interface GatewayOptions {
	now: () => number;
	roomEngine?: RoomEngine;
}

interface ConnectionState {
	seq: number;
	sender: Sender;
	roomId?: string;
	playerId?: string;
}

interface AuditMetrics {
	claim_accept_total: number;
	claim_too_late_total: number;
	claim_duplicate_total: number;
	claim_decision_ms: { count: number; total: number; max: number };
}

type ClaimAckWire = Omit<ClaimAck, "reason"> & {
	reason: Exclude<ClaimAck["reason"], "OK"> | null;
};

let connectionSeq = 0;
let eventSeq = 0;

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function recordDecision(
	metrics: AuditMetrics,
	startedAt: number,
	finishedAt: number,
): void {
	const elapsed = Math.max(0, finishedAt - startedAt);
	metrics.claim_decision_ms.count += 1;
	metrics.claim_decision_ms.total += elapsed;
	metrics.claim_decision_ms.max = Math.max(
		metrics.claim_decision_ms.max,
		elapsed,
	);
}

export class WsGateway {
	readonly roomEngine: RoomEngine;
	private readonly now: () => number;
	private readonly connections = new Map<number, ConnectionState>();
	private readonly metrics: AuditMetrics = {
		claim_accept_total: 0,
		claim_too_late_total: 0,
		claim_duplicate_total: 0,
		claim_decision_ms: { count: 0, total: 0, max: 0 },
	};

	constructor(options: GatewayOptions) {
		this.now = options.now;
		this.roomEngine =
			options.roomEngine ??
			new RoomEngine({
				now: options.now,
				onRoundTimeout: (event) => this.handleRoundTimeout(event),
			});
	}

	connect(sender: Sender) {
		const state: ConnectionState = { seq: ++connectionSeq, sender };
		this.connections.set(state.seq, state);

		return {
			receive: (message: Record<string, unknown>) =>
				this.receive(state, message),
			close: () => this.connections.delete(state.seq),
		};
	}

	getAuditMetrics(): AuditMetrics {
		return {
			claim_accept_total: this.metrics.claim_accept_total,
			claim_too_late_total: this.metrics.claim_too_late_total,
			claim_duplicate_total: this.metrics.claim_duplicate_total,
			claim_decision_ms: { ...this.metrics.claim_decision_ms },
		};
	}

	private receive(
		state: ConnectionState,
		message: Record<string, unknown>,
	): void {
		switch (message.type) {
			case "PING":
				state.sender.send(
					this.withEnvelope({ type: "PONG", reqId: message.reqId }),
				);
				return;
			case "CREATE_ROOM":
				this.createRoom(state, message);
				return;
			case "JOIN_ROOM":
				this.joinRoom(state, message);
				return;
			case "START_GAME":
				this.startGame(state, message);
				return;
			case "SUBMIT_CLAIM":
				this.submitClaim(state, message);
				return;
			default:
				state.sender.send(this.error(message.reqId, "UNKNOWN_MESSAGE_TYPE"));
		}
	}

	private createRoom(
		state: ConnectionState,
		message: Record<string, unknown>,
	): void {
		if (!isNonEmptyString(message.playerName)) {
			state.sender.send(this.error(message.reqId, "INVALID_PLAYER_NAME"));
			return;
		}

		const created = this.roomEngine.createRoom({
			hostName: message.playerName,
			config: parseRoomConfig(message.config),
		});
		state.roomId = created.roomId;
		state.playerId = created.hostId;
		state.sender.send(
			this.withEnvelope({
				type: "ROOM_SNAPSHOT",
				reqId: message.reqId,
				roomState: created.roomState,
				yourPlayerId: created.hostId,
			}),
		);
	}

	private joinRoom(
		state: ConnectionState,
		message: Record<string, unknown>,
	): void {
		if (
			!isNonEmptyString(message.roomCode) ||
			!isNonEmptyString(message.playerName)
		) {
			state.sender.send(this.error(message.reqId, "INVALID_JOIN"));
			return;
		}

		const joined = this.roomEngine.joinRoom({
			roomCode: message.roomCode,
			playerName: message.playerName,
		});
		if (!joined.ok) {
			state.sender.send(this.error(message.reqId, joined.code));
			return;
		}

		state.roomId = joined.roomId;
		state.playerId = joined.playerId;
		this.broadcast(joined.roomId, (connection) =>
			this.withEnvelope({
				type: "ROOM_SNAPSHOT",
				reqId: message.reqId,
				roomState: joined.roomState,
				yourPlayerId: connection.playerId,
			}),
		);
	}

	private startGame(
		state: ConnectionState,
		message: Record<string, unknown>,
	): void {
		if (!isNonEmptyString(message.roomId) || !state.playerId) {
			state.sender.send(this.error(message.reqId, "INVALID_START"));
			return;
		}

		const started = this.roomEngine.startGame({
			roomId: message.roomId,
			actorPlayerId: state.playerId,
		});
		if (!started.ok) {
			state.sender.send(this.error(message.reqId, started.code));
			return;
		}

		const room = this.roomEngine.roomsById.get(message.roomId);
		if (room) this.broadcastRoundStarted(room);
	}

	private submitClaim(
		state: ConnectionState,
		message: Record<string, unknown>,
	): void {
		const startedAt = this.now();
		if (
			!isNonEmptyString(message.roomId) ||
			typeof message.roundId !== "number" ||
			!isPoint(message.target)
		) {
			state.sender.send(this.error(message.reqId, "INVALID_CLAIM"));
			return;
		}

		if (!state.playerId) {
			state.sender.send(this.error(message.reqId, "INVALID_PLAYER"));
			return;
		}

		const result = this.roomEngine.submitClaim({
			roomId: message.roomId,
			roundId: message.roundId,
			playerId: state.playerId,
			target: message.target,
			serverReceivedAtMs: this.now(),
			wsConnectionSeq: state.seq,
		});

		if ("duplicate" in result && result.duplicate)
			this.metrics.claim_duplicate_total += 1;
		this.recordClaimMetrics(result.ack);
		recordDecision(this.metrics, startedAt, this.now());

		state.sender.send(
			this.withEnvelope({
				reqId: message.reqId,
				...this.toClaimAckWire(result.ack),
			}),
		);

		const room = this.roomEngine.roomsById.get(message.roomId);
		if (result.ok && room) {
			this.broadcast(message.roomId, () =>
				this.withEnvelope({
					type: "RANKING_UPDATED",
					reqId: message.reqId,
					ranking: this.roomEngine.getRanking(room),
					rankingVersion: room.rankingVersion,
				}),
			);
		}
	}

	private broadcastRoundStarted(room: RoomState): void {
		const eventsByPlayer = new Map(
			this.roomEngine
				.getRoundStartedEvents(room)
				.map(({ playerId, event }) => [playerId, event]),
		);
		this.broadcast(room.roomId, (connection) =>
			this.withEnvelope({
				reqId: "",
				...(eventsByPlayer.get(connection.playerId ?? "") ?? {
					type: "ROUND_STARTED",
					roundId: room.currentRound,
				}),
			}),
		);
	}

	private handleRoundTimeout(event: RoundTimeoutEvent): void {
		const { room, closingRoundId, result } = event;
		if (!result.ok) return;

		const results =
			"results" in result && result.results
				? result.results
				: this.roomEngine.getRoundResults(room, closingRoundId);
		this.broadcast(room.roomId, () =>
			this.withEnvelope({
				type: "ROUND_ENDED",
				reqId: "",
				roundId: closingRoundId,
				results,
			}),
		);
		if (result.ended) {
			this.broadcast(room.roomId, () =>
				this.withEnvelope({
					type: "GAME_ENDED",
					reqId: "",
					finalRanking: this.roomEngine.getRanking(room),
				}),
			);
		} else {
			this.broadcastRoundStarted(room);
		}
	}

	private broadcast(
		roomId: string,
		eventFactory: (connection: ConnectionState) => unknown,
	): void {
		for (const connection of this.connections.values()) {
			if (connection.roomId === roomId)
				connection.sender.send(eventFactory(connection));
		}
	}

	private recordClaimMetrics(ack: ClaimAck): void {
		if (ack.status === "ACCEPTED") this.metrics.claim_accept_total += 1;
		if (ack.reason === "TOO_LATE") this.metrics.claim_too_late_total += 1;
	}

	private toClaimAckWire(ack: ClaimAck): ClaimAckWire {
		return { ...ack, reason: ack.reason === "OK" ? null : ack.reason };
	}

	private withEnvelope<T extends Record<string, unknown>>(
		event: T,
	): T & { reqId: string; eventId: string; serverTsMs: number } {
		return {
			...event,
			reqId: typeof event.reqId === "string" ? event.reqId : "",
			eventId: `evt-${++eventSeq}`,
			serverTsMs: this.now(),
		};
	}

	private error(reqId: unknown, code: string) {
		return this.withEnvelope({ type: "ERROR", reqId, code, message: code });
	}
}

function isPoint(value: unknown): value is { x: number; y: number } {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as { x?: unknown }).x === "number" &&
		typeof (value as { y?: unknown }).y === "number"
	);
}

function parseRoomConfig(value: unknown) {
	if (typeof value !== "object" || value === null) return undefined;
	const config = value as Record<string, unknown>;
	return {
		maxPlayers:
			typeof config.maxPlayers === "number" ? config.maxPlayers : undefined,
		rounds: typeof config.rounds === "number" ? config.rounds : undefined,
		roundDurationMs:
			typeof config.roundDurationMs === "number"
				? config.roundDurationMs
				: undefined,
		maxX: typeof config.maxX === "number" ? config.maxX : undefined,
		maxY: typeof config.maxY === "number" ? config.maxY : undefined,
	};
}
