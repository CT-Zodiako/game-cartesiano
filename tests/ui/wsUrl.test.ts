import assert from "node:assert/strict";
import test from "node:test";
import { deriveWsUrl } from "../../src/infrastructure/ws/url.js";

test("deriveWsUrl uses ws:// for plain http pages", () => {
	assert.equal(deriveWsUrl("http:", "localhost:5173"), "ws://localhost:5173/ws");
});

test("deriveWsUrl upgrades to wss:// for https pages (mixed-content guard)", () => {
	assert.equal(
		deriveWsUrl("https:", "mi-app.up.railway.app"),
		"wss://mi-app.up.railway.app/ws",
	);
});

test("deriveWsUrl keeps an explicit override untouched", () => {
	assert.equal(
		deriveWsUrl("https:", "mi-app.up.railway.app", "wss://otro-host/ws"),
		"wss://otro-host/ws",
	);
});
