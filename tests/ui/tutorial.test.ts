import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
	setupTutorial,
	TUTORIAL_STEP_WAIT_SECONDS,
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
	removeItem(key: string): void {
		this.values.delete(key);
	}
}

class FakeElement {
	textContent = "";
	innerHTML = "";
	disabled = false;
	hidden = false;
	checked = false;
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

class FakeClock {
	private now = 0;
	private tasks: Array<{ at: number; run: () => void; cancelled: boolean }> = [];

	readonly schedule = (run: () => void, ms: number): (() => void) => {
		const task = { at: this.now + ms, run, cancelled: false };
		this.tasks.push(task);
		return () => {
			task.cancelled = true;
		};
	};

	advance(ms: number): void {
		const end = this.now + ms;
		for (;;) {
			const due = this.tasks
				.filter((task) => !task.cancelled && task.at <= end)
				.sort((a, b) => a.at - b.at)[0];
			if (!due) break;
			this.now = due.at;
			due.cancelled = true;
			due.run();
		}
		this.now = end;
	}
}

function fakeTutorial() {
	return {
		overlay: new FakeElement(),
		title: new FakeElement(),
		body: new FakeElement(),
		progress: new FakeElement(),
		scene: new FakeElement(),
		prev: new FakeElement(),
		next: new FakeElement(),
		close: new FakeElement(),
		openButton: new FakeElement(),
		dontShowRow: new FakeElement(),
		dontShow: new FakeElement(),
	};
}

const WAIT_MS = TUTORIAL_STEP_WAIT_SECONDS * 1000;

function finishStep(elements: ReturnType<typeof fakeTutorial>, clock: FakeClock): void {
	clock.advance(WAIT_MS);
	elements.next.click();
}

test("the guide covers five short steps from the origin to answering", () => {
	assert.equal(TUTORIAL_STEP_WAIT_SECONDS, 5);
	// A new key so players who finished the old optional-after-first-run guide see it again.
	assert.equal(TUTORIAL_STORAGE_KEY, "xy-arena-tutorial-hidden");
	assert.deepEqual(
		TUTORIAL_STEPS.map((step) => step.title),
		["El origen", "Primero X", "Después Y", "Los cuadrantes", "Cómo responder"],
	);
	for (const step of TUTORIAL_STEPS) assert.ok(step.body.length <= 90, step.body);
	assert.match(TUTORIAL_STEPS[1].body, /\(x, y\)/);
	assert.match(TUTORIAL_STEPS[3].body, /I .*II .*III .*IV/s);
	assert.match(TUTORIAL_STEPS[4].body, /No arrastres/);
});

test("the guide opens on every load and cannot be closed or skipped", () => {
	const elements = fakeTutorial();
	const clock = new FakeClock();
	const tutorial = setupTutorial(elements, new FakeStorage(), clock.schedule);

	assert.ok(elements.overlay.classes.has("visible"));
	assert.equal(tutorial.canClose, false);
	assert.equal(elements.close.hidden, true);
	assert.equal(elements.title.textContent, "El origen");
	assert.equal(elements.progress.textContent, "1 de 5");
	assert.equal(elements.prev.disabled, true);

	elements.close.click();
	tutorial.close();
	assert.ok(elements.overlay.classes.has("visible"));
});

test("finishing without the opt-out keeps the guide on the next load", () => {
	const storage = new FakeStorage();
	const first = fakeTutorial();
	const clock = new FakeClock();
	setupTutorial(first, storage, clock.schedule);
	for (let step = 0; step < TUTORIAL_STEPS.length; step += 1) finishStep(first, clock);
	assert.equal(first.overlay.classes.has("visible"), false);
	assert.equal(storage.getItem(TUTORIAL_STORAGE_KEY), null);

	const reload = fakeTutorial();
	setupTutorial(reload, storage, new FakeClock().schedule);
	assert.ok(reload.overlay.classes.has("visible"));
});

test("Next unlocks only after five seconds and shows the remaining time", () => {
	const elements = fakeTutorial();
	const clock = new FakeClock();
	setupTutorial(elements, new FakeStorage(), clock.schedule);

	assert.equal(elements.next.disabled, true);
	assert.equal(elements.next.textContent, "Siguiente (5)");
	elements.next.click();
	assert.equal(elements.title.textContent, "El origen");

	clock.advance(WAIT_MS - 1000);
	assert.equal(elements.next.disabled, true);
	assert.equal(elements.next.textContent, "Siguiente (1)");

	clock.advance(1000);
	assert.equal(elements.next.disabled, false);
	assert.equal(elements.next.textContent, "Siguiente");
	elements.next.click();
	assert.equal(elements.title.textContent, "Primero X");
	assert.equal(elements.next.textContent, "Siguiente (5)");
});

test("each step shows its own animated scene", () => {
	const elements = fakeTutorial();
	const clock = new FakeClock();
	setupTutorial(elements, new FakeStorage(), clock.schedule);

	const scenes = [elements.scene.innerHTML];
	for (let step = 1; step < TUTORIAL_STEPS.length; step += 1) {
		finishStep(elements, clock);
		scenes.push(elements.scene.innerHTML);
	}
	assert.deepEqual(
		scenes.map((scene) => scene.match(/data-scene="([a-z-]+)"/)?.[1]),
		["origin", "x-axis", "y-axis", "quadrants", "answer"],
	);
});

test("going back to a finished step does not wait again, but an unfinished step restarts its wait", () => {
	const elements = fakeTutorial();
	const clock = new FakeClock();
	setupTutorial(elements, new FakeStorage(), clock.schedule);

	finishStep(elements, clock);
	clock.advance(2000);
	elements.prev.click();
	assert.equal(elements.title.textContent, "El origen");
	assert.equal(elements.next.disabled, false);

	elements.next.click();
	assert.equal(elements.title.textContent, "Primero X");
	assert.equal(elements.next.disabled, true);
	assert.equal(elements.next.textContent, "Siguiente (5)");
});

test("the do-not-show-again checkbox appears only on the last step", () => {
	const elements = fakeTutorial();
	const clock = new FakeClock();
	setupTutorial(elements, new FakeStorage(), clock.schedule);
	assert.equal(elements.dontShowRow.hidden, true);

	for (let step = 1; step < TUTORIAL_STEPS.length; step += 1) finishStep(elements, clock);
	assert.equal(elements.title.textContent, "Cómo responder");
	assert.equal(elements.dontShowRow.hidden, false);
	assert.equal(elements.next.textContent, "¡A jugar! (5)");

	elements.prev.click();
	assert.equal(elements.dontShowRow.hidden, true);
});

test("finishing with the checkbox marked stops the automatic guide on later loads", () => {
	const storage = new FakeStorage();
	const elements = fakeTutorial();
	const clock = new FakeClock();
	setupTutorial(elements, storage, clock.schedule);
	for (let step = 1; step < TUTORIAL_STEPS.length; step += 1) finishStep(elements, clock);
	elements.dontShow.checked = true;
	finishStep(elements, clock);
	assert.equal(elements.overlay.classes.has("visible"), false);
	assert.equal(storage.getItem(TUTORIAL_STORAGE_KEY), "1");

	const reload = fakeTutorial();
	setupTutorial(reload, storage, new FakeClock().schedule);
	assert.equal(reload.overlay.classes.has("visible"), false);
});

test("the guide button still opens the full mandatory guide after opting out", () => {
	const storage = new FakeStorage();
	storage.setItem(TUTORIAL_STORAGE_KEY, "1");
	const elements = fakeTutorial();
	const clock = new FakeClock();
	const tutorial = setupTutorial(elements, storage, clock.schedule);
	assert.equal(elements.overlay.classes.has("visible"), false);

	elements.openButton.click();
	assert.ok(elements.overlay.classes.has("visible"));
	assert.equal(tutorial.canClose, false);
	assert.equal(elements.close.hidden, true);
	assert.equal(elements.next.disabled, true);
	assert.equal(elements.next.textContent, "Siguiente (5)");
	assert.equal(elements.dontShow.checked, true);
});

test("unchecking the box on a later run brings the automatic guide back", () => {
	const storage = new FakeStorage();
	storage.setItem(TUTORIAL_STORAGE_KEY, "1");
	const elements = fakeTutorial();
	const clock = new FakeClock();
	setupTutorial(elements, storage, clock.schedule);
	elements.openButton.click();
	for (let step = 1; step < TUTORIAL_STEPS.length; step += 1) finishStep(elements, clock);
	elements.dontShow.checked = false;
	finishStep(elements, clock);
	assert.equal(storage.getItem(TUTORIAL_STORAGE_KEY), null);
});

test("unavailable browser storage still shows the mandatory guide and lets it finish", () => {
	const elements = fakeTutorial();
	const clock = new FakeClock();
	const brokenStorage = {
		getItem(): string | null {
			throw new Error("blocked");
		},
		setItem(): void {
			throw new Error("blocked");
		},
		removeItem(): void {
			throw new Error("blocked");
		},
	};
	setupTutorial(elements, brokenStorage, clock.schedule);
	assert.ok(elements.overlay.classes.has("visible"));
	for (let step = 1; step < TUTORIAL_STEPS.length; step += 1) finishStep(elements, clock);
	elements.dontShow.checked = true;
	finishStep(elements, clock);
	assert.equal(elements.overlay.classes.has("visible"), false);
});

test("the page exposes an accessible guide dialog with an animated scene area", () => {
	const indexHtml = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
	assert.match(indexHtml, /<button id="btn-tutorial"[^>]*type="button"[^>]*>¿Cómo se juega\?<\/button>/);
	assert.match(indexHtml, /id="tutorial-modal"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="tutorial-title"/);
	assert.match(indexHtml, /<div id="tutorial-scene" class="tutorial-scene" aria-hidden="true"><\/div>/);
	assert.match(indexHtml, /<button id="btn-tutorial-close" type="button" hidden>Cerrar guía<\/button>/);
	assert.doesNotMatch(indexHtml, /Saltar guía|id="tutorial-tap-demo"/);
	assert.match(indexHtml, /<label id="tutorial-dont-show-row" class="tutorial-dont-show" hidden>\s*<input id="tutorial-dont-show" type="checkbox" \/>\s*No volver a mostrar esta guía\s*<\/label>/);
	assert.match(indexHtml, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.tutorial-scene \*\s*\{[^}]*animation-duration: 0\.01ms !important;/);
	for (const id of ["tutorial-title", "tutorial-body", "tutorial-progress", "btn-tutorial-prev", "btn-tutorial-next"]) {
		assert.ok(indexHtml.includes(`id="${id}"`), id);
	}
});
