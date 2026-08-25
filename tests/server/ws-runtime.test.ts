import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const TSX_BIN = path.join(REPO_ROOT, "node_modules", ".bin", "tsx");

type WireEvent = Record<string, unknown> & { type?: string };

function getFreePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const probe = net.createServer();
		probe.once("error", reject);
		probe.listen(0, "127.0.0.1", () => {
			const address = probe.address();
			if (address === null || typeof address === "string") {
				probe.close();
				reject(new Error("could not allocate a free port"));
				return;
			}
			probe.close((error) => (error ? reject(error) : resolve(address.port)));
		});
	});
}

async function waitForServer(url: string, child: ChildProcess): Promise<void> {
	const deadline = Date.now() + 5_000;
	while (Date.now() <= deadline) {
		if (child.exitCode !== null) throw new Error("WebSocket server exited before it became ready");
		try {
			const response = await fetch(url);
			if (response.ok) return;
		} catch {
			// The server has not started listening yet.
		}
		await new Promise((resolve) => setTimeout(resolve, 25));
	}
	throw new Error("WebSocket server did not become ready within 5 seconds");
}

function connect(url: string): Promise<WebSocket> {
	return new Promise((resolve, reject) => {
		const socket = new WebSocket(url);
		const timeout = setTimeout(() => {
			socket.terminate();
			reject(new Error("WebSocket client did not connect within 2 seconds"));
		}, 2_000);
		socket.once("open", () => {
			clearTimeout(timeout);
			resolve(socket);
		});
		socket.once("error", (error) => {
			clearTimeout(timeout);
			reject(error);
		});
	});
}

async function waitForEvent(events: WireEvent[], type: string): Promise<WireEvent> {
	const deadline = Date.now() + 5_000;
	while (Date.now() <= deadline) {
		const event = events.find((candidate) => candidate.type === type);
		if (event) return event;
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	throw new Error(`Did not receive ${type} within 5 seconds`);
}

async function closeSocket(socket: WebSocket | undefined): Promise<void> {
	if (!socket || socket.readyState === WebSocket.CLOSED) return;
	await new Promise<void>((resolve) => {
		const timeout = setTimeout(resolve, 500);
		socket.once("close", () => {
			clearTimeout(timeout);
			resolve();
		});
		socket.terminate();
	});
}

async function stopServer(child: ChildProcess | undefined): Promise<void> {
	if (!child || child.exitCode !== null) return;
	await new Promise<void>((resolve) => {
		const timeout = setTimeout(() => {
			child.kill("SIGKILL");
			resolve();
		}, 1_000);
		child.once("exit", () => {
			clearTimeout(timeout);
			resolve();
		});
		child.kill("SIGTERM");
	});
}

test("real WebSocket clients receive GAME_COUNTDOWN before ROUND_STARTED", { timeout: 12_000 }, async () => {
	let child: ChildProcess | undefined;
	let host: WebSocket | undefined;
	let peer: WebSocket | undefined;

	try {
		const port = await getFreePort();
		child = spawn(TSX_BIN, ["server.ts"], {
			cwd: REPO_ROOT,
			env: { ...process.env, PORT: String(port) },
			stdio: "ignore",
		});
		await waitForServer(`http://127.0.0.1:${port}/health`, child);

		const hostEvents: WireEvent[] = [];
		const peerEvents: WireEvent[] = [];
		host = await connect(`ws://127.0.0.1:${port}/ws`);
		peer = await connect(`ws://127.0.0.1:${port}/ws`);
		host.on("message", (raw) => hostEvents.push(JSON.parse(raw.toString()) as WireEvent));
		peer.on("message", (raw) => peerEvents.push(JSON.parse(raw.toString()) as WireEvent));

		host.send(JSON.stringify({ type: "CREATE_ROOM", reqId: "create", playerName: "Host" }));
		const created = await waitForEvent(hostEvents, "ROOM_SNAPSHOT");
		const roomState = created.roomState as { roomId: string; roomCode: string };
		assert.equal(typeof roomState.roomId, "string");
		assert.equal(typeof roomState.roomCode, "string");

		peer.send(JSON.stringify({ type: "JOIN_ROOM", reqId: "join", playerName: "Peer", roomCode: roomState.roomCode }));
		await waitForEvent(peerEvents, "ROOM_SNAPSHOT");
		host.send(JSON.stringify({ type: "START_GAME", reqId: "start", roomId: roomState.roomId }));

		await Promise.all([
			waitForEvent(hostEvents, "GAME_COUNTDOWN"),
			waitForEvent(peerEvents, "GAME_COUNTDOWN"),
			waitForEvent(hostEvents, "ROUND_STARTED"),
			waitForEvent(peerEvents, "ROUND_STARTED"),
		]);

		for (const events of [hostEvents, peerEvents]) {
			assert.ok(events.findIndex((event) => event.type === "GAME_COUNTDOWN") >= 0);
			assert.ok(
				events.findIndex((event) => event.type === "ROUND_STARTED") >
					events.findIndex((event) => event.type === "GAME_COUNTDOWN"),
			);
		}
	} finally {
		await closeSocket(host);
		await closeSocket(peer);
		await stopServer(child);
	}
});
