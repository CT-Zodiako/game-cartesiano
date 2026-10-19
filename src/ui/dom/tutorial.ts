export const TUTORIAL_STORAGE_KEY = "xy-arena-tutorial-seen";

export interface TutorialStep {
	title: string;
	body: string;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
	{
		title: "El origen",
		body: "El punto (0, 0) es el centro del plano, donde se cruzan los dos ejes. Desde ahí empezás a contar.",
	},
	{
		title: "Primero X",
		body: "Una coordenada se escribe (x, y). El primer número es X: positivo hacia la derecha y negativo hacia la izquierda. Los números de X son azules.",
	},
	{
		title: "Después Y",
		body: "El segundo número es Y: positivo hacia arriba y negativo hacia abajo. Los números de Y son verdes.",
	},
	{
		title: "Los cuadrantes",
		body: "I (+, +) arriba a la derecha · II (−, +) arriba a la izquierda · III (−, −) abajo a la izquierda · IV (+, −) abajo a la derecha. Si un número es 0, el punto está sobre un eje. En el tablero cada cuadrante muestra su nombre.",
	},
	{
		title: "Cómo responder",
		body: "Separá el problema en dos pasos: movete en X, después en Y, y tocá el vértice donde se cruzan las líneas. Si fallás, el tablero te muestra el punto correcto.",
	},
];

type TutorialStorage = Pick<Storage, "getItem" | "setItem">;

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
	prev: TutorialButton & { disabled: boolean };
	next: TutorialButton & TutorialText;
	close: TutorialButton;
	openButton: TutorialButton;
	/** Animated tap demonstration shown on the how-to-answer step. */
	tapDemo?: { hidden: boolean };
}

export interface TutorialController {
	open(): void;
	close(): void;
	readonly isOpen: boolean;
}

function hasSeenTutorial(storage: TutorialStorage): boolean {
	try {
		return storage.getItem(TUTORIAL_STORAGE_KEY) === "1";
	} catch {
		return false;
	}
}

function markTutorialSeen(storage: TutorialStorage): void {
	try {
		storage.setItem(TUTORIAL_STORAGE_KEY, "1");
	} catch {
		// The guide still works when browser storage is unavailable; it just reappears next visit.
	}
}

export function setupTutorial(elements: TutorialElements, storage: TutorialStorage): TutorialController {
	let step = 0;
	let isOpen = false;
	const lastStep = TUTORIAL_STEPS.length - 1;

	const render = (): void => {
		elements.title.textContent = TUTORIAL_STEPS[step].title;
		elements.body.textContent = TUTORIAL_STEPS[step].body;
		elements.progress.textContent = `${step + 1} de ${TUTORIAL_STEPS.length}`;
		elements.prev.disabled = step === 0;
		elements.next.textContent = step === lastStep ? "¡A jugar!" : "Siguiente";
		if (elements.tapDemo) elements.tapDemo.hidden = step !== lastStep;
	};

	const open = (): void => {
		step = 0;
		isOpen = true;
		render();
		elements.overlay.classList.add("visible");
		elements.next.focus();
	};

	const close = (): void => {
		if (!isOpen) return;
		isOpen = false;
		elements.overlay.classList.remove("visible");
		markTutorialSeen(storage);
		elements.openButton.focus();
	};

	elements.openButton.addEventListener("click", open);
	elements.close.addEventListener("click", close);
	elements.prev.addEventListener("click", () => {
		if (step === 0) return;
		step -= 1;
		render();
	});
	elements.next.addEventListener("click", () => {
		if (step === lastStep) {
			close();
			return;
		}
		step += 1;
		render();
	});

	if (!hasSeenTutorial(storage)) open();

	return {
		open,
		close,
		get isOpen() {
			return isOpen;
		},
	};
}
