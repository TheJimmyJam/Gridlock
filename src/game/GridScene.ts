import Phaser from 'phaser';
import { GRID_COLS, GRID_ROWS, SERVICE_COVERAGE_RADIUS } from '../sim/constants';
import type { RecipeId, ResourceType, TileType, WorldState } from '../sim/types';
import { BuildHud } from './BuildHud';
import { gridToScreen, screenToGrid, TILE_HEIGHT, TILE_WIDTH } from './iso';
import { saveWorldState } from './persistence';
import { SimLoop } from './SimLoop';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 1.5;
const CLICK_DRAG_THRESHOLD = 4; // px of pointer movement before a click counts as a pan
const AUTOSAVE_INTERVAL_MS = 15_000;

export interface GridSceneData {
  userId: string;
  initialState?: WorldState;
}

const TILE_COLORS: Record<Exclude<TileType, 'empty' | 'house' | 'road'>, number> = {
  resourceNode: 0x8d6e63,
  forestNode: 0x2e7d32,
  factory: 0xff9800,
  service: 0x5c6bc0,
};

const SERVICE_COVERAGE_MARKER_COLOR = 0x29b6f6;
const SERVICE_COVERAGE_RADIUS_SQ = SERVICE_COVERAGE_RADIUS * SERVICE_COVERAGE_RADIUS;

const SHIPMENT_COLORS: Record<ResourceType, number> = {
  ore: 0xffca28,
  wood: 0x6d4c41,
  plank: 0xa1887f,
  widget: 0x9c27b0,
  food: 0xef5350,
};

const COMMUTER_COLOR = 0x42a5f5;
const HOUSE_COLOR_UNHAPPY = 0xe53935;
const HOUSE_COLOR_HAPPY = 0x66bb6a;
const ROAD_COLOR_CONGESTED = 0xe53935;

/** Source art canvases are square with padding around the diamond; this is
 * the display size (px) that makes the diamond within them match the grid's
 * TILE_WIDTH/TILE_HEIGHT footprint. */
const TILE_SPRITE_SIZE = 136;

type Direction = 'N' | 'S' | 'E' | 'W';

/** Rotation (degrees) for each 2-connection combo the road art covers.
 * road_straight connects the opposite pair baked into its art at 0deg
 * (W+E); road_corner connects an adjacent pair at 0deg (S+E). Rotating in
 * 90deg steps cycles the connected pair through N->E->S->W. Best-effort --
 * nudge these if a piece renders rotated wrong once it's on screen. */
const STRAIGHT_ROTATIONS: Record<string, number> = {
  'E,W': 0,
  'N,S': 90,
};
const CORNER_ROTATIONS: Record<string, number> = {
  'E,S': 0,
  'S,W': 90,
  'N,W': 180,
  'E,N': 270,
};
const ENDCAP_ROTATIONS: Record<string, number> = {
  S: 0,
  W: 90,
  N: 180,
  E: 270,
};
const TJUNCTION_ROTATIONS: Record<string, number> = {
  'E,S,W': 0,
  'N,S,W': 90,
  'E,N,W': 180,
  'E,N,S': 270,
};

function interpolateColor(from: number, to: number, ratio: number): number {
  const color = Phaser.Display.Color.Interpolate.ColorWithColor(
    Phaser.Display.Color.ValueToColor(from),
    Phaser.Display.Color.ValueToColor(to),
    100,
    Phaser.Math.Clamp(ratio, 0, 1) * 100,
  );
  return Phaser.Display.Color.GetColor(color.r, color.g, color.b);
}

type Tool = Exclude<TileType, 'empty'>;

/**
 * Isometric-projection scene: draws the grid, placed tiles, in-transit
 * shipments, buffer labels, and a money/congestion HUD from WorldState.
 * Player input enqueues actions on the SimLoop; it never mutates sim
 * state directly. All grid/tile math happens in plain orthogonal
 * (col, row) space — this file (via iso.ts) is the only place that
 * translates to/from iso screen coordinates. Placeholder shapes are flat
 * diamonds, not real sprites. Road tiles tint red as they congest; house
 * tiles tint red as happiness drops.
 */
