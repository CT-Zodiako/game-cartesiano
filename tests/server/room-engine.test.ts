import assert from "node:assert/strict";
import test from "node:test";

import { RoomEngine, ROOM_STATUS } from "../../server/room-engine.js";

function createFakeTimers(nowStart = 1_000) {
	let now = nowStart;
	let timerSeq = 0;
	const timers = new Map<
		string,
		{ cb: () => void; dueAt: number; cancelled: boolean }
	>();

	return {
		now: () => now,
		setTimer: (cb: () => void, delay: number) => {
			const id = `timer-${++timerSeq}`;
			timers.set(id, { cb, dueAt: now + delay, cancelled: false });
			return id;
		},
		clearTimer: (id: unknown) => {
			const timer = timers.get(String(id));
			if (timer) timer.cancelled = true;
		},
		tick: (ms: number) => {
			now += ms;
			for (const [id, timer] of [...timers]) {
				if (timer.cancelled || timer.dueAt > now) continue;
				timer.cancelled = true;
				timers.delete(id);
				timer.cb();
			}
		},
		callbacks: () => [...timers.values()].map((timer) => timer.cb),
	};
}

function createRoomWithPeer(engine: RoomEngine) {
	const created = engine.createRoom({ hostName: "Host", config: { rounds: 1 } });
	const joined = engine.joinRoom({ roomCode: created.roomCode, playerName: "Peer" });
	if (!joined.ok) throw new Error("peer join failed");
	return { created, joined, room: engine.roomsById.get(created.roomId)! };
}

test("initial start waits three seconds, exposes an absolute start time, and rejects duplicates", () => {
	const timers = createFakeTimers();
	const engine = new RoomEngine(timers);
	const { created, room } = createRoomWithPeer(engine);

	const started = engine.startGame({ roomId: created.roomId, actorPlayerId: created.hostId });
	assert.deepEqual(started, {
		ok: true,
		startsAtMs: 4_000,
		roomState: engine.getRoomSnapshot(created.roomId)?.roomState,
	});
	assert.equal(room.status, ROOM_STATUS.COUNTDOWN);
	assert.equal(room.currentRound, 0);
	assert.equal(engine.getGameCountdownEvent(room).startsAtMs, 4_000);
	assert.deepEqual(
		engine.startGame({ roomId: created.roomId, actorPlayerId: created.hostId }),
		{ ok: false, code: "INVALID_STATUS" },
	);

	timers.tick(2_999);
	assert.equal(room.status, ROOM_STATUS.COUNTDOWN);
	assert.equal(room.currentRound, 0);
	timers.tick(1);
	assert.equal(room.status, ROOM_STATUS.ROUND_ACTIVE);
	assert.equal(room.currentRound, 1);
});

test("rematch preserves final scores through countdown and resets them only at expiry", () => {
	const timers = createFakeTimers();
	const engine = new RoomEngine(timers);
	const { created, joined, room } = createRoomWithPeer(engine);
	engine.startGame({ roomId: created.roomId, actorPlayerId: created.hostId });
	timers.tick(3_000);
	const target = room.targetsByRoundPlayer.get(`1:${created.hostId}`)!;
	engine.submitClaim({
		roomId: created.roomId,
		roundId: 1,
		playerId: created.hostId,
		target,
		serverReceivedAtMs: timers.now(),
		wsConnectionSeq: 1,
	});
	engine.closeRound(created.roomId, "TIMEOUT");
	assert.equal(room.status, ROOM_STATUS.FINAL);
	assert.ok(room.players[0].totalScore > 0);

	assert.equal(
		engine.startRematch({ roomId: created.roomId, actorPlayerId: created.hostId }).ok,
		true,
	);
	assert.equal(room.status, ROOM_STATUS.COUNTDOWN);
	assert.ok(room.players[0].totalScore > 0);
	timers.tick(3_000);
	assert.equal(room.status, ROOM_STATUS.ROUND_ACTIVE);
	assert.equal(room.currentRound, 1);
	assert.deepEqual(room.players.map((player) => player.totalScore), [0, 0]);
	assert.deepEqual(room.players.map((player) => player.lastAcceptedAtMs), [null, null]);
	assert.deepEqual(
		engine.getRoundStartedEvents(room).map(({ playerId }) => playerId),
		[created.hostId, joined.playerId],
	);
});

test("countdown expiry revalidates the connected roster before starting round one", () => {
	const timers = createFakeTimers();
	const engine = new RoomEngine(timers);
	const { created, joined, room } = createRoomWithPeer(engine);
	engine.startGame({ roomId: created.roomId, actorPlayerId: created.hostId });
	room.playersById.get(joined.playerId)!.connected = false;

	timers.tick(3_000);
	assert.equal(room.status, ROOM_STATUS.LOBBY);
	assert.equal(room.currentRound, 0);
});

