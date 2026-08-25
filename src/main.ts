import type { RoverState } from "@domain/rover/types.ts";
import { RoverScene } from "@ui/phaser/RoverScene.ts";
import { createStatePanel } from "@ui/dom/statePanel.ts";
import { setupThemeToggle } from "@ui/dom/theme.ts";
import {
	WSClient,
	handleRoomSnapshot,
	handleGameCountdown,
	handleRoundStarted,
	handleClaimAck,
	handleLateAlert,
	handleRankingUpdated,
	handleError,
	handleGameEnded,
	handleRoomClosed,
} from "@infrastructure/ws/client.ts";
import type {
	RoomState,
	RankingEntry,
	GameCountdownEvent,
	RoundStartedEvent,
	GameEndedEvent,
} from "@infrastructure/ws/events.ts";
import { getRoomErrorFeedback } from "@infrastructure/ws/room-feedback.ts";
import { deriveWsUrl } from "@infrastructure/ws/url.ts";

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

const themeToggle = document.getElementById("theme-toggle") as HTMLButtonElement | null;
if (themeToggle) {
	setupThemeToggle(
		document.documentElement,
		themeToggle,
		window.localStorage,
		(theme) => scene.setTheme(theme),
	);
}

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
const connectionStatus = document.getElementById("connection-status");

const panel = createStatePanel(document);

// ── State ──────────────────────────────────────────────────────────────────

let challenge: { x: number; y: number } | null = null;
let selectedPosition = { x: 0, y: 0 };

const ws = new WSClient();

interface OnlineState {
	connected: boolean;
	roomId: string | null;
	roomCode: string | null;
	playerId: string | null;
	hostId: string | null;
	status: RoomState["status"] | null;
	currentRound: number;
	countdownStartsAtMs: number | null;
	deadlineMs: number | null;
	ranking: RankingEntry[];
}

const onlineState: OnlineState = {
	connected: false,
	roomId: null,
	roomCode: null,
	playerId: null,
	hostId: null,
	status: null,
	currentRound: 0,
	countdownStartsAtMs: null,
	deadlineMs: null,
	ranking: [],
};
let isFinalRankingModalOpen = false;

// ── Online mode helpers ─────────────────────────────────────────────────────

function syncStartGameControl(): void {
	if (!startGameBtn) return;
	const isHost = onlineState.playerId === onlineState.hostId;
	const canStart =
		onlineState.status === "LOBBY" ||
		(onlineState.status === "FINAL" && !isFinalRankingModalOpen);
	startGameBtn.style.display = isHost && canStart ? "block" : "none";
	startGameBtn.disabled =
		!canStart ||
		onlineState.ranking.filter((player) => player.connected).length < 2;
}

function syncLobbyUi(roomState: RoomState): void {
	if (!roomState) return;
	onlineState.roomId = roomState.roomId;
	onlineState.roomCode = roomState.roomCode;
	onlineState.hostId = roomState.hostId;
	onlineState.status = roomState.status;
	onlineState.currentRound = roomState.currentRound;
	onlineState.countdownStartsAtMs = roomState.countdownStartsAtMs;
	onlineState.deadlineMs = roomState.roundDeadlineMs;
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

	// Mostrar u ocultar botón de iniciar partida según si es host.
	syncStartGameControl();
}

function setConnectionStatus(message: string, isError = false): void {
	if (!connectionStatus) return;
	connectionStatus.textContent = message;
	connectionStatus.classList.toggle("connection-error", isError);
}

function resetOnlineRoom(): void {
	onlineState.roomId = null;
	onlineState.roomCode = null;
	onlineState.playerId = null;
	onlineState.hostId = null;
	onlineState.status = null;
	onlineState.currentRound = 0;
	onlineState.countdownStartsAtMs = null;
	onlineState.deadlineMs = null;
	onlineState.ranking = [];
	isFinalRankingModalOpen = false;
	if (startGameBtn) {
		startGameBtn.style.display = "none";
		startGameBtn.disabled = true;
	}
	challenge = null;
	onlineMenuState = "menu";
	showOnlinePanel(onlineEntryMenu);
	updateRankingPanel([]);
	scene.setTarget(null);
	const targetEl = document.getElementById("target-coord");
	if (targetEl) targetEl.textContent = "...";
	const gameContainer = document.getElementById("game-container");
	if (gameContainer) gameContainer.classList.add("dimmed");
}

