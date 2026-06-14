import type { RoverState } from "@domain/rover/types.ts";
import { RoverScene } from "@ui/phaser/RoverScene.ts";
import { createStatePanel } from "@ui/dom/statePanel.ts";
import {
	WSClient,
	handleRoomSnapshot,
	handleRoundStarted,
	handleClaimAck,
	handleLateAlert,
	handleRankingUpdated,
	handleError,
	handleGameEnded,
} from "@infrastructure/ws/client.ts";
import type {
	RoomState,
	RankingEntry,
	RoundStartedEvent,
	GameEndedEvent,
} from "@infrastructure/ws/events.ts";

// ── Plateau config ─────────────────────────────────────────────────────────

const PLATEAU = { xMax: 10, yMax: 10 }; // Four quadrants: [-10, 10] for both axes

// ── Board sizing ────────────────────────────────────────────────────────────

function boardSize(): { width: number; height: number } {
	const boardEl = document.getElementById("game-container");
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
	parent: "game-container",
	width: initialSize.width,
	height: initialSize.height,
	backgroundColor: "#0f172a",
	scene: [scene],
	scale: { mode: Phaser.RESIZE, autoCenter: Phaser.CENTER_BOTH },
});

// ── DOM refs ────────────────────────────────────────────────────────────────

const playBtn = document.getElementById("btn-play") as HTMLButtonElement | null;

// Elementos del menú online
const createRoomBtn = document.getElementById(
	"btn-create-room",
) as HTMLButtonElement | null;
const joinRoomBtn = document.getElementById(
	"btn-join-room",
) as HTMLButtonElement | null;
const startGameBtn = document.getElementById(
	"btn-start-game",
) as HTMLButtonElement | null;
const leaveRoomBtn = document.getElementById(
	"btn-leave-room",
) as HTMLButtonElement | null;

// Paneles del menú online
const onlineEntryMenu = document.getElementById("online-entry-menu");
const onlineCreatePanel = document.getElementById("online-create-panel");
const onlineJoinPanel = document.getElementById("online-join-panel");
const onlineLobby = document.getElementById("online-lobby");

// Inputs de cada panel
const playerNameInputCreate = document.getElementById(
	"player-name-create",
) as HTMLInputElement | null;
const playerNameInputJoin = document.getElementById(
	"player-name-join",
) as HTMLInputElement | null;
const roomCodeInputJoin = document.getElementById(
	"room-code-join",
) as HTMLInputElement | null;

// Botones de confirmar
const confirmCreateBtn = document.getElementById(
	"btn-confirm-create",
) as HTMLButtonElement | null;
const confirmJoinBtn = document.getElementById(
	"btn-confirm-join",
) as HTMLButtonElement | null;

// Botones atrás
const backCreateBtn = document.getElementById(
	"btn-back-create",
) as HTMLButtonElement | null;
const backJoinBtn = document.getElementById(
	"btn-back-join",
) as HTMLButtonElement | null;

// Estado del menú
type OnlineMenuState = "menu" | "create" | "join" | "lobby";
let onlineMenuState: OnlineMenuState = "menu";

function showOnlinePanel(panel: HTMLElement | null): void {
	if (
		!onlineEntryMenu ||
		!onlineCreatePanel ||
		!onlineJoinPanel ||
		!onlineLobby
	)
		return;
	onlineEntryMenu.classList.add("hidden");
	onlineCreatePanel.classList.add("hidden");
	onlineJoinPanel.classList.add("hidden");
	onlineLobby.classList.add("hidden");
	if (panel) panel.classList.remove("hidden");
}

function showOnlineMenu(panel: HTMLElement | null): void {
	if (!onlineEntryMenu) return;
	onlineEntryMenu.classList.remove("hidden");
	if (panel) panel.classList.add("hidden");
	onlineLobby?.classList.add("hidden");
}

// Config inputs
const configMaxPlayers = document.getElementById(
	"config-max-players",
) as HTMLInputElement | null;
const configRounds = document.getElementById(
	"config-rounds",
) as HTMLInputElement | null;
const configSeconds = document.getElementById(
	"config-seconds",
) as HTMLInputElement | null;
const configMaxXy = document.getElementById(
	"config-max-xy",
) as HTMLInputElement | null;

