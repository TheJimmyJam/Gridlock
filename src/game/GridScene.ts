import Phaser from 'phaser';
import { GRID_COLS, GRID_ROWS } from '../sim/constants';
import type { ResourceType, TileType } from '../sim/types';
import { gridToScreen, screenToGrid, TILE_HEIGHT, TILE_WIDTH } from './iso';
import { SimLoop } from './SimLoop';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 1.5;
const CLICK_DRAG_THRESHOLD = 4; // px of pointer movement before a click counts as a pan

const TILE_COLORS: Record<Exclude<TileType, 'empty' | 'house'>, number> = {
  road: 0x777777,
  resourceNode: 0x4caf50,
  factory: 0xff9800,
};

const SHIPMENT_COLORS: Record<ResourceType, number> = {
  ore: 0xffca28,
  plank: 0xa1887f,
  widget: 0x9c27b0,
  food: 0xef5350,
};

const COMMUTER_COLOR = 0x42a5f5;
const HOUSE_COLOR_UNHAPPY = 0xe53935;
const HOUSE_COLOR_HAPPY = 0x66bb6a;

type Tool = TileType;

/**
 * Phase 2 scene, isometric projection: draws the grid, placed tiles,
 * in-transit shipments, and buffer labels from WorldState. Player input
 * enqueues actions on the SimLoop; it never mutates sim state directly.
 * All grid/tile math happens in plain orthogonal (col, row) space — this
 * file (via iso.ts) is the only place that translates to/from iso screen
 * coordinates. Placeholder shapes are flat diamonds, not real sprites.
 */
export class GridScene extends Phaser.Scene {
  private simLoop = new SimLoop();
  private tilesGraphics!: Phaser.GameObjects.Graphics;
  private shipmentsGraphics!: Phaser.GameObjects.Graphics;
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private currentTool: Tool = 'road';

  private isDragging = false;
  private pointerDownPos = new Phaser.Math.Vector2();
  private dragStart = new Phaser.Math.Vector2();
  private cameraStart = new Phaser.Math.Vector2();

  constructor() {
    super('GridScene');
  }

  create(): void {
    this.drawGridLines();
    this.tilesGraphics = this.add.graphics();
    this.shipmentsGraphics = this.add.graphics();
    this.centerCamera();
    this.setupPan();
    this.setupZoom();
    this.setupToolSelection();
    this.simLoop.start();
    this.events.on('destroy', () => this.simLoop.stop());
  }

  update(): void {
    this.drawTiles();
    this.drawShipments();
    this.drawLabels();
  }

  private drawGridLines(): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x333333, 1);

    for (let col = 0; col <= GRID_COLS; col++) {
      const a = gridToScreen(col, 0);
      const b = gridToScreen(col, GRID_ROWS);
      graphics.lineBetween(a.x, a.y, b.x, b.y);
    }
    for (let row = 0; row <= GRID_ROWS; row++) {
      const a = gridToScreen(0, row);
      const b = gridToScreen(GRID_COLS, row);
      graphics.lineBetween(a.x, a.y, b.x, b.y);
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
    const { grid, houses } = this.simLoop.getState();
    const houseByCoord = new Map(houses.map((h) => [`${h.x},${h.y}`, h]));

    for (const row of grid) {
      for (const tile of row) {
        if (tile.type === 'empty') continue;

        if (tile.type === 'house') {
          const house = houseByCoord.get(`${tile.x},${tile.y}`);
          const happiness = house?.happiness ?? 0;
          const color = Phaser.Display.Color.Interpolate.ColorWithColor(
            Phaser.Display.Color.ValueToColor(HOUSE_COLOR_UNHAPPY),
            Phaser.Display.Color.ValueToColor(HOUSE_COLOR_HAPPY),
            100,
            happiness,
          );
          this.tilesGraphics.fillStyle(
            Phaser.Display.Color.GetColor(color.r, color.g, color.b),
            1,
          );
        } else {
          this.tilesGraphics.fillStyle(TILE_COLORS[tile.type], 1);
        }
        this.drawTileDiamond(this.tilesGraphics, tile.x, tile.y);
      }
    }
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
      const text = `ore:${node.buffer}`;
      this.setLabel(node.id, text, node.x, node.y);
    }
    for (const factory of factories) {
      seenIds.add(factory.id);
      const text = `in:${factory.inputBuffer} out:${factory.outputBuffer}`;
      this.setLabel(factory.id, text, factory.x, factory.y);
    }
    for (const house of houses) {
      seenIds.add(house.id);
      const text = `♥${house.happiness} demand:${house.demandBuffer}`;
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
    } else {
      this.simLoop.enqueue({ type: 'PLACE_TILE', x: tileX, y: tileY, tileType: this.currentTool });
    }
  }

  private setupZoom(): void {
    this.input.on(
      'wheel',
      (
        _pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number,
      ) => {
        const camera = this.cameras.main;
        const zoomFactor = deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Phaser.Math.Clamp(camera.zoom * zoomFactor, MIN_ZOOM, MAX_ZOOM);
        camera.setZoom(newZoom);
      },
    );
  }

  private setupToolSelection(): void {
    this.input.mouse?.disableContextMenu();
    this.input.keyboard?.on('keydown-ONE', () => (this.currentTool = 'road'));
    this.input.keyboard?.on('keydown-TWO', () => (this.currentTool = 'resourceNode'));
    this.input.keyboard?.on('keydown-THREE', () => (this.currentTool = 'factory'));
    this.input.keyboard?.on('keydown-FOUR', () => (this.currentTool = 'house'));
  }
}
