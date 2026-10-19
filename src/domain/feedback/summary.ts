import type { Point } from "@domain/protocol/types.ts";
import { classifyMiss, type MissKind } from "./index.ts";

export interface AnswerRecord {
	target: Point;
	/** null when the player did not answer before the round ended. */
	selected: Point | null;
}

export type SummaryMistake = MissKind | "NO_ANSWER";

export interface AnswerSummary {
	total: number;
	hits: number;
	misses: number;
	unanswered: number;
	accuracy: number;
	topMistake: SummaryMistake | null;
	suggestion: string;
}

const SUGGESTIONS: Record<SummaryMistake, string> = {
	SWAPPED: "Practicá el orden (x, y): primero X (horizontal), después Y (vertical).",
	X_SIGN: "Repasá el signo de X: negativo es hacia la izquierda.",
	Y_SIGN: "Repasá el signo de Y: negativo es hacia abajo.",
	BOTH_SIGNS: "Repasá los signos de cada cuadrante: II (−, +), III (−, −) y IV (+, −).",
	QUADRANT: "Antes de tocar, decidí en qué cuadrante está el punto.",
	NEARBY: "Contá las unidades de a una desde el origen.",
	NO_ANSWER: "Tomá el tiempo a tu favor: primero ubicá X, después Y, y tocá.",
};

export function summarizeAnswers(records: readonly AnswerRecord[]): AnswerSummary {
	const counts = new Map<SummaryMistake, number>();
	let hits = 0;
	let misses = 0;
	let unanswered = 0;

	for (const { target, selected } of records) {
		const mistake: SummaryMistake | null = selected ? classifyMiss(selected, target) : "NO_ANSWER";
		if (mistake === null) hits += 1;
		else if (mistake === "NO_ANSWER") unanswered += 1;
		else misses += 1;
		if (mistake) counts.set(mistake, (counts.get(mistake) ?? 0) + 1);
	}

	// Map iteration follows first occurrence, so ties resolve to the earliest mistake.
	let topMistake: SummaryMistake | null = null;
	for (const [mistake, count] of counts) {
		if (topMistake === null || count > (counts.get(topMistake) ?? 0)) topMistake = mistake;
	}

	const total = records.length;
	const suggestion = total === 0
		? "Jugá una partida para ver tu resumen."
		: topMistake
			? SUGGESTIONS[topMistake]
			: "¡Excelente! Probá un tablero más grande o menos segundos por ronda.";

	return {
		total,
		hits,
		misses,
		unanswered,
		accuracy: total === 0 ? 0 : Math.round((hits / total) * 100),
		topMistake,
		suggestion,
	};
}
