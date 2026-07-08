/**
 * 2:1 diamond isometric projection. Render-only — the sim never sees
 * screen coordinates, it only ever works in plain orthogonal (col, row)
 * grid space. This module is the sole place that translates between them.
 */
export const TILE_WIDTH = 128;
export const TILE_HEIGHT = 64;

export interface ScreenPoint {
  x: number;
  y: number;
}

export function gridToScreen(gx: number, gy: number): ScreenPoint {
  return {
    x: (gx - gy) * (TILE_WIDTH / 2),
    y: (gx + gy) * (TILE_HEIGHT / 2),
  };
}

export function screenToGrid(sx: number, sy: number): { gx: number; gy: number } {
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;
  const gx = (sx / halfW + sy / halfH) / 2;
  const gy = (sy / halfH - sx / halfW) / 2;
  return { gx, gy };
}
