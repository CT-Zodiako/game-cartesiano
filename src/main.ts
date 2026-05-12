import type { RoverState } from '@domain/rover/types.ts';
import { RoverScene } from '@ui/phaser/RoverScene.ts';
import { createStatePanel } from '@ui/dom/statePanel.ts';
import { WSClient, handleRoomSnapshot, handleRoundStarted, handleClaimAck, handleLateAlert, handleRankingUpdated, handleError } from '@infrastructure/ws/client.ts';
import type { RoomState, RankingEntry, RoundStartedEvent } from '@infrastructure/ws/events.ts';

// ── Plateau config ─────────────────────────────────────────────────────────

const PLATEAU = { xMax: 5, yMax: 5 };

// ── Board sizing ────────────────────────────────────────────────────────────

function boardSize(): { width: number; height: number } {
  const boardEl = document.getElementById('game-container');
  const w = Math.max(320, boardEl?.clientWidth ?? 700);
  const h = Math.max(320, boardEl?.clientHeight ?? 520);
  const s = Math.min(w, h);
  return { width: s, height: s };
}

// ── Phaser setup ───────────────────────────────────────────────────────────

const scene = new RoverScene();
const initialSize = boardSize();

const phaserGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-container',
  width: initialSize.width,
  height: initialSize.height,
  backgroundColor: '#0f172a',
  scene: [scene],
  scale: { mode: Phaser.RESIZE, autoCenter: Phaser.CENTER_BOTH },
});

// ── DOM refs ────────────────────────────────────────────────────────────────

const playBtn = document.getElementById('btn-play') as HTMLButtonElement | null;
const createRoomBtn = document.getElementById('btn-create-room') as HTMLButtonElement | null;
const joinRoomBtn = document.getElementById('btn-join-room') as HTMLButtonElement | null;
const startGameBtn = document.getElementById('btn-start-game') as HTMLButtonElement | null;
const playerNameInput = document.getElementById('player-name') as HTMLInputElement | null;
const roomCodeInput = document.getElementById('room-code') as HTMLInputElement | null;
const roomInfoText = document.getElementById('room-info-text');

const challengeText = document.getElementById('challenge-text');
const scoreText = document.getElementById('score-text');
const feedbackText = document.getElementById('feedback-text');
const stateText = document.querySelector('[data-role="state"]') as HTMLElement | null;

const panel = createStatePanel(document);

// ── State ──────────────────────────────────────────────────────────────────

const onlineMode =
  String((window as unknown as { __ONLINE_MODE__: string }).__ONLINE_MODE ?? '').toLowerCase() === 'true' ||
  new URLSearchParams(window.location.search).get('online') === '1';

let score = 0;
let challenge: { x: number; y: number } | null = null;
let selectedPosition = { x: 0, y: 0 };

const ws = new WSClient();

interface OnlineState {
  connected: boolean;
  roomId: string | null;
  roomCode: string | null;
  playerId: string | null;
  hostId: string | null;
  currentRound: number;
  deadlineMs: number | null;
  ranking: RankingEntry[];
}

const onlineState: OnlineState = {
  connected: false,
  roomId: null,
  roomCode: null,
  playerId: null,
  hostId: null,
  currentRound: 0,
  deadlineMs: null,
  ranking: [],
};

// ── Online mode helpers ─────────────────────────────────────────────────────

function syncLobbyUi(roomState: RoomState): void {
  if (!roomState) return;
  onlineState.roomId = roomState.roomId;
  onlineState.roomCode = roomState.roomCode;
  onlineState.hostId = roomState.hostId;
  const self = (roomState.players ?? []).find(
    (p) => p.name === playerNameInput?.value?.trim() || p.playerId === onlineState.playerId,
  );
  if (self?.playerId) onlineState.playerId = self.playerId;
  if (roomInfoText) {
    roomInfoText.textContent = `Sala ${roomState.roomCode} · Estado ${roomState.status} · Jugadores ${(roomState.players ?? []).map((p) => p.name).join(', ')}`;
  }
  if (startGameBtn) {
    startGameBtn.disabled = !(roomState.status === 'LOBBY' && onlineState.playerId === roomState.hostId && (roomState.players ?? []).length >= 2);
  }
}

