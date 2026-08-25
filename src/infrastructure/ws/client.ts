import type {
	S2CEvent,
	RoomState,
	RankingEntry,
	GameCountdownEvent,
	RoundStartedEvent,
	ClaimAckEvent,
	LateAlertEvent,
	GameEndedEvent,
	RoomClosedEvent,
} from "./events.ts";

type ConnectionEventType =
	| "connecting"
	| "reconnecting"
	| "connected"
	| "disconnected";
type SyntheticEvent = { type: ConnectionEventType };
type WsClientEvent = S2CEvent | SyntheticEvent;

export type WsEventHandler = (event: WsClientEvent) => void;

const S2C_EVENT_TYPES = new Set<string>([
	"ROOM_SNAPSHOT",
	"GAME_COUNTDOWN",
	"ROUND_STARTED",
	"CLAIM_ACK",
	"LATE_ALERT",
	"RANKING_UPDATED",
	"ROUND_ENDED",
	"GAME_ENDED",
	"ROOM_CLOSED",
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
	private wsUrl: string | null = null;
	private reqSeq = 0;
	private reconnectAttempts = 0;
	private manuallyDisconnected = false;
	private pendingLobbyMessage: string | null = null;
	private handlers: Map<string, WsEventHandler> = new Map();

	connect(wsUrl: string): void {
		this.wsUrl = wsUrl;
		this.manuallyDisconnected = false;
		this.reconnectAttempts = 0;
		this.openConnection("connecting");
	}

	disconnect(): void {
		this.manuallyDisconnected = true;
		this.pendingLobbyMessage = null;
		this.ws?.close();
		this.ws = null;
	}

	private openConnection(status: "connecting" | "reconnecting"): void {
		if (!this.wsUrl) return;
		const socket = new WebSocket(this.wsUrl);
		this.ws = socket;
		this.emit(status, { type: status });

		socket.addEventListener("open", () => {
			if (this.ws !== socket) return;
			this.reconnectAttempts = 0;
			this.emit("connected", { type: "connected" });
			this.flushPendingLobbyMessages();
		});

		socket.addEventListener("message", (raw: MessageEvent) => {
			try {
				const event: unknown = JSON.parse(String(raw.data));
				if (isS2CEvent(event)) this.emit(event.type, event);
			} catch {
				// ignore malformed
			}
		});

		socket.addEventListener("close", () => {
			if (this.ws !== socket) return;
			this.ws = null;
			if (!this.manuallyDisconnected && this.reconnectAttempts < 1) {
				this.reconnectAttempts += 1;
				this.openConnection("reconnecting");
				return;
			}
			this.emit("disconnected", { type: "disconnected" });
		});
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

	private message(type: string, payload: Record<string, unknown>): string {
		return JSON.stringify({ type, reqId: `c-${++this.reqSeq}`, ...payload });
	}

	private send(type: string, payload: Record<string, unknown>): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
		this.ws.send(this.message(type, payload));
	}

	private sendLobby(type: "CREATE_ROOM" | "JOIN_ROOM", payload: Record<string, unknown>): void {
		const message = this.message(type, payload);
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(message);
			return;
		}
		this.pendingLobbyMessage = message;
		if (!this.ws) {
			this.reconnectAttempts = 0;
			this.openConnection("connecting");
		}
	}

	private flushPendingLobbyMessages(): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
		const message = this.pendingLobbyMessage;
		this.pendingLobbyMessage = null;
		if (message) this.ws.send(message);
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
		this.sendLobby("CREATE_ROOM", { playerName, config: config ?? {} });
	}

	joinRoom(playerName: string, roomCode: string): void {
		this.sendLobby("JOIN_ROOM", { playerName, roomCode });
	}

	startGame(roomId: string): void {
		this.send("START_GAME", { roomId });
	}

	startRematch(roomId: string): void {
		this.send("START_REMATCH", { roomId });
	}

	leaveRoom(roomId: string): void {
		this.send("LEAVE_ROOM", { roomId });
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

export function handleGameCountdown(
	ws: WSClient,
	cb: (event: GameCountdownEvent) => void,
): void {
	ws.on("GAME_COUNTDOWN", (event) => {
		if (event.type === "GAME_COUNTDOWN") cb(event);
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

export function handleRoomClosed(
	ws: WSClient,
	cb: (event: RoomClosedEvent) => void,
): void {
	ws.on("ROOM_CLOSED", (event) => {
		if (event.type === "ROOM_CLOSED") cb(event);
	});
}
