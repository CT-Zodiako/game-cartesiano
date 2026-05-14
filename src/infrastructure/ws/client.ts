import type {
  C2SCreateRoom,
  C2SJoinRoom,
  C2SStartGame,
  C2SSubmitClaim,
  S2CEvent,
  RoomState,
  RankingEntry,
  RoundStartedEvent,
  ClaimAckEvent,
  LateAlertEvent,
  RankingUpdatedEvent,
} from './events.ts';

export type WsEventHandler = (event: S2CEvent) => void;

export class WSClient {
  private ws: WebSocket | null = null;
  private reqSeq = 0;
  private handlers: Map<string, WsEventHandler> = new Map();

  connect(wsUrl: string): void {
    this.ws = new WebSocket(wsUrl);

    this.ws.addEventListener('open', () => {
      this.emit('connected', { type: 'connected' } as S2CEvent);
    });

    this.ws.addEventListener('message', (raw: MessageEvent) => {
      try {
        const event = JSON.parse(raw.data) as S2CEvent;
        this.emit(event.type, event);
      } catch {
        // ignore malformed
      }
    });

    this.ws.addEventListener('close', () => {
      this.emit('disconnected', { type: 'disconnected' } as S2CEvent);
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

  private emit(eventType: string, event: S2CEvent): void {
    const handler = this.handlers.get(eventType);
    if (handler) handler(event);
  }

  private send(type: string, payload: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type, reqId: `c-${++this.reqSeq}`, ...payload }));
  }

  createRoom(playerName: string, config?: { maxPlayers?: number; rounds?: number; roundDurationMs?: number; maxX?: number; maxY?: number }): void {
    this.send('CREATE_ROOM', { playerName, config: config ?? {} });
  }

  joinRoom(playerName: string, roomCode: string): void {
    this.send('JOIN_ROOM', { playerName, roomCode });
  }

  startGame(roomId: string): void {
    this.send('START_GAME', { roomId });
  }

  submitClaim(roomId: string, roundId: number, playerId: string, target: { x: number; y: number }): void {
    this.send('SUBMIT_CLAIM', {
      roomId,
      roundId,
      playerId,
      target,
      sentAtClientMs: Date.now(),
    });
  }

  ping(): void {
    this.send('PING', {});
  }
}

// ── Convenience handlers (UI-layer helpers) ────────────────────────────────

export function handleRoomSnapshot(ws: WSClient, cb: (roomState: RoomState) => void): void {
  ws.on('ROOM_SNAPSHOT', (event) => {
    cb((event as { roomState: RoomState }).roomState);
  });
}

export function handleRoundStarted(ws: WSClient, cb: (event: RoundStartedEvent) => void): void {
  ws.on('ROUND_STARTED', (event) => cb(event as RoundStartedEvent));
}

export function handleClaimAck(ws: WSClient, cb: (event: ClaimAckEvent) => void): void {
  ws.on('CLAIM_ACK', (event) => cb(event as ClaimAckEvent));
}

export function handleLateAlert(ws: WSClient, cb: (event: LateAlertEvent) => void): void {
  ws.on('LATE_ALERT', (event) => cb(event as LateAlertEvent));
}

export function handleRankingUpdated(ws: WSClient, cb: (ranking: RankingEntry[]) => void): void {
  ws.on('RANKING_UPDATED', (event) => {
    cb((event as RankingUpdatedEvent).ranking);
  });
}

export function handleError(ws: WSClient, cb: (code: string, message: string) => void): void {
  ws.on('ERROR', (event) => {
    const e = event as { code: string; message: string };
    cb(e.code, e.message);
  });
}

export function handleGameEnded(ws: WSClient, cb: (event: GameEndedEvent) => void): void {
  ws.on('GAME_ENDED', (event) => cb(event as GameEndedEvent));
}
