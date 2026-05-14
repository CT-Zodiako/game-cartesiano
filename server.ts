import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;

// ── Types ──────────────────────────────────────────────────────────────────────

interface Player {
  playerId: string;
  name: string;
  totalScore: number;
}

interface RoomConfig {
  maxPlayers: number;
  rounds: number;
  roundDurationMs: number;
  maxX: number;
  maxY: number;
}

interface Room {
  roomId: string;
  roomCode: string;
  hostId: string;
  config: RoomConfig;
  status: 'LOBBY' | 'ROUND_ACTIVE' | 'ROUND_RESULT' | 'FINAL';
  players: Player[];
  currentRound: number;
  roundStartMs: number | null;
  roundDeadlineMs: number | null;
  targets: Record<string, { x: number; y: number }>;
  claimed: Set<string>;
  results: Map<string, { result: string; pointsEarned: number; totalScore: number }>;
}

interface Session {
  ws: WebSocket;
  roomId: string | null;
  playerId: string | null;
}

interface Message {
  type: string;
  playerName?: string;
  roomCode?: string;
  config?: Partial<RoomConfig>;
  roomId?: string;
  target?: { x: number; y: number };
  [key: string]: unknown;
}

// ── State ──────────────────────────────────────────────────────────────────────

const rooms = new Map<string, Room>();
let roomIdSeq = 1;
let playerIdSeq = 1;
const sessions = new Map<string, Session>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function randomTarget(maxX = 10, maxY = 10): { x: number; y: number } {
  return {
    x: Math.floor(Math.random() * (maxX * 2 + 1)) - maxX,
    y: Math.floor(Math.random() * (maxY * 2 + 1)) - maxY,
  };
}

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

// ── HTTP Server ───────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const urlPath = (req.url?.split('?')[0] ?? '/');
  if (urlPath === '/') {
    // Redirect to index.html
    const filePath = path.join(__dirname, 'index.html');
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
    return;
  }
  if (urlPath.startsWith('/ws')) return;

  const filePath = path.join(__dirname, urlPath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

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

// ── WebSocket Server ─────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  const sessionId = `s-${++playerIdSeq}`;
  sessions.set(sessionId, { ws, roomId: null, playerId: null });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString()) as Message;
      handleMessage(sessionId, msg);
    } catch {
      // ignore malformed
    }
  });

  ws.on('close', () => sessions.delete(sessionId));
});

function broadcast(roomId: string, event: unknown): void {
  sessions.forEach((s) => {
    if (s.roomId === roomId && s.ws.readyState === WebSocket.OPEN) {
      s.ws.send(JSON.stringify(event));
    }
  });
}

// ── Message Handlers ─────────────────────────────────────────────────────────

