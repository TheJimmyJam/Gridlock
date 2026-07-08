import type { Tile } from './types';

export interface Point {
  x: number;
  y: number;
}

/**
 * BFS shortest path from `start` to `goal` over road tiles. `start` and
 * `goal` themselves don't need to be roads (they're a resource node / a
 * factory tile) — every tile in between must be a road.
 *
 * All roads currently cost the same, so BFS finds the same result A*
 * would. Switch to real A* once road tiles carry congestion weights
 * (Phase 4) and shortest-by-cost stops being the same as shortest-by-hops.
 */
export function findPath(grid: Tile[][], start: Point, goal: Point): Point[] | null {
  const key = (p: Point): string => `${p.x},${p.y}`;
  const visited = new Set<string>([key(start)]);
  const cameFrom = new Map<string, Point>();
  const queue: Point[] = [start];

  const rows = grid.length;
  const cols = rows > 0 ? (grid[0]?.length ?? 0) : 0;

  const isTraversable = (p: Point): boolean => {
    if (p.x === goal.x && p.y === goal.y) return true;
    const row = grid[p.y];
    const tile = row?.[p.x];
    return tile?.type === 'road';
  };

  while (queue.length > 0) {
    const current = queue.shift() as Point;
    if (current.x === goal.x && current.y === goal.y) {
      return reconstructPath(cameFrom, current, key);
    }

    const neighbors: Point[] = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ];

    for (const next of neighbors) {
      if (next.x < 0 || next.x >= cols || next.y < 0 || next.y >= rows) continue;
      const k = key(next);
      if (visited.has(k)) continue;
      if (!isTraversable(next)) continue;
      visited.add(k);
      cameFrom.set(k, current);
      queue.push(next);
    }
  }

  return null;
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
