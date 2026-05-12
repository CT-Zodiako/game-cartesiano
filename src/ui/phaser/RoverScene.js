export class RoverScene extends Phaser.Scene {
  constructor() {
    super('RoverScene');
    this.plateau = { xMax: 5, yMax: 5 };
    this.initialState = { x: 0, y: 0, orientation: 'N' };
    this.currentState = { ...this.initialState };
    this.path = [{ ...this.initialState }];
    this.targetState = null;
    this.axisTexts = [];
    this.onCellSelected = null;
    this.onClaimSelected = null;
    this.claimLocked = false;
  }

  create() {
    this.gfx = this.add.graphics();
    this.pathGfx = this.add.graphics();
    this.targetGfx = this.add.graphics();
    this.rover = this.add.triangle(0, 0, 0, 20, 20, 20, 10, 0, 0x22d3ee);
    this.rover.setOrigin(0.5, 0.5);
    this.hitArea = this.add.zone(0, 0, this.scale.width, this.scale.height).setOrigin(0, 0).setInteractive();
    this.hitArea.on('pointerdown', (pointer) => {
      const cell = this.pixelToCell(pointer.x, pointer.y);
      if (!cell) return;
      this.currentState = { ...this.currentState, x: cell.x, y: cell.y };
      this.path = [{ ...this.currentState }];
      this.drawAll();
      if (typeof this.onCellSelected === 'function') this.onCellSelected(cell);
      if (!this.claimLocked && typeof this.onClaimSelected === 'function') {
        this.claimLocked = true;
        this.onClaimSelected(cell);
      }
    });
    this.drawAll();
    this.scale.on('resize', this.drawAll, this);
  }

  setCellSelectedCallback(cb) {
    this.onCellSelected = cb;
  }

  setClaimSubmitCallback(cb) {
    this.onClaimSelected = cb;
  }

  unlockClaim() {
    this.claimLocked = false;
  }

  setScenario(plateau, initialState) {
    this.plateau = plateau;
    this.initialState = { ...initialState };
    this.currentState = { ...initialState };
    this.path = [{ ...initialState }];
    this.drawAll();
  }

  applyFrame(frame) {
    this.currentState = { ...frame.next };
    this.path.push({ ...frame.next });
    this.drawAll();
  }

  resetToInitial() {
    this.currentState = { ...this.initialState };
    this.path = [{ ...this.initialState }];
    this.drawAll();
  }

  setTarget(state) {
    this.targetState = state ? { ...state } : null;
    this.drawAll();
  }

  cellToPixel(x, y) {
    const margin = 30;
    const w = this.scale.width - margin * 2;
    const h = this.scale.height - margin * 2;
    const stepX = this.plateau.xMax > 0 ? w / this.plateau.xMax : w;
    const stepY = this.plateau.yMax > 0 ? h / this.plateau.yMax : h;
    return {
      px: margin + stepX * x,
      py: this.scale.height - (margin + stepY * y),
      stepX,
      stepY,
      margin,
      w,
      h,
    };
  }

  pixelToCell(px, py) {
    const margin = 30;
    const w = this.scale.width - margin * 2;
    const h = this.scale.height - margin * 2;
    const stepX = this.plateau.xMax > 0 ? w / this.plateau.xMax : w;
    const stepY = this.plateau.yMax > 0 ? h / this.plateau.yMax : h;

    const minX = margin;
    const maxX = margin + w;
    const minY = this.scale.height - (margin + h);
    const maxY = this.scale.height - margin;

    if (px < minX || px > maxX || py < minY || py > maxY) return null;

    const gx = Math.round((px - margin) / stepX);
    const gy = Math.round((this.scale.height - margin - py) / stepY);
    const x = Phaser.Math.Clamp(gx, 0, this.plateau.xMax);
    const y = Phaser.Math.Clamp(gy, 0, this.plateau.yMax);

    // Aceptar click solo cerca del vértice (intersección), no en toda la celda.
    const vertex = this.cellToPixel(x, y);
    const dx = px - vertex.px;
    const dy = py - vertex.py;
    const distance = Math.hypot(dx, dy);
    const vertexHitRadius = 6;

    if (distance > vertexHitRadius) return null;

    return { x, y };
  }

  drawAll() {
    if (!this.gfx) return;
    this.gfx.clear();
    this.pathGfx.clear();
    this.targetGfx.clear();
    if (this.hitArea) this.hitArea.setSize(this.scale.width, this.scale.height);
    this.axisTexts.forEach((t) => t.destroy());
    this.axisTexts = [];

    const { margin, w, h, stepX, stepY } = this.cellToPixel(0, 0);
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

    // Ejes principales más marcados (estilo plano cartesiano)
    this.gfx.lineStyle(2, 0x94a3b8, 1);
    this.gfx.lineBetween(margin, this.scale.height - margin, margin + w, this.scale.height - margin); // X
    this.gfx.lineBetween(margin, this.scale.height - margin, margin, this.scale.height - (margin + h)); // Y

    // Ejes X/Y numerados en vértices
    for (let x = 0; x <= this.plateau.xMax; x += 1) {
      const p = this.cellToPixel(x, 0);
      const txt = this.add.text(p.px - 4, this.scale.height - margin + 10, String(x), {
        fontSize: '13px',
        color: '#cbd5e1',
      });
      this.axisTexts.push(txt);
    }
    for (let y = 0; y <= this.plateau.yMax; y += 1) {
      const p = this.cellToPixel(0, y);
      const txt = this.add.text(margin - 22, p.py - 8, String(y), {
        fontSize: '13px',
        color: '#cbd5e1',
      });
      this.axisTexts.push(txt);
    }
    this.axisTexts.push(
      this.add.text(margin + w + 8, this.scale.height - margin + 8, 'X', { fontSize: '13px', color: '#e2e8f0', fontStyle: 'bold' }),
      this.add.text(margin - 20, this.scale.height - (margin + h) - 20, 'Y', { fontSize: '13px', color: '#e2e8f0', fontStyle: 'bold' }),
    );

    this.pathGfx.lineStyle(3, 0xa3e635, 0.95);
    for (let i = 1; i < this.path.length; i += 1) {
      const a = this.cellToPixel(this.path[i - 1].x, this.path[i - 1].y);
      const b = this.cellToPixel(this.path[i].x, this.path[i].y);
      this.pathGfx.lineBetween(a.px, a.py, b.px, b.py);
    }

    // Objetivo oculto: no dibujar marcador visual en tablero.

    const pos = this.cellToPixel(this.currentState.x, this.currentState.y);
    this.rover.setPosition(pos.px, pos.py);
    const rotation = { N: 0, E: Math.PI / 2, S: Math.PI, W: -Math.PI / 2 };
    this.rover.setRotation(rotation[this.currentState.orientation] ?? 0);
  }
}
