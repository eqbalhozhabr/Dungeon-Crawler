import Phaser from 'phaser';
import { FONT_KEY } from '../art/font';
import { C } from '../config';

export interface LabelOpts {
  color?: number;
  scale?: number;
  align?: 'left' | 'center' | 'right';
  shadow?: number | false; // shadow colour, false = none
  depth?: number;
}

/** Pixel text: bitmap text from our own font, optional 1px drop shadow, always uppercase. */
export class Label extends Phaser.GameObjects.Container {
  private main: Phaser.GameObjects.BitmapText;
  private shade?: Phaser.GameObjects.BitmapText;
  private _opts: Required<Pick<LabelOpts, 'align' | 'scale'>>;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, opts: LabelOpts = {}) {
    super(scene, x, y);
    const scale = opts.scale ?? 1;
    const align = opts.align ?? 'left';
    this._opts = { align, scale };
    const origin = align === 'left' ? 0 : align === 'center' ? 0.5 : 1;
    const shadow = opts.shadow === undefined ? C.ink : opts.shadow;
    if (shadow !== false) {
      this.shade = scene.add.bitmapText(scale, scale, FONT_KEY, text.toUpperCase()).setOrigin(origin, 0).setScale(scale).setTint(shadow);
      this.add(this.shade);
    }
    this.main = scene.add.bitmapText(0, 0, FONT_KEY, text.toUpperCase()).setOrigin(origin, 0).setScale(scale).setTint(opts.color ?? C.text);
    this.add(this.main);
    if (opts.depth !== undefined) this.setDepth(opts.depth);
    scene.add.existing(this);
  }

  setText(text: string): this {
    const t = text.toUpperCase();
    this.main.setText(t);
    this.shade?.setText(t);
    return this;
  }

  setColor(color: number): this {
    this.main.setTint(color);
    return this;
  }

  get textWidth(): number {
    return this.main.width * this._opts.scale;
  }
}
