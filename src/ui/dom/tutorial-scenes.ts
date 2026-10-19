/**
 * Animated mini boards for the guide. They mirror the real board (grid, cyan axes, blue X numbers,
 * green Y numbers, diamond marker) so students recognize the game before playing. Motion lives in CSS.
 */

const SIZE = 240;
const RANGE = 3;
const MARGIN = 24;
const STEP = (SIZE - MARGIN * 2) / (RANGE * 2);
const CENTER = SIZE / 2;

export function scenePoint(x: number, y: number): { x: number; y: number } {
	return { x: CENTER + x * STEP, y: CENTER - y * STEP };
}

function board(): string {
	const lines: string[] = [];
	for (let i = -RANGE; i <= RANGE; i += 1) {
		const offset = CENTER + i * STEP;
		lines.push(`<line class="tut-grid" x1="${offset}" y1="${MARGIN}" x2="${offset}" y2="${SIZE - MARGIN}"/>`);
		lines.push(`<line class="tut-grid" x1="${MARGIN}" y1="${offset}" x2="${SIZE - MARGIN}" y2="${offset}"/>`);
	}
	lines.push(`<line class="tut-axis" x1="${CENTER}" y1="${MARGIN}" x2="${CENTER}" y2="${SIZE - MARGIN}"/>`);
	lines.push(`<line class="tut-axis" x1="${MARGIN}" y1="${CENTER}" x2="${SIZE - MARGIN}" y2="${CENTER}"/>`);
	for (let i = -RANGE; i <= RANGE; i += 1) {
		if (i === 0) continue;
		const { x } = scenePoint(i, 0);
		const { y } = scenePoint(0, i);
		lines.push(`<text class="tut-x-num" x="${x}" y="${CENTER + 15}">${i}</text>`);
		lines.push(`<text class="tut-y-num" x="${CENTER - 6}" y="${y + 4}">${i}</text>`);
	}
	lines.push(`<text class="tut-axis-name" x="${SIZE - 10}" y="${CENTER + 4}">X</text>`);
	lines.push(`<text class="tut-axis-name" x="${CENTER + 10}" y="${MARGIN - 8}">Y</text>`);
	return lines.join("");
}

function marker(): string {
	return `<g class="tut-marker"><polygon points="0,-10 10,0 0,10 -10,0" class="tut-marker-outline"/><polygon points="0,-6 6,0 0,6 -6,0" class="tut-marker-fill"/></g>`;
}

function pointer(className: string, x: number, y: number, style = ""): string {
	const styleAttr = style ? ` style="${style}"` : "";
	return `<g class="tut-pointer ${className}" transform="translate(${x} ${y})"${styleAttr}><circle class="tut-ripple" r="9"/><path class="tut-hand" d="M0 0 L0 22 L6 16 L10 26 L14 24 L10 14 L18 14 Z"/></g>`;
}

function bubble(className: string, x: number, y: number, text: string): string {
	const width = Math.max(56, Math.round(text.length * 7.5 + 18));
	return `<g class="tut-bubble ${className}" transform="translate(${x} ${y})"><rect x="${-width / 2}" y="-13" width="${width}" height="24" rx="12"/><text y="4">${text}</text></g>`;
}

function trail(axis: "x" | "y", from: { x: number; y: number }, to: { x: number; y: number }): string {
	return `<line class="tut-trail tut-trail-${axis}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" pathLength="1"/>`;
}

function slidingMarker(start: { x: number; y: number }, dx: number, dy: number): string {
	return `<g transform="translate(${start.x} ${start.y})"><g class="tut-slide" style="--dx: ${dx}px; --dy: ${dy}px">${marker()}</g></g>`;
}

function svg(scene: string, content: string): string {
	return `<svg class="tut-board" viewBox="0 0 ${SIZE} ${SIZE}" data-scene="${scene}" role="img">${board()}${content}</svg>`;
}

function originScene(): string {
	const origin = scenePoint(0, 0);
	return svg(
		"origin",
		`<g transform="translate(${origin.x} ${origin.y})"><circle class="tut-pulse" r="14"/>${marker()}</g>` +
			pointer("tut-tap", origin.x, origin.y) +
			bubble("tut-pop", origin.x + 44, origin.y - 30, "(0, 0)"),
	);
}

function xScene(): string {
	const origin = scenePoint(0, 0);
	const end = scenePoint(2, 0);
	return svg(
		"x-axis",
		`<line class="tut-axis-glow tut-axis-glow-x" x1="${MARGIN}" y1="${CENTER}" x2="${SIZE - MARGIN}" y2="${CENTER}"/>` +
			trail("x", origin, end) +
			slidingMarker(origin, end.x - origin.x, 0) +
			bubble("tut-pop tut-late", end.x, end.y - 30, "x = 2"),
	);
}

function yScene(): string {
	const start = scenePoint(2, 0);
	const end = scenePoint(2, 3);
	const origin = scenePoint(0, 0);
	return svg(
		"y-axis",
		`<line class="tut-trail-done tut-trail-x" x1="${origin.x}" y1="${origin.y}" x2="${start.x}" y2="${start.y}"/>` +
			trail("y", start, end) +
			slidingMarker(start, 0, end.y - start.y) +
			bubble("tut-pop tut-late", end.x - 30, end.y + 30, "(2, 3)"),
	);
}

function quadrantScene(): string {
	const quadrants: Array<[string, number, number]> = [
		["I (+, +)", CENTER, MARGIN],
		["II (−, +)", MARGIN, MARGIN],
		["III (−, −)", MARGIN, CENTER],
		["IV (+, −)", CENTER, CENTER],
	];
	const half = CENTER - MARGIN;
	const content = quadrants
		.map(([label, x, y], index) => `<g class="tut-quadrant-group" style="--order: ${index}"><rect class="tut-quadrant" x="${x}" y="${y}" width="${half}" height="${half}"/><text class="tut-quadrant-label" x="${x + half / 2}" y="${y + half / 2 + 5}">${label}</text></g>`)
		.join("");
	const origin = scenePoint(0, 0);
	return svg("quadrants", `${content}<g transform="translate(${origin.x} ${origin.y})">${marker()}</g>`);
}

function answerScene(): string {
	const origin = scenePoint(0, 0);
	const corner = scenePoint(-2, 0);
	const target = scenePoint(-2, 1);
	return svg(
		"answer",
		bubble("tut-target", scenePoint(1.85, 0).x, scenePoint(0, 2.5).y, "Buscá (−2, 1)") +
			trail("x", origin, corner) +
			trail("y", corner, target) +
			`<g transform="translate(${target.x} ${target.y})"><g class="tut-appear">${marker()}</g></g>` +
			// The hand appears on the vertex and taps: moving it would contradict "No arrastres".
			pointer("tut-tap-in", target.x, target.y) +
			bubble("tut-success", target.x + 10, target.y - 34, "✅ ¡Correcto!"),
	);
}

const SCENES = [originScene, xScene, yScene, quadrantScene, answerScene];

export function renderTutorialScene(step: number): string {
	return (SCENES[step] ?? originScene)();
}