const feedbackText = document.getElementById("feedback-text");

const panel = createStatePanel(document);

// ── State ──────────────────────────────────────────────────────────────────

const onlineMode =
	String(
		(window as unknown as { __ONLINE_MODE?: string }).__ONLINE_MODE ?? "",
	).toLowerCase() === "true" ||
	new URLSearchParams(window.location.search).get("online") === "1";

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
		(p) =>
			p.name === playerNameInputCreate?.value?.trim() ||
			p.name === playerNameInputJoin?.value?.trim() ||
			p.playerId === onlineState.playerId,
	);
	if (self?.playerId) onlineState.playerId = self.playerId;

	// Update lobby code display
	const lobbyCodeDisplay = document.getElementById("lobby-code-display");
	if (lobbyCodeDisplay) {
		lobbyCodeDisplay.textContent = roomState.roomCode || "—";
	}

	// Update ranking in lobby (antes de que	start el juego)
	const playersAsRanking: RankingEntry[] = (roomState.players ?? []).map(
		(p) => ({
			playerId: p.playerId,
			name: p.name,
			totalScore: p.totalScore ?? 0,
			connected: p.connected,
			lastAcceptedAtMs: p.lastAcceptedAtMs ?? null,
		}),
	);
	onlineState.ranking = playersAsRanking;
	updateRankingPanel(playersAsRanking);

	// Mostrar u ocultar botón de iniciar partida según si es host
	if (startGameBtn) {
		const isHost = onlineState.playerId === roomState.hostId;
		if (isHost) {
			startGameBtn.style.display = "block";
			startGameBtn.disabled = !(
				roomState.status === "LOBBY" && (roomState.players ?? []).length >= 2
			);
		} else {
			startGameBtn.style.display = "none";
		}
	}
}

