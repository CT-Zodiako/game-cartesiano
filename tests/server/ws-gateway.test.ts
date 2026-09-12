import assert from "node:assert/strict";
import test from "node:test";

import { WsGateway } from "../../server/ws-gateway.js";

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
	};
}

function setupRoom(config: Record<string, number> = {}) {
	const timers = createFakeTimers();
	const gateway = new WsGateway({ now: timers.now });
	gateway.roomEngine.setTimer = timers.setTimer;
	gateway.roomEngine.clearTimer = timers.clearTimer;
	const hostSent: Array<Record<string, unknown>> = [];
	const peerSent: Array<Record<string, unknown>> = [];
	const host = gateway.connect({ send: (event: unknown) => hostSent.push(event as Record<string, unknown>) });
	host.receive({ type: "CREATE_ROOM", reqId: "create", playerName: "Host", config });
	const room = (hostSent[0].roomState as { roomId: string; roomCode: string; hostId: string });
	const peer = gateway.connect({ send: (event: unknown) => peerSent.push(event as Record<string, unknown>) });
	peer.receive({ type: "JOIN_ROOM", reqId: "join", roomCode: room.roomCode, playerName: "Peer" });
	return { timers, gateway, host, peer, hostSent, peerSent, room };
}

function eventsOf(events: Array<Record<string, unknown>>, type: string) {
	return events.filter((event) => event.type === type);
}

test("START_GAME sends one shared GAME_COUNTDOWN, never starts early, and rejects duplicates", () => {
	const { timers, gateway, host, hostSent, peerSent, room } = setupRoom();
	host.receive({ type: "START_GAME", reqId: "start", roomId: room.roomId });

	const hostCountdown = eventsOf(hostSent, "GAME_COUNTDOWN");
	const peerCountdown = eventsOf(peerSent, "GAME_COUNTDOWN");
	assert.equal(hostCountdown.length, 1);
	assert.equal(peerCountdown.length, 1);
	assert.equal(hostCountdown[0].startsAtMs, 4_000);
	assert.equal(peerCountdown[0].startsAtMs, 4_000);
	assert.equal(gateway.roomEngine.roomsById.get(room.roomId)?.status, "COUNTDOWN");
	assert.equal(eventsOf(hostSent, "ROUND_STARTED").length, 0);

	host.receive({ type: "START_GAME", reqId: "duplicate", roomId: room.roomId });
	assert.equal(eventsOf(hostSent, "GAME_COUNTDOWN").length, 1);
	assert.equal((hostSent.at(-1) as { code: string }).code, "INVALID_STATUS");
	timers.tick(2_999);
	assert.equal(eventsOf(hostSent, "ROUND_STARTED").length, 0);
	timers.tick(1);
	assert.equal(eventsOf(hostSent, "ROUND_STARTED").length, 1);
	assert.equal(eventsOf(peerSent, "ROUND_STARTED").length, 1);
});

test("START_REMATCH keeps final scores through countdown and broadcasts reset snapshot only when round one starts", () => {
	const { timers, gateway, host, hostSent, peerSent, room } = setupRoom({ rounds: 1 });
	host.receive({ type: "START_GAME", reqId: "start", roomId: room.roomId });
	timers.tick(3_000);
	const activeRoom = gateway.roomEngine.roomsById.get(room.roomId)!;
	const target = activeRoom.targetsByRoundPlayer.get(`1:${room.hostId}`)!;
	host.receive({ type: "SUBMIT_CLAIM", reqId: "claim", roomId: room.roomId, roundId: 1, playerId: room.hostId, target });
	timers.tick(20_000);
	assert.equal((eventsOf(hostSent, "GAME_ENDED").at(-1) as { roomState: { status: string } }).roomState.status, "FINAL");
	const scoreBeforeRematch = activeRoom.players[0].totalScore;
	const beforeRematch = hostSent.length;

	host.receive({ type: "START_REMATCH", reqId: "rematch", roomId: room.roomId });
	assert.equal((hostSent.at(-1) as { type: string }).type, "GAME_COUNTDOWN");
	assert.equal(activeRoom.players[0].totalScore, scoreBeforeRematch);
	timers.tick(3_000);

	const newEvents = hostSent.slice(beforeRematch);
	assert.deepEqual(newEvents.map((event) => event.type), ["GAME_COUNTDOWN", "ROOM_SNAPSHOT", "ROUND_STARTED"]);
	assert.equal((newEvents[1].roomState as { status: string }).status, "ROUND_ACTIVE");
	assert.deepEqual(
		(newEvents[1].roomState as { players: Array<{ totalScore: number }> }).players.map((player) => player.totalScore),
		[0, 0],
	);
	assert.deepEqual(peerSent.slice(-3).map((event) => event.type), ["GAME_COUNTDOWN", "ROOM_SNAPSHOT", "ROUND_STARTED"]);
});

