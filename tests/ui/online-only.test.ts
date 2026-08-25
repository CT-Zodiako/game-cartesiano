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
	assert.match(mainSource, /Esperando que el host inicie otra partida/);
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
