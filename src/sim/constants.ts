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
