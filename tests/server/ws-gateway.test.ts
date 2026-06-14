import test from 'node:test';
import assert from 'node:assert/strict';

import { WsGateway } from '../../server/ws-gateway.js';

function createFakeTimers(nowStart = 1_000) {
  let now = nowStart;
  let timerSeq = 0;
  const timers = new Map<string, { cb: () => void; dueAt: number; cancelled: boolean }>();

  return {
    now: () => now,
    setTimer: (cb: () => void, delay: number) => {
      const id = `t-${++timerSeq}`;
      timers.set(id, { cb, dueAt: now + delay, cancelled: false });
      return id;
    },
    clearTimer: (id: string) => {
      const timer = timers.get(id);
      if (timer) timer.cancelled = true;
    },
    tick: (ms: number) => {
      now += ms;
      for (const [id, timer] of timers.entries()) {
        if (timer.cancelled) continue;
        if (timer.dueAt <= now) {
          timer.cancelled = true;
          timer.cb();
        }
        if (timer.cancelled) timers.delete(id);
      }
    },
  };
}

test('invalid payload returns typed ERROR', () => {
  const sent: unknown[] = [];
  const gateway = new WsGateway({ now: () => 1_000 });
  const conn = gateway.connect({ send: (e: unknown) => sent.push(e) });

  conn.receive({ type: 'CREATE_ROOM', reqId: '1' });

  assert.equal(sent.length, 1);
  assert.equal((sent[0] as { type: string }).type, 'ERROR');
  assert.equal((sent[0] as { code: string }).code, 'INVALID_PLAYER_NAME');
});

test('ping responds pong', () => {
  const sent: unknown[] = [];
  const gateway = new WsGateway({ now: () => 1_000 });
  const conn = gateway.connect({ send: (e: unknown) => sent.push(e) });

  conn.receive({ type: 'PING', reqId: 'r-ping' });

  assert.equal(sent.length, 1);
  assert.equal((sent[0] as { type: string }).type, 'PONG');
  assert.equal((sent[0] as { reqId: string }).reqId, 'r-ping');
});

test('create/join/start flow and late-join reject in ROUND_ACTIVE', () => {
  const hostSent: unknown[] = [];
  const p2Sent: unknown[] = [];
  const gateway = new WsGateway({ now: () => 1_000 });

  const host = gateway.connect({ send: (e: unknown) => hostSent.push(e) });
  host.receive({ type: 'CREATE_ROOM', reqId: 'r1', playerName: 'Host' });
  const roomCode = (hostSent[0] as { roomState: { roomCode: string } }).roomState.roomCode;
  const roomId = (hostSent[0] as { roomState: { roomId: string } }).roomState.roomId;

  const p2 = gateway.connect({ send: (e: unknown) => p2Sent.push(e) });
  p2.receive({ type: 'JOIN_ROOM', reqId: 'r2', roomCode, playerName: 'P2' });
  assert.equal((p2Sent[0] as { type: string }).type, 'ROOM_SNAPSHOT');
  assert.equal((hostSent[1] as { type: string }).type, 'ROOM_SNAPSHOT');

  host.receive({ type: 'START_GAME', reqId: 'r3', roomId });
  assert.equal((hostSent[2] as { type: string }).type, 'ROUND_STARTED');
  assert.equal((p2Sent[1] as { type: string }).type, 'ROUND_STARTED');

  const p3Sent: unknown[] = [];
  const p3 = gateway.connect({ send: (e: unknown) => p3Sent.push(e) });
  p3.receive({ type: 'JOIN_ROOM', reqId: 'r4', roomCode, playerName: 'P3' });
  assert.equal((p3Sent[0] as { type: string }).type, 'ERROR');
  assert.equal((p3Sent[0] as { code: string }).code, 'ROOM_IN_PROGRESS');
});

test('accepted claim broadcasts ranking update to room peers', () => {
  const hostSent: unknown[] = [];
  const p2Sent: unknown[] = [];
  const gateway = new WsGateway({ now: () => 5_000 });

  const host = gateway.connect({ send: (e: unknown) => hostSent.push(e) });
  host.receive({ type: 'CREATE_ROOM', reqId: 'c1', playerName: 'Host' });
  const roomCode = (hostSent[0] as { roomState: { roomCode: string } }).roomState.roomCode;
  const roomId = (hostSent[0] as { roomState: { roomId: string } }).roomState.roomId;

  const p2 = gateway.connect({ send: (e: unknown) => p2Sent.push(e) });
  p2.receive({ type: 'JOIN_ROOM', reqId: 'c2', roomCode, playerName: 'P2' });

  host.receive({ type: 'START_GAME', reqId: 'c3', roomId });
  const hostRoundStarted = hostSent.find((e) => (e as { type: string }).type === 'ROUND_STARTED') as { roundId: number; target: { x: number; y: number } };

  host.receive({
    type: 'SUBMIT_CLAIM',
    reqId: 'c4',
    roomId,
    roundId: hostRoundStarted.roundId,
    playerId: (hostSent[0] as { roomState: { hostId: string } }).roomState.hostId,
    target: hostRoundStarted.target,
  });

  assert.equal(hostSent.some((e) => (e as { type: string }).type === 'RANKING_UPDATED'), true);
  assert.equal(p2Sent.some((e) => (e as { type: string }).type === 'RANKING_UPDATED'), true);
});

