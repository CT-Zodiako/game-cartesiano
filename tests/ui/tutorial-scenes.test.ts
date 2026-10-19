import assert from "node:assert/strict";
import test from "node:test";

import { renderTutorialScene, scenePoint } from "../../src/ui/dom/tutorial-scenes.ts";

test("maps mini-board coordinates like the real board: origin centered, Y grows upward", () => {
	assert.deepEqual(scenePoint(0, 0), { x: 120, y: 120 });
	assert.deepEqual(scenePoint(2, 3), { x: 184, y: 24 });
	assert.deepEqual(scenePoint(-2, -1), { x: 56, y: 152 });
});

test("every scene draws the game board with blue X numbers, green Y numbers, and the marker", () => {
	for (let step = 0; step < 5; step += 1) {
		const svg = renderTutorialScene(step);
		assert.match(svg, /^<svg class="tut-board" viewBox="0 0 240 240"/);
		assert.equal(svg.match(/class="tut-x-num"/g)?.length, 6);
		assert.equal(svg.match(/class="tut-y-num"/g)?.length, 6);
		assert.match(svg, /class="tut-axis"/);
		assert.match(svg, /class="tut-marker"/);
	}
});

test("the origin scene taps (0, 0) and labels it", () => {
	const svg = renderTutorialScene(0);
	assert.match(svg, /data-scene="origin"/);
	assert.match(svg, /class="tut-pointer tut-tap" transform="translate\(120 120\)"/);
	assert.match(svg, />\(0, 0\)</);
});

test("the X scene slides the marker two steps right with a blue trail", () => {
	const svg = renderTutorialScene(1);
	assert.match(svg, /data-scene="x-axis"/);
	assert.match(svg, /class="tut-slide" style="--dx: 64px; --dy: 0px"/);
	assert.match(svg, /<line class="tut-trail tut-trail-x" x1="120" y1="120" x2="184" y2="120"/);
	assert.match(svg, />x = 2</);
});

test("the Y scene climbs from (2, 0) to (2, 3) with a green trail", () => {
	const svg = renderTutorialScene(2);
	assert.match(svg, /data-scene="y-axis"/);
	assert.match(svg, /class="tut-slide" style="--dx: 0px; --dy: -96px"/);
	assert.match(svg, /<line class="tut-trail tut-trail-y" x1="184" y1="120" x2="184" y2="24"/);
	assert.match(svg, />\(2, 3\)</);
});

test("the quadrant scene lights up the four quadrants with their signs", () => {
	const svg = renderTutorialScene(3);
	assert.match(svg, /data-scene="quadrants"/);
	assert.equal(svg.match(/class="tut-quadrant"/g)?.length, 4);
	for (const label of ["I (+, +)", "II (−, +)", "III (−, −)", "IV (+, −)"]) {
		assert.ok(svg.includes(`>${label}<`), label);
	}
});

test("the answer scene shows a full play: target, X count, Y count, a tap without dragging, and success", () => {
	const svg = renderTutorialScene(4);
	assert.match(svg, /data-scene="answer"/);
	// The target sits in the empty first quadrant so it never covers the axis numbers.
	assert.match(svg, /class="tut-bubble tut-target" transform="translate\(179\.2 40\)"[^>]*>.*?>Buscá \(−2, 1\)</);
	assert.match(svg, /<line class="tut-trail tut-trail-x" x1="120" y1="120" x2="56" y2="120"/);
	assert.match(svg, /<line class="tut-trail tut-trail-y" x1="56" y1="120" x2="56" y2="88"/);
	// The hand appears on the target and taps; it never travels, because the game says "No arrastres".
	assert.match(svg, /class="tut-pointer tut-tap-in" transform="translate\(56 88\)"/);
	assert.doesNotMatch(svg, /tut-walk|--wx|--wy/);
	assert.match(svg, />✅ ¡Correcto!</);
});

test("an unknown step falls back to the origin scene", () => {
	assert.match(renderTutorialScene(99), /data-scene="origin"/);
});
