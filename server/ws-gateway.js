import { createErrorEvent, validateC2SEvent } from './protocol-v1.js';
import { RoomEngine } from './room-engine.js';
import { AuditLog } from './audit-log.js';

export class WsGateway {
  constructor({ roomEngine, now = () => Date.now(), auditLog = new AuditLog() } = {}) {
    this.now = now;
    this.auditLog = auditLog;
    this.roomEngine = roomEngine ?? new RoomEngine({ onRoundTransition: (event) => this.handleRoundTransition(event) });
    this.roomEngine.onRoundTransition = (event) => this.handleRoundTransition(event);
    this.connectionSeq = 0;
    this.sessions = new Map();
  }

  handleRoundTransition({ roomId, outcome }) {
    if (!outcome?.ok) return;

    this.broadcastToRoom(roomId, () => ({
      type: 'ROUND_ENDED',
      reqId: `sys-round-ended-${Date.now()}`,
      eventId: `evt-${Date.now()}`,
      serverTsMs: this.now(),
      roundId: outcome.endedRoundId,
      results: outcome.roundResults,
    }));

    if (outcome.ended) {
      this.broadcastToRoom(roomId, () => ({
        type: 'GAME_ENDED',
        reqId: `sys-game-ended-${Date.now()}`,
        eventId: `evt-${Date.now()}`,
        serverTsMs: this.now(),
        finalRanking: outcome.ranking,
      }));
      return;
    }

    this.broadcastToRoom(roomId, (targetSession) => ({
      type: 'ROUND_STARTED',
      reqId: `sys-next-round-${Date.now()}`,
      eventId: `evt-${Date.now()}`,
      serverTsMs: this.now(),
      roundId: outcome.state.currentRound,
      deadlineMs: outcome.state.roundDeadlineMs,
      target: this.roomEngine.getPlayerTarget({
        roomId,
        roundId: outcome.state.currentRound,
        playerId: targetSession.playerId,
      }),
    }));
  }

  broadcastToRoom(roomId, eventFactory) {
    if (!roomId) return;
    this.sessions.forEach((session) => {
      if (session.roomId !== roomId) return;
      session.send(eventFactory(session));
    });
  }

  connect({ send }) {
    const sessionId = `s-${++this.connectionSeq}`;
    this.sessions.set(sessionId, {
      sessionId,
      send,
      wsConnectionSeq: this.connectionSeq,
      roomId: null,
      playerId: null,
    });
    return {
      sessionId,
      receive: (payload) => this.onMessage(sessionId, payload),
      close: () => this.sessions.delete(sessionId),
    };
  }

  onMessage(sessionId, payload) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const validation = validateC2SEvent(payload);
    if (!validation.ok) {
      session.send(createErrorEvent(payload?.reqId, validation.error.code, validation.error.message));
      return;
    }
    const { event } = validation;

    if (event.type === 'PING') {
      session.send({ type: 'PONG', reqId: event.reqId, eventId: `evt-${Date.now()}`, serverTsMs: this.now() });
      return;
    }

    if (event.type === 'CREATE_ROOM') {
      const out = this.roomEngine.createRoom({ hostName: event.playerName.trim() });
      session.roomId = out.roomId;
      session.playerId = out.hostId;
      session.send({ type: 'ROOM_SNAPSHOT', reqId: event.reqId, eventId: `evt-${Date.now()}`, serverTsMs: this.now(), roomState: out.state });
      return;
    }

    if (event.type === 'JOIN_ROOM') {
      const out = this.roomEngine.joinRoom({ roomCode: event.roomCode, playerName: event.playerName.trim() });
      if (!out.ok) {
        session.send(createErrorEvent(event.reqId, out.code, out.code));
        return;
      }
      session.roomId = out.roomId;
      session.playerId = out.playerId;
      this.broadcastToRoom(out.roomId, (targetSession) => ({
        type: 'ROOM_SNAPSHOT',
        reqId: targetSession.sessionId === session.sessionId ? event.reqId : `sys-join-${Date.now()}`,
        eventId: `evt-${Date.now()}`,
        serverTsMs: this.now(),
        roomState: out.state,
      }));
      return;
    }

    if (event.type === 'START_GAME') {
      const out = this.roomEngine.startGame({ roomId: event.roomId, actorPlayerId: session.playerId });
      if (!out.ok) {
        session.send(createErrorEvent(event.reqId, out.code, out.code));
        return;
      }
      this.broadcastToRoom(out.state.roomId, (targetSession) => ({
        type: 'ROUND_STARTED',
        reqId: targetSession.sessionId === session.sessionId ? event.reqId : `sys-start-${Date.now()}`,
        eventId: `evt-${Date.now()}`,
        serverTsMs: this.now(),
        roundId: out.state.currentRound,
        deadlineMs: out.state.roundDeadlineMs,
        target: this.roomEngine.getPlayerTarget({
          roomId: out.state.roomId,
          roundId: out.state.currentRound,
          playerId: targetSession.playerId,
        }),
      }));
      return;
    }

    if (event.type === 'SUBMIT_CLAIM') {
      const decisionStartedAt = this.now();
      const out = this.roomEngine.submitClaim({
        roomId: event.roomId,
        roundId: event.roundId,
        playerId: event.playerId,
        target: event.target,
        serverReceivedAtMs: this.now(),
        wsConnectionSeq: session.wsConnectionSeq,
      });

      session.send({
        type: 'CLAIM_ACK',
        reqId: event.reqId,
        eventId: `evt-${Date.now()}`,
        serverTsMs: this.now(),
        status: out.ack.status,
        reason: out.ack.reason,
        scoreDelta: out.ack.scoreDelta,
      });

      if (out.lateAlert) {
        session.send({ type: 'LATE_ALERT', reqId: event.reqId, eventId: `evt-${Date.now()}`, serverTsMs: this.now(), ...out.lateAlert });
      }

      this.auditLog.recordClaimDecision({
        eventId: `evt-${Date.now()}`,
        roomId: event.roomId,
        roundId: event.roundId,
        playerId: event.playerId,
        reqId: event.reqId,
        serverReceivedAtMs: this.now(),
        decision: out.ack.status,
        reason: out.duplicate ? 'DUPLICATE' : out.ack.reason,
        scoreDelta: out.ack.scoreDelta,
        rankingVersion: out.rankingVersion ?? null,
        decisionMs: Math.max(0, this.now() - decisionStartedAt),
      });

      if (out.ok && out.ranking) {
        this.broadcastToRoom(event.roomId, () => ({
          type: 'RANKING_UPDATED',
          reqId: `sys-rank-${Date.now()}`,
          eventId: `evt-${Date.now()}`,
          serverTsMs: this.now(),
          rankingVersion: out.rankingVersion,
          ranking: out.ranking,
        }));
      }
    }
  }

  getAuditMetrics() {
    return this.auditLog.snapshotMetrics();
  }
}