function initOnlineMode(): void {
	const wsUrl = deriveWsUrl(
		window.location.protocol,
		window.location.host,
		(window as unknown as { __WS_URL__?: string }).__WS_URL__,
	);
	let hasHostLeftClosureNotice = false;

	function clearHostLeftClosureFeedback(): void {
		if (!hasHostLeftClosureNotice || !feedbackText) return;
		feedbackText.textContent = "";
		feedbackText.style.color = "";
	}

	ws.on("connecting", () => {
		onlineState.connected = false;
		setConnectionStatus("Conectando con la sala...");
	});

	ws.on("reconnecting", () => {
		onlineState.connected = false;
		setConnectionStatus("Conexión perdida. Reintentando...");
	});

	ws.on("connected", () => {
		onlineState.connected = true;
		setConnectionStatus("Conectado. Podés crear o unirte a una sala.");
	});

	ws.on("disconnected", () => {
		onlineState.connected = false;
		setConnectionStatus(
			"No se pudo conectar. Presioná Crear o Unirse para reintentar.",
			true,
		);
	});

	handleRoomSnapshot(ws, (roomState, yourPlayerId) => {
		hasHostLeftClosureNotice = false;
		if (yourPlayerId) onlineState.playerId = yourPlayerId;
		syncLobbyUi(roomState);
		// Si hay roomId, mostrar lobby
		if (roomState.roomId) {
			onlineMenuState = "lobby";
			showOnlinePanel(onlineLobby);
		}
	});

	handleGameCountdown(ws, (event: GameCountdownEvent) => {
		closeFinalRankingModal();
		onlineState.status = "COUNTDOWN";
		onlineState.countdownStartsAtMs = event.startsAtMs;
		onlineState.deadlineMs = null;
		panel.setCountdown(event.startsAtMs);
		if (startGameBtn) startGameBtn.style.display = "none";
		if (feedbackText) {
			feedbackText.textContent = "La partida comienza en 3...";
			feedbackText.style.color = "";
		}
		const gameContainer = document.getElementById("game-container");
		if (gameContainer) gameContainer.classList.add("dimmed");
	});

	handleRoundStarted(ws, (event: RoundStartedEvent) => {
		closeFinalRankingModal();
		onlineState.status = "ROUND_ACTIVE";
		onlineState.countdownStartsAtMs = null;
		onlineState.currentRound = event.roundId;
		onlineState.deadlineMs = event.deadlineMs;
		panel.setCountdown(event.deadlineMs);
		panel.setLateAlert("");
		scene.unlockClaim();
		if (feedbackText?.textContent === "La partida comienza en 3...") {
			feedbackText.textContent = "";
			feedbackText.style.color = "";
		}
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

	handleError(ws, (code) => {
		const feedback = getRoomErrorFeedback(code, hasHostLeftClosureNotice);
		if (!feedback) return;
		feedbackText!.textContent = `❌ ${feedback}`;
		feedbackText!.style.color = "#f87171";
	});

	// Mostrar modal de ranking final al terminar el juego
	handleGameEnded(ws, (event: GameEndedEvent) => {
		syncLobbyUi(event.roomState);
		showFinalRankingModal(event.finalRanking || []);
	});

	handleRoomClosed(ws, (event) => {
		hasHostLeftClosureNotice = event.reason === "HOST_LEFT";
		resetOnlineRoom();
		feedbackText!.textContent =
			event.reason === "HOST_LEFT"
				? "La partida se canceló porque el host abandonó la sala. Podés crear o unirte a otra sala."
				: event.message;
		feedbackText!.style.color = "#f87171";
	});

	// Navegación del menú online
	createRoomBtn?.addEventListener("click", () => {
		clearHostLeftClosureFeedback();
		onlineMenuState = "create";
		showOnlinePanel(onlineCreatePanel);
	});

	joinRoomBtn?.addEventListener("click", () => {
		clearHostLeftClosureFeedback();
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
		if (
			onlineState.roomId &&
			onlineState.playerId === onlineState.hostId
		) {
			ws.leaveRoom(onlineState.roomId);
		}
		resetOnlineRoom();
	});

	startGameBtn?.addEventListener("click", () => {
		if (!onlineState.roomId) return;
		if (onlineState.status === "FINAL") {
			ws.startRematch(onlineState.roomId);
			return;
		}
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
		const deadlineMs =
			onlineState.countdownStartsAtMs ?? onlineState.deadlineMs;
		if (!deadlineMs) return;
		panel.setCountdown(deadlineMs);
	}, 250);

	ws.connect(wsUrl);
}

// Callback para actualizar "Tu elección" cuando se selecciona una celda
scene.setCellSelectedCallback(({ x, y }) => {
	selectedPosition = { x, y };
	const coordEl = document.getElementById("selected-coord");
	if (coordEl) coordEl.textContent = `(${x}, ${y})`;
});

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
	isFinalRankingModalOpen = true;
	syncStartGameControl();
	modal.classList.add("visible");
}

function closeFinalRankingModal(): void {
	const modal = document.getElementById("final-ranking-modal");
	if (modal) modal.classList.remove("visible");
	isFinalRankingModalOpen = false;
	syncStartGameControl();
	if (
		onlineState.status === "FINAL" &&
		onlineState.playerId !== onlineState.hostId &&
		feedbackText
	) {
		feedbackText.textContent = "Esperando que el host inicie otra partida.";
		feedbackText.style.color = "";
	}
}

// Helper para escapar HTML
function escapeHtml(text: string): string {
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

function setRover(state: RoverState): void {
	scene.setScenario(PLATEAU, state);
}

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

setRover({ x: 0, y: 0, orientation: "N" });

const targetEl = document.getElementById("target-coord");
if (targetEl) targetEl.textContent = "...";
initOnlineMode();
