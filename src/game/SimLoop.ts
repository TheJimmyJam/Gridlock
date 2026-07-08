import { TICK_INTERVAL_MS } from '../sim/constants';
import type { Action, WorldState } from '../sim/types';
import { createWorldState, tick } from '../sim/world';

/**
 * Owns the action queue and drives sim.tick() on a fixed interval,
 * decoupled from Phaser's requestAnimationFrame render loop. The renderer
 * only ever reads getState(); it never mutates sim state directly.
 */
export class SimLoop {
  private state: WorldState = createWorldState();
  private pendingActions: Action[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.intervalId !== null) return;
    this.intervalId = setInterval(() => {
      this.state = tick(this.state, this.pendingActions);
      this.pendingActions = [];
    }, TICK_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId === null) return;
    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  enqueue(action: Action): void {
    this.pendingActions.push(action);
  }

  getState(): WorldState {
    return this.state;
  }
}
