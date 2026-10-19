interface MenuElement {
	classList: { add(name: string): void; remove(name: string): void };
}

interface MenuButton {
	setAttribute(name: string, value: string): void;
	addEventListener(type: "click", listener: () => void): void;
	focus(): void;
}

export interface MobileMenuElements {
	toggle: MenuButton;
	panel: MenuElement;
	backdrop: { hidden: boolean; addEventListener(type: "click", listener: () => void): void };
	close: MenuButton;
}

export interface MobileMenuController {
	open(): void;
	close(): void;
	readonly isOpen: boolean;
}

/**
 * Off-canvas side panel for phones. The layout is CSS-driven, so opening it on desktop is harmless;
 * focus moves only on compact layouts to avoid stealing the keyboard on desktop.
 */
export function setupMobileMenu(elements: MobileMenuElements, isCompact: () => boolean): MobileMenuController {
	let isOpen = false;

	const render = (): void => {
		if (isOpen) elements.panel.classList.add("is-open");
		else elements.panel.classList.remove("is-open");
		elements.backdrop.hidden = !isOpen;
		elements.toggle.setAttribute("aria-expanded", String(isOpen));
		elements.toggle.setAttribute("aria-label", isOpen ? "Cerrar menú" : "Abrir menú");
	};

	const open = (): void => {
		if (isOpen) return;
		isOpen = true;
		render();
		if (isCompact()) elements.close.focus();
	};

	const close = (): void => {
		if (!isOpen) return;
		isOpen = false;
		render();
		if (isCompact()) elements.toggle.focus();
	};

	elements.toggle.addEventListener("click", () => (isOpen ? close() : open()));
	elements.close.addEventListener("click", close);
	elements.backdrop.addEventListener("click", close);
	render();

	return {
		open,
		close,
		get isOpen() {
			return isOpen;
		},
	};
}
