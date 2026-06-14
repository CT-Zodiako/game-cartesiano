import { WebSocketServer } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WsGateway } from './server/ws-gateway.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8080);

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

const gateway = new WsGateway({ now: () => Date.now() });

const server = http.createServer((req, res) => {
  const urlPath = req.url?.split('?')[0] ?? '/';
  if (urlPath.startsWith('/ws')) return;

  const safePath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const filePath = path.resolve(__dirname, safePath);
  const relativePath = path.relative(__dirname, filePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    res.writeHead(403);
    res.end('Forbidden');
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
