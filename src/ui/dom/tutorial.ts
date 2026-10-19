import { renderTutorialScene } from "./tutorial-scenes.ts";

/** Set only when the player marks "No volver a mostrar esta guía" before finishing. */
export const TUTORIAL_STORAGE_KEY = "xy-arena-tutorial-hidden";
/** Seconds each step stays on screen before Next unlocks. */
export const TUTORIAL_STEP_WAIT_SECONDS = 5;

export interface TutorialStep {
	title: string;
	body: string;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
	{ title: "El origen", body: "Este es el origen (0, 0). Desde acá empezás a contar." },
	{ title: "Primero X", body: "En (x, y), x va a los lados: + a la derecha, − a la izquierda." },
	{ title: "Después Y", body: "Después y sube o baja: + hacia arriba, − hacia abajo." },
	{ title: "Los cuadrantes", body: "El plano tiene 4 zonas: I (+, +), II (−, +), III (−, −) y IV (+, −)." },
	{ title: "Cómo responder", body: "Contá X, después Y, y tocá el vértice. ¡No arrastres!" },
];

type TutorialStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Runs a callback later and returns a function that cancels it. */
export type TutorialScheduler = (callback: () => void, ms: number) => () => void;

interface TutorialText {
	textContent: string | null;
}

interface TutorialButton {
	addEventListener(type: "click", listener: () => void): void;
	focus(): void;
}

export interface TutorialElements {
	overlay: { classList: { add(name: string): void; remove(name: string): void } };
	title: TutorialText;
	body: TutorialText;
	progress: TutorialText;
	scene: { innerHTML: string };
	prev: TutorialButton & { disabled: boolean };
	next: TutorialButton & TutorialText & { disabled: boolean };
	close: TutorialButton & { hidden: boolean };
	openButton: TutorialButton;
	/** "No volver a mostrar esta guía" checkbox, shown only on the last step. */
	dontShowRow: { hidden: boolean };
	dontShow: { checked: boolean };
}

export interface TutorialController {
	open(): void;
	close(): void;
	readonly isOpen: boolean;
	/** Always false: the guide can only be finished, never closed early. */
	readonly canClose: boolean;
}

const browserScheduler: TutorialScheduler = (callback, ms) => {
	const id = globalThis.setTimeout(callback, ms);
	return () => globalThis.clearTimeout(id);
};

function isTutorialHidden(storage: TutorialStorage): boolean {
	try {
		return storage.getItem(TUTORIAL_STORAGE_KEY) === "1";
	} catch {
		return false;
	}
}

function saveTutorialHidden(storage: TutorialStorage, hidden: boolean): void {
	try {
		if (hidden) storage.setItem(TUTORIAL_STORAGE_KEY, "1");
		else storage.removeItem(TUTORIAL_STORAGE_KEY);
	} catch {
		// The guide still works when browser storage is unavailable; it just reappears next visit.
	}
}

export function setupTutorial(
	elements: TutorialElements,
	storage: TutorialStorage,
	schedule: TutorialScheduler = browserScheduler,
): TutorialController {
	let step = 0;
	let isOpen = false;
	let remainingSeconds = 0;
	let cancelCountdown: (() => void) | null = null;
	const finishedSteps = new Set<number>();
	const lastStep = TUTORIAL_STEPS.length - 1;

	const nextLabel = (): string => (step === lastStep ? "¡A jugar!" : "Siguiente");

	const stopCountdown = (): void => {
		cancelCountdown?.();
		cancelCountdown = null;
	};

	const renderNext = (): void => {
		const waiting = remainingSeconds > 0;
		elements.next.disabled = waiting;
		elements.next.textContent = waiting ? `${nextLabel()} (${remainingSeconds})` : nextLabel();
	};

	const tick = (): void => {
		remainingSeconds -= 1;
		if (remainingSeconds <= 0) {
			remainingSeconds = 0;
			cancelCountdown = null;
			finishedSteps.add(step);
		} else {
			cancelCountdown = schedule(tick, 1000);
		}
		renderNext();
	};

	const render = (): void => {
		stopCountdown();
		elements.title.textContent = TUTORIAL_STEPS[step].title;
		elements.body.textContent = TUTORIAL_STEPS[step].body;
		elements.progress.textContent = `${step + 1} de ${TUTORIAL_STEPS.length}`;
		elements.scene.innerHTML = renderTutorialScene(step);
		elements.prev.disabled = step === 0;
		elements.close.hidden = true;
		elements.dontShowRow.hidden = step !== lastStep;
		remainingSeconds = finishedSteps.has(step) ? 0 : TUTORIAL_STEP_WAIT_SECONDS;
		if (remainingSeconds > 0) cancelCountdown = schedule(tick, 1000);
		renderNext();
	};

	const finish = (): void => {
		stopCountdown();
		isOpen = false;
		elements.overlay.classList.remove("visible");
		saveTutorialHidden(storage, elements.dontShow.checked);
		elements.openButton.focus();
	};

	const open = (): void => {
		step = 0;
		isOpen = true;
		elements.dontShow.checked = isTutorialHidden(storage);
		finishedSteps.clear();
		render();
		elements.overlay.classList.add("visible");
		elements.next.focus();
	};

	const close = (): void => {
		// The guide is mandatory: it ends only through "¡A jugar!" on the last step.
	};

	elements.openButton.addEventListener("click", open);
	elements.close.addEventListener("click", close);
	elements.prev.addEventListener("click", () => {
		if (step === 0) return;
		step -= 1;
		render();
	});
	elements.next.addEventListener("click", () => {
		if (elements.next.disabled) return;
		if (step === lastStep) {
			finish();
			return;
		}
		step += 1;
		render();
	});

	if (!isTutorialHidden(storage)) open();

	return {
		open,
		close,
		get isOpen() {
			return isOpen;
		},
		get canClose() {
			return false;
		},
	};
}
