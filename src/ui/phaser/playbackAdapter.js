export class PlaybackAdapter {
  constructor(scene, speedMs = 500) {
    this.scene = scene;
    this.speedMs = speedMs;
    this.timeline = [];
    this.index = 0;
    this.timer = null;
    this.onFrame = () => {};
    this.onEnd = () => {};
  }

  load({ timeline, plateau, initialState }) {
    this.pause();
    this.timeline = timeline;
    this.index = 0;
    this.scene.setScenario(plateau, initialState);
  }

  setCallbacks({ onFrame, onEnd }) {
    this.onFrame = onFrame ?? this.onFrame;
    this.onEnd = onEnd ?? this.onEnd;
  }

  setSpeed(speedMs) {
    this.speedMs = Number(speedMs) || this.speedMs;
    if (this.timer) {
      this.pause();
      this.play();
    }
  }

  step() {
    if (this.index >= this.timeline.length) {
      this.onEnd();
      return null;
    }
    const frame = this.timeline[this.index];
    this.scene.applyFrame(frame);
    this.index += 1;
    this.onFrame(frame, this.index, this.timeline.length);
    if (this.index >= this.timeline.length) this.onEnd();
    return frame;
  }

  play() {
    if (this.timer || this.timeline.length === 0) return;
    this.timer = setInterval(() => {
      const frame = this.step();
      if (!frame || this.index >= this.timeline.length) this.pause();
    }, this.speedMs);
  }

  pause() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  reset() {
    this.pause();
    this.index = 0;
    this.scene.resetToInitial();
  }
}