test("peer departure during countdown restores the source state and prevents timer-driven rounds", () => {
	const { timers, gateway, host, peer, hostSent, room } = setupRoom();
	host.receive({ type: "START_GAME", reqId: "start", roomId: room.roomId });
	peer.receive({ type: "LEAVE_ROOM", reqId: "leave", roomId: room.roomId });

	assert.equal(gateway.roomEngine.roomsById.get(room.roomId)?.status, "LOBBY");
	assert.equal((eventsOf(hostSent, "ROOM_SNAPSHOT").at(-1) as { roomState: { status: string } }).roomState.status, "LOBBY");
	timers.tick(3_000);
	assert.equal(eventsOf(hostSent, "ROUND_STARTED").length, 0);
});

test("host departure during countdown closes the room and clears the pending timer", () => {
	const { timers, gateway, host, hostSent, peerSent, room } = setupRoom();
	host.receive({ type: "START_GAME", reqId: "start", roomId: room.roomId });
	host.close();

	assert.equal(gateway.roomEngine.roomsById.has(room.roomId), false);
	assert.equal((eventsOf(peerSent, "ROOM_CLOSED").at(-1) as { reason: string }).reason, "HOST_LEFT");
	timers.tick(3_000);
	assert.equal(eventsOf(hostSent, "ROUND_STARTED").length, 0);
	assert.equal(eventsOf(peerSent, "ROUND_STARTED").length, 0);
});

test("invalid payloads return typed errors", () => {
	const sent: Array<Record<string, unknown>> = [];
	const gateway = new WsGateway({ now: () => 1_000 });
	gateway.connect({ send: (event: unknown) => sent.push(event as Record<string, unknown>) })
		.receive({ type: "CREATE_ROOM", reqId: "invalid" });
	assert.deepEqual(
		{ type: sent[0].type, code: sent[0].code },
		{ type: "ERROR", code: "INVALID_PLAYER_NAME" },
	);
});

test("create room forwards all supplied configuration values", () => {
	const sent: Array<Record<string, unknown>> = [];
	const gateway = new WsGateway({ now: () => 1_000 });
	gateway.connect({ send: (event: unknown) => sent.push(event as Record<string, unknown>) })
		.receive({
			type: "CREATE_ROOM", reqId: "config", playerName: "Host",
			config: { maxPlayers: 4, rounds: 5, roundDurationMs: 7_000, maxX: 3, maxY: 6 },
		});
	assert.deepEqual((sent[0].roomState as { config: unknown }).config, {
		maxPlayers: 4, rounds: 5, roundDurationMs: 7_000, maxX: 3, maxY: 6,
	});
});

test("create room applies defaults for omitted configuration", () => {
	const sent: Array<Record<string, unknown>> = [];
	const gateway = new WsGateway({ now: () => 1_000 });
	gateway.connect({ send: (event: unknown) => sent.push(event as Record<string, unknown>) })
		.receive({ type: "CREATE_ROOM", reqId: "defaults", playerName: "Host", config: { rounds: 1 } });
	const config = (sent[0].roomState as { config: Record<string, number> }).config;
	assert.deepEqual(
		[config.rounds, config.maxPlayers, config.maxX, config.maxY],
		[1, 8, 6, 6],
	);
});

test("only the host can start and late joins are rejected during countdown", () => {
	const { gateway, host, peer, peerSent, room } = setupRoom();
	peer.receive({ type: "START_GAME", reqId: "not-host", roomId: room.roomId });
	assert.equal((peerSent.at(-1) as { code: string }).code, "NOT_HOST");
	host.receive({ type: "START_GAME", reqId: "start", roomId: room.roomId });
	const lateSent: Array<Record<string, unknown>> = [];
	gateway.connect({ send: (event: unknown) => lateSent.push(event as Record<string, unknown>) })
		.receive({ type: "JOIN_ROOM", reqId: "late", roomCode: room.roomCode, playerName: "Late" });
	assert.equal((lateSent.at(-1) as { code: string }).code, "ROOM_IN_PROGRESS");
});

test("claims use connection identity instead of a client-supplied player id", () => {
	const { timers, host, peer, hostSent, peerSent, room } = setupRoom();
	host.receive({ type: "START_GAME", reqId: "start", roomId: room.roomId });
	timers.tick(3_000);
	const target = (eventsOf(hostSent, "ROUND_STARTED")[0] as { target: { x: number; y: number } }).target;
	peer.receive({
		type: "SUBMIT_CLAIM", reqId: "impersonate", roomId: room.roomId, roundId: 1,
		playerId: room.hostId, target,
	});
	const ack = eventsOf(peerSent, "CLAIM_ACK").at(-1) as { status: string; reason: string };
	assert.deepEqual(ack, { ...ack, status: "REJECTED", reason: "WRONG_TARGET" });
	assert.equal(eventsOf(hostSent, "RANKING_UPDATED").length, 0);
});