function initOnlineMode(): void {
	const wsUrl =
		(window as unknown as { __WS_URL__: string }).__WS_URL__ ??
		`ws://${window.location.host}/ws`;
	ws.connect(wsUrl);

	ws.on("connected", () => {
		onlineState.connected = true;
	});

	ws.on("disconnected", () => {
		onlineState.connected = false;
	});

	handleRoomSnapshot(ws, (roomState, yourPlayerId) => {
		if (yourPlayerId) onlineState.playerId = yourPlayerId;
		syncLobbyUi(roomState);
		// Si hay roomId, mostrar lobby
		if (roomState.roomId) {
			onlineMenuState = "lobby";
			showOnlinePanel(onlineLobby);
		}
	});

	handleRoundStarted(ws, (event: RoundStartedEvent) => {
		onlineState.currentRound = event.roundId;
		onlineState.deadlineMs = event.deadlineMs;
		panel.setCountdown(event.deadlineMs);
		panel.setLateAlert("");
		scene.unlockClaim();
		// Restaurar el tablero para la nueva ronda
		const gameContainer = document.getElementById("game-container");
		if (gameContainer) gameContainer.classList.remove("dimmed");
		if (event.target) {
			challenge = event.target;
			// Update target display in header
			const targetEl = document.getElementById("target-coord");
			if (targetEl) targetEl.textContent = `(${challenge.x}, ${challenge.y})`;
			scene.setTarget(challenge);
		}
	});

	handleClaimAck(ws, (event) => {
		if (event.status === "ACCEPTED") {
			feedbackText!.textContent = `✅ Correcto! +${event.pointsEarned} puntos`;
			feedbackText!.style.color = "#4ade80";
		} else {
			if (event.reason === "TOO_LATE") {
				feedbackText!.textContent = `❌ Tiempo agotado! (+0)`;
			} else if (event.reason === "WRONG_TARGET") {
				feedbackText!.textContent = `❌ Incorrecto (+0)`;
			} else {
				feedbackText!.textContent = `❌ Claim rechazado (${event.reason})`;
			}
			feedbackText!.style.color = "#f87171";
		}
		// Opacar el tablero hasta la siguiente ronda
		const gameContainer = document.getElementById("game-container");
		if (gameContainer) gameContainer.classList.add("dimmed");
	});

	handleLateAlert(ws, (event) => {
		panel.setLateAlert(event.message || "Llegaste tarde.");
	});

	handleRankingUpdated(ws, (ranking: RankingEntry[]) => {
		onlineState.ranking = ranking;
		panel.setRanking(ranking);
		// Update ranking panel in DOM
		updateRankingPanel(ranking);
	});

	handleError(ws, (code, message) => {
		feedbackText!.textContent = `❌ ${code}`;
		feedbackText!.style.color = "#f87171";
	});

	// Mostrar modal de ranking final al terminar el juego
	handleGameEnded(ws, (event: GameEndedEvent) => {
		showFinalRankingModal(event.finalRanking || []);
	});

	// Navegación del menú online
	createRoomBtn?.addEventListener("click", () => {
		onlineMenuState = "create";
		showOnlinePanel(onlineCreatePanel);
	});

	joinRoomBtn?.addEventListener("click", () => {
		onlineMenuState = "join";
		showOnlinePanel(onlineJoinPanel);
	});

	backCreateBtn?.addEventListener("click", () => {
		onlineMenuState = "menu";
		showOnlinePanel(onlineEntryMenu);
	});

	backJoinBtn?.addEventListener("click", () => {
		onlineMenuState = "menu";
		showOnlinePanel(onlineEntryMenu);
	});

	confirmCreateBtn?.addEventListener("click", () => {
		const playerName = playerNameInputCreate?.value?.trim() || "Jugador";
		if (!playerName) {
			feedbackText!.textContent = "⚠️ Ingresa tu nombre";
			return;
		}
		const maxPlayers = parseInt(configMaxPlayers?.value || "8");
		const rounds = parseInt(configRounds?.value || "3");
		const seconds = parseInt(configSeconds?.value || "20");
		const maxXy = parseInt(configMaxXy?.value || "10");
		const config = {
			maxPlayers,
			rounds,
			roundDurationMs: seconds * 1000,
			maxX: maxXy,
			maxY: maxXy,
		};
		ws.createRoom(playerName, config);
	});

	confirmJoinBtn?.addEventListener("click", () => {
		const playerName = playerNameInputJoin?.value?.trim() || "Jugador";
		const roomCode = roomCodeInputJoin?.value?.trim() || "";
		if (!playerName || !roomCode) {
			feedbackText!.textContent = "⚠️ Ingresa tu nombre y el código de sala";
			return;
		}
		ws.joinRoom(playerName, roomCode);
	});

	leaveRoomBtn?.addEventListener("click", () => {
		// Limpiar estado y volver al menú
		onlineState.roomId = null;
		onlineState.playerId = null;
		onlineState.currentRound = 0;
		onlineState.deadlineMs = null;
		onlineState.ranking = [];
		onlineMenuState = "menu";
		showOnlineMenu(onlineEntryMenu);
		// Reset ranking display
		updateRankingPanel([]);
	});

	startGameBtn?.addEventListener("click", () => {
		if (!onlineState.roomId) return;
		ws.startGame(onlineState.roomId);
	});

	scene.setClaimSubmitCallback((target: { x: number; y: number }) => {
		if (
			!onlineState.roomId ||
			!onlineState.playerId ||
			!onlineState.currentRound
		)
			return;
		ws.submitClaim(
			onlineState.roomId,
			onlineState.currentRound,
			onlineState.playerId,
			target,
		);
	});

	setInterval(() => {
		if (!onlineState.deadlineMs) return;
		panel.setCountdown(onlineState.deadlineMs);
	}, 250);
}

// Callback para actualizar "Tu elección" cuando se selecciona una celda
scene.setCellSelectedCallback(({ x, y }) => {
	selectedPosition = { x, y };
	const coordEl = document.getElementById("selected-coord");
	if (coordEl) coordEl.textContent = `(${x}, ${y})`;
});

