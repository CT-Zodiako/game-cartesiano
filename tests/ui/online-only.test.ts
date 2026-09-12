import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const indexHtml = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../../src/main.ts", import.meta.url), "utf8");

test("the browser entry point offers only online room matchmaking", () => {
	assert.match(indexHtml, /id="online-entry-menu"/);
	assert.match(indexHtml, /id="btn-create-room"/);
	assert.match(indexHtml, /id="btn-join-room"/);
	assert.doesNotMatch(indexHtml, /data-tab="single"|id="tab-single"|id="btn-play"/);
	assert.doesNotMatch(indexHtml, /single-player|\?online=1/iu);
});

test("tap selection guidance stays in the game header without taking board space", () => {
	assert.doesNotMatch(indexHtml, /online-rules-notice|Modo Competitivo|notice-title|notice-list/);
	assert.match(indexHtml, /<div class="tap-hint" role="note">\s*<span class="tap-demo" aria-hidden="true"><\/span>\s*<span class="tap-hint-copy">\s*<span>Toca en el vértice de la cuadrícula<\/span>\s*<small>No arrastres<\/small>/);
	assert.equal(indexHtml.match(/class="tap-hint"/g)?.length, 1);
	assert.doesNotMatch(indexHtml, /class="tap-instruction"/);
	assert.match(indexHtml, /\.tap-hint\s*\{[^}]*font-size: 0\.7em;[^}]*text-align: right;/);
});

test("mobile puts a viewport-sized square game stage before scrollable controls", () => {
	const mobile = indexHtml.slice(indexHtml.indexOf('@media (max-width: 900px)'), indexHtml.indexOf('</style>'));
	assert.match(mobile, /\.left\s*\{[^}]*order: 2;[^}]*max-height: none;[^}]*overflow: visible;/);
	assert.match(mobile, /\.right\s*\{[^}]*order: 1;[^}]*box-sizing: border-box;[^}]*height: 100vh;[^}]*height: 100dvh;[^}]*grid-template-rows: auto minmax\(0, 1fr\) auto;/);
	for (const edge of ['top', 'right', 'bottom', 'left']) {
		assert.ok(mobile.includes(`env(safe-area-inset-${edge})`));
	}
	assert.match(mobile, /\.game-board-space\s*\{[^}]*container-type: size;[^}]*min-height: 0;/);
	assert.match(mobile, /#game-container\s*\{[^}]*width: min\(100cqw, 100cqh\);[^}]*height: auto;[^}]*aspect-ratio: 1 \/ 1;[^}]*max-height: none;/);
	assert.match(mobile, /\.game-header\s*\{[^}]*padding: 8px;/);
	assert.match(mobile, /\.tap-hint\s*\{[^}]*font-size: 0\.62em;/);
	assert.doesNotMatch(indexHtml, /max-height:\s*50dvh/);
	assert.match(indexHtml, /grid-template-columns: 320px 1fr;/);
});

test("tap guidance is compact and aligned in the header", () => {
	assert.match(indexHtml, /\.tap-hint span \{ color: var\(--color-text\); font-weight: 700; \}/);
	assert.match(indexHtml, /\.tap-hint small \{ font-size: 0\.9em; \}/);
	assert.match(indexHtml, /Toca en el vértice de la cuadrícula/);
	assert.doesNotMatch(indexHtml, /👆 Tocá un punto/);
	assert.match(indexHtml, /\.tap-hint \.tap-demo\s*\{[^}]*transform: scale\(0\.66\);/);
	assert.match(indexHtml, /\.tap-demo::before\s*\{[^}]*animation: tap-point 2s ease-in-out infinite;/);
	assert.match(indexHtml, /\.tap-demo::after\s*\{[^}]*animation: tap-pointer 2s ease-in-out infinite;/);
	assert.match(indexHtml, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.tap-demo::before, \.tap-demo::after\s*\{ animation: none; \}/);
});

