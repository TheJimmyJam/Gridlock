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
  HOUSE_POPULATION,
  INITIAL_UNLOCKED_RECIPES,
  MAX_INFLIGHT_SHIPMENTS_PER_SOURCE,
  MAX_TRIP_TICKS,
  NODE_BUFFER_CAP,
  ROAD_CAPACITY,
  SERVICE_COVERAGE_RADIUS,
  SERVICE_HAPPINESS_BONUS,
  STARTING_MONEY,
  TAX_RATE_PER_POP_PER_TICK,
  TILE_COSTS,
} from './constants';
import { findPath } from './pathfinding';
import { RECIPES } from './recipes';
import type {
  Action,
  Factory,
  House,
  RecipeId,
  ResourceNode,
  ResourceType,
  Service,
  Shipment,
  Tile,
  WorldState,
} from './types';

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
    services: [],
    shipments: [],
    nextEntityId: 1,
    money: STARTING_MONEY,
    congestion: 0,
    unlockedRecipes: [...INITIAL_UNLOCKED_RECIPES],
  };
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS;
}

function countInFlightFrom(shipments: Shipment[], sourceId: string): number {
  return shipments.filter((s) => s.fromId === sourceId).length;
}

/** Whether a point is within any service building's coverage radius. */
function isServiceCovered(x: number, y: number, services: Service[]): boolean {
  const radiusSq = SERVICE_COVERAGE_RADIUS * SERVICE_COVERAGE_RADIUS;
  return services.some((s) => (s.x - x) ** 2 + (s.y - y) ** 2 <= radiusSq);
}

/** Any producer (resource node or factory) with something to ship. */
interface Producer {
  id: string;
  x: number;
  y: number;
  resourceType: ResourceType;
}

/**
 * Find something that currently wants `resourceType` AND is actually
 * reachable from `from`: prefer a factory whose recipe consumes it (keeps
 * multi-stage chains flowing), otherwise a house that demands it as a
 * finished good. Tries every matching candidate, not just the first one
 * by array order — an unreachable match (no road connection) must not
 * block dispatch to a reachable one further down the list.
 */
function findConsumer(
  grid: Tile[][],
  from: { x: number; y: number },
  resourceType: ResourceType,
  factories: Factory[],
  houses: House[],
  excludeFactoryId?: string,
): { entity: { id: string; x: number; y: number }; path: { x: number; y: number }[] } | undefined {
  const factoryCandidates = factories.filter((f) => {
    if (f.id === excludeFactoryId) return false;
    const recipe = RECIPES[f.recipeId];
    return resourceType in recipe.inputs && f.inputBuffer < FACTORY_INPUT_CAP;
  });
  const houseCandidates = houses.filter(
    (h) => h.demand === resourceType && h.demandBuffer < HOUSE_DEMAND_CAP,
  );

  for (const candidate of [...factoryCandidates, ...houseCandidates]) {
    const path = findPath(grid, from, { x: candidate.x, y: candidate.y });
    if (path) return { entity: candidate, path };
  }
  return undefined;
}

/**
 * Advance the world one fixed simulation step. Pure function: given the
 * same state and actions, always produces the same result. Does not read
 * wall-clock time, randomness, or any browser/Phaser API.
 */
