import Phaser from 'phaser';

const TILE_SIZE = 64;
const GRID_COLS = 40;
const GRID_ROWS = 40;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;

/**
 * Phase 0 stub scene: draws an empty tile grid and lets the player
 * pan (drag) and zoom (scroll wheel). No sim state yet.
 */
export class GridScene extends Phaser.Scene {
  private isDragging = false;
  private dragStart = new Phaser.Math.Vector2();
  private cameraStart = new Phaser.Math.Vector2();

  constructor() {
    super('GridScene');
  }

  create(): void {
    this.drawGrid();
    this.centerCamera();
    this.setupPan();
    this.setupZoom();
  }

  private drawGrid(): void {
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

  private centerCamera(): void {
    const width = GRID_COLS * TILE_SIZE;
    const height = GRID_ROWS * TILE_SIZE;
    this.cameras.main.centerOn(width / 2, height / 2);
  }

  private setupPan(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.dragStart.set(pointer.x, pointer.y);
      this.cameraStart.set(this.cameras.main.scrollX, this.cameras.main.scrollY);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      const zoom = this.cameras.main.zoom;
      const dx = (pointer.x - this.dragStart.x) / zoom;
      const dy = (pointer.y - this.dragStart.y) / zoom;
      this.cameras.main.scrollX = this.cameraStart.x - dx;
      this.cameras.main.scrollY = this.cameraStart.y - dy;
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });

    this.input.on('pointerupoutside', () => {
      this.isDragging = false;
    });
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
}