test("a peer departure cancels the countdown to its source and stale callbacks cannot start a round", () => {
	const timers = createFakeTimers();
	const engine = new RoomEngine(timers);
	const { created, joined, room } = createRoomWithPeer(engine);
	engine.startGame({ roomId: created.roomId, actorPlayerId: created.hostId });
	const staleCountdownCallbacks = timers.callbacks();

	engine.disconnectPlayer({ roomId: created.roomId, playerId: joined.playerId });
	assert.equal(room.status, ROOM_STATUS.LOBBY);
	assert.equal(room.countdownStartsAtMs, 0);
	for (const callback of staleCountdownCallbacks) callback();
	assert.equal(room.status, ROOM_STATUS.LOBBY);
	assert.equal(room.currentRound, 0);
});

test("a peer departure during a rematch countdown restores FINAL without clearing the ranking", () => {
	const timers = createFakeTimers();
	const engine = new RoomEngine(timers);
	const { created, joined, room } = createRoomWithPeer(engine);
	engine.startGame({ roomId: created.roomId, actorPlayerId: created.hostId });
	timers.tick(3_000);
	const target = room.targetsByRoundPlayer.get(`1:${created.hostId}`)!;
	engine.submitClaim({
		roomId: created.roomId,
		roundId: 1,
		playerId: created.hostId,
		target,
		serverReceivedAtMs: timers.now(),
		wsConnectionSeq: 1,
	});
	engine.closeRound(created.roomId, "TIMEOUT");
	const finalScore = room.players[0].totalScore;
	engine.startRematch({ roomId: created.roomId, actorPlayerId: created.hostId });

	engine.disconnectPlayer({ roomId: created.roomId, playerId: joined.playerId });
	assert.equal(room.status, ROOM_STATUS.FINAL);
	assert.equal(room.players[0].totalScore, finalScore);
});

test("host departure during countdown clears timers, closes the room, and blocks stale timer effects", () => {
	const timers = createFakeTimers();
	const engine = new RoomEngine(timers);
	const { created, room } = createRoomWithPeer(engine);
	engine.startGame({ roomId: created.roomId, actorPlayerId: created.hostId });
	const staleCountdownCallbacks = timers.callbacks();

	assert.deepEqual(
		engine.abortRoom({ roomId: created.roomId, actorPlayerId: created.hostId }),
		{ ok: true, reason: "HOST_LEFT" },
	);
	assert.equal(engine.roomsById.has(created.roomId), false);
	for (const callback of staleCountdownCallbacks) callback();
	assert.equal(room.currentRound, 0);
});

test("host departure from an active round clears its round timer", () => {
	const timers = createFakeTimers();
	const engine = new RoomEngine(timers);
	const { created, room } = createRoomWithPeer(engine);
	engine.startGame({ roomId: created.roomId, actorPlayerId: created.hostId });
	timers.tick(3_000);
	const staleRoundCallbacks = timers.callbacks();

	engine.abortRoom({ roomId: created.roomId, actorPlayerId: created.hostId });
	for (const callback of staleRoundCallbacks) callback();
	assert.equal(engine.roomsById.has(created.roomId), false);
	assert.equal(room.currentRound, 1);
});

test("room snapshots preserve null initial timestamps and per-engine ids", () => {
	const createEngine = () =>
		new RoomEngine({ now: () => 1_000, setTimer: () => 1, clearTimer: () => {} });
	const first = createEngine().createRoom({ hostName: "Host" });
	const second = createEngine().createRoom({ hostName: "Host" });
	assert.equal(first.roomId, "room-1");
	assert.equal(first.hostId, "p-1");
	assert.equal(first.roomState.players[0].lastAcceptedAtMs, null);
	assert.equal(second.roomId, "room-1");
});

test("non-hosts cannot start and late joins are rejected during countdown", () => {
	const timers = createFakeTimers();
	const engine = new RoomEngine(timers);
	const { created, joined } = createRoomWithPeer(engine);
	const nonHostStart = engine.startGame({
		roomId: created.roomId,
		actorPlayerId: joined.playerId,
	});
	assert.deepEqual(nonHostStart, { ok: false, code: "NOT_HOST" });
	assert.equal(
		engine.startGame({ roomId: created.roomId, actorPlayerId: created.hostId }).ok,
		true,
	);
	const lateJoin = engine.joinRoom({ roomCode: created.roomCode, playerName: "Late" });
	assert.deepEqual(lateJoin, { ok: false, code: "ROOM_IN_PROGRESS" });
});