export function tick(state: WorldState, actions: Action[]): WorldState {
  const grid = state.grid.map((row) => row.slice());
  let nextEntityId = state.nextEntityId;
  let money = state.money;
  let resourceNodes = state.resourceNodes.slice();
  let factories = state.factories.slice();
  let houses = state.houses.slice();
  let services = state.services.slice();
  const unlockedRecipes = new Set<RecipeId>(state.unlockedRecipes);
  const validDemands = new Set<ResourceType>([...unlockedRecipes].map((id) => RECIPES[id].output));

  // --- Apply actions: place/remove tiles + entities. Placement costs
  // money; if the player can't afford it, the action is silently a no-op
  // (the "soft fail when broke" — nothing breaks, you just can't build). ---
  for (const action of actions) {
    if (!inBounds(action.x, action.y)) continue;
    const row = grid[action.y];
    if (!row) continue;

    if (action.type === 'PLACE_TILE') {
      const cost = TILE_COSTS[action.tileType];
      if (money < cost) continue;
      money -= cost;

      if (action.tileType === 'road') {
        row[action.x] = {
          x: action.x,
          y: action.y,
          type: 'road',
          roadCapacity: ROAD_CAPACITY,
          load: 0,
        };
      } else {
        row[action.x] = { x: action.x, y: action.y, type: action.tileType };
      }

      if (action.tileType === 'resourceNode') {
        const node: ResourceNode = {
          id: `node-${nextEntityId++}`,
          x: action.x,
          y: action.y,
          resourceType: 'ore',
          buffer: 0,
        };
        resourceNodes = [...resourceNodes, node];
      } else if (action.tileType === 'forestNode') {
        const node: ResourceNode = {
          id: `node-${nextEntityId++}`,
          x: action.x,
          y: action.y,
          resourceType: 'wood',
          buffer: 0,
        };
        resourceNodes = [...resourceNodes, node];
      } else if (action.tileType === 'factory') {
        const recipeId: RecipeId =
          action.recipeId && unlockedRecipes.has(action.recipeId) ? action.recipeId : 'makeWidget';
        factories = [
          ...factories,
          {
            id: `factory-${nextEntityId++}`,
            x: action.x,
            y: action.y,
            recipeId,
            inputBuffer: 0,
            outputBuffer: 0,
            progress: 0,
          },
        ];
      } else if (action.tileType === 'house') {
        const demand: ResourceType =
          action.demand && validDemands.has(action.demand) ? action.demand : 'widget';
        houses = [
          ...houses,
          {
            id: `house-${nextEntityId++}`,
            x: action.x,
            y: action.y,
            demand,
            demandBuffer: 0,
            commuteBuffer: 0,
            happiness: HOUSE_INITIAL_HAPPINESS,
            ticksSinceDemandFulfilled: 0,
            ticksSinceCommute: 0,
            population: HOUSE_POPULATION,
          },
        ];
      } else if (action.tileType === 'service') {
        const service: Service = { id: `service-${nextEntityId++}`, x: action.x, y: action.y };
        services = [...services, service];
      }
    } else if (action.type === 'REMOVE_TILE') {
      row[action.x] = { x: action.x, y: action.y, type: 'empty' };
      resourceNodes = resourceNodes.filter((n) => n.x !== action.x || n.y !== action.y);
      factories = factories.filter((f) => f.x !== action.x || f.y !== action.y);
      houses = houses.filter((h) => h.x !== action.x || h.y !== action.y);
      services = services.filter((s) => s.x !== action.x || s.y !== action.y);
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

  // --- Congestion: snapshot how many shipments currently occupy each
  // road tile, write it back onto the tile (for rendering + next tick's
  // pathfinding), and compute the aggregate congestion metric. ---
  const loadByTile = new Map<string, number>();
  for (const shipment of shipments) {
    const at = shipment.path[shipment.pathIndex];
    if (!at) continue;
    const key = `${at.x},${at.y}`;
    loadByTile.set(key, (loadByTile.get(key) ?? 0) + 1);
  }

  let congestionRatioSum = 0;
  let activeRoadTiles = 0;
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) {
      const tile = row[x];
      if (!tile || tile.type !== 'road') continue;
      const load = loadByTile.get(`${x},${y}`) ?? 0;
      if (load === tile.load) continue;
      row[x] = { ...tile, load };
      if (load > 0) {
        congestionRatioSum += load / (tile.roadCapacity ?? ROAD_CAPACITY);
        activeRoadTiles += 1;
      }
    }
  }
  const congestion = activeRoadTiles > 0 ? congestionRatioSum / activeRoadTiles : 0;

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

  // Fresh copies so the dispatch loop below can mutate outputBuffer in
  // place without corrupting the previous tick's state (resourceNodes
  // already gets this via its production .map() above; factories don't
  // get an equivalent pass until crafting runs, which is after dispatch).
  factories = factories.map((f) => ({ ...f }));

  // --- Dispatch: any producer (resource node or factory output) ships to
  // whatever currently wants that resource type — another factory (keeps
  // multi-stage chains like wood -> plank -> food flowing) or a house. ---
  const producers: Producer[] = [
    ...resourceNodes.map((n) => ({ id: n.id, x: n.x, y: n.y, resourceType: n.resourceType })),
    ...factories
      .filter((f) => f.outputBuffer > 0)
      .map((f) => ({ id: f.id, x: f.x, y: f.y, resourceType: RECIPES[f.recipeId].output })),
  ];

  for (const producer of producers) {
    const isNode = resourceNodes.some((n) => n.id === producer.id);
    const sourceBuffer = isNode
      ? (resourceNodes.find((n) => n.id === producer.id)?.buffer ?? 0)
      : (factories.find((f) => f.id === producer.id)?.outputBuffer ?? 0);
    if (sourceBuffer <= 0) continue;
    if (countInFlightFrom(shipments, producer.id) >= MAX_INFLIGHT_SHIPMENTS_PER_SOURCE) continue;

    const result = findConsumer(
      grid,
      { x: producer.x, y: producer.y },
      producer.resourceType,
      factories,
      houses,
      isNode ? undefined : producer.id,
    );
    if (!result) continue;
    const { entity: consumer, path } = result;

    if (isNode) {
      const node = resourceNodes.find((n) => n.id === producer.id);
      if (node) node.buffer -= 1;
    } else {
      const factory = factories.find((f) => f.id === producer.id);
      if (factory) factory.outputBuffer -= 1;
    }

    shipments = [
      ...shipments,
      {
        id: `shipment-${nextEntityId++}`,
        kind: 'freight',
        fromId: producer.id,
        toId: consumer.id,
        cargo: producer.resourceType,
        path,
        pathIndex: 0,
        subProgress: 0,
        ticksInTransit: 0,
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
      const candidatePath = findPath(
        grid,
        { x: house.x, y: house.y },
        { x: candidate.x, y: candidate.y },
      );
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
        subProgress: 0,
        ticksInTransit: 0,
      },
    ];
  }

  // --- Move every shipment, respecting congestion; collect arrivals and
  // time out trips that have been stuck too long. ---
  const freightDeliveries = new Map<string, number>(); // keyed by toId (factory or house)
  const commuterArrivals = new Map<string, number>(); // keyed by fromId (the house that commuted)
  const movingShipments: Shipment[] = [];

  for (const shipment of shipments) {
    const ticksInTransit = shipment.ticksInTransit + 1;
    if (ticksInTransit > MAX_TRIP_TICKS) {
      // Trip timeout: cargo is lost / commuter never arrives. No delivery
      // credit — this is what lets the cascade actually show up as failed
      // deliveries and failed commutes, not just slow ones.
      continue;
    }

    const at = shipment.path[shipment.pathIndex];
    const atTile = at ? grid[at.y]?.[at.x] : undefined;
    const speed =
      atTile?.type === 'road'
        ? Math.min(1, (atTile.roadCapacity ?? ROAD_CAPACITY) / Math.max(1, atTile.load ?? 0))
        : 1;

    let pathIndex = shipment.pathIndex;
    let subProgress = shipment.subProgress + speed;
    if (subProgress >= 1) {
      pathIndex += 1;
      subProgress -= 1;
    }

    if (pathIndex >= shipment.path.length - 1) {
      if (shipment.kind === 'freight') {
        freightDeliveries.set(shipment.toId, (freightDeliveries.get(shipment.toId) ?? 0) + 1);
      } else {
        commuterArrivals.set(shipment.fromId, (commuterArrivals.get(shipment.fromId) ?? 0) + 1);
      }
    } else {
      movingShipments.push({ ...shipment, pathIndex, subProgress, ticksInTransit });
    }
  }
  shipments = movingShipments;

  // --- Factories: receive input, craft on schedule. ---
  factories = factories.map((f) => {
    const delivered = freightDeliveries.get(f.id) ?? 0;
    let inputBuffer = Math.min(FACTORY_INPUT_CAP, f.inputBuffer + delivered);
    let outputBuffer = f.outputBuffer;
    let progress = f.progress;

    const recipe = RECIPES[f.recipeId];
    const [, required] = Object.entries(recipe.inputs)[0] ?? [undefined, 0];

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

  // --- Houses: receive goods, consume demand, credit commutes, update
  // happiness, and pay tax proportional to happiness * population. A
  // house's first fulfilled widget demand unlocks the makeFood recipe. ---
  let taxIncome = 0;
  houses = houses.map((h) => {
    const delivered = freightDeliveries.get(h.id) ?? 0;
    let demandBuffer = Math.min(HOUSE_DEMAND_CAP, h.demandBuffer + delivered);

    const demandFulfilled = demandBuffer > 0;
    if (demandFulfilled) {
      demandBuffer -= 1;
      if (h.demand === 'widget') unlockedRecipes.add('makeFood');
    }

    const commuteSucceeded = (commuterArrivals.get(h.id) ?? 0) > 0;

    // Deliveries/commutes are bursty by nature (production takes several
    // ticks, congestion adds more delay), so happiness only reacts to
    // actual events, and only decays once a house has gone too long
    // without one — not on every idle tick.
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

    // Service buildings give covered houses a flat happiness boost every
    // tick, independent of demand/commute events -- a lever the player can
    // pull to protect happiness while fixing a congested network.
    if (isServiceCovered(h.x, h.y, services)) {
      happiness = Math.min(HAPPINESS_MAX, happiness + SERVICE_HAPPINESS_BONUS);
    }

    taxIncome += h.population * (happiness / HAPPINESS_MAX) * TAX_RATE_PER_POP_PER_TICK;

    return { ...h, demandBuffer, happiness, ticksSinceDemandFulfilled, ticksSinceCommute };
  });
  money += taxIncome;

  return {
    tick: state.tick + 1,
    grid,
    resourceNodes,
    factories,
    houses,
    services,
    shipments,
    nextEntityId,
    money,
    congestion,
    unlockedRecipes: [...unlockedRecipes],
  };
}
