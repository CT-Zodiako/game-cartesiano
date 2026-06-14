import type { Plateau } from '@domain/rover/types.ts';

export interface PixelCoord {
  px: number;
  py: number;
  stepX: number;
  stepY: number;
  margin: number;
  w: number;
  h: number;
  centerX: number;
  centerY: number;
}

export interface BoardConfig {
  plateau: Plateau;
  width: number;
  height: number;
  margin?: number;
}

const DEFAULT_MARGIN = 30;

// Four quadrants: origin (0,0) at center, x goes [-xMax, xMax], y goes [-yMax, yMax]
export function cellToPixel(x: number, y: number, plateau: Plateau, width: number, height: number, margin = DEFAULT_MARGIN): PixelCoord {
  const w = width - margin * 2;
  const h = height - margin * 2;
  const stepX = plateau.xMax > 0 ? w / (plateau.xMax * 2) : w;
  const stepY = plateau.yMax > 0 ? h / (plateau.yMax * 2) : h;

  // Center of the board
  const centerX = margin + w / 2;
  const centerY = margin + h / 2;

  return {
    px: centerX + x * stepX,
    py: centerY - y * stepY,
    stepX,
    stepY,
    margin,
    w,
    h,
    centerX,
    centerY,
  };
}

// Get the center of a cell (not the vertex)
export function cellCenter(x: number, y: number, plateau: Plateau, width: number, height: number, margin = DEFAULT_MARGIN): { cx: number; cy: number } {
  const coord = cellToPixel(x, y, plateau, width, height, margin);
  return {
    cx: coord.px + coord.stepX / 2,
    cy: coord.py - coord.stepY / 2,
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
  const centerX = margin + w / 2;
  const centerY = margin + h / 2;

  const minX = margin;
  const maxX = margin + w;
  const minY = margin;
  const maxY = margin + h;

  if (px < minX || px > maxX || py < minY || py > maxY) return null;

  const stepX = plateau.xMax > 0 ? w / (plateau.xMax * 2) : w;
  const stepY = plateau.yMax > 0 ? h / (plateau.yMax * 2) : h;

  const gx = Math.round((px - centerX) / stepX);
  const gy = Math.round((centerY - py) / stepY);

  const x = Math.max(-plateau.xMax, Math.min(gx, plateau.xMax));
  const y = Math.max(-plateau.yMax, Math.min(gy, plateau.yMax));

  // Accept click only near vertex intersection
  const vertex = cellToPixel(x, y, plateau, width, height, margin);
  const dx = px - vertex.px;
  const dy = py - vertex.py;
  const distance = Math.hypot(dx, dy);

  if (distance > vertexHitRadius) return null;

  return { x, y };
}