test("claims are idempotent by connection sequence and retain their original acknowledgement", () => {
	const timers = createFakeTimers();
	const engine = new RoomEngine(timers);
	const { created, room } = createRoomWithPeer(engine);
	engine.startGame({ roomId: created.roomId, actorPlayerId: created.hostId });
	timers.tick(3_000);
	const target = room.targetsByRoundPlayer.get(`1:${created.hostId}`)!;
	const claim = {
		roomId: created.roomId,
		roundId: 1,
		playerId: created.hostId,
		target,
		serverReceivedAtMs: timers.now(),
		wsConnectionSeq: 7,
	};
	const first = engine.submitClaim(claim);
	const duplicate = engine.submitClaim(claim);
	assert.equal(first.ok, true);
	assert.equal(duplicate.duplicate, true);
	assert.deepEqual(duplicate.ack, first.ack);
});

test("wrong claims are rejected while accepted claims update ordered ranking and version", () => {
	const timers = createFakeTimers();
	const engine = new RoomEngine(timers);
	const { created, room } = createRoomWithPeer(engine);
	engine.startGame({ roomId: created.roomId, actorPlayerId: created.hostId });
	timers.tick(3_000);
	const wrong = engine.submitClaim({
		roomId: created.roomId,
		roundId: 1,
		playerId: created.hostId,
		target: { x: 999, y: 999 },
		serverReceivedAtMs: timers.now(),
		wsConnectionSeq: 1,
	});
	assert.equal(wrong.ok, false);
	assert.equal(wrong.ack.reason, "WRONG_TARGET");
	const accepted = engine.submitClaim({
		roomId: created.roomId,
		roundId: 1,
		playerId: created.hostId,
		target: room.targetsByRoundPlayer.get(`1:${created.hostId}`)!,
		serverReceivedAtMs: timers.now(),
		wsConnectionSeq: 2,
	});
	assert.equal(accepted.ok, true);
	assert.equal(accepted.ack.rankingVersion, 1);
	assert.equal(accepted.ranking?.[0]?.playerId, created.hostId);
});

test("a shared-target collision accepts the first claimant and alerts the later claimant", () => {
	const timers = createFakeTimers();
	const engine = new RoomEngine(timers);
	const { created, joined, room } = createRoomWithPeer(engine);
	engine.startGame({ roomId: created.roomId, actorPlayerId: created.hostId });
	timers.tick(3_000);
	const target = room.targetsByRoundPlayer.get(`1:${created.hostId}`)!;
	room.targetsByRoundPlayer.set(`1:${joined.playerId}`, target);
	const first = engine.submitClaim({
		roomId: created.roomId, roundId: 1, playerId: created.hostId, target,
		serverReceivedAtMs: timers.now(), wsConnectionSeq: 1,
	});
	timers.tick(1);
	const late = engine.submitClaim({
		roomId: created.roomId, roundId: 1, playerId: joined.playerId, target,
		serverReceivedAtMs: timers.now(), wsConnectionSeq: 2,
	});
	assert.equal(first.ok, true);
	assert.equal(late.ok, false);
	assert.equal(late.ack.reason, "TOO_LATE");
	assert.equal(late.lateAlert.code, "TOO_LATE");
});

test("three-round lifecycle reaches FINAL after the countdown", () => {
	const timers = createFakeTimers();
	const engine = new RoomEngine(timers);
	const created = engine.createRoom({ hostName: "Host", config: { rounds: 3 } });
	engine.joinRoom({ roomCode: created.roomCode, playerName: "Peer" });
	engine.startGame({ roomId: created.roomId, actorPlayerId: created.hostId });
	timers.tick(3_000);
	assert.equal(engine.closeRound(created.roomId, "TIMEOUT").ended, false);
	assert.equal(engine.closeRound(created.roomId, "TIMEOUT").ended, false);
	assert.equal(engine.closeRound(created.roomId, "TIMEOUT").ended, true);
	assert.equal(engine.roomsById.get(created.roomId)?.status, ROOM_STATUS.FINAL);
});

test("partial configuration keeps defaults and produces finite round targets", () => {
	const timers = createFakeTimers();
	const engine = new RoomEngine(timers);
	const created = engine.createRoom({
		hostName: "Host",
		config: { rounds: 1, roundDurationMs: 8_000, maxPlayers: undefined, maxX: undefined, maxY: undefined },
	});
	engine.joinRoom({ roomCode: created.roomCode, playerName: "Peer" });
	engine.startGame({ roomId: created.roomId, actorPlayerId: created.hostId });
	timers.tick(3_000);
	const room = engine.roomsById.get(created.roomId)!;
	assert.deepEqual(
		[room.config.maxPlayers, room.config.maxX, room.config.maxY],
		[8, 10, 10],
	);
	for (const { event } of engine.getRoundStartedEvents(room)) {
		assert.ok(Number.isFinite(event.target.x));
		assert.ok(Number.isFinite(event.target.y));
	}
});