test('3-round lifecycle emits ROUND_ENDED, next ROUND_STARTED and GAME_ENDED', () => {
  const timers = createFakeTimers(10_000);
  const hostSent: unknown[] = [];
  const p2Sent: unknown[] = [];
  const gateway = new WsGateway({
    now: timers.now,
    roomEngine: undefined,
  });
  gateway.roomEngine.setTimer = timers.setTimer;
  gateway.roomEngine.clearTimer = timers.clearTimer;

  const host = gateway.connect({ send: (e: unknown) => hostSent.push(e) });
  host.receive({ type: 'CREATE_ROOM', reqId: 'l1', playerName: 'Host' });
  const roomCode = (hostSent[0] as { roomState: { roomCode: string } }).roomState.roomCode;
  const roomId = (hostSent[0] as { roomState: { roomId: string } }).roomState.roomId;

  const p2 = gateway.connect({ send: (e: unknown) => p2Sent.push(e) });
  p2.receive({ type: 'JOIN_ROOM', reqId: 'l2', roomCode, playerName: 'P2' });

  host.receive({ type: 'START_GAME', reqId: 'l3', roomId });

  timers.tick(20_000);
  timers.tick(20_000);
  timers.tick(20_000);

  const hostRoundEnded = hostSent.filter((e) => (e as { type: string }).type === 'ROUND_ENDED');
  const hostRoundStarted = hostSent.filter((e) => (e as { type: string }).type === 'ROUND_STARTED');
  const hostGameEnded = hostSent.filter((e) => (e as { type: string }).type === 'GAME_ENDED');

  assert.equal(hostRoundEnded.length, 3);
  assert.equal(hostRoundStarted.length, 3);
  assert.equal(hostGameEnded.length, 1);

  assert.equal(p2Sent.filter((e) => (e as { type: string }).type === 'ROUND_ENDED').length, 3);
  assert.equal(p2Sent.filter((e) => (e as { type: string }).type === 'GAME_ENDED').length, 1);
});

test('idempotency in gateway returns same CLAIM_ACK payload and records duplicate metric', () => {
  const hostSent: unknown[] = [];
  const p2Sent: unknown[] = [];
  const gateway = new WsGateway({ now: () => 20_000 });
  const host = gateway.connect({ send: (e: unknown) => hostSent.push(e) });
  gateway.connect({ send: (e: unknown) => p2Sent.push(e) });

  host.receive({ type: 'CREATE_ROOM', reqId: 'i1', playerName: 'Host' });
  const roomId = (hostSent[0] as { roomState: { roomId: string } }).roomState.roomId;
  gateway.connect({ send: () => {} }).receive({ type: 'JOIN_ROOM', reqId: 'i2', roomCode: (hostSent[0] as { roomState: { roomCode: string } }).roomState.roomCode, playerName: 'P2' });
  host.receive({ type: 'START_GAME', reqId: 'i3', roomId });

  const started = hostSent.find((e) => (e as { type: string }).type === 'ROUND_STARTED') as { roundId: number; target: { x: number; y: number } };
  const playerId = (hostSent[0] as { roomState: { hostId: string } }).roomState.hostId;
  const claim = {
    type: 'SUBMIT_CLAIM',
    roomId,
    roundId: started.roundId,
    playerId,
    target: started.target,
  };

  host.receive({ ...claim, reqId: 'i4' });
  host.receive({ ...claim, reqId: 'i5' });

  const acks = hostSent.filter((e) => (e as { type: string }).type === 'CLAIM_ACK') as { status: string; reason: string; scoreDelta: number }[];
  assert.equal(acks.length, 2);
  assert.equal(acks[0].status, 'ACCEPTED');
  assert.equal(acks[1].status, acks[0].status);
  assert.equal(acks[1].reason, acks[0].reason);
  assert.equal(acks[1].scoreDelta, acks[0].scoreDelta);

  const metrics = gateway.getAuditMetrics();
  assert.equal(metrics.claim_duplicate_total, 1);
});