function handleMessage(sessionId: string, msg: Message): void {
  const s = sessions.get(sessionId);
  if (!s) return;

  if (msg.type === 'CREATE_ROOM') {
    const roomId = `room-${roomIdSeq++}`;
    const roomCode = randomCode();
    const playerId = `p-${playerIdSeq++}`;
    const config = msg.config ?? {};
    const room: Room = {
      roomId,
      roomCode,
      hostId: playerId,
      config: {
        maxPlayers: config.maxPlayers ?? 8,
        rounds: config.rounds ?? 3,
        roundDurationMs: config.roundDurationMs ?? 20000,
        maxX: config.maxX ?? 10,
        maxY: config.maxY ?? 10,
      },
      status: 'LOBBY',
      players: [{ playerId, name: msg.playerName ?? 'Player', totalScore: 0 }],
      currentRound: 0,
      roundStartMs: null,
      roundDeadlineMs: null,
      targets: {},
      claimed: new Set(),
      results: new Map(),
    };
    rooms.set(roomId, room);
    s.roomId = roomId;
    s.playerId = playerId;
    s.ws.send(JSON.stringify({ type: 'ROOM_SNAPSHOT', roomState: rooms.get(roomId), yourPlayerId: playerId }));
  }

  else if (msg.type === 'JOIN_ROOM') {
    const room = Array.from(rooms.values()).find(r => r.roomCode === msg.roomCode);
    if (!room || room.status !== 'LOBBY') {
      return s.ws.send(JSON.stringify({ type: 'ERROR', code: 'ROOM_NOT_FOUND' }));
    }
    if (room.players.length >= room.config.maxPlayers) {
      return s.ws.send(JSON.stringify({ type: 'ERROR', code: 'ROOM_FULL' }));
    }
    const playerId = `p-${playerIdSeq++}`;
    room.players.push({ playerId, name: msg.playerName ?? 'Player', totalScore: 0 });
    s.roomId = room.roomId;
    s.playerId = playerId;
    broadcast(room.roomId, { type: 'ROOM_SNAPSHOT', roomState: room, yourPlayerId: playerId });
  }

  else if (msg.type === 'START_GAME') {
    const room = rooms.get(s.roomId ?? '');
    if (!room || room.hostId !== s.playerId || room.players.length < 2) return;
    startRound(room);
  }

  else if (msg.type === 'SUBMIT_CLAIM') {
    const room = rooms.get(s.roomId ?? '');
    if (!room || room.status !== 'ROUND_ACTIVE') return;
    if (!msg.target) return;

    const target = room.targets[`${room.currentRound}:${s.playerId}`];
    if (!target || target.x !== msg.target.x || target.y !== msg.target.y) {
      return s.ws.send(JSON.stringify({ type: 'CLAIM_ACK', status: 'REJECTED', reason: 'WRONG_TARGET', pointsEarned: 0 }));
    }
    const key = `${msg.target.x}:${msg.target.y}`;
    if (room.claimed.has(key)) {
      return s.ws.send(JSON.stringify({ type: 'CLAIM_ACK', status: 'REJECTED', reason: 'TOO_LATE', pointsEarned: 0 }));
    }

    room.claimed.add(key);
    const elapsed = Date.now() - (room.roundStartMs ?? 0);
    const pointsEarned = Math.max(100, Math.floor(1000 * (1 - elapsed / room.config.roundDurationMs)));
    const player = room.players.find(p => p.playerId === s.playerId);
    if (!player) return;

    player.totalScore += pointsEarned;
    room.results.set(s.playerId, { result: 'WIN', pointsEarned, totalScore: player.totalScore });

    s.ws.send(JSON.stringify({ type: 'CLAIM_ACK', status: 'ACCEPTED', pointsEarned, totalScore: player.totalScore }));
    broadcast(room.roomId, {
      type: 'RANKING_UPDATED',
      ranking: room.players
        .map(p => ({ playerId: p.playerId, name: p.name, totalScore: p.totalScore }))
        .sort((a, b) => b.totalScore - a.totalScore)
    });
  }
}

function startRound(room: Room): void {
  room.status = 'ROUND_ACTIVE';
  room.currentRound++;
  room.roundStartMs = Date.now();
  room.roundDeadlineMs = room.roundStartMs + room.config.roundDurationMs;
  room.claimed.clear();
  room.targets = {};

  room.players.forEach(p => {
    room.targets[`${room.currentRound}:${p.playerId}`] = randomTarget(room.config.maxX, room.config.maxY);
  });

  // Send target to each player
  sessions.forEach((s) => {
    if (s.roomId === room.roomId && s.ws.readyState === WebSocket.OPEN) {
      const target = room.targets[`${room.currentRound}:${s.playerId}`];
      s.ws.send(JSON.stringify({ type: 'ROUND_STARTED', roundId: room.currentRound, deadlineMs: room.roundDeadlineMs, target }));
    }
  });

  setTimeout(() => {
    if (room.status !== 'ROUND_ACTIVE') return;
    room.status = 'ROUND_RESULT';

    if (room.currentRound >= room.config.rounds) {
      room.status = 'FINAL';
      broadcast(room.roomId, {
        type: 'GAME_ENDED',
        ranking: room.players
          .map(p => ({ playerId: p.playerId, name: p.name, totalScore: p.totalScore }))
          .sort((a, b) => b.totalScore - a.totalScore)
      });
    } else {
      startRound(room);
    }
  }, room.config.roundDurationMs);
}

// ── Start ────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`🚀 Server: http://localhost:${PORT}`);
  console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`   Online: http://localhost:${PORT}?online=1`);
});