import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { setupMobileMenu } from "../../src/ui/dom/mobile-menu.ts";

class FakeElement {
	hidden = false;
	focused = 0;
	readonly classes = new Set<string>();
	readonly attributes = new Map<string, string>();
	private readonly listeners: Array<() => void> = [];
	readonly classList = {
		add: (name: string): void => {
			this.classes.add(name);
		},
		remove: (name: string): void => {
			this.classes.delete(name);
		},
	};
	setAttribute(name: string, value: string): void {
		this.attributes.set(name, value);
	}
	addEventListener(_type: "click", listener: () => void): void {
		this.listeners.push(listener);
	}
	focus(): void {
		this.focused += 1;
	}
	click(): void {
		for (const listener of this.listeners) listener();
	}
}

function fakeMenu() {
	return {
		toggle: new FakeElement(),
		panel: new FakeElement(),
		backdrop: new FakeElement(),
		close: new FakeElement(),
	};
}

test("starts closed with the toggle announcing a collapsed menu", () => {
	const elements = fakeMenu();
	const menu = setupMobileMenu(elements, () => true);

	assert.equal(menu.isOpen, false);
	assert.equal(elements.panel.classes.has("is-open"), false);
	assert.equal(elements.backdrop.hidden, true);
	assert.equal(elements.toggle.attributes.get("aria-expanded"), "false");
	assert.equal(elements.toggle.attributes.get("aria-label"), "Abrir menú");
});

test("the hamburger opens the panel and the close button or backdrop closes it", () => {
	const elements = fakeMenu();
	const menu = setupMobileMenu(elements, () => true);

	elements.toggle.click();
	assert.equal(menu.isOpen, true);
	assert.ok(elements.panel.classes.has("is-open"));
	assert.equal(elements.backdrop.hidden, false);
	assert.equal(elements.toggle.attributes.get("aria-expanded"), "true");
	assert.equal(elements.toggle.attributes.get("aria-label"), "Cerrar menú");
	assert.equal(elements.close.focused, 1);

	elements.close.click();
	assert.equal(menu.isOpen, false);
	assert.equal(elements.backdrop.hidden, true);
	assert.equal(elements.toggle.focused, 1);

	elements.toggle.click();
	elements.backdrop.click();
	assert.equal(menu.isOpen, false);
});

test("the hamburger toggles the menu closed when it is already open", () => {
	const elements = fakeMenu();
	const menu = setupMobileMenu(elements, () => true);
	elements.toggle.click();
	elements.toggle.click();
	assert.equal(menu.isOpen, false);
});

test("programmatic opening on a desktop layout never steals keyboard focus", () => {
	const elements = fakeMenu();
	const menu = setupMobileMenu(elements, () => false);
	menu.open();
	menu.close();
	assert.equal(elements.close.focused, 0);
	assert.equal(elements.toggle.focused, 0);
});

test("the page offers an accessible hamburger and an off-canvas panel on phones", () => {
	const indexHtml = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
	assert.match(indexHtml, /<button id="btn-menu" class="menu-toggle" type="button" aria-controls="side-panel" aria-expanded="false" aria-label="Abrir menú">☰<\/button>/);
	assert.match(indexHtml, /<section class="left" id="side-panel">/);
	assert.match(indexHtml, /<button id="btn-menu-close" class="menu-close" type="button" aria-label="Cerrar menú">✕<\/button>/);
	assert.match(indexHtml, /<div id="menu-backdrop" class="menu-backdrop" hidden><\/div>/);
	assert.match(indexHtml, /\.menu-toggle, \.menu-close\s*\{\s*display: none;/);

	const mobile = indexHtml.slice(indexHtml.indexOf("@media (max-width: 900px)"), indexHtml.indexOf("</style>"));
	assert.match(mobile, /\.left\s*\{[^}]*position: fixed;[^}]*transform: translateX\(-105%\);[^}]*overflow-y: auto;/);
	assert.match(mobile, /\.left\.is-open\s*\{\s*transform: none;/);
	assert.match(mobile, /\.menu-toggle, \.menu-close\s*\{\s*display: inline-grid;/);
	assert.match(mobile, /\.menu-backdrop\s*\{[^}]*position: fixed;/);
	// The hamburger, time, and target share the first header row; the tap hint takes a full second row.
	assert.match(mobile, /\.game-header \{ grid-template-columns: auto auto 1fr; column-gap: 10px; \}/);
	assert.match(mobile, /\.game-header \.tap-hint \{ grid-column: 1 \/ -1; justify-self: center; \}/);
});