function initOnlineMode(): void {
  const wsUrl = (window as unknown as { __WS_URL__: string }).__WS_URL__ ?? `ws://${window.location.host}/ws`;
  ws.connect(wsUrl);

  ws.on('connected', () => {
    onlineState.connected = true;
    if (roomInfoText) roomInfoText.textContent = 'Conectado. Creá o unite a una sala.';
  });

  ws.on('disconnected', () => {
    onlineState.connected = false;
    if (roomInfoText) roomInfoText.textContent = 'Desconectado del servidor.';
  });

  handleRoomSnapshot(ws, syncLobbyUi);

  handleRoundStarted(ws, (event: RoundStartedEvent) => {
    onlineState.currentRound = event.roundId;
    onlineState.deadlineMs = event.deadlineMs;
    panel.setCountdown(event.deadlineMs);
    panel.setLateAlert('');
    scene.unlockClaim();
    if (event.target) {
      challenge = event.target;
      challengeText!.innerHTML = `<strong>Objetivo:</strong> (${challenge.x}, ${challenge.y})`;
      scene.setTarget(challenge);
    }
  });

  handleClaimAck(ws, (event) => {
    if (event.status === 'ACCEPTED') {
      feedbackText!.textContent = `✅ Claim aceptado (+${event.scoreDelta})`;
      feedbackText!.style.color = '#4ade80';
    } else {
      feedbackText!.textContent = `❌ Claim rechazado (${event.reason})`;
      feedbackText!.style.color = '#f87171';
    }
  });

  handleLateAlert(ws, (event) => {
    panel.setLateAlert(event.message || 'Llegaste tarde.');
  });

  handleRankingUpdated(ws, (ranking: RankingEntry[]) => {
    onlineState.ranking = ranking;
    panel.setRanking(ranking);
  });

  handleError(ws, (code, message) => {
    feedbackText!.textContent = `❌ ${code}`;
    feedbackText!.style.color = '#f87171';
  });

  createRoomBtn?.addEventListener('click', () => {
    const playerName = playerNameInput?.value?.trim() || 'Jugador';
    ws.createRoom(playerName);
  });

  joinRoomBtn?.addEventListener('click', () => {
    const playerName = playerNameInput?.value?.trim() || 'Jugador';
    const roomCode = roomCodeInput?.value?.trim() || '';
    ws.joinRoom(playerName, roomCode);
  });

  startGameBtn?.addEventListener('click', () => {
    if (!onlineState.roomId) return;
    ws.startGame(onlineState.roomId);
  });

  scene.setClaimSubmitCallback((target: { x: number; y: number }) => {
    if (!onlineState.roomId || !onlineState.playerId || !onlineState.currentRound) return;
    ws.submitClaim(onlineState.roomId, onlineState.currentRound, onlineState.playerId, target);
  });

  setInterval(() => {
    if (!onlineState.deadlineMs) return;
    panel.setCountdown(onlineState.deadlineMs);
  }, 250);
}

// ── Single-player helpers ───────────────────────────────────────────────────

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function newChallenge(): void {
  challenge = {
    x: randomInt(0, PLATEAU.xMax),
    y: randomInt(0, PLATEAU.yMax),
  };
  challengeText!.innerHTML = `<strong>Objetivo:</strong> (${challenge.x}, ${challenge.y})`;
  scene.setTarget(challenge);
  feedbackText!.textContent = '';
}

function renderHud(): void {
  scoreText!.innerHTML = `<strong>Puntaje:</strong> ${score}`;
}

function setRover(state: RoverState): void {
  scene.setScenario(PLATEAU, state);
}

function renderState(state: RoverState): void {
  if (!stateText) return;
  stateText.textContent = `S=(${state.x},${state.y},${state.orientation})`;
}

// ── Event handlers ─────────────────────────────────────────────────────────

playBtn?.addEventListener('click', () => {
  if (onlineMode) return;
  const { x, y } = selectedPosition;
  const state: RoverState = { x, y, orientation: 'N' };
  setRover(state);
  renderState(state);

  const hit = state.x === challenge?.x && state.y === challenge?.y;
  if (hit) {
    score += 1;
    feedbackText!.textContent = '✅ ¡Correcto! Ganaste 1 punto.';
    feedbackText!.style.color = '#4ade80';
  } else {
    score = Math.max(0, score - 1);
    feedbackText!.textContent = `❌ Incorrecto. Era (${challenge?.x}, ${challenge?.y}).`;
    feedbackText!.style.color = '#f87171';
  }

  renderHud();

  selectedPosition = { x: 0, y: 0 };
  setRover({ x: 0, y: 0, orientation: 'N' });
  renderState({ x: 0, y: 0, orientation: 'N' });
  newChallenge();
});

scene.setCellSelectedCallback(({ x, y }) => {
  selectedPosition = { x, y };
  renderState({ x, y, orientation: 'N' });
});

// ── Resize handler ───────────────────────────────────────────────────────────

const resizeBoard = (): void => {
  const s = boardSize();
  if (phaserGame?.scale) phaserGame.scale.resize(s.width, s.height);
};

window.addEventListener('resize', resizeBoard);
if (typeof ResizeObserver !== 'undefined') {
  const boardEl = document.getElementById('game-container');
  if (boardEl) {
    const ro = new ResizeObserver(resizeBoard);
    ro.observe(boardEl);
  }
}

// ── Bootstrap ──────────────────────────────────────────────────────────────

renderHud();
setRover({ x: 0, y: 0, orientation: 'N' });
renderState({ x: 0, y: 0, orientation: 'N' });

if (onlineMode) {
  challengeText!.innerHTML = '<strong>Objetivo:</strong> esperando ronda...';
  if (playBtn) playBtn.disabled = true;
  initOnlineMode();
} else {
  newChallenge();
}
