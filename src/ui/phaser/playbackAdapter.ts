import type { Plateau, RoverState } from '@domain/rover/types.ts';

export class PlaybackAdapter {
  private scene: Phaser.Scene;
  private speedMs: number;
  private timeline: Array<{ frameIndex: number; roverId: string; cmd: string; prev: RoverState; next: RoverState }> = [];
  private index = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private onFrame: (frame: ReturnType<typeof this.timeline[0]>, index: number, total: number) => void = () => {};
  private onEnd: () => void = () => {};
  private plateau: Plateau = { xMax: 5, yMax: 5 };
  private initialState: RoverState = { x: 0, y: 0, orientation: 'N' };

  constructor(scene: Phaser.Scene, speedMs = 500) {
    this.scene = scene;
    this.speedMs = speedMs;
  }

  load(data: {
    timeline: PlaybackAdapter['timeline'];
    plateau: Plateau;
    initialState: RoverState;
  }): void {
    this.pause();
    this.timeline = data.timeline;
    this.index = 0;
    this.plateau = data.plateau;
    this.initialState = data.initialState;
    this.scene.setScenario(data.plateau, data.initialState);
  }

  setCallbacks(cb: {
    onFrame?: (frame: ReturnType<typeof this.timeline[0]>, index: number, total: number) => void;
    onEnd?: () => void;
  }): void {
    if (cb.onFrame) this.onFrame = cb.onFrame;
    if (cb.onEnd) this.onEnd = cb.onEnd;
  }

  setSpeed(speedMs: number): void {
    this.speedMs = Number(speedMs) || this.speedMs;
    if (this.timer) {
      this.pause();
      this.play();
    }
  }

  step(): ReturnType<typeof this.timeline[0]> | null {
    if (this.index >= this.timeline.length) {
      this.onEnd();
      return null;
    }
    const frame = this.timeline[this.index];
    this.scene.applyFrame({ next: frame.next });
    this.index += 1;
    this.onFrame(frame, this.index, this.timeline.length);
    if (this.index >= this.timeline.length) this.onEnd();
    return frame;
  }

  play(): void {
    if (this.timer || this.timeline.length === 0) return;
    this.timer = setInterval(() => {
      const frame = this.step();
      if (!frame || this.index >= this.timeline.length) this.pause();
    }, this.speedMs);
  }

  pause(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  reset(): void {
    this.pause();
    this.index = 0;
    this.scene.resetToInitial();
  }
}
