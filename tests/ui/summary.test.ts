import assert from "node:assert/strict";
import test from "node:test";

import { summarizeAnswers } from "../../src/domain/feedback/summary.ts";

test("an empty game asks the player to play before showing a summary", () => {
	assert.deepEqual(summarizeAnswers([]), {
		total: 0,
		hits: 0,
		misses: 0,
		unanswered: 0,
		accuracy: 0,
		topMistake: null,
		suggestion: "Jugá una partida para ver tu resumen.",
	});
});

test("a perfect game suggests a harder challenge", () => {
	const summary = summarizeAnswers([
		{ target: { x: 2, y: 3 }, selected: { x: 2, y: 3 } },
		{ target: { x: -1, y: 4 }, selected: { x: -1, y: 4 } },
	]);
	assert.equal(summary.hits, 2);
	assert.equal(summary.accuracy, 100);
	assert.equal(summary.topMistake, null);
	assert.equal(
		summary.suggestion,
		"¡Excelente! Probá un tablero más grande o menos segundos por ronda.",
	);
});

test("counts hits, misses, and unanswered rounds and rounds the accuracy", () => {
	const summary = summarizeAnswers([
		{ target: { x: 2, y: 3 }, selected: { x: 2, y: 3 } },
		{ target: { x: 1, y: 3 }, selected: { x: 3, y: 1 } },
		{ target: { x: 4, y: 2 }, selected: null },
	]);
	assert.deepEqual(
		{ total: summary.total, hits: summary.hits, misses: summary.misses, unanswered: summary.unanswered, accuracy: summary.accuracy },
		{ total: 3, hits: 1, misses: 1, unanswered: 1, accuracy: 33 },
	);
});

test("reports the most frequent mistake with a matching practice suggestion", () => {
	const summary = summarizeAnswers([
		{ target: { x: 4, y: 2 }, selected: { x: -4, y: 2 } },
		{ target: { x: 1, y: 3 }, selected: { x: 3, y: 1 } },
		{ target: { x: -5, y: 1 }, selected: { x: 5, y: 1 } },
	]);
	assert.equal(summary.topMistake, "X_SIGN");
	assert.equal(summary.suggestion, "Repasá el signo de X: negativo es hacia la izquierda.");
});

test("breaks ties by the earliest mistake and reports unanswered rounds", () => {
	assert.equal(
		summarizeAnswers([
			{ target: { x: 1, y: 3 }, selected: { x: 3, y: 1 } },
			{ target: { x: 4, y: 2 }, selected: { x: 4, y: -2 } },
		]).topMistake,
		"SWAPPED",
	);
	const slow = summarizeAnswers([
		{ target: { x: 4, y: 2 }, selected: null },
		{ target: { x: 2, y: 2 }, selected: null },
	]);
	assert.equal(slow.topMistake, "NO_ANSWER");
	assert.equal(slow.suggestion, "Tomá el tiempo a tu favor: primero ubicá X, después Y, y tocá.");
});
