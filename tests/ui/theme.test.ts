import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
	initializeTheme,
	setupThemeToggle,
	THEME_STORAGE_KEY,
	type Theme,
} from "../../src/ui/dom/theme.ts";

class FakeStorage {
	readonly values = new Map<string, string>();

	getItem(key: string): string | null {
		return this.values.get(key) ?? null;
	}

	setItem(key: string, value: string): void {
		this.values.set(key, value);
	}
}

class FakeRoot {
	dataset: Record<string, string | undefined> = {};
}

class FakeButton {
	textContent = "";
	attributes = new Map<string, string>([
		["aria-pressed", "false"],
		["aria-label", "Usar tema claro"],
	]);
	private listener: (() => void) | undefined;

	setAttribute(name: string, value: string): void {
		this.attributes.set(name, value);
	}

	getAttribute(name: string): string | null {
		return this.attributes.get(name) ?? null;
	}

	addEventListener(type: string, listener: () => void): void {
		if (type === "click") this.listener = listener;
	}

	click(): void {
		this.listener?.();
	}
}

test("the document applies the saved theme before styles are parsed to prevent a flash", () => {
	const indexHtml = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
	const themeScript = indexHtml.indexOf("cartesian-game-theme");
	const styles = indexHtml.indexOf("<style>");

	assert.ok(themeScript >= 0);
	assert.ok(themeScript < styles);
});

test("a saved light preference synchronizes the switch before the application module initializes", () => {
	const indexHtml = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
	const storage = new FakeStorage();
	const button = new FakeButton();
	const document = {
		documentElement: new FakeRoot(),
		getElementById(id: string): FakeButton | null {
			return id === "theme-toggle" ? button : null;
		},
	};
	const inlineScripts = [...indexHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)];
	const switchScript = inlineScripts.find((script) => script[1].includes('getElementById("theme-toggle")'));
	const moduleScript = indexHtml.indexOf('<script type="module" src="/src/main.ts"></script>');

	storage.setItem(THEME_STORAGE_KEY, "light");
	assert.ok(switchScript, "the document should synchronize the static theme switch");
	assert.ok(switchScript.index! < moduleScript, "the switch must synchronize before module setup");
	for (const [, script] of inlineScripts) {
		Function("document", "localStorage", script)(document, storage);
	}

	assert.equal(document.documentElement.dataset.theme, "light");
	assert.equal(button.getAttribute("aria-pressed"), "true");
	assert.equal(button.getAttribute("aria-label"), "Usar tema oscuro");
	assert.match(indexHtml, /:root\[data-theme="light"\] \.theme-toggle__thumb/);

	const darkButton = new FakeButton();
	const darkDocument = {
		documentElement: new FakeRoot(),
		getElementById(id: string): FakeButton | null {
			return id === "theme-toggle" ? darkButton : null;
		},
	};
	const darkStorage = new FakeStorage();
	for (const [, script] of inlineScripts) {
		Function("document", "localStorage", script)(darkDocument, darkStorage);
	}

	assert.equal(darkDocument.documentElement.dataset.theme, "dark");
	assert.equal(darkButton.getAttribute("aria-pressed"), "false");
	assert.equal(darkButton.getAttribute("aria-label"), "Usar tema claro");
});

