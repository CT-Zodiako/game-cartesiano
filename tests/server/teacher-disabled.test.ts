import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');

let child: ChildProcess;
let baseUrl: string;

function getFreePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const probe = net.createServer();
		probe.once('error', reject);
		probe.listen(0, '127.0.0.1', () => {
			const address = probe.address();
			if (address === null || typeof address === 'string') return reject(new Error('no port'));
			probe.close(() => resolve(address.port));
		});
	});
}

before(async () => {
	const port = await getFreePort();
	baseUrl = `http://127.0.0.1:${port}`;
	const env: NodeJS.ProcessEnv = { ...process.env, PORT: String(port) };
	delete env.DOCENTE_USER;
	delete env.DOCENTE_PASSWORD;
	// Dev mode: STATIC_ROOT falls back to the repository root, the riskiest static configuration.
	delete env.NODE_ENV;
	delete env.STATIC_ROOT;
	child = spawn(TSX_BIN, ['server.ts'], { cwd: REPO_ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
	const deadline = Date.now() + 15_000;
	for (;;) {
		try {
			await fetch(`${baseUrl}/health`);
			return;
		} catch {
			if (Date.now() > deadline) throw new Error('server did not start in time');
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}
});

after(() => {
	child.kill('SIGTERM');
});

test('without a configured password the teacher page does not exist', async () => {
	const res = await fetch(`${baseUrl}/docente`, {
		headers: { Authorization: `Basic ${Buffer.from('docente:').toString('base64')}` },
	});
	assert.equal(res.status, 404);
	assert.equal(res.headers.get('www-authenticate'), null);
	assert.doesNotMatch(await res.text(), /docs\.google\.com/);
});

test('server and test sources are never served as static files, even in dev mode', async () => {
	for (const urlPath of [
		'/server/teacher-page.ts',
		'/tests/server/teacher-page.test.ts',
		'/server.ts',
		'/.git/config',
		'/%73erver/teacher-page.ts',
	]) {
		const res = await fetch(`${baseUrl}${urlPath}`);
		assert.equal(res.status, 404, urlPath);
		assert.doesNotMatch(await res.text(), /1FAIpQL/, urlPath);
	}
});

test('regular static files are still served in dev mode', async () => {
	const res = await fetch(`${baseUrl}/index.html`);
	assert.equal(res.status, 200);
});

