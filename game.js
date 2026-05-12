import { RoverScene } from './src/ui/phaser/RoverScene.js';
import { createStatePanel } from './src/ui/statePanel.js';
const plateau = { xMax: 5, yMax: 5 };
const boardEl = document.getElementById('game-container');
const onlineMode =
  String(window.__ONLINE_MODE ?? '').toLowerCase() === 'true' ||
  new URLSearchParams(window.location.search).get('online') === '1';

function boardSize() {
  const w = Math.max(320, boardEl?.clientWidth ?? 700);
  const h = Math.max(320, boardEl?.clientHeight ?? 520);
  const s = Math.min(w, h);
  return { width: s, height: s };
}

const scene = new RoverScene();
const initialSize = boardSize();
const phaserGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-container',
  width: initialSize.width,
  height: initialSize.height,
  backgroundColor: '#0f172a',
  scene: [scene],
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
});

const playBtn = document.getElementById('btn-play');
const createRoomBtn = document.getElementById('btn-create-room');
const joinRoomBtn = document.getElementById('btn-join-room');
const startGameBtn = document.getElementById('btn-start-game');
const playerNameInput = document.getElementById('player-name');
const roomCodeInput = document.getElementById('room-code');
const roomInfoText = document.getElementById('room-info-text');

const challengeText = document.getElementById('challenge-text');
const scoreText = document.getElementById('score-text');
const feedbackText = document.getElementById('feedback-text');
const stateText = document.querySelector('[data-role="state"]');
const panel = createStatePanel(document);

let score = 0;
let challenge = null;
let selectedPosition = { x: 0, y: 0 };
let ws = null;
let reqSeq = 1;
let onlineState = {
  connected: false,
  roomId: null,
  roomCode: null,
  playerId: null,
  hostId: null,
  currentRound: 0,
  deadlineMs: null,
  ranking: [],
};

function nextReqId() {
  return `c-${reqSeq++}`;
}

function sendEvent(type, payload = {}) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type, reqId: nextReqId(), ...payload }));
}

function syncLobbyUi(roomState) {
  if (!roomState) return;
  onlineState.roomId = roomState.roomId;
  onlineState.roomCode = roomState.roomCode;
  onlineState.hostId = roomState.hostId;
  const self = (roomState.players || []).find((p) => p.name === playerNameInput?.value?.trim() || p.playerId === onlineState.playerId);
  if (self?.playerId) onlineState.playerId = self.playerId;
  if (roomInfoText) {
    roomInfoText.textContent = `Sala ${roomState.roomCode} · Estado ${roomState.status} · Jugadores ${(roomState.players || []).map((p) => p.name).join(', ')}`;
  }
  if (startGameBtn) {
    startGameBtn.disabled = !(roomState.status === 'LOBBY' && onlineState.playerId === roomState.hostId && (roomState.players || []).length >= 2);
  }
}

function handleWsEvent(event) {
  if (event.type === 'ROOM_SNAPSHOT') {
    syncLobbyUi(event.roomState);
    return;
  }
  if (event.type === 'ROUND_STARTED') {
    onlineState.currentRound = event.roundId;
    onlineState.deadlineMs = event.deadlineMs;
    panel.setCountdown(event.deadlineMs);
    panel.setLateAlert('');
    scene.unlockClaim();
    if (event.target) {
      challenge = event.target;
      challengeText.innerHTML = `<strong>Objetivo:</strong> (${challenge.x}, ${challenge.y})`;
      scene.setTarget(challenge);
    }
    return;
  }
  if (event.type === 'CLAIM_ACK') {
    if (event.status === 'ACCEPTED') {
      feedbackText.textContent = `✅ Claim aceptado (+${event.scoreDelta})`;
      feedbackText.style.color = '#4ade80';
    } else {
      feedbackText.textContent = `❌ Claim rechazado (${event.reason})`;
      feedbackText.style.color = '#f87171';
    }
    return;
  }
  if (event.type === 'LATE_ALERT') {
    panel.setLateAlert(event.message || 'Llegaste tarde.');
    return;
  }
  if (event.type === 'RANKING_UPDATED') {
    onlineState.ranking = event.ranking || [];
    panel.setRanking(onlineState.ranking);
    return;
  }
  if (event.type === 'ERROR') {
    feedbackText.textContent = `❌ ${event.code}`;
    feedbackText.style.color = '#f87171';
  }
}

