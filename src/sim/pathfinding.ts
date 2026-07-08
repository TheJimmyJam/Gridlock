import { CONGESTION_PATH_WEIGHT } from './constants';
import type { Tile } from './types';

export interface Point {
  x: number;
  y: number;
}

function tileCost(grid: Tile[][], p: Point): number {
  const tile = grid[p.y]?.[p.x];
  if (tile?.type !== 'road') return 1;
  const capacity = tile.roadCapacity ?? 1;
  const load = tile.load ?? 0;
  const overCapacityRatio = Math.max(0, load / capacity - 1);
  return 1 + CONGESTION_PATH_WEIGHT * overCapacityRatio;
}

/**
 * Shortest path from `start` to `goal` by cumulative tile cost (Dijkstra).
 * `start`/`goal` don't need to be roads themselves (they're a resource
 * node / factory / house tile) — every tile in between must be a road.
 *
 * Cost is congestion-aware: an uncongested road costs 1, an overloaded
 * one costs more. This is what makes "relieve congestion by widening or
 * rerouting" an actual player lever — with uniform costs, every shipment
 * between the same two points would always take the identical shortest
 * path and a parallel road would never get used.
 *
 * Implementation note: linear-scan priority selection rather than a
 * binary heap. Fine while road networks are small/sparse (only reachable
 * road tiles enter `dist`, not the whole grid) — revisit if that stops
 * being true.
 */
export function findPath(grid: Tile[][], start: Point, goal: Point): Point[] | null {
  const key = (p: Point): string => `${p.x},${p.y}`;
  const dist = new Map<string, number>([[key(start), 0]]);
  const cameFrom = new Map<string, Point>();
  const visited = new Set<string>();

  const rows = grid.length;
  const cols = rows > 0 ? (grid[0]?.length ?? 0) : 0;

  const isTraversable = (p: Point): boolean => {
    if (p.x === goal.x && p.y === goal.y) return true;
    return grid[p.y]?.[p.x]?.type === 'road';
  };

  while (true) {
    let currentKey: string | null = null;
    let currentDist = Infinity;
    for (const [k, d] of dist) {
      if (!visited.has(k) && d < currentDist) {
        currentDist = d;
        currentKey = k;
      }
    }
    if (currentKey === null) return null;

    const [cxStr, cyStr] = currentKey.split(',');
    const current: Point = { x: Number(cxStr), y: Number(cyStr) };

    if (current.x === goal.x && current.y === goal.y) {
      return reconstructPath(cameFrom, current, key);
    }
    visited.add(currentKey);

    const neighbors: Point[] = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ];

    for (const next of neighbors) {
      if (next.x < 0 || next.x >= cols || next.y < 0 || next.y >= rows) continue;
      if (!isTraversable(next)) continue;
      const nk = key(next);
      if (visited.has(nk)) continue;

      const newDist = currentDist + tileCost(grid, next);
      if (newDist < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, newDist);
        cameFrom.set(nk, current);
      }
    }
  }
}

function reconstructPath(
  cameFrom: Map<string, Point>,
  goal: Point,
  key: (p: Point) => string,
): Point[] {
  const path: Point[] = [goal];
  let current = goal;
  while (true) {
    const prev = cameFrom.get(key(current));
    if (!prev) break;
    path.unshift(prev);
    current = prev;
  }
  return path;
}
