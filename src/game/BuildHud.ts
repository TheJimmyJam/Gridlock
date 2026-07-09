import { RECIPES } from '../sim/recipes';
import type { RecipeId, ResourceType, TileType } from '../sim/types';

export type Tool = Exclude<TileType, 'empty'>;

export interface BuildHudCallbacks {
  onToolChange: (tool: Tool) => void;
  onRecipeChange: (recipeId: RecipeId) => void;
  onDemandChange: (demand: ResourceType) => void;
}

const TOOLS: Tool[] = ['road', 'resourceNode', 'forestNode', 'factory', 'house', 'service'];

/**
 * DOM-based building toolbar (matches the auth-overlay/sign-out-button
 * pattern already used elsewhere) -- replaces raw 1-5 keyboard tool
 * selection with clickable buttons, and shows a recipe/demand dropdown
 * only when the relevant tool (factory/house) is active.
 */
export class BuildHud {
  private buttons = new Map<Tool, HTMLButtonElement>();
  private recipeSelect: HTMLSelectElement;
  private demandSelect: HTMLSelectElement;
  private lastUnlockedKey = '';

  constructor(private callbacks: BuildHudCallbacks) {
    this.recipeSelect = document.getElementById('recipe-select') as HTMLSelectElement;
    this.demandSelect = document.getElementById('demand-select') as HTMLSelectElement;

    for (const tool of TOOLS) {
      const btn = document.querySelector<HTMLButtonElement>(`.build-btn[data-tool="${tool}"]`);
      if (!btn) continue;
      this.buttons.set(tool, btn);
      btn.addEventListener('click', () => {
        this.setActiveTool(tool);
        this.callbacks.onToolChange(tool);
      });
    }

    this.recipeSelect.addEventListener('change', () => {
      this.callbacks.onRecipeChange(this.recipeSelect.value as RecipeId);
    });
    this.demandSelect.addEventListener('change', () => {
      this.callbacks.onDemandChange(this.demandSelect.value as ResourceType);
    });
  }

  /** Highlights the active tool button and shows/hides the relevant dropdown. */
  setActiveTool(tool: Tool): void {
    for (const [t, btn] of this.buttons) btn.classList.toggle('active', t === tool);
    this.recipeSelect.style.display = tool === 'factory' ? 'inline-block' : 'none';
    this.demandSelect.style.display = tool === 'house' ? 'inline-block' : 'none';
  }

  /** Repopulates the recipe/demand dropdowns whenever the unlocked set changes. */
  syncUnlockedRecipes(
    unlockedRecipes: RecipeId[],
    currentRecipeId: RecipeId,
    currentDemand: ResourceType,
  ): void {
    const key = unlockedRecipes.join(',');
    if (key === this.lastUnlockedKey) return;
    this.lastUnlockedKey = key;

    this.recipeSelect.innerHTML = '';
    for (const id of unlockedRecipes) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = id;
      this.recipeSelect.appendChild(opt);
    }
    this.recipeSelect.value = currentRecipeId;

    const demands = [...new Set(unlockedRecipes.map((id) => RECIPES[id].output))];
    this.demandSelect.innerHTML = '';
    for (const d of demands) {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      this.demandSelect.appendChild(opt);
    }
    this.demandSelect.value = currentDemand;
  }
}
