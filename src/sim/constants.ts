import type { RecipeId, TileType } from './types';

export const GRID_COLS = 200;
export const GRID_ROWS = 200;

/** Sim runs on a fixed timestep, decoupled from render framerate. */
export const TICK_INTERVAL_MS = 250;

export const NODE_BUFFER_CAP = 5;
export const FACTORY_INPUT_CAP = 10;
export const FACTORY_OUTPUT_CAP = 10;
export const MAX_INFLIGHT_SHIPMENTS_PER_SOURCE = 3;

export const HOUSE_DEMAND_CAP = 5;
export const HOUSE_COMMUTE_CAP = 5;
export const HOUSE_INITIAL_HAPPINESS = 50;
export const HAPPINESS_STEP = 2;
export const HAPPINESS_MIN = 0;
export const HAPPINESS_MAX = 100;
/**
 * Deliveries/commutes are inherently bursty (factories only finish a
 * widget every recipe.ticks). Only dock happiness once a house has gone
 * this many ticks without a success, instead of every idle tick — so a
 * healthily-connected house trends up, not down on noise.
 */
export const HAPPINESS_IDLE_THRESHOLD_TICKS = 20;

// --- Phase 4: congestion ---
export const ROAD_CAPACITY = 3;
/** A trip stuck in transit longer than this fails outright (cargo lost / commuter never arrives). */
export const MAX_TRIP_TICKS = 200;
/**
 * Extra pathfinding cost added per unit a road tile is over capacity.
 * This is what makes "widen the road" or "build a parallel route" an
 * actual lever — without a congestion-aware cost, every shipment between
 * the same two points would always take the identical shortest path.
 */
export const CONGESTION_PATH_WEIGHT = 2;

// --- Phase 4: economy ---
export const STARTING_MONEY = 1000;
export const HOUSE_POPULATION = 4;
/** Placeholder balance value — will need tuning once the game is playable. */
export const TAX_RATE_PER_POP_PER_TICK = 0.1;

export const TILE_COSTS: Record<Exclude<TileType, 'empty'>, number> = {
  road: 5,
  resourceNode: 20,
  forestNode: 20,
  factory: 100,
  house: 50,
  service: 150,
};

// --- Phase 6: recipes/tech progression ---
export const INITIAL_UNLOCKED_RECIPES: RecipeId[] = ['makeWidget', 'makePlank'];

// --- Phase 6: service buildings ---
/** Tiles (Euclidean, grid units) within which a service building boosts house happiness. */
export const SERVICE_COVERAGE_RADIUS = 8;
/**
 * Flat happiness gain per tick for a covered house, independent of
 * demand/commute events. A totally disconnected house still decays (both
 * idle penalties = -4/tick, this only offsets 3 of it) -- services soften
 * the cascade, they don't replace needing roads.
 */
export const SERVICE_HAPPINESS_BONUS = 3;
