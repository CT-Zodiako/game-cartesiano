import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');
const INDEX_HTML = '<!doctype html><html><title>static-root-test</title></html>';

let child: ChildProcess;
let staticRoot: string;
let baseUrl: string;

function getFreePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const probe = net.createServer();
		probe.once('error', reject);
		probe.listen(0, '127.0.0.1', () => {
			const address = probe.address();
			if (address === null || typeof address === 'string') {
				reject(new Error('could not allocate a free port'));
				return;
			}
			probe.close(() => resolve(address.port));
		});
	});
}

async function waitForServer(url: string, timeoutMs = 15_000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		try {
			await fetch(url);
			return;
		} catch {
			if (Date.now() > deadline) throw new Error('server did not start in time');
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}
}

function rawGetStatus(urlPath: string): Promise<number> {
	return new Promise((resolve, reject) => {
		const target = new URL(baseUrl);
		const req = http.request(
			{ hostname: target.hostname, port: target.port, path: urlPath, method: 'GET' },
			(res) => {
				res.resume();
				res.once('end', () => resolve(res.statusCode ?? 0));
			},
		);
		req.once('error', reject);
		req.end();
	});
}

before(async () => {
	staticRoot = mkdtempSync(path.join(tmpdir(), 'gc-static-root-'));
	writeFileSync(path.join(staticRoot, 'index.html'), INDEX_HTML);

	const port = await getFreePort();
	baseUrl = `http://127.0.0.1:${port}`;

	child = spawn(TSX_BIN, ['server.ts'], {
		cwd: REPO_ROOT,
		env: {
			...process.env,
			PORT: String(port),
			NODE_ENV: 'production',
			STATIC_ROOT: staticRoot,
		},
		stdio: ['ignore', 'pipe', 'pipe'],
	});

	await waitForServer(`${baseUrl}/health`);
});

after(() => {
	child.kill('SIGTERM');
	rmSync(staticRoot, { recursive: true, force: true });
});

test('GET /health returns 200 JSON with status ok and rooms 0', async () => {
	const res = await fetch(`${baseUrl}/health`);
	assert.equal(res.status, 200);
	assert.match(res.headers.get('content-type') ?? '', /application\/json/);
	const body = (await res.json()) as { status: string; rooms: number };
	assert.equal(body.status, 'ok');
	assert.equal(body.rooms, 0);
});

test('GET / serves index.html from STATIC_ROOT in production', async () => {
	const res = await fetch(`${baseUrl}/`);
	assert.equal(res.status, 200);
	const body = await res.text();
	assert.equal(body, INDEX_HTML);
});

test('path traversal outside STATIC_ROOT is rejected (403 or 404)', async () => {
	const status = await rawGetStatus('/../package.json');
	assert.ok(status === 403 || status === 404, `expected 403/404, got ${status}`);
});
