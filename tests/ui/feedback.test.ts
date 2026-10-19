import assert from "node:assert/strict";
import test from "node:test";

import {
	classifyMiss,
	explainMiss,
	quadrantOf,
} from "../../src/domain/feedback/index.ts";

test("names the quadrant, axis, or origin of a point", () => {
	assert.equal(quadrantOf({ x: 3, y: 2 }), "I");
	assert.equal(quadrantOf({ x: -3, y: 2 }), "II");
	assert.equal(quadrantOf({ x: -3, y: -2 }), "III");
	assert.equal(quadrantOf({ x: 3, y: -2 }), "IV");
	assert.equal(quadrantOf({ x: 4, y: 0 }), "X_AXIS");
	assert.equal(quadrantOf({ x: 0, y: -4 }), "Y_AXIS");
	assert.equal(quadrantOf({ x: 0, y: 0 }), "ORIGIN");
});

test("classifies a correct answer as no mistake", () => {
	assert.equal(classifyMiss({ x: 2, y: -1 }, { x: 2, y: -1 }), null);
});

test("detects swapped coordinates before sign mistakes", () => {
	assert.equal(classifyMiss({ x: 3, y: 1 }, { x: 1, y: 3 }), "SWAPPED");
});

test("detects a wrong sign on X, on Y, or on both", () => {
	assert.equal(classifyMiss({ x: -4, y: 2 }, { x: 4, y: 2 }), "X_SIGN");
	assert.equal(classifyMiss({ x: 4, y: -2 }, { x: 4, y: 2 }), "Y_SIGN");
	assert.equal(classifyMiss({ x: -4, y: -1 }, { x: 4, y: 1 }), "BOTH_SIGNS");
});

test("falls back to a quadrant mistake or a nearby miss", () => {
	assert.equal(classifyMiss({ x: 5, y: 5 }, { x: -2, y: 3 }), "QUADRANT");
	assert.equal(classifyMiss({ x: 2, y: 4 }, { x: 2, y: 3 }), "NEARBY");
});

test("explains each mistake with the step-by-step X then Y route", () => {
	assert.equal(
		explainMiss("SWAPPED", { x: 1, y: 3 }),
		"Invertiste el orden. Primero va X y después Y: (1, 3).",
	);
	assert.equal(
		explainMiss("X_SIGN", { x: 4, y: 2 }),
		"Revisá el signo de X: 4 es hacia la derecha.",
	);
	assert.equal(
		explainMiss("Y_SIGN", { x: 4, y: -2 }),
		"Revisá el signo de Y: -2 es hacia abajo.",
	);
	assert.equal(
		explainMiss("BOTH_SIGNS", { x: -4, y: -1 }),
		"Revisá los signos: X = -4 va hacia la izquierda e Y = -1 va hacia abajo.",
	);
	assert.equal(
		explainMiss("QUADRANT", { x: -2, y: 3 }),
		"El punto está en el cuadrante II. Desde el origen: 2 a la izquierda y 3 hacia arriba.",
	);
	assert.equal(
		explainMiss("NEARBY", { x: 2, y: 3 }),
		"Casi. Contá de a una: 2 a la derecha y 3 hacia arriba.",
	);
});

test("explains axis targets by naming the axis and the single move", () => {
	assert.equal(
		explainMiss("QUADRANT", { x: 0, y: -5 }),
		"El punto está sobre el eje Y. Desde el origen: 5 hacia abajo.",
	);
	assert.equal(
		explainMiss("NEARBY", { x: 6, y: 0 }),
		"Casi. Contá de a una: 6 a la derecha.",
	);
});
