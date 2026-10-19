import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
	setupTutorial,
	TUTORIAL_STEPS,
	TUTORIAL_STORAGE_KEY,
} from "../../src/ui/dom/tutorial.ts";

class FakeStorage {
	readonly values = new Map<string, string>();
	getItem(key: string): string | null {
		return this.values.get(key) ?? null;
	}
	setItem(key: string, value: string): void {
		this.values.set(key, value);
	}
}

class FakeElement {
	textContent = "";
	disabled = false;
	readonly classes = new Set<string>();
	private readonly listeners: Array<() => void> = [];
	readonly classList = {
		add: (name: string): void => {
			this.classes.add(name);
		},
		remove: (name: string): void => {
			this.classes.delete(name);
		},
	};
	addEventListener(_type: "click", listener: () => void): void {
		this.listeners.push(listener);
	}
	focus(): void {}
	click(): void {
		for (const listener of this.listeners) listener();
	}
}

function fakeTutorial() {
	return {
		overlay: new FakeElement(),
		title: new FakeElement(),
		body: new FakeElement(),
		progress: new FakeElement(),
		prev: new FakeElement(),
		next: new FakeElement(),
		close: new FakeElement(),
		openButton: new FakeElement(),
	};
}

test("the guide covers origin, X axis, Y axis, quadrants, and how to answer", () => {
	assert.deepEqual(
		TUTORIAL_STEPS.map((step) => step.title),
		["El origen", "Primero X", "Después Y", "Los cuadrantes", "Cómo responder"],
	);
	assert.match(TUTORIAL_STEPS[1].body, /\(x, y\)/);
	assert.match(TUTORIAL_STEPS[3].body, /I .*II .*III .*IV/s);
});

test("opens automatically on the first visit at the first step", () => {
	const elements = fakeTutorial();
	setupTutorial(elements, new FakeStorage());

	assert.ok(elements.overlay.classes.has("visible"));
	assert.equal(elements.title.textContent, "El origen");
	assert.equal(elements.progress.textContent, "1 de 5");
	assert.equal(elements.prev.disabled, true);
	assert.equal(elements.next.textContent, "Siguiente");
});

test("stays closed for a returning player but can be reopened from the guide button", () => {
	const elements = fakeTutorial();
	const storage = new FakeStorage();
	storage.setItem(TUTORIAL_STORAGE_KEY, "1");
	setupTutorial(elements, storage);
	assert.equal(elements.overlay.classes.has("visible"), false);

	elements.openButton.click();
	assert.ok(elements.overlay.classes.has("visible"));
	assert.equal(elements.title.textContent, "El origen");
});

test("navigates the steps, finishes on the last one, and remembers it was seen", () => {
	const elements = fakeTutorial();
	const storage = new FakeStorage();
	setupTutorial(elements, storage);

	elements.next.click();
	assert.equal(elements.title.textContent, "Primero X");
	assert.equal(elements.prev.disabled, false);
	elements.prev.click();
	assert.equal(elements.title.textContent, "El origen");

	for (let step = 1; step < TUTORIAL_STEPS.length; step += 1) elements.next.click();
	assert.equal(elements.title.textContent, "Cómo responder");
	assert.equal(elements.progress.textContent, "5 de 5");
	assert.equal(elements.next.textContent, "¡A jugar!");
	assert.equal(storage.getItem(TUTORIAL_STORAGE_KEY), null);

	elements.next.click();
	assert.equal(elements.overlay.classes.has("visible"), false);
	assert.equal(storage.getItem(TUTORIAL_STORAGE_KEY), "1");
});

test("closing early also marks the guide as seen", () => {
	const elements = fakeTutorial();
	const storage = new FakeStorage();
	setupTutorial(elements, storage);
	elements.close.click();

	assert.equal(elements.overlay.classes.has("visible"), false);
	assert.equal(storage.getItem(TUTORIAL_STORAGE_KEY), "1");
});

test("unavailable browser storage still shows the guide without failing", () => {
	const elements = fakeTutorial();
	const brokenStorage = {
		getItem(): string | null {
			throw new Error("blocked");
		},
		setItem(): void {
			throw new Error("blocked");
		},
	};
	setupTutorial(elements, brokenStorage);
	assert.ok(elements.overlay.classes.has("visible"));
	elements.close.click();
	assert.equal(elements.overlay.classes.has("visible"), false);
});

test("the page exposes an accessible guide dialog and a button to reopen it", () => {
	const indexHtml = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
	assert.match(indexHtml, /<button id="btn-tutorial"[^>]*type="button"[^>]*>¿Cómo se juega\?<\/button>/);
	assert.match(indexHtml, /id="tutorial-modal"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="tutorial-title"/);
	for (const id of ["tutorial-title", "tutorial-body", "tutorial-progress", "btn-tutorial-prev", "btn-tutorial-next", "btn-tutorial-close"]) {
		assert.ok(indexHtml.includes(`id="${id}"`), id);
	}
});
