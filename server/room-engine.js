import { computeScoreFromServerTimes, ROUND_DURATION_MS } from './scoring.js';
import { bumpRankingVersion, computeRanking } from './ranking.js';

const ROOM_STATUS = {
  LOBBY: 'LOBBY',
  ROUND_ACTIVE: 'ROUND_ACTIVE',
  ROUND_RESULT: 'ROUND_RESULT',
  FINAL: 'FINAL',
};

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function randomTarget(maxX = 5, maxY = 5) {
  return { x: Math.floor(Math.random() * (maxX + 1)), y: Math.floor(Math.random() * (maxY + 1)) };
}

function keyFromTarget(target) {
  return `${target.x}:${target.y}`;
}

function claimIdempotencyKey(roomId, roundId, playerId) {
  return `${roomId}:${roundId}:${playerId}`;
}

export class RoomEngine {
  constructor({ now = () => Date.now(), setTimer = setTimeout, clearTimer = clearTimeout, onRoundTransition = () => {} } = {}) {
    this.now = now;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.roomsById = new Map();
    this.roomIdSeq = 1;
    this.playerIdSeq = 1;
    this.onRoundTransition = onRoundTransition;
  }

  createRoom({ hostName }) {
    const roomId = `room-${this.roomIdSeq++}`;
    const roomCode = randomCode();
    const hostId = `p-${this.playerIdSeq++}`;
    const room = {
      roomId,
      roomCode,
      hostId,
      status: ROOM_STATUS.LOBBY,
      currentRound: 0,
      roundStartMs: null,
      roundDeadlineMs: null,
      roundTimer: null,
      rankingVersion: 0,
      players: new Map(),
      targetsByRoundPlayer: new Map(),
      claimedTargets: new Set(),
      claimsByIdemKey: new Map(),
      acceptedClaimsInRound: new Set(),
      roundResults: new Map(),
    };
    room.players.set(hostId, {
      playerId: hostId,
      name: hostName,
      connected: true,
      totalScore: 0,
      lastAcceptedAtMs: null,
    });
    this.roomsById.set(roomId, room);
    return { roomId, roomCode, hostId, state: this.snapshotRoom(room) };
  }

  joinRoom({ roomCode, playerName }) {
    const room = Array.from(this.roomsById.values()).find((r) => r.roomCode === roomCode);
    if (!room) return { ok: false, code: 'ROOM_NOT_FOUND' };
    if (room.status !== ROOM_STATUS.LOBBY) return { ok: false, code: 'ROOM_IN_PROGRESS' };
    const playerId = `p-${this.playerIdSeq++}`;
    room.players.set(playerId, {
      playerId,
      name: playerName,
      connected: true,
      totalScore: 0,
      lastAcceptedAtMs: null,
    });
    return { ok: true, roomId: room.roomId, playerId, state: this.snapshotRoom(room) };
  }

  reconnectPlayer({ roomId, playerId }) {
    const room = this.roomsById.get(roomId);
    if (!room) return { ok: false, code: 'ROOM_NOT_FOUND' };
    const player = room.players.get(playerId);
    if (!player) return { ok: false, code: 'PLAYER_NOT_FOUND' };
    player.connected = true;
    return { ok: true, state: this.snapshotRoom(room), ranking: computeRanking(room.players) };
  }

  startGame({ roomId, actorPlayerId }) {
    const room = this.roomsById.get(roomId);
    if (!room) return { ok: false, code: 'ROOM_NOT_FOUND' };
    if (room.status !== ROOM_STATUS.LOBBY) return { ok: false, code: 'INVALID_STATE' };
    if (room.hostId !== actorPlayerId) return { ok: false, code: 'NOT_HOST' };
    if (room.players.size < 2) return { ok: false, code: 'NOT_ENOUGH_PLAYERS' };
    this.openRound(room, 1);
    return { ok: true, state: this.snapshotRoom(room) };
  }

  openRound(room, roundNumber) {
    room.status = ROOM_STATUS.ROUND_ACTIVE;
    room.currentRound = roundNumber;
    room.roundStartMs = this.now();
    room.roundDeadlineMs = room.roundStartMs + ROUND_DURATION_MS;
    room.claimedTargets = new Set();
    room.acceptedClaimsInRound = new Set();
    room.roundResults = new Map();
    room.targetsByRoundPlayer = new Map();
    room.players.forEach((p) => {
      room.targetsByRoundPlayer.set(`${room.currentRound}:${p.playerId}`, randomTarget());
    });

    if (room.roundTimer) this.clearTimer(room.roundTimer);
    room.roundTimer = this.setTimer(() => {
      this.closeRound(room.roomId, 'TIMEOUT');
    }, ROUND_DURATION_MS);
  }

