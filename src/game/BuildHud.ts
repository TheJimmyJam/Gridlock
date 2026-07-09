import { RECIPES } from '../sim/recipes';
import type { RecipeId, ResourceType, RoadPiece, TileType } from '../sim/types';

export type Tool = Exclude<TileType, 'empty'>;

export interface BuildHudCallbacks {
  onToolChange: (tool: Tool) => void;
  onRecipeChange: (recipeId: RecipeId) => void;
  onDemandChange: (demand: ResourceType) => void;
  onRoadPieceChange: (piece: RoadPiece) => void;
  onRoadAngleChange: (angle: 0 | 90 | 180 | 270) => void;
}

const TOOLS: Tool[] = ['road', 'resourceNode', 'forestNode', 'factory', 'house', 'service'];

const ROAD_PIECE_LABELS: Record<RoadPiece, string> = {
  straight: 'Straight',
  corner: 'Corner',
  tjunction: 'T-Junction',
  '4way': '4-Way',
  endcap: 'End Cap',
};
const ROAD_PIECES: RoadPiece[] = ['straight', 'corner', 'tjunction', '4way', 'endcap'];

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
  private roadPieceSelect: HTMLSelectElement;
  private rotateBtn: HTMLButtonElement;
  private lastUnlockedKey = '';
  private roadAngle: 0 | 90 | 180 | 270 = 0;

  constructor(private callbacks: BuildHudCallbacks) {
    this.recipeSelect = document.getElementById('recipe-select') as HTMLSelectElement;
    this.demandSelect = document.getElementById('demand-select') as HTMLSelectElement;
    this.roadPieceSelect = document.getElementById('road-piece-select') as HTMLSelectElement;
    this.rotateBtn = document.getElementById('road-rotate-btn') as HTMLButtonElement;

    for (const piece of ROAD_PIECES) {
      const opt = document.createElement('option');
      opt.value = piece;
      opt.textContent = ROAD_PIECE_LABELS[piece];
      this.roadPieceSelect.appendChild(opt);
    }

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
    this.roadPieceSelect.addEventListener('change', () => {
      this.callbacks.onRoadPieceChange(this.roadPieceSelect.value as RoadPiece);
    });
    this.rotateBtn.addEventListener('click', () => {
      this.roadAngle = (((this.roadAngle + 90) % 360) as 0 | 90 | 180 | 270);
      this.updateRotateLabel();
      this.callbacks.onRoadAngleChange(this.roadAngle);
    });
    this.updateRotateLabel();
  }

  private updateRotateLabel(): void {
    this.rotateBtn.textContent = `⟳ Rotate (${this.roadAngle}°)`;
  }

  /** Highlights the active tool button and shows/hides the relevant dropdown. */
  setActiveTool(tool: Tool): void {
    for (const [t, btn] of this.buttons) btn.classList.toggle('active', t === tool);
    this.recipeSelect.style.display = tool === 'factory' ? 'inline-block' : 'none';
    this.demandSelect.style.display = tool === 'house' ? 'inline-block' : 'none';
    this.roadPieceSelect.style.display = tool === 'road' ? 'inline-block' : 'none';
    this.rotateBtn.style.display = tool === 'road' ? 'inline-block' : 'none';
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