test("the theme control is a visual switch with a labeled native button and explicit selected-state styling", () => {
	const indexHtml = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

	assert.match(
		indexHtml,
		/<button id="theme-toggle" class="theme-toggle" type="button" aria-pressed="false" aria-label="Usar tema claro">/,
	);
	assert.match(indexHtml, /class="theme-toggle__track" aria-hidden="true"/);
	assert.match(indexHtml, /class="theme-toggle__icon theme-toggle__icon--sun"/);
	assert.match(indexHtml, /class="theme-toggle__icon theme-toggle__icon--moon"/);
	assert.match(indexHtml, /class="theme-toggle__thumb"/);
	assert.match(indexHtml, /\.theme-toggle\[aria-pressed="true"\] \.theme-toggle__thumb/);
	assert.match(indexHtml, /@media \(max-width: 900px\)[\s\S]*?\.theme-toggle \{\s*align-self: flex-start;/);
});

test("the theme switch uses fixed border-box geometry with inset-based thumb states", () => {
	const indexHtml = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

	assert.match(
		indexHtml,
		/\.theme-toggle\s*\{[\s\S]*?box-sizing: border-box;[\s\S]*?width: 4\.75rem;[\s\S]*?height: 2\.75rem;[\s\S]*?padding: 0;/,
	);
	assert.match(
		indexHtml,
		/\.theme-toggle__track\s*\{[\s\S]*?position: absolute;[\s\S]*?inset: 0;[\s\S]*?display: grid;[\s\S]*?grid-template-columns: repeat\(2, 1fr\);/,
	);
	assert.match(
		indexHtml,
		/\.theme-toggle__icon\s*\{[\s\S]*?justify-self: center;[\s\S]*?align-self: center;/,
	);
	assert.match(
		indexHtml,
		/\.theme-toggle__thumb\s*\{[\s\S]*?inset-block: var\(--theme-toggle-inset\);[\s\S]*?inset-inline-start: var\(--theme-toggle-inset\);[\s\S]*?inline-size: var\(--theme-toggle-thumb-size\);[\s\S]*?block-size: var\(--theme-toggle-thumb-size\);[\s\S]*?transition: inset-inline-start 180ms ease,/,
	);
	assert.match(
		indexHtml,
		/\.theme-toggle\[aria-pressed="true"\] \.theme-toggle__thumb,[\s\S]*?inset-inline-start: 2\.25rem;/,
	);
	assert.doesNotMatch(
		indexHtml,
		/\.theme-toggle\[aria-pressed="true"\] \.theme-toggle__thumb,[\s\S]*?:root\[data-theme="light"\] \.theme-toggle__thumb \{[^}]*transform: translateX/,
	);
});

test("theme initialization defaults to the existing dark palette and restores a saved preference", () => {
	const root = new FakeRoot();
	const storage = new FakeStorage();

	assert.equal(initializeTheme(root, storage), "dark");
	assert.equal(root.dataset.theme, "dark");

	storage.setItem(THEME_STORAGE_KEY, "light");
	assert.equal(initializeTheme(root, storage), "light");
	assert.equal(root.dataset.theme, "light");
});

test("theme toggle updates the accessible switch state and persists the selected theme", () => {
	const root = new FakeRoot();
	const storage = new FakeStorage();
	const button = new FakeButton();

	const getTheme = setupThemeToggle(root, button, storage);
	assert.equal(getTheme(), "dark");
	assert.equal(button.getAttribute("aria-pressed"), "false");
	assert.equal(button.getAttribute("aria-label"), "Usar tema claro");

	button.click();

	assert.equal(getTheme(), "light" satisfies Theme);
	assert.equal(root.dataset.theme, "light");
	assert.equal(storage.getItem(THEME_STORAGE_KEY), "light");
	assert.equal(button.getAttribute("aria-pressed"), "true");
	assert.equal(button.getAttribute("aria-label"), "Usar tema oscuro");
});

test("theme toggle notifies the board of the restored preference and runtime updates", () => {
	const root = new FakeRoot();
	const storage = new FakeStorage();
	const button = new FakeButton();
	const appliedThemes: Theme[] = [];
	storage.setItem(THEME_STORAGE_KEY, "light");

	setupThemeToggle(root, button, storage, (theme) => appliedThemes.push(theme));
	assert.equal(button.getAttribute("aria-pressed"), "true");
	assert.equal(button.getAttribute("aria-label"), "Usar tema oscuro");

	button.click();

	assert.deepEqual(appliedThemes, ["light", "dark"]);
});

test("invalid saved theme values fall back to the dark default", () => {
	const root = new FakeRoot();
	const storage = new FakeStorage();
	storage.setItem(THEME_STORAGE_KEY, "system");

	assert.equal(initializeTheme(root, storage), "dark");
	assert.equal(root.dataset.theme, "dark");
});
