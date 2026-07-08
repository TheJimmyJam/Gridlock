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
  private lastTickAt = performance.now();

  start(): void {
    if (this.intervalId !== null) return;
    this.lastTickAt = performance.now();
    this.intervalId = setInterval(() => {
      this.state = tick(this.state, this.pendingActions);
      this.pendingActions = [];
      this.lastTickAt = performance.now();
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

  /** 0..1 progress toward the next tick, for render-side interpolation only. */
  getInterpolationAlpha(): number {
    const elapsed = performance.now() - this.lastTickAt;
    return Math.min(1, elapsed / TICK_INTERVAL_MS);
  }
}
