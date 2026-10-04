import { Container, Sprite, Texture } from 'pixi.js';

export type PixelGrid = readonly string[];
export type PixelPalette = Readonly<Record<string, number | string>>;

export function createPixelTexture(grid: PixelGrid, palette: PixelPalette): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, ...grid.map((row) => row.length));
  canvas.height = Math.max(1, grid.length);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Pixel texture generation requires Canvas 2D.');
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) {
      const key = row[x];
      const color = key === undefined ? undefined : palette[key];
      if (color === undefined) continue;
      context.fillStyle =
        typeof color === 'number' ? `#${color.toString(16).padStart(6, '0')}` : color;
      context.fillRect(x, y, 1, 1);
    }
  }
  const texture = Texture.from(canvas);
  texture.source.scaleMode = 'nearest';
  return texture;
}

export function createPixelFrames(
  frames: readonly PixelGrid[],
  palette: PixelPalette,
): readonly Texture[] {
  return frames.map((grid) => createPixelTexture(grid, palette));
}

export class PixelText extends Container {
  private readonly glyphs: Sprite[];
  private currentText = '';
  private currentColor = 0xffffff;

  constructor(
    private readonly font: Readonly<Record<string, Texture>>,
    private readonly glyphWidth: number,
    private readonly capacity = 32,
  ) {
    super();
    this.glyphs = Array.from({ length: capacity }, (_, index) => {
      const glyph = new Sprite(Texture.EMPTY);
      glyph.x = index * (glyphWidth + 1);
      glyph.visible = false;
      this.addChild(glyph);
      return glyph;
    });
    this.eventMode = 'none';
  }

  setText(text: string, color = 0xffffff): void {
    const normalized = text.toUpperCase().slice(0, this.capacity);
    if (normalized === this.currentText && color === this.currentColor) return;
    this.currentText = normalized;
    this.currentColor = color;
    for (let index = 0; index < this.glyphs.length; index++) {
      const glyph = this.glyphs[index];
      if (!glyph) continue;
      const character = normalized[index];
      const texture = character === undefined ? undefined : this.font[character];
      glyph.visible = texture !== undefined;
      if (texture) glyph.texture = texture;
      glyph.tint = color;
    }
  }

  get textWidth(): number {
    return this.currentText.length === 0 ? 0 : this.currentText.length * (this.glyphWidth + 1) - 1;
  }
}
