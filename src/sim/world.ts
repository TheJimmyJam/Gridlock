import { GRID_COLS, GRID_ROWS } from './constants';
import type { Action, Tile, WorldState } from './types';

export function createWorldState(): WorldState {
  const grid: Tile[][] = [];
  for (let y = 0; y < GRID_ROWS; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < GRID_COLS; x++) {
      row.push({ x, y, type: 'empty' });
    }
    grid.push(row);
  }
  return { tick: 0, grid };
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS;
}

function applyAction(grid: Tile[][], action: Action): void {
  if (!inBounds(action.x, action.y)) return;
  const row = grid[action.y];
  if (!row) return;

  if (action.type === 'PLACE_TILE') {
    row[action.x] = { x: action.x, y: action.y, type: action.tileType };
  } else if (action.type === 'REMOVE_TILE') {
    row[action.x] = { x: action.x, y: action.y, type: 'empty' };
  }
}

/**
 * Advance the world one fixed simulation step. Pure function: given the
 * same state and actions, always produces the same result. Does not read
 * wall-clock time or any browser/Phaser API.
 */
export function tick(state: WorldState, actions: Action[]): WorldState {
  const grid = state.grid.map((row) => row.slice());
  for (const action of actions) {
    applyAction(grid, action);
  }
  return { tick: state.tick + 1, grid };
}
