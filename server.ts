import { WebSocketServer } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WsGateway } from './server/ws-gateway.js';
import { isAuthorized, renderTeacherPage } from './server/teacher-page.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8080);
const NODE_ENV = process.env.NODE_ENV ?? 'development';
const STATIC_ROOT = process.env.STATIC_ROOT ?? (NODE_ENV === 'production' ? path.join(__dirname, 'dist') : __dirname);

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

const PRIVATE_STATIC_DIRS = new Set(['server', 'tests', 'node_modules', 'odd', 'investigacion']);

const gateway = new WsGateway({ now: () => Date.now() });

// The private teacher page exists only when a password is configured (Railway variables).
const DOCENTE_USER = process.env.DOCENTE_USER || 'docente';
const DOCENTE_PASSWORD = process.env.DOCENTE_PASSWORD ?? '';

const server = http.createServer((req, res) => {
  const urlPath = req.url?.split('?')[0] ?? '/';
  if (urlPath.startsWith('/ws')) return;

  if (urlPath === '/health') {
    const body = JSON.stringify({ status: 'ok', rooms: gateway.roomEngine.roomsById.size });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(body);
    return;
  }

  if (urlPath === '/docente' || urlPath === '/docente/') {
    if (!DOCENTE_PASSWORD) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const privateHeaders = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' };
    if (!isAuthorized(req.headers.authorization, DOCENTE_USER, DOCENTE_PASSWORD)) {
      res.writeHead(401, { ...privateHeaders, 'WWW-Authenticate': 'Basic realm="XY Arena docente", charset="UTF-8"', 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Acceso restringido');
      return;
    }
    renderTeacherPage()
      .then((html) => {
        res.writeHead(200, { ...privateHeaders, 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      })
      .catch(() => {
        res.writeHead(500, privateHeaders);
        res.end('Error');
      });
    return;
  }

  const safePath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const filePath = path.resolve(STATIC_ROOT, safePath);
  const relativePath = path.relative(STATIC_ROOT, filePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  // In dev the static root is the repository: never expose server code, tests, or dotfiles (they hold private data).
  const [firstSegment = ''] = relativePath.split(path.sep);
  if (PRIVATE_STATIC_DIRS.has(firstSegment) || relativePath === 'server.ts' || relativePath.split(path.sep).some((part) => part.startsWith('.'))) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] ?? 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  const connection = gateway.connect({
    send: (event: unknown) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(event));
    },
  });

  ws.on('message', (raw) => {
    try {
      connection.receive(JSON.parse(raw.toString()) as Record<string, unknown>);
    } catch {
      ws.send(JSON.stringify({ type: 'ERROR', code: 'INVALID_JSON', message: 'INVALID_JSON', reqId: '', eventId: 'evt-invalid-json', serverTsMs: Date.now() }));
    }
  });

  ws.on('close', () => connection.close());
});

server.listen(PORT, () => {
  console.log(`🚀 Server: http://localhost:${PORT}`);
  console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`   Online: http://localhost:${PORT}?online=1`);
});
