export type TileType = 'empty' | 'road' | 'resourceNode' | 'factory' | 'house';

export interface Tile {
  x: number;
  y: number;
  type: TileType;
  /** Only set for road tiles. */
  roadCapacity?: number;
  /** Only set for road tiles; recomputed fresh every tick from shipment positions. */
  load?: number;
}

export type ResourceType = 'ore' | 'plank' | 'widget' | 'food';

export interface ResourceNode {
  id: string;
  x: number;
  y: number;
  resourceType: ResourceType;
  buffer: number;
}

export type RecipeId = 'makeWidget';

export interface Recipe {
  inputs: Partial<Record<ResourceType, number>>;
  output: ResourceType;
  ticks: number;
}

export interface Factory {
  id: string;
  x: number;
  y: number;
  recipeId: RecipeId;
  inputBuffer: number;
  outputBuffer: number;
  progress: number;
}

export interface House {
  id: string;
  x: number;
  y: number;
  demand: ResourceType;
  demandBuffer: number;
  commuteBuffer: number;
  happiness: number;
  ticksSinceDemandFulfilled: number;
  ticksSinceCommute: number;
  population: number;
}

export type ShipmentKind = 'freight' | 'commuter';

export interface Shipment {
  id: string;
  kind: ShipmentKind;
  fromId: string;
  toId: string;
  cargo?: ResourceType;
  path: { x: number; y: number }[];
  pathIndex: number;
  /** 0..1 progress toward the next tile in the path. Sim-authoritative;
   * advances by less than 1 per tick when the current tile is congested. */
  subProgress: number;
  ticksInTransit: number;
}

export interface WorldState {
  tick: number;
  grid: Tile[][];
  resourceNodes: ResourceNode[];
  factories: Factory[];
  houses: House[];
  shipments: Shipment[];
  nextEntityId: number;
  money: number;
  /** Average load/capacity ratio across active road tiles. 0 = no traffic, 1 = at capacity. */
  congestion: number;
}

export type Action =
  | { type: 'PLACE_TILE'; x: number; y: number; tileType: Exclude<TileType, 'empty'> }
  | { type: 'REMOVE_TILE'; x: number; y: number };
