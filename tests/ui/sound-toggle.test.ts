import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { setupSoundToggle, SOUND_STORAGE_KEY } from "../../src/ui/dom/sound-toggle.ts";

class FakeStorage {
	readonly values = new Map<string, string>();
	getItem(key: string): string | null {
		return this.values.get(key) ?? null;
	}
	setItem(key: string, value: string): void {
		this.values.set(key, value);
	}
}

class FakeButton {
	textContent = "";
	readonly attributes = new Map<string, string>();
	private listener: (() => void) | undefined;
	setAttribute(name: string, value: string): void {
		this.attributes.set(name, value);
	}
	addEventListener(_type: "click", listener: () => void): void {
		this.listener = listener;
	}
	click(): void {
		this.listener?.();
	}
}

test("sound starts enabled and the button offers to mute it", () => {
	const sounds = { muted: false };
	const button = new FakeButton();
	setupSoundToggle(button, new FakeStorage(), sounds);

	assert.equal(sounds.muted, false);
	assert.equal(button.textContent, "🔊");
	assert.equal(button.attributes.get("aria-pressed"), "false");
	assert.equal(button.attributes.get("aria-label"), "Silenciar sonidos");
});

test("muting is applied immediately, persisted, and reversible", () => {
	const sounds = { muted: false };
	const button = new FakeButton();
	const storage = new FakeStorage();
	setupSoundToggle(button, storage, sounds);

	button.click();
	assert.equal(sounds.muted, true);
	assert.equal(storage.getItem(SOUND_STORAGE_KEY), "muted");
	assert.equal(button.textContent, "🔇");
	assert.equal(button.attributes.get("aria-pressed"), "true");
	assert.equal(button.attributes.get("aria-label"), "Activar sonidos");

	button.click();
	assert.equal(sounds.muted, false);
	assert.equal(storage.getItem(SOUND_STORAGE_KEY), "on");
	assert.equal(button.textContent, "🔊");
});

test("a saved mute preference is restored on load", () => {
	const sounds = { muted: false };
	const storage = new FakeStorage();
	storage.setItem(SOUND_STORAGE_KEY, "muted");
	const button = new FakeButton();
	setupSoundToggle(button, storage, sounds);

	assert.equal(sounds.muted, true);
	assert.equal(button.attributes.get("aria-pressed"), "true");
});

test("unavailable storage keeps the toggle working for the session", () => {
	const sounds = { muted: false };
	const button = new FakeButton();
	const brokenStorage = {
		getItem(): string | null {
			throw new Error("blocked");
		},
		setItem(): void {
			throw new Error("blocked");
		},
	};
	setupSoundToggle(button, brokenStorage, sounds);
	button.click();
	assert.equal(sounds.muted, true);
});

test("the page exposes the sound toggle next to the guide button", () => {
	const indexHtml = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
	assert.match(
		indexHtml,
		/<div class="help-row">\s*<button id="btn-tutorial"[^>]*>¿Cómo se juega\?<\/button>\s*<button id="sound-toggle" class="sound-toggle" type="button" aria-pressed="false" aria-label="Silenciar sonidos">🔊<\/button>\s*<\/div>/,
	);
});
