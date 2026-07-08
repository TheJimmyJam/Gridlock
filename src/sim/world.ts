import {
  FACTORY_INPUT_CAP,
  FACTORY_OUTPUT_CAP,
  GRID_COLS,
  GRID_ROWS,
  HAPPINESS_IDLE_THRESHOLD_TICKS,
  HAPPINESS_MAX,
  HAPPINESS_MIN,
  HAPPINESS_STEP,
  HOUSE_COMMUTE_CAP,
  HOUSE_DEMAND_CAP,
  HOUSE_INITIAL_HAPPINESS,
  MAX_INFLIGHT_SHIPMENTS_PER_SOURCE,
  NODE_BUFFER_CAP,
} from './constants';
import { findPath } from './pathfinding';
import { RECIPES } from './recipes';
import type { Action, Factory, House, ResourceNode, Shipment, Tile, WorldState } from './types';

export function createWorldState(): WorldState {
  const grid: Tile[][] = [];
  for (let y = 0; y < GRID_ROWS; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < GRID_COLS; x++) {
      row.push({ x, y, type: 'empty' });
    }
    grid.push(row);
  }
  return {
    tick: 0,
    grid,
    resourceNodes: [],
    factories: [],
    houses: [],
    shipments: [],
    nextEntityId: 1,
  };
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS;
}

function applyTileAction(grid: Tile[][], action: Action): void {
  if (!inBounds(action.x, action.y)) return;
  const row = grid[action.y];
  if (!row) return;

  if (action.type === 'PLACE_TILE') {
    row[action.x] = { x: action.x, y: action.y, type: action.tileType };
  } else if (action.type === 'REMOVE_TILE') {
    row[action.x] = { x: action.x, y: action.y, type: 'empty' };
  }
}

function countInFlightFrom(shipments: Shipment[], sourceId: string): number {
  return shipments.filter((s) => s.fromId === sourceId).length;
}

/**
 * Advance the world one fixed simulation step. Pure function: given the
 * same state and actions, always produces the same result. Does not read
 * wall-clock time, randomness, or any browser/Phaser API.
 */