test("the host can select a reduced mobile coordinate range in room configuration", () => {
	const configuration = indexHtml.slice(
		indexHtml.indexOf('<details class="config-section">'),
		indexHtml.indexOf('</details>'),
	);
	assert.match(configuration, /<label for="config-mobile-board">/);
	assert.match(configuration, /<input id="config-mobile-board" type="checkbox" role="switch" \/>/);
	assert.match(configuration, /Tablero móvil: rango reducido ±6 \(de -6 a 6\) para mayor precisión táctil\./);
	assert.match(configuration, /id="config-max-xy" type="number" value="6"/);
});

test("room configuration uses a prominent native disclosure with keyboard and touch feedback", () => {
	assert.match(indexHtml, /<details class="config-section">\s*<summary>Configurar sala<\/summary>/);
	assert.doesNotMatch(indexHtml, /<summary>⚙/);
	assert.match(indexHtml, /\.config-section summary\s*\{[^}]*min-height: 48px;[^}]*padding: 14px 16px;[^}]*border: 2px solid var\(--color-focus\);[^}]*font-size: 16px;[^}]*font-weight: 700;/);
	assert.match(indexHtml, /\.config-section summary::marker\s*\{/);
	assert.doesNotMatch(indexHtml, /summary[^{}]*\{[^}]*list-style:\s*none|summary::-webkit-details-marker/);
	assert.match(indexHtml, /\.config-section summary:active/);
	assert.match(indexHtml, /\.config-section\[open\] summary/);
	assert.match(indexHtml, /\.config-section summary:focus-visible, \.config-section input:focus-visible\s*\{[^}]*outline: 3px solid var\(--color-focus\);/);
});

test("configuration fields have labeled touch targets and a responsive non-overflowing grid", () => {
	assert.match(indexHtml, /<div class="config-fields">/);
	assert.match(indexHtml, /\.config-fields\s*\{[^}]*display: grid;[^}]*grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, 200px\), 1fr\)\);[^}]*gap: 16px;/);
	assert.match(indexHtml, /\.config-section input\[type="number"\]\s*\{[^}]*box-sizing: border-box;[^}]*width: 100%;[^}]*min-width: 0;[^}]*min-height: 48px;[^}]*font-size: 16px;/);
	for (const id of ["config-max-players", "config-rounds", "config-seconds", "config-max-xy"]) {
		assert.ok(indexHtml.includes(`<label for="${id}">`));
	}
	assert.match(indexHtml, /\.config-section label\[for="config-mobile-board"\]\s*\{[^}]*grid-column: 1 \/ -1;[^}]*min-height: 48px;/);
	assert.match(indexHtml, /\.config-section input\[type="checkbox"\]\s*\{[^}]*width: 24px;[^}]*height: 24px;/);
});

test("mobile defaults follow screen size once without overriding the host choice", () => {
	assert.match(mainSource, /const configMobileBoard = document\.getElementById\(\s*"config-mobile-board",?\s*\) as HTMLInputElement \| null;/);
	assert.match(mainSource, /configMobileBoard\.checked = window\.matchMedia\("\(max-width: 900px\)"\)\.matches;/);
	assert.equal(mainSource.match(/configMobileBoard\.checked\s*=/g)?.length, 1);
	assert.match(mainSource, /configMaxXy\.value = "6";/);
	assert.match(mainSource, /configMobileBoard\?\.addEventListener\("change", syncMobileBoardConfig\);/);
});

test("room creation applies mobile bounds or preserves the configured symmetric range", () => {
	const createSource = mainSource.slice(
		mainSource.indexOf('confirmCreateBtn?.addEventListener("click"'),
		mainSource.indexOf('confirmJoinBtn?.addEventListener("click"'),
	);
	assert.match(createSource, /const maxXy = configMobileBoard\?\.checked\s*\? 6\s*: parseInt\(configMaxXy\?\.value \|\| "6"\);/);
	assert.match(createSource, /maxX: maxXy,\s*maxY: maxXy,/);
	assert.match(createSource, /ws\.createRoom\(playerName, config\);/);
});

