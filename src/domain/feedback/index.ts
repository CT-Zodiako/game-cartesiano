import type { Point } from "@domain/protocol/types.ts";

export type PointLocation = "I" | "II" | "III" | "IV" | "X_AXIS" | "Y_AXIS" | "ORIGIN";

export type MissKind =
	| "SWAPPED"
	| "X_SIGN"
	| "Y_SIGN"
	| "BOTH_SIGNS"
	| "QUADRANT"
	| "NEARBY";

export function quadrantOf(point: Point): PointLocation {
	if (point.x === 0 && point.y === 0) return "ORIGIN";
	if (point.y === 0) return "X_AXIS";
	if (point.x === 0) return "Y_AXIS";
	if (point.x > 0) return point.y > 0 ? "I" : "IV";
	return point.y > 0 ? "II" : "III";
}

/** Classifies the most likely conceptual mistake behind a wrong vertex. */
export function classifyMiss(selected: Point, target: Point): MissKind | null {
	if (selected.x === target.x && selected.y === target.y) return null;
	if (selected.x === target.y && selected.y === target.x) return "SWAPPED";
	const sameX = selected.x === target.x;
	const sameY = selected.y === target.y;
	const flippedX = target.x !== 0 && selected.x === -target.x;
	const flippedY = target.y !== 0 && selected.y === -target.y;
	if (flippedX && sameY) return "X_SIGN";
	if (sameX && flippedY) return "Y_SIGN";
	if (flippedX && flippedY) return "BOTH_SIGNS";
	return quadrantOf(selected) === quadrantOf(target) ? "NEARBY" : "QUADRANT";
}

function xStep(x: number): string {
	return `${Math.abs(x)} a la ${x > 0 ? "derecha" : "izquierda"}`;
}

function yStep(y: number): string {
	return `${Math.abs(y)} hacia ${y > 0 ? "arriba" : "abajo"}`;
}

/** Splits the route from the origin into its X move and its Y move. */
export function routeFromOrigin(target: Point): string {
	const steps = [
		target.x !== 0 ? xStep(target.x) : null,
		target.y !== 0 ? yStep(target.y) : null,
	].filter((step): step is string => step !== null);
	return steps.length > 0 ? steps.join(" y ") : "quedate en el origen";
}

function locationName(location: PointLocation): string {
	switch (location) {
		case "X_AXIS":
			return "sobre el eje X";
		case "Y_AXIS":
			return "sobre el eje Y";
		case "ORIGIN":
			return "en el origen";
		default:
			return `en el cuadrante ${location}`;
	}
}

export function explainMiss(kind: MissKind, target: Point): string {
	switch (kind) {
		case "SWAPPED":
			return `Invertiste el orden. Primero va X y después Y: (${target.x}, ${target.y}).`;
		case "X_SIGN":
			return `Revisá el signo de X: ${target.x} es hacia la ${target.x > 0 ? "derecha" : "izquierda"}.`;
		case "Y_SIGN":
			return `Revisá el signo de Y: ${target.y} es hacia ${target.y > 0 ? "arriba" : "abajo"}.`;
		case "BOTH_SIGNS":
			return `Revisá los signos: X = ${target.x} va hacia la ${target.x > 0 ? "derecha" : "izquierda"} e Y = ${target.y} va hacia ${target.y > 0 ? "arriba" : "abajo"}.`;
		case "QUADRANT":
			return `El punto está ${locationName(quadrantOf(target))}. Desde el origen: ${routeFromOrigin(target)}.`;
		case "NEARBY":
			return `Casi. Contá de a una: ${routeFromOrigin(target)}.`;
	}
}
