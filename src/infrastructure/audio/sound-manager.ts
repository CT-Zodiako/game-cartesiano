export type SoundCue = "tap" | "countdown" | "roundStart" | "correct" | "wrong"
	| "urgent" | "timeout" | "playerJoined" | "victory";

export interface SoundContext {
	readonly state: string;
	readonly currentTime: number;
	readonly destination: AudioNode;
	resume(): Promise<void>;
	createOscillator(): OscillatorNode;
	createGain(): GainNode;
}

const tones: Record<SoundCue, readonly number[]> = {
	tap: [440],
	countdown: [660],
	roundStart: [523, 784],
	correct: [523, 659, 784],
	wrong: [220, 165],
	urgent: [880],
	timeout: [330, 220, 110],
	playerJoined: [659, 784],
	victory: [523, 659, 784, 1047],
};

function browserContext(): SoundContext | undefined {
	if (typeof window === "undefined" || !window.AudioContext) return;
	return new window.AudioContext();
}

/** Optional feedback only: audio failures must never interrupt gameplay. */
export class SoundManager {
	private context?: SoundContext;
	private active = new Set<GainNode>();
	private isEnabled = true;

	constructor(private readonly createContext: () => SoundContext | undefined = browserContext) {}

	get enabled(): boolean { return this.isEnabled; }
	set enabled(value: boolean) {
		this.isEnabled = value;
		if (!value) {
			for (const gain of this.active) {
				try { gain.disconnect(); } catch { /* Already disconnected. */ }
			}
			this.active.clear();
		}
	}
	get muted(): boolean { return !this.enabled; }
	set muted(value: boolean) { this.enabled = !value; }

	/** Call only from a user gesture; play never creates or resumes a context. */
	async unlock(): Promise<void> {
		if (!this.enabled) return;
		try {
			this.context ??= this.createContext();
			if (this.context?.state === "suspended") await this.context.resume();
		} catch { /* Unsupported or denied audio is silent. */ }
	}

	play(cue: SoundCue): void {
		const context = this.context;
		if (!this.enabled || !context || context.state !== "running") return;
		try {
			for (const [index, frequency] of tones[cue].entries()) {
				const oscillator = context.createOscillator();
				const gain = context.createGain();
				const start = context.currentTime + index * 0.12;
				const end = start + 0.1;
				oscillator.type = "sine";
				oscillator.frequency.setValueAtTime(frequency, start);
				gain.gain.setValueAtTime(0, start);
				gain.gain.linearRampToValueAtTime(0.08, start + 0.01);
				gain.gain.linearRampToValueAtTime(0, end);
				oscillator.connect(gain);
				gain.connect(context.destination);
				this.active.add(gain);
				oscillator.onended = () => {
					this.active.delete(gain);
					try { oscillator.disconnect(); gain.disconnect(); } catch { /* Optional cleanup. */ }
				};
				oscillator.start(start);
				oscillator.stop(end);
			}
		} catch { /* Audio cannot affect network or game state. */ }
	}
}