test("room snapshots render configured bounds before rounds and reset to the default board", () => {
	assert.match(mainSource, /let plateau = \{ xMax: 6, yMax: 6 \};/);
	const syncSource = mainSource.slice(
		mainSource.indexOf("function syncLobbyUi"),
		mainSource.indexOf("function resetOnlineRoom"),
	);
	assert.match(syncSource, /plateau = \{\s*xMax: positiveBoardBound\(roomState\.config\?\.maxX\),\s*yMax: positiveBoardBound\(roomState\.config\?\.maxY\),\s*\};\s*setRover\(/);
	assert.match(mainSource, /handleRoomSnapshot\(ws,[\s\S]*?syncLobbyUi\(roomState\);/);
	assert.match(mainSource, /typeof value === "number" && Number\.isFinite\(value\) && value > 0\s*\? value\s*: 6;/);
	assert.match(mainSource, /function resetOnlineRoom\(\): void \{\s*plateau = \{ xMax: 6, yMax: 6 \};\s*setRover\(/);
	assert.match(mainSource, /scene\.setScenario\(plateau, state\);/);
	assert.doesNotMatch(mainSource, /scene\.setScenario\(PLATEAU, state\)/);
});

test("the lobby start button is prominent, touch-friendly, and clearly disabled when unavailable", () => {
	assert.match(indexHtml, /<button id="btn-start-game" disabled>🚀 Iniciar partida<\/button>/);
	assert.match(indexHtml, /#btn-start-game\s*\{[^}]*min-height: 56px;[^}]*background: linear-gradient\([^}]*font-size: 1\.05rem;[^}]*font-weight: 800;/);
	assert.match(indexHtml, /#btn-start-game:hover:not\(:disabled\)/);
	assert.match(indexHtml, /#btn-start-game:focus-visible\s*\{[^}]*outline: 3px solid var\(--color-focus\);/);
	assert.match(indexHtml, /#btn-start-game:disabled\s*\{[^}]*cursor: not-allowed;/);
});

test("claim results appear as an animated friendly status card", () => {
	assert.doesNotMatch(indexHtml, /Tu elección|id="selection-display"/);
	assert.match(indexHtml, /\.claim-result-overlay\s*\{[^}]*position: fixed;[^}]*pointer-events: none;/);
	assert.match(indexHtml, /\.claim-result-card\s*\{[^}]*animation: claim-result-pop 420ms/);
	assert.match(mainSource, /window\.setTimeout\(\(\) =>[\s\S]*?\}, 2000\);/);
	assert.match(mainSource, /function hideClaimResult\(\): void \{/);
	assert.match(mainSource, /onlineState\.status = "COUNTDOWN";\s*hideClaimResult\(\);/);
	assert.match(mainSource, /onlineState\.status = "ROUND_ACTIVE";\s*hideClaimResult\(\);/);
	assert.match(indexHtml, /\.claim-result-card\.is-correct[^}]*border-color: #4ade80/);
	assert.match(indexHtml, /\.claim-result-card\.is-error[^}]*border-color: #f87171/);
	assert.match(mainSource, /showClaimResult\(accepted, event\.pointsEarned, selectedPosition, challenge\);/);
	assert.match(mainSource, /event\.reason === "ROUND_NOT_ACTIVE"/);
	assert.match(mainSource, /La ronda todavía no está activa\. Esperá al próximo objetivo/);
	assert.match(mainSource, /Elegiste \(\$\{selected\.x\}, \$\{selected\.y\}\)<br>Buscábamos/);
	assert.match(mainSource, /const title = accepted \? "✅ Correcto" : "❌ Error";/);
	assert.match(mainSource, /window\.setTimeout\(\(\) =>/);
});

test("the browser boot always initializes multiplayer without an offline branch", () => {
	assert.match(mainSource, /initOnlineMode\(\);\s*$/);
	assert.doesNotMatch(
		mainSource,
		/__ONLINE_MODE|URLSearchParams|onlineMode|btn-play|newChallenge|randomCoord/,
	);
});

test("the online lobby visibly reports connecting and failed connection states", () => {
	assert.match(indexHtml, /id="connection-status"[^>]*role="status"/);
	assert.match(mainSource, /ws\.on\("connecting"/);
	assert.match(mainSource, /ws\.on\("reconnecting"/);
	assert.match(mainSource, /ws\.on\("disconnected"/);
});

test("host departure notifies the server before the lobby resets and explains the cancellation", () => {
	assert.match(mainSource, /handleRoomClosed\(ws,/);
	assert.match(mainSource, /ws\.leaveRoom\(onlineState\.roomId\);[\s\S]*resetOnlineRoom\(\);/);
	assert.match(mainSource, /La partida se canceló porque el host abandonó la sala/);
});

test("host closure returns to matchmaking with the Create and Join controls visible", () => {
	const resetOnlineRoomSource = mainSource.slice(
		mainSource.indexOf("function resetOnlineRoom"),
		mainSource.indexOf("function initOnlineMode"),
	);
	assert.match(resetOnlineRoomSource, /onlineState\.roomId = null;/);
	assert.match(resetOnlineRoomSource, /onlineState\.playerId = null;/);
	assert.match(resetOnlineRoomSource, /onlineState\.currentRound = 0;/);
	assert.match(resetOnlineRoomSource, /challenge = null;/);
	assert.match(resetOnlineRoomSource, /showOnlinePanel\(onlineEntryMenu\);/);
});

test("final ranking closes before the normal host start control routes FINAL through START_REMATCH", () => {
	assert.doesNotMatch(mainSource, /btn-start-rematch|rematch-action|Jugar otra partida/);
	assert.match(mainSource, /onlineState\.status === "FINAL"/);
	assert.match(mainSource, /ws\.startRematch\(onlineState\.roomId\)/);
	assert.match(mainSource, /Esperando a que inicie la partida/);
	assert.match(mainSource, /closeFinalRankingModal\(\);/);
});

test("the host Start Game control remains hidden until final ranking is closed", () => {
	assert.match(mainSource, /let isFinalRankingModalOpen = false;/);
	assert.match(
		mainSource,
		/onlineState\.status === "FINAL"\s*&& !isFinalRankingModalOpen/,
	);
	assert.match(mainSource, /isFinalRankingModalOpen = true;[\s\S]*syncStartGameControl\(\);/);
	assert.match(mainSource, /isFinalRankingModalOpen = false;[\s\S]*syncStartGameControl\(\);/);
});

test("the countdown is driven by GAME_COUNTDOWN and hides Start Game until ROUND_STARTED", () => {
	assert.match(mainSource, /handleGameCountdown\(ws,/);
	assert.match(mainSource, /onlineState\.countdownStartsAtMs = event\.startsAtMs;/);
	assert.match(mainSource, /startGameBtn\.style\.display = "none"/);
	assert.match(mainSource, /onlineState\.countdownStartsAtMs = null;/);
});

test("ROUND_STARTED clears only the countdown feedback and restores its neutral color", () => {
	const roundStartedSource = mainSource.slice(
		mainSource.indexOf("handleRoundStarted(ws"),
		mainSource.indexOf("handleClaimAck(ws"),
	);

	assert.match(
		roundStartedSource,
		/if \(feedbackText\?\.textContent === "La partida comienza en 3\.\.\."\) \{[\s\S]*feedbackText\.textContent = "";[\s\S]*feedbackText\.style\.color = "";/,
	);
});

test("starting a fresh room flow clears a prior host-cancellation notice", () => {
	const createFlowSource = mainSource.slice(
		mainSource.indexOf('createRoomBtn?.addEventListener("click"'),
		mainSource.indexOf('joinRoomBtn?.addEventListener("click"'),
	);
	const joinFlowSource = mainSource.slice(
		mainSource.indexOf('joinRoomBtn?.addEventListener("click"'),
		mainSource.indexOf('backCreateBtn?.addEventListener("click"'),
	);

	const clearFeedbackSource = mainSource.slice(
		mainSource.indexOf("function clearHostLeftClosureFeedback"),
		mainSource.indexOf('ws.on("connecting"'),
	);

	assert.match(clearFeedbackSource, /if \(!hasHostLeftClosureNotice \|\| !feedbackText\) return;/);
	assert.match(clearFeedbackSource, /feedbackText\.textContent = "";/);
	assert.match(createFlowSource, /clearHostLeftClosureFeedback\(\);/);
	assert.match(joinFlowSource, /clearHostLeftClosureFeedback\(\);/);
});
