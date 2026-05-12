import type { Plateau, RoverState } from '@domain/rover/types.js';
import { cellToPixel, pixelToCell } from './board.ts';

const DEFAULT_MARGIN = 30;

export class RoverScene extends Phaser.Scene {
  private plateau: Plateau;
  private initialState: RoverState;
  private currentState: RoverState;
  private path: RoverState[];
  private targetState: { x: number; y: number } | null = null;
  private axisTexts: Phaser.GameObjects.Text[] = [];
  private onCellSelected: ((cell: { x: number; y: number }) => void) | null = null;
  private onClaimSelected: ((cell: { x: number; y: number }) => void) | null = null;
  private claimLocked = false;

  private gfx!: Phaser.GameObjects.Graphics;
  private pathGfx!: Phaser.GameObjects.Graphics;
  private targetGfx!: Phaser.GameObjects.Graphics;
  private rover!: Phaser.GameObjects.Triangle;
  private hitArea!: Phaser.GameObjects.Zone;

  constructor() {
    super('RoverScene');
    this.plateau = { xMax: 5, yMax: 5 };
    this.initialState = { x: 0, y: 0, orientation: 'N' };
    this.currentState = { ...this.initialState };
    this.path = [{ ...this.initialState }];
  }

  create(): void {
    this.gfx = this.add.graphics();
    this.pathGfx = this.add.graphics();
    this.targetGfx = this.add.graphics();

    this.rover = this.add.triangle(0, 0, 0, 20, 20, 20, 10, 0, 0x22d3ee);
    this.rover.setOrigin(0.5, 0.5);

    this.hitArea = this.add.zone(0, 0, this.scale.width, this.scale.height).setOrigin(0, 0).setInteractive();
    this.hitArea.on('pointerdown', (pointer: Phaser.InputPointer) => {
      const cell = pixelToCell(
        pointer.x,
        pointer.y,
        this.plateau,
        this.scale.width,
        this.scale.height,
        DEFAULT_MARGIN,
        6,
      );
      if (!cell) return;

      this.currentState = { ...this.currentState, x: cell.x, y: cell.y };
      this.path = [{ ...this.currentState }];
      this.drawAll();

      if (this.onCellSelected) this.onCellSelected(cell);
      if (!this.claimLocked && this.onClaimSelected) {
        this.claimLocked = true;
        this.onClaimSelected(cell);
      }
    });

    this.drawAll();
    this.scale.on('resize', this.drawAll, this);
  }

  setCellSelectedCallback(cb: (cell: { x: number; y: number }) => void): void {
    this.onCellSelected = cb;
  }

  setClaimSubmitCallback(cb: (cell: { x: number; y: number }) => void): void {
    this.onClaimSelected = cb;
  }

  unlockClaim(): void {
    this.claimLocked = false;
  }

  setScenario(plateau: Plateau, initialState: RoverState): void {
    this.plateau = plateau;
    this.initialState = { ...initialState };
    this.currentState = { ...initialState };
    this.path = [{ ...initialState }];
    this.drawAll();
  }

  applyFrame(frame: { next: RoverState }): void {
    this.currentState = { ...frame.next };
    this.path.push({ ...frame.next });
    this.drawAll();
  }

  resetToInitial(): void {
    this.currentState = { ...this.initialState };
    this.path = [{ ...this.initialState }];
    this.drawAll();
  }

  setTarget(target: { x: number; y: number } | null): void {
    this.targetState = target ? { ...target } : null;
    this.drawAll();
  }

  setPlateau(plateau: Plateau): void {
    this.plateau = plateau;
  }

  private drawAll(): void {
    if (!this.gfx) return;
    this.gfx.clear();
    this.pathGfx.clear();
    this.targetGfx.clear();
    if (this.hitArea) this.hitArea.setSize(this.scale.width, this.scale.height);

    this.axisTexts.forEach((t) => t.destroy());
    this.axisTexts = [];

    const margin = DEFAULT_MARGIN;
    const w = this.scale.width - margin * 2;
    const h = this.scale.height - margin * 2;
    const stepX = this.plateau.xMax > 0 ? w / this.plateau.xMax : w;
    const stepY = this.plateau.yMax > 0 ? h / this.plateau.yMax : h;

    this.gfx.fillStyle(0x0f172a, 1);
    this.gfx.fillRect(0, 0, this.scale.width, this.scale.height);
    this.gfx.lineStyle(1, 0x334155, 0.9);

    for (let i = 0; i <= this.plateau.xMax; i += 1) {
      const x = margin + i * stepX;
      this.gfx.lineBetween(x, this.scale.height - margin, x, this.scale.height - (margin + h));
    }
    for (let j = 0; j <= this.plateau.yMax; j += 1) {
      const y = this.scale.height - (margin + j * stepY);
      this.gfx.lineBetween(margin, y, margin + w, y);
    }

    this.gfx.lineStyle(2, 0x94a3b8, 1);
    this.gfx.lineBetween(margin, this.scale.height - margin, margin + w, this.scale.height - margin);
    this.gfx.lineBetween(margin, this.scale.height - margin, margin, this.scale.height - (margin + h));

    for (let x = 0; x <= this.plateau.xMax; x += 1) {
      const p = cellToPixel(x, 0, this.plateau, this.scale.width, this.scale.height, margin);
      const txt = this.add.text(p.px - 4, this.scale.height - margin + 10, String(x), { fontSize: '13px', color: '#cbd5e1' });
      this.axisTexts.push(txt);
    }
    for (let y = 0; y <= this.plateau.yMax; y += 1) {
      const p = cellToPixel(0, y, this.plateau, this.scale.width, this.scale.height, margin);
      const txt = this.add.text(margin - 22, p.py - 8, String(y), { fontSize: '13px', color: '#cbd5e1' });
      this.axisTexts.push(txt);
    }
    this.axisTexts.push(
      this.add.text(margin + w + 8, this.scale.height - margin + 8, 'X', { fontSize: '13px', color: '#e2e8f0', fontStyle: 'bold' }),
      this.add.text(margin - 20, this.scale.height - (margin + h) - 20, 'Y', { fontSize: '13px', color: '#e2e8f0', fontStyle: 'bold' }),
    );

    this.pathGfx.lineStyle(3, 0xa3e635, 0.95);
    for (let i = 1; i < this.path.length; i += 1) {
      const a = cellToPixel(this.path[i - 1].x, this.path[i - 1].y, this.plateau, this.scale.width, this.scale.height, margin);
      const b = cellToPixel(this.path[i].x, this.path[i].y, this.plateau, this.scale.width, this.scale.height, margin);
      this.pathGfx.lineBetween(a.px, a.py, b.px, b.py);
    }

    const pos = cellToPixel(this.currentState.x, this.currentState.y, this.plateau, this.scale.width, this.scale.height, margin);
    this.rover.setPosition(pos.px, pos.py);
    const rotation: Record<string, number> = { N: 0, E: Math.PI / 2, S: Math.PI, W: -Math.PI / 2 };
    this.rover.setRotation(rotation[this.currentState.orientation] ?? 0);
  }
}
