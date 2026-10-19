export const SOUND_STORAGE_KEY = "xy-arena-sound";

type SoundStorage = Pick<Storage, "getItem" | "setItem">;

type SoundButton = {
	textContent: string | null;
	setAttribute(name: string, value: string): void;
	addEventListener(type: "click", listener: () => void): void;
};

type MutableSounds = { muted: boolean };

function storedMuted(storage: SoundStorage): boolean {
	try {
		return storage.getItem(SOUND_STORAGE_KEY) === "muted";
	} catch {
		return false;
	}
}

function persistMuted(muted: boolean, storage: SoundStorage): void {
	try {
		storage.setItem(SOUND_STORAGE_KEY, muted ? "muted" : "on");
	} catch {
		// Muting still applies for this session when storage is unavailable.
	}
}

function updateButton(button: SoundButton, muted: boolean): void {
	button.textContent = muted ? "🔇" : "🔊";
	button.setAttribute("aria-pressed", String(muted));
	button.setAttribute("aria-label", muted ? "Activar sonidos" : "Silenciar sonidos");
}

export function setupSoundToggle(button: SoundButton, storage: SoundStorage, sounds: MutableSounds): void {
	sounds.muted = storedMuted(storage);
	updateButton(button, sounds.muted);

	button.addEventListener("click", () => {
		sounds.muted = !sounds.muted;
		persistMuted(sounds.muted, storage);
		updateButton(button, sounds.muted);
	});
}