function initOnlineMode() {
  const wsUrl = window.__WS_URL || `ws://${window.location.host}/ws`;
  try {
    ws = new WebSocket(wsUrl);
  } catch {
    feedbackText.textContent = '❌ No se pudo crear conexión WebSocket.';
    feedbackText.style.color = '#f87171';
    return;
  }
  ws.addEventListener('open', () => {
    onlineState.connected = true;
    if (roomInfoText) roomInfoText.textContent = 'Conectado. Creá o unite a una sala.';
  });
  ws.addEventListener('message', (raw) => {
    try {
      const parsed = JSON.parse(raw.data);
      handleWsEvent(parsed);
    } catch {
      // ignore
    }
  });
  ws.addEventListener('close', () => {
    onlineState.connected = false;
    if (roomInfoText) roomInfoText.textContent = 'Desconectado del servidor.';
  });

  createRoomBtn?.addEventListener('click', () => {
    const playerName = playerNameInput?.value?.trim() || 'Jugador';
    sendEvent('CREATE_ROOM', { playerName });
  });
  joinRoomBtn?.addEventListener('click', () => {
    const playerName = playerNameInput?.value?.trim() || 'Jugador';
    const roomCode = roomCodeInput?.value?.trim() || '';
    sendEvent('JOIN_ROOM', { playerName, roomCode });
  });
  startGameBtn?.addEventListener('click', () => {
    if (!onlineState.roomId) return;
    sendEvent('START_GAME', { roomId: onlineState.roomId });
  });

  scene.setClaimSubmitCallback((target) => {
    if (!onlineState.roomId || !onlineState.playerId || !onlineState.currentRound) return;
    sendEvent('SUBMIT_CLAIM', {
      roomId: onlineState.roomId,
      roundId: onlineState.currentRound,
      playerId: onlineState.playerId,
      target,
      sentAtClientMs: Date.now(),
    });
  });

  setInterval(() => {
    if (!onlineState.deadlineMs) return;
    panel.setCountdown(onlineState.deadlineMs);
  }, 250);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function newChallenge() {
  challenge = {
    x: randomInt(0, plateau.xMax),
    y: randomInt(0, plateau.yMax),
  };
  challengeText.innerHTML = `<strong>Objetivo:</strong> (${challenge.x}, ${challenge.y})`;
  scene.setTarget(challenge);
  feedbackText.textContent = '';
}

function renderHud() {
  scoreText.innerHTML = `<strong>Puntaje:</strong> ${score}`;
}

function getGuess() {
  const { x, y } = selectedPosition;
  return { value: { x, y, orientation: 'N' } };
}

function setRover(state) {
  scene.setScenario(plateau, state);
}

function renderState(state) {
  if (!stateText) return;
  stateText.textContent = `S=(${state.x},${state.y},${state.orientation})`;
}

playBtn.addEventListener('click', () => {
  if (onlineMode) return;
  const guess = getGuess();
  if (guess.error) {
    feedbackText.textContent = guess.error;
    feedbackText.style.color = '#f87171';
    return;
  }

  const state = guess.value;
  setRover(state);
  renderState(state);

  const hit = state.x === challenge.x && state.y === challenge.y;
  if (hit) {
    score += 1;
    feedbackText.textContent = '✅ ¡Correcto! Ganaste 1 punto.';
    feedbackText.style.color = '#4ade80';
  } else {
    score = Math.max(0, score - 1);
    feedbackText.textContent = `❌ Incorrecto. Era (${challenge.x}, ${challenge.y}).`;
    feedbackText.style.color = '#f87171';
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

const resizeBoard = () => {
  const s = boardSize();
  if (phaserGame?.scale) phaserGame.scale.resize(s.width, s.height);
};

window.addEventListener('resize', resizeBoard);
if (typeof ResizeObserver !== 'undefined' && boardEl) {
  const ro = new ResizeObserver(resizeBoard);
  ro.observe(boardEl);
}

renderHud();
setRover({ x: 0, y: 0, orientation: 'N' });
renderState({ x: 0, y: 0, orientation: 'N' });
if (onlineMode) {
  challengeText.innerHTML = '<strong>Objetivo:</strong> esperando ronda...';
  playBtn.disabled = true;
  initOnlineMode();
} else {
  newChallenge();
}
