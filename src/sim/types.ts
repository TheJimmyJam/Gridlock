export type TileType = 'empty' | 'road' | 'resourceNode' | 'factory';

export interface Tile {
  x: number;
  y: number;
  type: TileType;
}

export interface WorldState {
  tick: number;
  grid: Tile[][];
}

export type Action =
  | { type: 'PLACE_TILE'; x: number; y: number; tileType: TileType }
  | { type: 'REMOVE_TILE'; x: number; y: number };