test("accepted claims broadcast ranking updates with a new ranking version", () => {
	const { timers, host, hostSent, peerSent, room } = setupRoom();
	host.receive({ type: "START_GAME", reqId: "start", roomId: room.roomId });
	timers.tick(3_000);
	const target = (eventsOf(hostSent, "ROUND_STARTED")[0] as { target: { x: number; y: number } }).target;
	host.receive({ type: "SUBMIT_CLAIM", reqId: "claim", roomId: room.roomId, roundId: 1, playerId: room.hostId, target });
	assert.equal(eventsOf(hostSent, "RANKING_UPDATED").length, 1);
	assert.equal(eventsOf(peerSent, "RANKING_UPDATED").length, 1);
	assert.equal((eventsOf(hostSent, "CLAIM_ACK")[0] as { rankingVersion: number }).rankingVersion, 1);
});

test("duplicate claims replay the acknowledgement and increment duplicate metrics", () => {
	const { timers, gateway, host, hostSent, room } = setupRoom();
	host.receive({ type: "START_GAME", reqId: "start", roomId: room.roomId });
	timers.tick(3_000);
	const target = (eventsOf(hostSent, "ROUND_STARTED")[0] as { target: { x: number; y: number } }).target;
	const claim = { type: "SUBMIT_CLAIM", roomId: room.roomId, roundId: 1, playerId: room.hostId, target };
	host.receive({ ...claim, reqId: "claim-1" });
	host.receive({ ...claim, reqId: "claim-2" });
	const acks = eventsOf(hostSent, "CLAIM_ACK") as Array<{ status: string; reason: string; scoreDelta: number }>;
	assert.equal(acks.length, 2);
	assert.deepEqual(
		{ status: acks[1].status, reason: acks[1].reason, scoreDelta: acks[1].scoreDelta },
		{ status: acks[0].status, reason: acks[0].reason, scoreDelta: acks[0].scoreDelta },
	);
	assert.equal(gateway.getAuditMetrics().claim_duplicate_total, 1);
});

test("collisions retain one winner and record fairness and latency metrics", () => {
	const { timers, gateway, host, peer, hostSent, peerSent, room } = setupRoom();
	host.receive({ type: "START_GAME", reqId: "start", roomId: room.roomId });
	timers.tick(3_000);
	const target = (eventsOf(hostSent, "ROUND_STARTED")[0] as { target: { x: number; y: number } }).target;
	const activeRoom = gateway.roomEngine.roomsById.get(room.roomId)!;
	const peerId = activeRoom.players.find((player) => player.name === "Peer")!.playerId;
	activeRoom.targetsByRoundPlayer.set(`1:${peerId}`, target);
	host.receive({ type: "SUBMIT_CLAIM", reqId: "first", roomId: room.roomId, roundId: 1, playerId: room.hostId, target });
	peer.receive({ type: "SUBMIT_CLAIM", reqId: "late", roomId: room.roomId, roundId: 1, playerId: peerId, target });
	const acks = [...eventsOf(hostSent, "CLAIM_ACK"), ...eventsOf(peerSent, "CLAIM_ACK")] as Array<{ status: string; reason: string }>;
	assert.equal(acks.filter((ack) => ack.status === "ACCEPTED").length, 1);
	assert.equal(acks.some((ack) => ack.reason === "TOO_LATE"), true);
	const metrics = gateway.getAuditMetrics();
	assert.equal(metrics.claim_accept_total, 1);
	assert.equal(metrics.claim_too_late_total, 1);
	assert.equal(metrics.claim_decision_ms.count >= 2, true);
});

test("three rounds emit lifecycle events after the initial countdown", () => {
	const { timers, host, hostSent, peerSent, room } = setupRoom({ rounds: 3 });
	host.receive({ type: "START_GAME", reqId: "start", roomId: room.roomId });
	timers.tick(3_000);
	timers.tick(20_000);
	timers.tick(20_000);
	timers.tick(20_000);
	assert.equal(eventsOf(hostSent, "ROUND_ENDED").length, 3);
	assert.equal(eventsOf(hostSent, "ROUND_STARTED").length, 3);
	assert.equal(eventsOf(hostSent, "GAME_ENDED").length, 1);
	assert.equal(eventsOf(peerSent, "GAME_ENDED").length, 1);
});
