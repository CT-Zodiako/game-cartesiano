import type { Plateau, RoverState } from '@domain/rover/types.ts';

export interface PixelCoord {
  px: number;
  py: number;
  stepX: number;
  stepY: number;
  margin: number;
  w: number;
  h: number;
}

export interface BoardConfig {
  plateau: Plateau;
  width: number;
  height: number;
  margin?: number;
}

const DEFAULT_MARGIN = 30;

export function cellToPixel(x: number, y: number, plateau: Plateau, width: number, height: number, margin = DEFAULT_MARGIN): PixelCoord {
  const w = width - margin * 2;
  const h = height - margin * 2;
  const stepX = plateau.xMax > 0 ? w / plateau.xMax : w;
  const stepY = plateau.yMax > 0 ? h / plateau.yMax : h;
  return {
    px: margin + stepX * x,
    py: height - (margin + stepY * y),
    stepX,
    stepY,
    margin,
    w,
    h,
  };
}

export function pixelToCell(
  px: number,
  py: number,
  plateau: Plateau,
  width: number,
  height: number,
  margin = DEFAULT_MARGIN,
  vertexHitRadius = 6,
): { x: number; y: number } | null {
  const w = width - margin * 2;
  const h = height - margin * 2;

  const minX = margin;
  const maxX = margin + w;
  const minY = height - (margin + h);
  const maxY = height - margin;

  if (px < minX || px > maxX || py < minY || py > maxY) return null;

  const stepX = plateau.xMax > 0 ? w / plateau.xMax : w;
  const stepY = plateau.yMax > 0 ? h / plateau.yMax : h;

  const gx = Math.round((px - margin) / stepX);
  const gy = Math.round((height - margin - py) / stepY);
  const x = Math.max(0, Math.min(gx, plateau.xMax));
  const y = Math.max(0, Math.min(gy, plateau.yMax));

  // Accept click only near vertex intersection
  const vertex = cellToPixel(x, y, plateau, width, height, margin);
  const dx = px - vertex.px;
  const dy = py - vertex.py;
  const distance = Math.hypot(dx, dy);

  if (distance > vertexHitRadius) return null;

  return { x, y };
}

export function drawGrid(
  gfx: Phaser.GameObjects.Graphics,
  plateau: Plateau,
  width: number,
  height: number,
  margin = DEFAULT_MARGIN,
): Phaser.GameObjects.Text[] {
  const w = width - margin * 2;
  const h = height - margin * 2;
  const stepX = plateau.xMax > 0 ? w / plateau.xMax : w;
  const stepY = plateau.yMax > 0 ? h / plateau.yMax : h;

  const axisTexts: Phaser.GameObjects.Text[] = [];

  gfx.fillStyle(0x0f172a, 1);
  gfx.fillRect(0, 0, width, height);
  gfx.lineStyle(1, 0x334155, 0.9);

  for (let i = 0; i <= plateau.xMax; i += 1) {
    const x = margin + i * stepX;
    gfx.lineBetween(x, height - margin, x, height - (margin + h));
  }
  for (let j = 0; j <= plateau.yMax; j += 1) {
    const y = height - (margin + j * stepY);
    gfx.lineBetween(margin, y, margin + w, y);
  }

  // Main axes (darker)
  gfx.lineStyle(2, 0x94a3b8, 1);
  gfx.lineBetween(margin, height - margin, margin + w, height - margin); // X
  gfx.lineBetween(margin, height - margin, margin, height - (margin + h)); // Y

  return axisTexts;
}
