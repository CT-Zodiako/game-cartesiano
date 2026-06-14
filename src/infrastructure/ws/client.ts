import type {
	S2CEvent,
	RoomState,
	RankingEntry,
	RoundStartedEvent,
	ClaimAckEvent,
	LateAlertEvent,
	GameEndedEvent,
} from "./events.ts";

type SyntheticEvent = { type: "connected" | "disconnected" };
type WsClientEvent = S2CEvent | SyntheticEvent;

export type WsEventHandler = (event: WsClientEvent) => void;

const S2C_EVENT_TYPES = new Set<string>([
	"ROOM_SNAPSHOT",
	"ROUND_STARTED",
	"CLAIM_ACK",
	"LATE_ALERT",
	"RANKING_UPDATED",
	"ROUND_ENDED",
	"GAME_ENDED",
	"ERROR",
	"PONG",
]);

function isS2CEvent(value: unknown): value is S2CEvent {
	return (
		typeof value === "object" &&
		value !== null &&
		"type" in value &&
		typeof value.type === "string" &&
		S2C_EVENT_TYPES.has(value.type)
	);
}

export class WSClient {
	private ws: WebSocket | null = null;
	private reqSeq = 0;
	private handlers: Map<string, WsEventHandler> = new Map();

	connect(wsUrl: string): void {
		this.ws = new WebSocket(wsUrl);

		this.ws.addEventListener("open", () => {
			this.emit("connected", { type: "connected" });
		});

		this.ws.addEventListener("message", (raw: MessageEvent) => {
			try {
				const event: unknown = JSON.parse(String(raw.data));
				if (isS2CEvent(event)) this.emit(event.type, event);
			} catch {
				// ignore malformed
			}
		});

		this.ws.addEventListener("close", () => {
			this.emit("disconnected", { type: "disconnected" });
		});
	}

	disconnect(): void {
		this.ws?.close();
		this.ws = null;
	}

	get isConnected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN;
	}

	on(eventType: string, handler: WsEventHandler): void {
		this.handlers.set(eventType, handler);
	}

	off(eventType: string): void {
		this.handlers.delete(eventType);
	}

	private emit(eventType: string, event: WsClientEvent): void {
		const handler = this.handlers.get(eventType);
		if (handler) handler(event);
	}

	private send(type: string, payload: Record<string, unknown>): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
		this.ws.send(
			JSON.stringify({ type, reqId: `c-${++this.reqSeq}`, ...payload }),
		);
	}

	createRoom(
		playerName: string,
		config?: {
			maxPlayers?: number;
			rounds?: number;
			roundDurationMs?: number;
			maxX?: number;
			maxY?: number;
		},
	): void {
		this.send("CREATE_ROOM", { playerName, config: config ?? {} });
	}

	joinRoom(playerName: string, roomCode: string): void {
		this.send("JOIN_ROOM", { playerName, roomCode });
	}

	startGame(roomId: string): void {
		this.send("START_GAME", { roomId });
	}

	submitClaim(
		roomId: string,
		roundId: number,
		playerId: string,
		target: { x: number; y: number },
	): void {
		this.send("SUBMIT_CLAIM", {
			roomId,
			roundId,
			playerId,
			target,
			sentAtClientMs: Date.now(),
		});
	}

	ping(): void {
		this.send("PING", {});
	}
}

// ── Convenience handlers (UI-layer helpers) ────────────────────────────────

export function handleRoomSnapshot(
	ws: WSClient,
	cb: (roomState: RoomState, yourPlayerId?: string) => void,
): void {
	ws.on("ROOM_SNAPSHOT", (event) => {
		if (event.type === "ROOM_SNAPSHOT") cb(event.roomState, event.yourPlayerId);
	});
}

export function handleRoundStarted(
	ws: WSClient,
	cb: (event: RoundStartedEvent) => void,
): void {
	ws.on("ROUND_STARTED", (event) => {
		if (event.type === "ROUND_STARTED") cb(event);
	});
}

export function handleClaimAck(
	ws: WSClient,
	cb: (event: ClaimAckEvent) => void,
): void {
	ws.on("CLAIM_ACK", (event) => {
		if (event.type === "CLAIM_ACK") cb(event);
	});
}

export function handleLateAlert(
	ws: WSClient,
	cb: (event: LateAlertEvent) => void,
): void {
	ws.on("LATE_ALERT", (event) => {
		if (event.type === "LATE_ALERT") cb(event);
	});
}

export function handleRankingUpdated(
	ws: WSClient,
	cb: (ranking: RankingEntry[]) => void,
): void {
	ws.on("RANKING_UPDATED", (event) => {
		if (event.type === "RANKING_UPDATED") cb(event.ranking);
	});
}

export function handleError(
	ws: WSClient,
	cb: (code: string, message: string) => void,
): void {
	ws.on("ERROR", (event) => {
		if (event.type === "ERROR") cb(event.code, event.message);
	});
}

export function handleGameEnded(
	ws: WSClient,
	cb: (event: GameEndedEvent) => void,
): void {
	ws.on("GAME_ENDED", (event) => {
		if (event.type === "GAME_ENDED") cb(event);
	});
}
