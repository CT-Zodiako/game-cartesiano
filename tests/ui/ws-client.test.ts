import assert from "node:assert/strict";
import test from "node:test";

import {
	handleGameCountdown,
	WSClient,
} from "../../src/infrastructure/ws/client.ts";

class FakeWebSocket {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSING = 2;
	static readonly CLOSED = 3;
	static instances: FakeWebSocket[] = [];

	readyState = FakeWebSocket.CONNECTING;
	readonly sent: string[] = [];
	private readonly listeners = new Map<string, Array<(event: Event) => void>>();

	constructor(_url: string) {
		FakeWebSocket.instances.push(this);
	}

	addEventListener(type: string, listener: (event: Event) => void): void {
		const listeners = this.listeners.get(type) ?? [];
		listeners.push(listener);
		this.listeners.set(type, listeners);
	}

	send(message: string): void {
		this.sent.push(message);
	}

	open(): void {
		this.readyState = FakeWebSocket.OPEN;
		this.emit("open");
	}

	close(): void {
		this.readyState = FakeWebSocket.CLOSED;
		this.emit("close");
	}

	message(payload: unknown): void {
		const event = new Event("message") as MessageEvent;
		Object.defineProperty(event, "data", { value: JSON.stringify(payload) });
		for (const listener of this.listeners.get("message") ?? []) listener(event);
	}

	private emit(type: string): void {
		for (const listener of this.listeners.get(type) ?? []) listener(new Event(type));
	}
}

function withFakeWebSocket(run: () => void): void {
	const original = globalThis.WebSocket;
	FakeWebSocket.instances = [];
	globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
	try {
		run();
	} finally {
		globalThis.WebSocket = original;
	}
}

test("queues lobby creation while connecting and sends it when the socket opens", () => {
	withFakeWebSocket(() => {
		const client = new WSClient();
		client.connect("ws://example.test/ws");
		client.createRoom("Ada", { rounds: 3 });

		const socket = FakeWebSocket.instances[0];
		assert.equal(socket.sent.length, 0);
		socket.open();

		assert.deepEqual(JSON.parse(socket.sent[0]), {
			type: "CREATE_ROOM",
			reqId: "c-1",
			playerName: "Ada",
			config: { rounds: 3 },
		});
	});
});

test("retries one pending lobby request through a replacement connection", () => {
	withFakeWebSocket(() => {
		const client = new WSClient();
		client.connect("ws://example.test/ws");
		const firstSocket = FakeWebSocket.instances[0];
		firstSocket.open();
		firstSocket.close();

		client.joinRoom("Bea", "ABC123");
		const retrySocket = FakeWebSocket.instances[1];
		assert.ok(retrySocket);
		assert.equal(retrySocket.sent.length, 0);
		retrySocket.open();

		assert.deepEqual(JSON.parse(retrySocket.sent[0]), {
			type: "JOIN_ROOM",
			reqId: "c-1",
			playerName: "Bea",
			roomCode: "ABC123",
		});
	});
});

test("keeps only the latest pending lobby action to avoid duplicate rooms", () => {
	withFakeWebSocket(() => {
		const client = new WSClient();
		client.connect("ws://example.test/ws");
		const socket = FakeWebSocket.instances[0];
		client.createRoom("Ada");
		client.createRoom("Bea");
		socket.open();

		assert.equal(socket.sent.length, 1);
		assert.equal(JSON.parse(socket.sent[0]).playerName, "Bea");
	});
});

test("retries a failed connection only once before reporting it disconnected", () => {
	withFakeWebSocket(() => {
		const client = new WSClient();
		let disconnected = false;
		client.on("disconnected", () => {
			disconnected = true;
		});
		client.connect("ws://example.test/ws");
		FakeWebSocket.instances[0].close();
		FakeWebSocket.instances[1].close();

		assert.equal(FakeWebSocket.instances.length, 2);
		assert.equal(disconnected, true);
	});
});

test("sends host room departure and surfaces typed host-closure events", () => {
	withFakeWebSocket(() => {
		const client = new WSClient();
		let closure: unknown;
		client.on("ROOM_CLOSED", (event) => {
			if (event.type === "ROOM_CLOSED") closure = event;
		});
		client.connect("ws://example.test/ws");
		const socket = FakeWebSocket.instances[0];
		socket.open();

		client.leaveRoom("room-1");
		assert.deepEqual(JSON.parse(socket.sent[0]), {
			type: "LEAVE_ROOM",
			reqId: "c-1",
			roomId: "room-1",
		});

		socket.message({
			type: "ROOM_CLOSED",
			reqId: "c-1",
			eventId: "evt-1",
			serverTsMs: 1_000,
			reason: "HOST_LEFT",
			message: "The host left the room.",
		});
		assert.deepEqual(closure, {
			type: "ROOM_CLOSED",
			reqId: "c-1",
			eventId: "evt-1",
			serverTsMs: 1_000,
			reason: "HOST_LEFT",
			message: "The host left the room.",
		});
	});
});

test("sends a distinct START_REMATCH message", () => {
	withFakeWebSocket(() => {
		const client = new WSClient();
		client.connect("ws://example.test/ws");
		const socket = FakeWebSocket.instances[0];
		socket.open();

		client.startRematch("room-1");

		assert.deepEqual(JSON.parse(socket.sent[0]), {
			type: "START_REMATCH",
			reqId: "c-1",
			roomId: "room-1",
		});
	});
});

test("surfaces typed GAME_COUNTDOWN events with the server absolute start time", () => {
	withFakeWebSocket(() => {
		const client = new WSClient();
		let startsAtMs: number | undefined;
		handleGameCountdown(client, (event) => {
			startsAtMs = event.startsAtMs;
		});
		client.connect("ws://example.test/ws");
		const socket = FakeWebSocket.instances[0];
		socket.open();
		socket.message({
			type: "GAME_COUNTDOWN",
			reqId: "start",
			eventId: "evt-countdown",
			serverTsMs: 1_000,
			startsAtMs: 4_000,
		});
		assert.equal(startsAtMs, 4_000);
	});
});

test("does not queue time-sensitive game claims while connecting", () => {
	withFakeWebSocket(() => {
		const client = new WSClient();
		client.connect("ws://example.test/ws");
		const socket = FakeWebSocket.instances[0];
		client.submitClaim("room-1", 1, "p-1", { x: 3, y: -2 });
		socket.open();

		assert.equal(socket.sent.length, 0);
	});
});
