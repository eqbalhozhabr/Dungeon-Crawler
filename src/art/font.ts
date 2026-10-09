import Phaser from 'phaser';
import { GLYPHS } from './glyphs';
import { Px } from './pixel';

// Our own 5x7 pixel font, drawn from data (glyph table: glyphs.ts).
export const FONT_CHARS = ' ' + Object.keys(GLYPHS).filter((k) => k !== ' ').join('');
const CELL_W = 6;
const CELL_H = 8;
const PER_ROW = 16;

export const FONT_KEY = 'pfont';

export function registerFont(scene: Phaser.Scene): void {
  const rows = Math.ceil(FONT_CHARS.length / PER_ROW);
  const px = new Px(CELL_W * PER_ROW, CELL_H * rows);
  [...FONT_CHARS].forEach((ch, i) => {
    const g = GLYPHS[ch].split('/');
    const ox = (i % PER_ROW) * CELL_W;
    const oy = Math.floor(i / PER_ROW) * CELL_H;
    g.forEach((row, y) => {
      for (let x = 0; x < 5; x++) if (row[x] === '#') px.set(ox + x, oy + y, 0xffffff);
    });
  });
  scene.textures.addCanvas(FONT_KEY + '_img', px.toCanvas());
  const data = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: FONT_KEY + '_img',
    width: CELL_W,
    height: CELL_H,
    chars: FONT_CHARS,
    charsPerRow: PER_ROW,
    'offset.x': 0,
    'offset.y': 0,
    'spacing.x': 0,
    'spacing.y': 0,
    lineSpacing: 0,
  });
  scene.cache.bitmapFont.add(FONT_KEY, data);
}