test('concurrency stress: simultaneous collisions keep unique winner across repeated runs', () => {
  for (let i = 0; i < 20; i += 1) {
    const clock = { now: () => 30_000 + i };
    const gateway = new WsGateway({ now: clock.now });
    const hostSent: unknown[] = [];
    const p2Sent: unknown[] = [];

    const host = gateway.connect({ send: (e: unknown) => hostSent.push(e) });
    host.receive({ type: 'CREATE_ROOM', reqId: `s-${i}-1`, playerName: 'Host' });
    const roomCode = (hostSent[0] as { roomState: { roomCode: string } }).roomState.roomCode;
    const roomId = (hostSent[0] as { roomState: { roomId: string } }).roomState.roomId;

    const p2 = gateway.connect({ send: (e: unknown) => p2Sent.push(e) });
    p2.receive({ type: 'JOIN_ROOM', reqId: `s-${i}-2`, roomCode, playerName: 'P2' });
    host.receive({ type: 'START_GAME', reqId: `s-${i}-3`, roomId });

    const hostTarget = (hostSent.find((e) => (e as { type: string }).type === 'ROUND_STARTED') as { target: { x: number; y: number } }).target;
    const p2Snapshot = p2Sent.find((e) => (e as { type: string }).type === 'ROOM_SNAPSHOT') as { roomState: { players: { name: string; playerId: string }[] } };
    const p2PlayerId = p2Snapshot.roomState.players.find((p) => p.name === 'P2')?.playerId ?? '';
    const room = gateway.roomEngine.roomsById.get(roomId);
    room?.targetsByRoundPlayer.set(`1:${p2PlayerId}`, hostTarget);

    host.receive({
      type: 'SUBMIT_CLAIM',
      reqId: `s-${i}-4`,
      roomId,
      roundId: 1,
      playerId: (hostSent[0] as { roomState: { hostId: string } }).roomState.hostId,
      target: hostTarget,
    });

    p2.receive({
      type: 'SUBMIT_CLAIM',
      reqId: `s-${i}-5`,
      roomId,
      roundId: 1,
      playerId: p2PlayerId,
      target: hostTarget,
    });

    const ackHost = hostSent.find((e) => (e as { type: string }).type === 'CLAIM_ACK') as { status: string; reason: string };
    const ackP2 = p2Sent.find((e) => (e as { type: string }).type === 'CLAIM_ACK') as { status: string; reason: string };
    const acceptedCount = [ackHost, ackP2].filter((ack) => ack?.status === 'ACCEPTED').length;
    assert.equal(acceptedCount, 1);
    assert.equal([ackHost.reason, ackP2.reason].includes('TOO_LATE'), true);
  }
});

test('audit log stores fairness counters and decision latency summary', () => {
  const hostSent: unknown[] = [];
  const gateway = new WsGateway({ now: () => 40_000 });
  const host = gateway.connect({ send: (e: unknown) => hostSent.push(e) });
  gateway.connect({ send: () => {} });

  host.receive({ type: 'CREATE_ROOM', reqId: 'm1', playerName: 'Host' });
  const roomId = (hostSent[0] as { roomState: { roomId: string } }).roomState.roomId;
  gateway.connect({ send: () => {} }).receive({ type: 'JOIN_ROOM', reqId: 'm2', roomCode: (hostSent[0] as { roomState: { roomCode: string } }).roomState.roomCode, playerName: 'P2' });
  host.receive({ type: 'START_GAME', reqId: 'm3', roomId });

  const hostTarget = (hostSent.find((e) => (e as { type: string }).type === 'ROUND_STARTED') as { target: { x: number; y: number } }).target;
  const p2Snapshot = hostSent.find((e) => (e as { type: string }).type === 'ROOM_SNAPSHOT' && e !== hostSent[0]) as { roomState: { players: { name: string; playerId: string }[] } };
  const p2PlayerId = p2Snapshot?.roomState?.players?.find((p) => p.name === 'P2')?.playerId ?? '';
  const room = gateway.roomEngine.roomsById.get(roomId);
  room?.targetsByRoundPlayer.set(`1:${p2PlayerId}`, hostTarget);

  host.receive({ type: 'SUBMIT_CLAIM', reqId: 'm4', roomId, roundId: 1, playerId: (hostSent[0] as { roomState: { hostId: string } }).roomState.hostId, target: hostTarget });
  gateway.connect({ send: () => {} }).receive({ type: 'SUBMIT_CLAIM', reqId: 'm5', roomId, roundId: 1, playerId: p2PlayerId, target: hostTarget });

  const metrics = gateway.getAuditMetrics();
  assert.equal(metrics.claim_accept_total, 1);
  assert.equal(metrics.claim_too_late_total, 1);
  assert.equal(metrics.claim_decision_ms.count >= 2, true);
});
