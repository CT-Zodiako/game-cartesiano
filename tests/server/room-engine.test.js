import test from 'node:test';
import assert from 'node:assert/strict';

import { RoomEngine, ROOM_STATUS } from '../../server/room-engine.js';

function createFakeClock(start = 1_000) {
  let now = start;
  return {
    now: () => now,
    tick: (ms) => {
      now += ms;
      return now;
    },
  };
}

test('fsm start valid/invalid transitions', () => {
  const clock = createFakeClock();
  const engine = new RoomEngine({ now: clock.now, setTimer: () => 1, clearTimer: () => {} });

  const created = engine.createRoom({ hostName: 'Host' });
  const room = engine.roomsById.get(created.roomId);
  assert.equal(room.status, ROOM_STATUS.LOBBY);

  const invalid = engine.startGame({ roomId: created.roomId, actorPlayerId: created.hostId });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.code, 'NOT_ENOUGH_PLAYERS');

  const joined = engine.joinRoom({ roomCode: created.roomCode, playerName: 'P2' });
  assert.equal(joined.ok, true);

  const started = engine.startGame({ roomId: created.roomId, actorPlayerId: created.hostId });
  assert.equal(started.ok, true);
  assert.equal(room.status, ROOM_STATUS.ROUND_ACTIVE);
  assert.equal(room.currentRound, 1);
});

test('late join is rejected after game start', () => {
  const engine = new RoomEngine({ now: () => 1_000, setTimer: () => 1, clearTimer: () => {} });
  const created = engine.createRoom({ hostName: 'Host' });
  engine.joinRoom({ roomCode: created.roomCode, playerName: 'P2' });
  engine.startGame({ roomId: created.roomId, actorPlayerId: created.hostId });
  const lateJoin = engine.joinRoom({ roomCode: created.roomCode, playerName: 'P3' });
  assert.equal(lateJoin.ok, false);
  assert.equal(lateJoin.code, 'ROOM_IN_PROGRESS');
});

test('idempotent claim returns same ack', () => {
  const clock = createFakeClock();
  const engine = new RoomEngine({ now: clock.now, setTimer: () => 1, clearTimer: () => {} });
  const created = engine.createRoom({ hostName: 'Host' });
  const joined = engine.joinRoom({ roomCode: created.roomCode, playerName: 'P2' });
  engine.startGame({ roomId: created.roomId, actorPlayerId: created.hostId });

  const room = engine.roomsById.get(created.roomId);
  const playerId = joined.playerId;
  const roundId = room.currentRound;
  const target = room.targetsByRoundPlayer.get(`${roundId}:${playerId}`);

  const first = engine.submitClaim({ roomId: created.roomId, roundId, playerId, target, serverReceivedAtMs: clock.now(), wsConnectionSeq: 2 });
  const second = engine.submitClaim({ roomId: created.roomId, roundId, playerId, target, serverReceivedAtMs: clock.now(), wsConnectionSeq: 2 });
  assert.equal(first.ok, true);
  assert.equal(second.duplicate, true);
  assert.deepEqual(second.ack, first.ack);
});

test('collision first valid claimant wins and second gets TOO_LATE', () => {
  const clock = createFakeClock();
  const engine = new RoomEngine({ now: clock.now, setTimer: () => 1, clearTimer: () => {} });
  const created = engine.createRoom({ hostName: 'Host' });
  const joined = engine.joinRoom({ roomCode: created.roomCode, playerName: 'P2' });
  engine.startGame({ roomId: created.roomId, actorPlayerId: created.hostId });

  const room = engine.roomsById.get(created.roomId);
  const roundId = room.currentRound;
  const sharedTarget = room.targetsByRoundPlayer.get(`${roundId}:${created.hostId}`);
  room.targetsByRoundPlayer.set(`${roundId}:${joined.playerId}`, sharedTarget);

  const first = engine.submitClaim({
    roomId: created.roomId,
    roundId,
    playerId: created.hostId,
    target: sharedTarget,
    serverReceivedAtMs: clock.now(),
    wsConnectionSeq: 1,
  });

  clock.tick(1);

  const second = engine.submitClaim({
    roomId: created.roomId,
    roundId,
    playerId: joined.playerId,
    target: sharedTarget,
    serverReceivedAtMs: clock.now(),
    wsConnectionSeq: 2,
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(second.ack.reason, 'TOO_LATE');
  assert.equal(second.lateAlert.code, 'TOO_LATE');
});

test('3 rounds timeout sequence ends game in FINAL', () => {
  const engine = new RoomEngine({ now: () => 1_000, setTimer: () => 1, clearTimer: () => {} });
  const created = engine.createRoom({ hostName: 'Host' });
  engine.joinRoom({ roomCode: created.roomCode, playerName: 'P2' });
  engine.startGame({ roomId: created.roomId, actorPlayerId: created.hostId });

  let out = engine.closeRound(created.roomId, 'TIMEOUT');
  assert.equal(out.ok, true);
  assert.equal(out.ended, false);

  out = engine.closeRound(created.roomId, 'TIMEOUT');
  assert.equal(out.ok, true);
  assert.equal(out.ended, false);

  out = engine.closeRound(created.roomId, 'TIMEOUT');
  assert.equal(out.ok, true);
  assert.equal(out.ended, true);

  const room = engine.roomsById.get(created.roomId);
  assert.equal(room.status, ROOM_STATUS.FINAL);
});