  closeRound(roomId, reason = 'TIMEOUT') {
    const room = this.roomsById.get(roomId);
    if (!room) return { ok: false, code: 'ROOM_NOT_FOUND' };
    if (room.status !== ROOM_STATUS.ROUND_ACTIVE) {
      return { ok: false, code: 'ROUND_NOT_ACTIVE' };
    }
    room.status = ROOM_STATUS.ROUND_RESULT;
    const endedRoundId = room.currentRound;
    if (room.roundTimer) {
      this.clearTimer(room.roundTimer);
      room.roundTimer = null;
    }

    room.players.forEach((p) => {
      if (!room.roundResults.has(p.playerId)) {
        room.roundResults.set(p.playerId, { playerId: p.playerId, result: 'LOSS', scoreDelta: 0, reason });
      }
    });

    const roundResults = Array.from(room.roundResults.values());

    if (room.currentRound >= 3) {
      room.status = ROOM_STATUS.FINAL;
      const out = {
        ok: true,
        ended: true,
        endedRoundId,
        roundResults,
        state: this.snapshotRoom(room),
        ranking: computeRanking(room.players),
      };
      this.onRoundTransition({ roomId: room.roomId, reason, outcome: out });
      return out;
    }

    this.openRound(room, room.currentRound + 1);
    const out = {
      ok: true,
      ended: false,
      endedRoundId,
      roundResults,
      state: this.snapshotRoom(room),
      ranking: computeRanking(room.players),
    };
    this.onRoundTransition({ roomId: room.roomId, reason, outcome: out });
    return out;
  }

  submitClaim({ roomId, roundId, playerId, target, serverReceivedAtMs, wsConnectionSeq = 0 }) {
    const room = this.roomsById.get(roomId);
    if (!room) return { ok: false, ack: this.rejectAck('ROOM_NOT_FOUND') };
    if (room.status !== ROOM_STATUS.ROUND_ACTIVE) return { ok: false, ack: this.rejectAck('ROUND_CLOSED') };
    if (roundId !== room.currentRound) return { ok: false, ack: this.rejectAck('INVALID_ROUND') };
    if (!room.players.has(playerId)) return { ok: false, ack: this.rejectAck('PLAYER_NOT_IN_ROOM') };

    const idemKey = claimIdempotencyKey(roomId, roundId, playerId);
    if (room.claimsByIdemKey.has(idemKey)) {
      return { ok: true, duplicate: true, ack: room.claimsByIdemKey.get(idemKey) };
    }

    if (serverReceivedAtMs > room.roundDeadlineMs) {
      const ack = this.rejectAck('ROUND_TIMEOUT');
      room.claimsByIdemKey.set(idemKey, ack);
      return { ok: false, ack };
    }

    const expected = room.targetsByRoundPlayer.get(`${roundId}:${playerId}`);
    if (!expected || expected.x !== target.x || expected.y !== target.y) {
      const ack = this.rejectAck('WRONG_TARGET');
      room.claimsByIdemKey.set(idemKey, ack);
      return { ok: false, ack };
    }

    const targetKey = keyFromTarget(target);
    if (room.claimedTargets.has(targetKey)) {
      const ack = this.rejectAck('TOO_LATE');
      room.claimsByIdemKey.set(idemKey, ack);
      return {
        ok: false,
        ack,
        lateAlert: {
          code: 'TOO_LATE',
          message: 'Llegaste tarde: otro jugador reclamó primero.',
          roundId,
          playerId,
        },
      };
    }

    room.claimedTargets.add(targetKey);
    const delta = computeScoreFromServerTimes(room.roundStartMs, serverReceivedAtMs);
    const player = room.players.get(playerId);
    player.totalScore += delta;
    player.lastAcceptedAtMs = serverReceivedAtMs;
    room.acceptedClaimsInRound.add(playerId);
    room.roundResults.set(playerId, { playerId, result: 'WIN', scoreDelta: delta, wsConnectionSeq });

    const ack = {
      status: 'ACCEPTED',
      reason: null,
      scoreDelta: delta,
    };
    room.claimsByIdemKey.set(idemKey, ack);

    bumpRankingVersion(room);
    return {
      ok: true,
      ack,
      rankingVersion: room.rankingVersion,
      ranking: computeRanking(room.players),
    };
  }

  rejectAck(reason) {
    return { status: 'REJECTED', reason, scoreDelta: 0 };
  }

  snapshotRoom(room) {
    return {
      roomId: room.roomId,
      roomCode: room.roomCode,
      hostId: room.hostId,
      status: room.status,
      currentRound: room.currentRound,
      roundDeadlineMs: room.roundDeadlineMs,
      rankingVersion: room.rankingVersion,
      players: Array.from(room.players.values()).map((p) => ({
        playerId: p.playerId,
        name: p.name,
        connected: p.connected,
        totalScore: p.totalScore,
      })),
    };
  }

  getPlayerTarget({ roomId, roundId, playerId }) {
    const room = this.roomsById.get(roomId);
    if (!room) return null;
    return room.targetsByRoundPlayer.get(`${roundId}:${playerId}`) ?? null;
  }
}

export { ROOM_STATUS };