export class GridScene extends Phaser.Scene {
  private simLoop!: SimLoop;
  private userId!: string;
  private autosaveIntervalId: ReturnType<typeof setInterval> | null = null;
  private gridLinesGraphics!: Phaser.GameObjects.Graphics;
  private tilesGraphics!: Phaser.GameObjects.Graphics;
  private shipmentsGraphics!: Phaser.GameObjects.Graphics;
  /** Sprites for tile types that have real art (resourceNode, forestNode,
   * road). Pooled by "x,y" key and reused across frames; house/factory/
   * service still fall back to the flat colored diamonds in tilesGraphics
   * since there's no art for those yet. */
  private tileSprites = new Map<string, Phaser.GameObjects.Image>();
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private hudText!: Phaser.GameObjects.Text;
  /** Non-zooming camera dedicated to fixed-position UI (the stats HUD). */
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private buildHud!: BuildHud;
  private currentTool: Tool = 'road';
  private selectedRecipeId: RecipeId = 'makeWidget';
  private selectedDemand: ResourceType = 'widget';

  private isDragging = false;
  private pointerDownPos = new Phaser.Math.Vector2();
  private dragStart = new Phaser.Math.Vector2();
  private cameraStart = new Phaser.Math.Vector2();

  constructor() {
    super('GridScene');
  }

  init(data: GridSceneData): void {
    this.userId = data.userId;
    this.simLoop = new SimLoop(data.initialState);
  }

  preload(): void {
    this.load.image('terrain_rock_cluster', 'assets/tiles/terrain_rock_cluster.png');
    this.load.image('terrain_tree_cluster', 'assets/tiles/terrain_tree_cluster.png');
    this.load.image('road_straight', 'assets/tiles/road_straight.png');
    this.load.image('road_corner', 'assets/tiles/road_corner.png');
    this.load.image('road_endcap', 'assets/tiles/road_endcap.png');
    this.load.image('road_tjunction', 'assets/tiles/road_tjunction.png');
    this.load.image('road_4way', 'assets/tiles/road_4way.png');
  }

  create(): void {
    this.drawGridLines();
    this.tilesGraphics = this.add.graphics();
    this.shipmentsGraphics = this.add.graphics();
    this.centerCamera();
    this.setupPan();
    this.setupZoom();
    this.setupToolSelection();
    this.setupHud();
    this.setupUiCamera();
    this.setupBuildHud();
    this.setupAutosave();
    this.simLoop.start();
    this.events.on('destroy', () => {
      this.simLoop.stop();
      if (this.autosaveIntervalId !== null) clearInterval(this.autosaveIntervalId);
    });
  }

