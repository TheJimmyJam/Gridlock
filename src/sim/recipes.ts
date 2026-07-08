import type { Recipe, RecipeId } from './types';

export const RECIPES: Record<RecipeId, Recipe> = {
  makeWidget: { inputs: { ore: 2 }, output: 'widget', ticks: 8 },
};