// Botón "Marcar" - modo single-player
playBtn?.addEventListener("click", () => {
	if (onlineMode) return;
	const { x, y } = selectedPosition;
	const state: RoverState = { x, y, orientation: "N" };
	setRover(state);
	panel.setCurrentState(state);

	const hit = state.x === challenge?.x && state.y === challenge?.y;
	if (hit) {
		score += 1;
		feedbackText!.textContent = "✅ ¡Correcto! Ganaste 1 punto.";
		feedbackText!.style.color = "#4ade80";
		// Nuevo objetivo inmediato tras acierto
		newChallenge();
		// Resetear la posición seleccionada
		selectedPosition = { x: 0, y: 0 };
		const coordEl = document.getElementById("selected-coord");
		if (coordEl) coordEl.textContent = "(0, 0)";
	} else {
		score = Math.max(0, score - 1);
		feedbackText!.textContent = `❌ Incorrecto. Era (${challenge?.x}, ${challenge?.y}).`;
		feedbackText!.style.color = "#f87171";
	}

	renderHud();
	setRover({ x: 0, y: 0, orientation: "N" });
});

// ── Single-player helpers ───────────────────────────────────────────────────

function randomInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Random in range [-max, max] (four quadrants)
function randomCoord(max: number): number {
	return randomInt(-max, max);
}

// Update ranking panel in the DOM
function updateRankingPanel(ranking: RankingEntry[]): void {
	const rankingList = document.getElementById("ranking-list");
	if (!rankingList) return;

	if (ranking.length === 0) {
		rankingList.innerHTML = '<li class="ranking-empty">Sin jugadores aún</li>';
		return;
	}

	const currentPlayerId = onlineState.playerId;
	rankingList.innerHTML = ranking
		.sort((a, b) => b.totalScore - a.totalScore)
		.map((entry, idx) => {
			const isCurrentPlayer = entry.playerId === currentPlayerId;
			const top3Class = idx < 3 ? "top-3" : "";
			const highlightClass = isCurrentPlayer ? "highlight" : "";
			return `
        <li class="ranking-item ${top3Class} ${highlightClass}">
          <span class="ranking-pos">${idx + 1}</span>
          <span class="ranking-name">${escapeHtml(entry.name)}</span>
          <span class="ranking-score">${entry.totalScore}</span>
        </li>
      `;
		})
		.join("");
}

// Mostrar modal de ranking final
function showFinalRankingModal(ranking: RankingEntry[]): void {
	// Crear modal si no existe
	let modal = document.getElementById("final-ranking-modal");
	if (!modal) {
		modal = document.createElement("div");
		modal.id = "final-ranking-modal";
		modal.className = "modal-overlay";
		modal.innerHTML = `
      <div class="modal-content">
        <h2 class="modal-title">🏆 Fin de la Partida</h2>
        <div class="podium" id="podium"></div>
        <div class="ranking-list-container">
          <ul class="ranking-list" id="final-ranking-list"></ul>
        </div>
        <button class="modal-close-btn" id="modal-close-btn">Cerrar</button>
      </div>
    `;
		document.body.appendChild(modal);

		// Cerrar modal al hacer click en el botón
		modal.querySelector("#modal-close-btn")?.addEventListener("click", () => {
			closeFinalRankingModal();
		});

		// Cerrar modal al hacer click fuera del contenido
		modal.addEventListener("click", (e) => {
			if (e.target === modal) closeFinalRankingModal();
		});
	}

	// Ordenar ranking
	const sortedRanking = [...ranking].sort(
		(a, b) => b.totalScore - a.totalScore,
	);
	const currentPlayerId = onlineState.playerId;

	// Renderizar podium (top 3)
	const podium = modal.querySelector("#podium") as HTMLElement;
	if (podium) {
		if (sortedRanking.length >= 3) {
			// Segundo y tercero primero (izquierda), luego primero (centro)
			const second = sortedRanking[1];
			const third = sortedRanking[2];
			const first = sortedRanking[0];
			podium.innerHTML = `
        <div class="podium-item podium-2">
          <span class="podium-pos">2</span>
          <span class="podium-name">${escapeHtml(second.name)}</span>
          <span class="podium-score">${second.totalScore}</span>
        </div>
        <div class="podium-item podium-1">
          <span class="podium-crown">👑</span>
          <span class="podium-name">${escapeHtml(first.name)}</span>
          <span class="podium-score">${first.totalScore}</span>
        </div>
        <div class="podium-item podium-3">
          <span class="podium-pos">3</span>
          <span class="podium-name">${escapeHtml(third.name)}</span>
          <span class="podium-score">${third.totalScore}</span>
        </div>
      `;
		} else if (sortedRanking.length === 2) {
			const second = sortedRanking[1];
			const first = sortedRanking[0];
			podium.innerHTML = `
        <div class="podium-item podium-2">
          <span class="podium-pos">2</span>
          <span class="podium-name">${escapeHtml(second.name)}</span>
          <span class="podium-score">${second.totalScore}</span>
        </div>
        <div class="podium-item podium-1">
          <span class="podium-crown">👑</span>
          <span class="podium-name">${escapeHtml(first.name)}</span>
          <span class="podium-score">${first.totalScore}</span>
        </div>
      `;
		} else if (sortedRanking.length === 1) {
			const first = sortedRanking[0];
			podium.innerHTML = `
        <div class="podium-item podium-1">
          <span class="podium-crown">👑</span>
          <span class="podium-name">${escapeHtml(first.name)}</span>
          <span class="podium-score">${first.totalScore}</span>
        </div>
      `;
		} else {
			podium.innerHTML = '<p class="podium-empty">No hay jugadores</p>';
		}
	}

	// Renderizar resto del ranking (del 4 en adelante)
	const rankingListEl = modal.querySelector(
		"#final-ranking-list",
	) as HTMLElement;
	if (rankingListEl) {
		const rest = sortedRanking.slice(3);
		if (rest.length > 0) {
			rankingListEl.innerHTML = rest
				.map((entry, idx) => {
					const isCurrentPlayer = entry.playerId === currentPlayerId;
					const highlightClass = isCurrentPlayer ? "highlight" : "";
					return `
            <li class="ranking-item ${highlightClass}">
              <span class="ranking-pos">${idx + 4}</span>
              <span class="ranking-name">${escapeHtml(entry.name)}</span>
              <span class="ranking-score">${entry.totalScore}</span>
            </li>
          `;
				})
				.join("");
		} else {
			rankingListEl.innerHTML = "";
		}
	}

	// Mostrar modal
	modal.classList.add("visible");
}