  /**
   * setScrollFactor(0) only cancels an object's response to camera SCROLL --
   * the main camera's ZOOM transform still displaces its on-screen position
   * (that's why the stats HUD drifted/vanished when zooming). Fix: render
   * fixed UI through a second camera that never zooms or scrolls, and have
   * each camera ignore the other's objects so nothing draws twice.
   */
  private setupUiCamera(): void {
    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCamera.ignore([this.gridLinesGraphics, this.tilesGraphics, this.shipmentsGraphics]);
    this.cameras.main.ignore(this.hudText);
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.uiCamera.setSize(gameSize.width, gameSize.height);
    });
  }

  private setupBuildHud(): void {
    this.buildHud = new BuildHud({
      onToolChange: (tool) => (this.currentTool = tool),
      onRecipeChange: (recipeId) => (this.selectedRecipeId = recipeId),
      onDemandChange: (demand) => (this.selectedDemand = demand),
    });
    this.buildHud.setActiveTool(this.currentTool);
  }

  private setupAutosave(): void {
    this.autosaveIntervalId = setInterval(() => {
      void saveWorldState(this.userId, this.simLoop.getState());
    }, AUTOSAVE_INTERVAL_MS);
  }

  update(): void {
    this.drawTiles();
    this.drawShipments();
    this.drawLabels();
    this.drawHud();
  }

  private setupHud(): void {
    this.hudText = this.add.text(0, 0, '', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 8, y: 6 },
    });
    this.hudText.setScrollFactor(0);
    this.hudText.setPosition(12, 12);
    this.hudText.setDepth(1000);
  }

  private drawHud(): void {
    const { money, congestion, unlockedRecipes } = this.simLoop.getState();
    this.hudText.setText(
      [`$${money.toFixed(0)}`, `congestion: ${congestion.toFixed(2)}`].join('   '),
    );
    this.buildHud.syncUnlockedRecipes(unlockedRecipes, this.selectedRecipeId, this.selectedDemand);
  }

  private drawGridLines(): void {
    this.gridLinesGraphics = this.add.graphics();
    this.gridLinesGraphics.lineStyle(1, 0x333333, 1);

    for (let col = 0; col <= GRID_COLS; col++) {
      const a = gridToScreen(col, 0);
      const b = gridToScreen(col, GRID_ROWS);
      this.gridLinesGraphics.lineBetween(a.x, a.y, b.x, b.y);
    }
    for (let row = 0; row <= GRID_ROWS; row++) {
      const a = gridToScreen(0, row);
      const b = gridToScreen(GRID_COLS, row);
      this.gridLinesGraphics.lineBetween(a.x, a.y, b.x, b.y);
    }
  }

  private drawTileDiamond(graphics: Phaser.GameObjects.Graphics, gx: number, gy: number): void {
    const center = gridToScreen(gx + 0.5, gy + 0.5);
    graphics.fillPoints(
      [
        { x: center.x, y: center.y - TILE_HEIGHT / 2 + 2 },
        { x: center.x + TILE_WIDTH / 2 - 2, y: center.y },
        { x: center.x, y: center.y + TILE_HEIGHT / 2 - 2 },
        { x: center.x - TILE_WIDTH / 2 + 2, y: center.y },
      ],
      true,
    );
  }

  private drawTiles(): void {
    this.tilesGraphics.clear();
    const { grid, houses, services } = this.simLoop.getState();
    const houseByCoord = new Map(houses.map((h) => [`${h.x},${h.y}`, h]));
    const seenSpriteCoords = new Set<string>();

    for (const row of grid) {
      for (const tile of row) {
        if (tile.type === 'empty') continue;

        if (tile.type === 'resourceNode') {
          this.setTileSprite(tile.x, tile.y, 'terrain_rock_cluster', 0);
          seenSpriteCoords.add(`${tile.x},${tile.y}`);
          continue;
        }
        if (tile.type === 'forestNode') {
          this.setTileSprite(tile.x, tile.y, 'terrain_tree_cluster', 0);
          seenSpriteCoords.add(`${tile.x},${tile.y}`);
          continue;
        }
        if (tile.type === 'road') {
          const roadSprite = this.getRoadSprite(tile.x, tile.y, grid);
          const sprite = this.setTileSprite(tile.x, tile.y, roadSprite.texture, roadSprite.angle);
          // Congestion feedback was the one thing players could already read
          // off the old flat tiles -- keep it by tinting the road art toward
          // red as load approaches capacity, instead of losing the signal.
          const ratio = (tile.load ?? 0) / (tile.roadCapacity ?? 1);
          sprite.setTint(interpolateColor(0xffffff, ROAD_COLOR_CONGESTED, ratio));
          seenSpriteCoords.add(`${tile.x},${tile.y}`);
          continue;
        }

        if (tile.type === 'house') {
          const house = houseByCoord.get(`${tile.x},${tile.y}`);
          const happiness = house?.happiness ?? 0;
          this.tilesGraphics.fillStyle(
            interpolateColor(HOUSE_COLOR_UNHAPPY, HOUSE_COLOR_HAPPY, happiness / 100),
            1,
          );
        } else {
          this.tilesGraphics.fillStyle(TILE_COLORS[tile.type], 1);
        }
        this.drawTileDiamond(this.tilesGraphics, tile.x, tile.y);

        // Coverage-radius mechanic is otherwise invisible -- mark covered
        // houses with a small dot so the player can see the effect land.
        if (tile.type === 'house' && this.isServiceCovered(tile.x, tile.y, services)) {
          const center = gridToScreen(tile.x + 0.5, tile.y + 0.5);
          this.tilesGraphics.fillStyle(SERVICE_COVERAGE_MARKER_COLOR, 0.9);
          this.tilesGraphics.fillCircle(center.x, center.y, TILE_HEIGHT / 6);
        }
      }
    }

    // Drop sprites for tiles that no longer have art-backed content
    // (removed, or changed to a type without art).
    for (const [key, sprite] of this.tileSprites) {
      if (!seenSpriteCoords.has(key)) {
        sprite.destroy();
        this.tileSprites.delete(key);
      }
    }
  }

  private setTileSprite(
    gx: number,
    gy: number,
    texture: string,
    angle: number,
  ): Phaser.GameObjects.Image {
    const key = `${gx},${gy}`;
    let sprite = this.tileSprites.get(key);
    if (!sprite) {
      sprite = this.add.image(0, 0, texture);
      sprite.setDisplaySize(TILE_SPRITE_SIZE, TILE_SPRITE_SIZE);
      this.uiCamera.ignore(sprite);
      this.tileSprites.set(key, sprite);
    } else if (sprite.texture.key !== texture) {
      sprite.setTexture(texture);
    }
    const center = gridToScreen(gx + 0.5, gy + 0.5);
    sprite.setPosition(center.x, center.y);
    sprite.setAngle(angle);
    sprite.clearTint();
    return sprite;
  }

  /** Picks the road piece + rotation matching this tile's live neighbor
   * connections. The full kit (endcap/straight/corner/T/4-way) covers every
   * connection count 0-4, so this always returns art -- no flat-color
   * fallback needed anymore. Rotation angles are a best-effort reverse
   * engineering of the source art's orientation; if a piece looks rotated
   * wrong once it's on screen, it's a one-line fix to the *_ROTATIONS
   * tables above. */
  private getRoadSprite(
    gx: number,
    gy: number,
    grid: WorldState['grid'],
  ): { texture: string; angle: number } {
    const isRoad = (x: number, y: number): boolean => grid[y]?.[x]?.type === 'road';
    const connections: Direction[] = [];
    if (isRoad(gx, gy - 1)) connections.push('N');
    if (isRoad(gx, gy + 1)) connections.push('S');
    if (isRoad(gx + 1, gy)) connections.push('E');
    if (isRoad(gx - 1, gy)) connections.push('W');

    if (connections.length === 0) {
      return { texture: 'road_straight', angle: STRAIGHT_ROTATIONS['E,W']! };
    }
    if (connections.length === 1) {
      return { texture: 'road_endcap', angle: ENDCAP_ROTATIONS[connections[0]!]! };
    }
    const key = [...connections].sort().join(',');
    if (connections.length === 2) {
      if (key in STRAIGHT_ROTATIONS) {
        return { texture: 'road_straight', angle: STRAIGHT_ROTATIONS[key]! };
      }
      return { texture: 'road_corner', angle: CORNER_ROTATIONS[key]! };
    }
    if (connections.length === 3) {
      return { texture: 'road_tjunction', angle: TJUNCTION_ROTATIONS[key]! };
    }
    return { texture: 'road_4way', angle: 0 };
  }

  private isServiceCovered(
    x: number,
    y: number,
    services: WorldState['services'],
  ): boolean {
    return services.some((s) => (s.x - x) ** 2 + (s.y - y) ** 2 <= SERVICE_COVERAGE_RADIUS_SQ);
  }

  private drawShipments(): void {
    this.shipmentsGraphics.clear();
    const { shipments } = this.simLoop.getState();
    const alpha = this.simLoop.getInterpolationAlpha();

    for (const shipment of shipments) {
      const from = shipment.path[shipment.pathIndex];
      if (!from) continue;
      const to = shipment.path[shipment.pathIndex + 1] ?? from;

      const gx = Phaser.Math.Linear(from.x, to.x, alpha) + 0.5;
      const gy = Phaser.Math.Linear(from.y, to.y, alpha) + 0.5;
      const screen = gridToScreen(gx, gy);

      const color = shipment.cargo ? SHIPMENT_COLORS[shipment.cargo] : COMMUTER_COLOR;
      this.shipmentsGraphics.fillStyle(color, 1);
      this.shipmentsGraphics.fillCircle(screen.x, screen.y, TILE_HEIGHT / 5);
    }
  }

  private drawLabels(): void {
    const { resourceNodes, factories, houses } = this.simLoop.getState();
    const seenIds = new Set<string>();

    for (const node of resourceNodes) {
      seenIds.add(node.id);
      const text = `${node.resourceType}:${node.buffer}`;
      this.setLabel(node.id, text, node.x, node.y);
    }
    for (const factory of factories) {
      seenIds.add(factory.id);
      const text = `${factory.recipeId} in:${factory.inputBuffer} out:${factory.outputBuffer}`;
      this.setLabel(factory.id, text, factory.x, factory.y);
    }
    for (const house of houses) {
      seenIds.add(house.id);
      const text = `wants ${house.demand} ♥${house.happiness} have:${house.demandBuffer}`;
      this.setLabel(house.id, text, house.x, house.y);
    }

    for (const [id, label] of this.labels) {
      if (!seenIds.has(id)) {
        label.destroy();
        this.labels.delete(id);
      }
    }
  }

  private setLabel(id: string, text: string, tileX: number, tileY: number): void {
    let label = this.labels.get(id);
    if (!label) {
      label = this.add.text(0, 0, '', {
        fontSize: '12px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 2, y: 1 },
      });
      label.setOrigin(0.5, 1);
      this.labels.set(id, label);
      this.uiCamera.ignore(label);
    }
    label.setText(text);
    const screen = gridToScreen(tileX + 0.5, tileY + 0.5);
    label.setPosition(screen.x, screen.y - TILE_HEIGHT / 2 - 4);
  }

  private centerCamera(): void {
    const center = gridToScreen(GRID_COLS / 2, GRID_ROWS / 2);
    this.cameras.main.centerOn(center.x, center.y);
  }

  private setupPan(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDragging = false;
      this.pointerDownPos.set(pointer.x, pointer.y);
      this.dragStart.set(pointer.x, pointer.y);
      this.cameraStart.set(this.cameras.main.scrollX, this.cameras.main.scrollY);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
      if (!this.isDragging) {
        const moved = Phaser.Math.Distance.Between(
          this.pointerDownPos.x,
          this.pointerDownPos.y,
          pointer.x,
          pointer.y,
        );
        if (moved < CLICK_DRAG_THRESHOLD) return;
        this.isDragging = true;
      }
      const zoom = this.cameras.main.zoom;
      const dx = (pointer.x - this.dragStart.x) / zoom;
      const dy = (pointer.y - this.dragStart.y) / zoom;
      this.cameras.main.scrollX = this.cameraStart.x - dx;
      this.cameras.main.scrollY = this.cameraStart.y - dy;
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging) {
        this.handleTileClick(pointer);
      }
      this.isDragging = false;
    });

    this.input.on('pointerupoutside', () => {
      this.isDragging = false;
    });
  }

  private handleTileClick(pointer: Phaser.Input.Pointer): void {
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const { gx, gy } = screenToGrid(worldPoint.x, worldPoint.y);
    const tileX = Math.floor(gx);
    const tileY = Math.floor(gy);
    if (tileX < 0 || tileX >= GRID_COLS || tileY < 0 || tileY >= GRID_ROWS) return;

    const existing = this.simLoop.getState().grid[tileY]?.[tileX];
    if (existing?.type === this.currentTool) {
      // Clicking a tile that already has the selected tool's type removes it.
      this.simLoop.enqueue({ type: 'REMOVE_TILE', x: tileX, y: tileY });
    } else if (this.currentTool === 'factory') {
      this.simLoop.enqueue({
        type: 'PLACE_TILE',
        x: tileX,
        y: tileY,
        tileType: 'factory',
        recipeId: this.selectedRecipeId,
      });
    } else if (this.currentTool === 'house') {
      this.simLoop.enqueue({
        type: 'PLACE_TILE',
        x: tileX,
        y: tileY,
        tileType: 'house',
        demand: this.selectedDemand,
      });
    } else {
      this.simLoop.enqueue({ type: 'PLACE_TILE', x: tileX, y: tileY, tileType: this.currentTool });
    }
  }

  private setupZoom(): void {
    this.input.on(
      'wheel',
      (
        pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number,
      ) => {
        const camera = this.cameras.main;
        const zoomFactor = deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Phaser.Math.Clamp(camera.zoom * zoomFactor, MIN_ZOOM, MAX_ZOOM);
        if (newZoom === camera.zoom) return;

        // Anchor the zoom on the cursor: capture the world point under the
        // pointer before zooming, then shift scroll so that same world
        // point stays under the pointer after zooming.
        const worldPointBefore = camera.getWorldPoint(pointer.x, pointer.y);
        camera.setZoom(newZoom);
        const worldPointAfter = camera.getWorldPoint(pointer.x, pointer.y);
        camera.scrollX += worldPointBefore.x - worldPointAfter.x;
        camera.scrollY += worldPointBefore.y - worldPointAfter.y;
      },
    );
  }

  /** Keyboard shortcuts 1-5 remain as a fast path; the build HUD buttons do the same thing. */
  private setupToolSelection(): void {
    this.input.mouse?.disableContextMenu();
    this.input.keyboard?.on('keydown-ONE', () => this.setTool('road'));
    this.input.keyboard?.on('keydown-TWO', () => this.setTool('resourceNode'));
    this.input.keyboard?.on('keydown-THREE', () => this.setTool('factory'));
    this.input.keyboard?.on('keydown-FOUR', () => this.setTool('house'));
    this.input.keyboard?.on('keydown-FIVE', () => this.setTool('forestNode'));
    this.input.keyboard?.on('keydown-SIX', () => this.setTool('service'));
  }

  private setTool(tool: Tool): void {
    this.currentTool = tool;
    this.buildHud.setActiveTool(tool);
  }
}
