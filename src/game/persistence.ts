import { GRID_COLS, GRID_ROWS } from '../sim/constants';
import type { Tile, WorldState } from '../sim/types';
import { createWorldState } from '../sim/world';
import { supabase } from './supabaseClient';

const TABLE = 'gridlock_saves';
const SAVE_NAME = 'Autosave';

interface SavedTile {
  x: number;
  y: number;
  type: Tile['type'];
  roadCapacity?: number;
}

/**
 * WorldState.grid is a dense GRID_COLS x GRID_ROWS array (mostly empty
 * tiles). Serializing it as-is would mean shipping ~40,000 tile objects
 * on every autosave. Only non-empty tiles are saved; `load` is omitted
 * since it's recomputed fresh from shipment positions every tick anyway.
 */
interface SavedWorld {
  tick: number;
  money: number;
  congestion: number;
  nextEntityId: number;
  tiles: SavedTile[];
  resourceNodes: WorldState['resourceNodes'];
  factories: WorldState['factories'];
  houses: WorldState['houses'];
  shipments: WorldState['shipments'];
}

function serialize(state: WorldState): SavedWorld {
  const tiles: SavedTile[] = [];
  for (const row of state.grid) {
    for (const tile of row) {
      if (tile.type === 'empty') continue;
      tiles.push(
        tile.type === 'road'
          ? { x: tile.x, y: tile.y, type: tile.type, roadCapacity: tile.roadCapacity }
          : { x: tile.x, y: tile.y, type: tile.type },
      );
    }
  }
  return {
    tick: state.tick,
    money: state.money,
    congestion: state.congestion,
    nextEntityId: state.nextEntityId,
    tiles,
    resourceNodes: state.resourceNodes,
    factories: state.factories,
    houses: state.houses,
    shipments: state.shipments,
  };
}

function deserialize(saved: SavedWorld): WorldState {
  const state = createWorldState();
  for (const t of saved.tiles) {
    if (t.x < 0 || t.x >= GRID_COLS || t.y < 0 || t.y >= GRID_ROWS) continue;
    const row = state.grid[t.y];
    if (!row) continue;
    row[t.x] =
      t.type === 'road'
        ? { x: t.x, y: t.y, type: t.type, roadCapacity: t.roadCapacity, load: 0 }
        : { x: t.x, y: t.y, type: t.type };
  }
  return {
    ...state,
    tick: saved.tick,
    money: saved.money,
    congestion: saved.congestion,
    nextEntityId: saved.nextEntityId,
    resourceNodes: saved.resourceNodes,
    factories: saved.factories,
    houses: saved.houses,
    shipments: saved.shipments,
  };
}

export async function loadWorldState(userId: string): Promise<WorldState | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('world')
    .eq('user_id', userId)
    .eq('name', SAVE_NAME)
    .maybeSingle();

  if (error) {
    console.error('Failed to load save:', error);
    return null;
  }
  if (!data) return null;

  return deserialize(data.world as SavedWorld);
}

export async function saveWorldState(userId: string, state: WorldState): Promise<void> {
  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: userId,
      name: SAVE_NAME,
      world: serialize(state),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,name' },
  );

  if (error) console.error('Autosave failed:', error);
}
