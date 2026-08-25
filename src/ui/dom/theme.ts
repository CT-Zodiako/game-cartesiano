export const THEME_STORAGE_KEY = "cartesian-game-theme";

export type Theme = "dark" | "light";
export type ThemeChangeListener = (theme: Theme) => void;

type ThemeRoot = {
	dataset: { theme?: string };
};

type ThemeStorage = Pick<Storage, "getItem" | "setItem">;

type ThemeButton = {
	setAttribute(name: string, value: string): void;
	addEventListener(type: "click", listener: () => void): void;
};

function storedTheme(storage: ThemeStorage): Theme | null {
	try {
		const value = storage.getItem(THEME_STORAGE_KEY);
		return value === "light" || value === "dark" ? value : null;
	} catch {
		return null;
	}
}

function persistTheme(theme: Theme, storage: ThemeStorage): void {
	try {
		storage.setItem(THEME_STORAGE_KEY, theme);
	} catch {
		// Theme selection remains available when browser storage is unavailable.
	}
}

function updateToggle(button: ThemeButton, theme: Theme): void {
	const isLight = theme === "light";
	button.setAttribute("aria-pressed", String(isLight));
	button.setAttribute("aria-label", isLight ? "Usar tema oscuro" : "Usar tema claro");
}

export function initializeTheme(root: ThemeRoot, storage: ThemeStorage): Theme {
	const theme = storedTheme(storage) ?? "dark";
	root.dataset.theme = theme;
	return theme;
}

export function setupThemeToggle(
	root: ThemeRoot,
	button: ThemeButton,
	storage: ThemeStorage,
	onThemeChange?: ThemeChangeListener,
): () => Theme {
	let theme = initializeTheme(root, storage);
	updateToggle(button, theme);
	onThemeChange?.(theme);

	button.addEventListener("click", () => {
		theme = theme === "dark" ? "light" : "dark";
		root.dataset.theme = theme;
		persistTheme(theme, storage);
		updateToggle(button, theme);
		onThemeChange?.(theme);
	});

	return () => theme;
}
