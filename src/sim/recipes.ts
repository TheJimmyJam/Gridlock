import type { Recipe, RecipeId } from './types';

export const RECIPES: Record<RecipeId, Recipe> = {
  makeWidget: { inputs: { ore: 2 }, output: 'widget', ticks: 8 },
  makePlank: { inputs: { wood: 2 }, output: 'plank', ticks: 5 },
  // Locked at game start (see INITIAL_UNLOCKED_RECIPES / world.ts) --
  // unlocks the first time any house's widget demand is fulfilled. A
  // genuine multi-stage chain: wood -> plank -> food.
  makeFood: { inputs: { plank: 1 }, output: 'food', ticks: 6 },
};