function closeFinalRankingModal(): void {
	const modal = document.getElementById("final-ranking-modal");
	if (modal) modal.classList.remove("visible");
}

// Helper para escapar HTML
function escapeHtml(text: string): string {
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

function renderHud(): void {
	// Update score in state panel (top)
	const scoreEl = document.querySelector('[data-role="score"]');
	if (scoreEl) scoreEl.textContent = String(score);
}

function setRover(state: RoverState): void {
	scene.setScenario(PLATEAU, state);
}

function newChallenge(): void {
	challenge = {
		x: randomCoord(PLATEAU.xMax),
		y: randomCoord(PLATEAU.yMax),
	};
	// Update target display in header
	const targetEl = document.getElementById("target-coord");
	if (targetEl) targetEl.textContent = `(${challenge.x}, ${challenge.y})`;
	scene.setTarget(challenge);
	feedbackText!.textContent = "";
}

// Exponer para el HTML (tab switching)
Object.assign(window, { generateNewChallenge: newChallenge });

// ── Resize handler ───────────────────────────────────────────────────────────

const resizeBoard = (): void => {
	const s = boardSize();
	if (phaserGame?.scale) phaserGame.scale.resize(s.width, s.height);
};

window.addEventListener("resize", resizeBoard);
if (typeof ResizeObserver !== "undefined") {
	const boardEl = document.getElementById("game-container");
	if (boardEl) {
		const ro = new ResizeObserver(resizeBoard);
		ro.observe(boardEl);
	}
}

// ── Bootstrap ──────────────────────────────────────────────────────────────

renderHud();
setRover({ x: 0, y: 0, orientation: "N" });

if (onlineMode) {
	// Reset target display
	const targetEl = document.getElementById("target-coord");
	if (targetEl) targetEl.textContent = "...";
	// Ocultar botón en modo online
	if (playBtn) {
		playBtn.disabled = true;
		playBtn.setAttribute("data-mode", "online");
	}
	initOnlineMode();
} else {
	// Mostrar botón en modo juego (single-player)
	if (playBtn) {
		playBtn.disabled = false;
		playBtn.setAttribute("data-mode", "single");
	}
	newChallenge();
}
