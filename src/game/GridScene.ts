import Phaser from 'phaser';
import { GRID_COLS, GRID_ROWS } from '../sim/constants';
import type { TileType } from '../sim/types';
import { SimLoop } from './SimLoop';

const TILE_SIZE = 64;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const CLICK_DRAG_THRESHOLD = 4; // px of pointer movement before a click counts as a pan

const TILE_COLORS: Record<Exclude<TileType, 'empty'>, number> = {
  road: 0x777777,
  resourceNode: 0x4caf50,
  factory: 0xff9800,
};

type Tool = TileType;

/**
 * Phase 1 scene: draws the grid and the placed tiles from WorldState.
 * Player input enqueues actions on the SimLoop; it never mutates sim
 * state directly. Rendering reads whatever the sim's latest tick produced.
 */
export class GridScene extends Phaser.Scene {
  private simLoop = new SimLoop();
  private tilesGraphics!: Phaser.GameObjects.Graphics;
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
    this.centerCamera();
    this.setupPan();
    this.setupZoom();
    this.setupToolSelection();
    this.simLoop.start();
    this.events.on('destroy', () => this.simLoop.stop());
  }

  update(): void {
    this.drawTiles();
  }

  private drawGridLines(): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x333333, 1);

    const width = GRID_COLS * TILE_SIZE;
    const height = GRID_ROWS * TILE_SIZE;

    for (let col = 0; col <= GRID_COLS; col++) {
      const x = col * TILE_SIZE;
      graphics.lineBetween(x, 0, x, height);
    }
    for (let row = 0; row <= GRID_ROWS; row++) {
      const y = row * TILE_SIZE;
      graphics.lineBetween(0, y, width, y);
    }
  }

  private drawTiles(): void {
    this.tilesGraphics.clear();
    const { grid } = this.simLoop.getState();
    for (const row of grid) {
      for (const tile of row) {
        if (tile.type === 'empty') continue;
        this.tilesGraphics.fillStyle(TILE_COLORS[tile.type], 1);
        this.tilesGraphics.fillRect(
          tile.x * TILE_SIZE + 2,
          tile.y * TILE_SIZE + 2,
          TILE_SIZE - 4,
          TILE_SIZE - 4,
        );
      }
    }
  }

  private centerCamera(): void {
    const width = GRID_COLS * TILE_SIZE;
    const height = GRID_ROWS * TILE_SIZE;
    this.cameras.main.centerOn(width / 2, height / 2);
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
    const tileX = Math.floor(worldPoint.x / TILE_SIZE);
    const tileY = Math.floor(worldPoint.y / TILE_SIZE);
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
  }
}