export function tick(state: WorldState, actions: Action[]): WorldState {
  const grid = state.grid.map((row) => row.slice());
  let nextEntityId = state.nextEntityId;
  let resourceNodes = state.resourceNodes.slice();
  let factories = state.factories.slice();
  let houses = state.houses.slice();

  for (const action of actions) {
    applyTileAction(grid, action);

    if (action.type === 'PLACE_TILE' && action.tileType === 'resourceNode') {
      const node: ResourceNode = {
        id: `node-${nextEntityId++}`,
        x: action.x,
        y: action.y,
        resourceType: 'ore',
        buffer: 0,
      };
      resourceNodes = [...resourceNodes, node];
    } else if (action.type === 'PLACE_TILE' && action.tileType === 'factory') {
      const factory: Factory = {
        id: `factory-${nextEntityId++}`,
        x: action.x,
        y: action.y,
        recipeId: 'makeWidget',
        inputBuffer: 0,
        outputBuffer: 0,
        progress: 0,
      };
      factories = [...factories, factory];
    } else if (action.type === 'PLACE_TILE' && action.tileType === 'house') {
      const house: House = {
        id: `house-${nextEntityId++}`,
        x: action.x,
        y: action.y,
        demand: RECIPES.makeWidget.output,
        demandBuffer: 0,
        commuteBuffer: 0,
        happiness: HOUSE_INITIAL_HAPPINESS,
        ticksSinceDemandFulfilled: 0,
        ticksSinceCommute: 0,
      };
      houses = [...houses, house];
    } else if (action.type === 'REMOVE_TILE') {
      resourceNodes = resourceNodes.filter((n) => n.x !== action.x || n.y !== action.y);
      factories = factories.filter((f) => f.x !== action.x || f.y !== action.y);
      houses = houses.filter((h) => h.x !== action.x || h.y !== action.y);
    }
  }

  // Drop shipments whose endpoints no longer exist (their tile was removed).
  const liveEntityIds = new Set<string>([
    ...resourceNodes.map((n) => n.id),
    ...factories.map((f) => f.id),
    ...houses.map((h) => h.id),
  ]);
  let shipments = state.shipments.filter(
    (s) => liveEntityIds.has(s.fromId) && liveEntityIds.has(s.toId),
  );

  // --- Production: resource nodes accumulate raw material. ---
  resourceNodes = resourceNodes.map((n) => ({
    ...n,
    buffer: Math.min(NODE_BUFFER_CAP, n.buffer + 1),
  }));

  // --- Commute desire: houses accumulate a want-to-commute buffer. ---
  houses = houses.map((h) => ({
    ...h,
    commuteBuffer: Math.min(HOUSE_COMMUTE_CAP, h.commuteBuffer + 1),
  }));

  // --- Dispatch: resource node -> factory (raw material freight). ---
  for (const node of resourceNodes) {
    if (node.buffer <= 0) continue;
    if (countInFlightFrom(shipments, node.id) >= MAX_INFLIGHT_SHIPMENTS_PER_SOURCE) continue;

    const factory = factories.find((f) => {
      const recipe = RECIPES[f.recipeId];
      return node.resourceType in recipe.inputs && f.inputBuffer < FACTORY_INPUT_CAP;
    });
    if (!factory) continue;

    const path = findPath(grid, { x: node.x, y: node.y }, { x: factory.x, y: factory.y });
    if (!path) continue;

    node.buffer -= 1;
    shipments = [
      ...shipments,
      {
        id: `shipment-${nextEntityId++}`,
        kind: 'freight',
        fromId: node.id,
        toId: factory.id,
        cargo: node.resourceType,
        path,
        pathIndex: 0,
      },
    ];
  }

  // --- Dispatch: factory -> house (finished-good freight). ---
  for (const factory of factories) {
    if (factory.outputBuffer <= 0) continue;
    if (countInFlightFrom(shipments, factory.id) >= MAX_INFLIGHT_SHIPMENTS_PER_SOURCE) continue;

    const recipe = RECIPES[factory.recipeId];
    const house = houses.find(
      (h) => h.demand === recipe.output && h.demandBuffer < HOUSE_DEMAND_CAP,
    );
    if (!house) continue;

    const path = findPath(grid, { x: factory.x, y: factory.y }, { x: house.x, y: house.y });
    if (!path) continue;

    factory.outputBuffer -= 1;
    shipments = [
      ...shipments,
      {
        id: `shipment-${nextEntityId++}`,
        kind: 'freight',
        fromId: factory.id,
        toId: house.id,
        cargo: recipe.output,
        path,
        pathIndex: 0,
      },
    ];
  }

  // --- Dispatch: house -> factory (commuter trips to jobs). Shares the
  // same road network and shipment/movement machinery as freight above. ---
  for (const house of houses) {
    if (house.commuteBuffer <= 0) continue;
    if (countInFlightFrom(shipments, house.id) >= MAX_INFLIGHT_SHIPMENTS_PER_SOURCE) continue;

    let job: Factory | undefined;
    let path: ReturnType<typeof findPath> = null;
    for (const candidate of factories) {
      const candidatePath = findPath(grid, { x: house.x, y: house.y }, { x: candidate.x, y: candidate.y });
      if (candidatePath) {
        job = candidate;
        path = candidatePath;
        break;
      }
    }
    if (!job || !path) continue;

    house.commuteBuffer -= 1;
    shipments = [
      ...shipments,
      {
        id: `shipment-${nextEntityId++}`,
        kind: 'commuter',
        fromId: house.id,
        toId: job.id,
        path,
        pathIndex: 0,
      },
    ];
  }

  // --- Move every shipment one step; collect arrivals. ---
  const freightDeliveries = new Map<string, number>(); // keyed by toId (factory or house)
  const commuterArrivals = new Map<string, number>(); // keyed by fromId (the house that commuted)
  const movingShipments: Shipment[] = [];
  for (const shipment of shipments) {
    const nextIndex = shipment.pathIndex + 1;
    if (nextIndex >= shipment.path.length) {
      if (shipment.kind === 'freight') {
        freightDeliveries.set(shipment.toId, (freightDeliveries.get(shipment.toId) ?? 0) + 1);
      } else {
        commuterArrivals.set(shipment.fromId, (commuterArrivals.get(shipment.fromId) ?? 0) + 1);
      }
    } else {
      movingShipments.push({ ...shipment, pathIndex: nextIndex });
    }
  }
  shipments = movingShipments;

  // --- Factories: receive raw material, craft on schedule. ---
  factories = factories.map((f) => {
    const delivered = freightDeliveries.get(f.id) ?? 0;
    let inputBuffer = Math.min(FACTORY_INPUT_CAP, f.inputBuffer + delivered);
    let outputBuffer = f.outputBuffer;
    let progress = f.progress;

    const recipe = RECIPES[f.recipeId];
    const required = recipe.inputs.ore ?? 0;

    if (inputBuffer >= required && outputBuffer < FACTORY_OUTPUT_CAP) {
      progress += 1;
      if (progress >= recipe.ticks) {
        inputBuffer -= required;
        outputBuffer = Math.min(FACTORY_OUTPUT_CAP, outputBuffer + 1);
        progress = 0;
      }
    }

    return { ...f, inputBuffer, outputBuffer, progress };
  });

  // --- Houses: receive goods, consume demand, credit commutes, update happiness. ---
  houses = houses.map((h) => {
    const delivered = freightDeliveries.get(h.id) ?? 0;
    let demandBuffer = Math.min(HOUSE_DEMAND_CAP, h.demandBuffer + delivered);

    const demandFulfilled = demandBuffer > 0;
    if (demandFulfilled) demandBuffer -= 1;

    const commuteSucceeded = (commuterArrivals.get(h.id) ?? 0) > 0;

    // Deliveries/commutes are bursty by nature (production takes several
    // ticks), so happiness only reacts to actual events, and only decays
    // once a house has gone too long without one — not on every idle tick.
    const ticksSinceDemandFulfilled = demandFulfilled ? 0 : h.ticksSinceDemandFulfilled + 1;
    const ticksSinceCommute = commuteSucceeded ? 0 : h.ticksSinceCommute + 1;

    let happiness = h.happiness;
    if (demandFulfilled) happiness = Math.min(HAPPINESS_MAX, happiness + HAPPINESS_STEP);
    else if (ticksSinceDemandFulfilled > HAPPINESS_IDLE_THRESHOLD_TICKS) {
      happiness = Math.max(HAPPINESS_MIN, happiness - HAPPINESS_STEP);
    }
    if (commuteSucceeded) happiness = Math.min(HAPPINESS_MAX, happiness + HAPPINESS_STEP);
    else if (ticksSinceCommute > HAPPINESS_IDLE_THRESHOLD_TICKS) {
      happiness = Math.max(HAPPINESS_MIN, happiness - HAPPINESS_STEP);
    }

    return { ...h, demandBuffer, happiness, ticksSinceDemandFulfilled, ticksSinceCommute };
  });

  return {
    tick: state.tick + 1,
    grid,
    resourceNodes,
    factories,
    houses,
    shipments,
    nextEntityId,
  };
}
