import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { C } from '../config';
import { Label } from './label';

export interface ButtonOpts {
  fill?: number;
  textColor?: number;
  scale?: number;
  sub?: string; // small second line
}

/** Chunky pixel button built from plain rectangles (no art files needed). */
export class Button extends Phaser.GameObjects.Container {
  private face: Phaser.GameObjects.Rectangle;
  private hi: Phaser.GameObjects.Rectangle;
  private label: Label;
  private subLabel?: Label;
  private enabled = true;
  private fill: number;
  private pressed = false;
  private glow?: Phaser.Tweens.Tween;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly w: number,
    readonly h: number,
    text: string,
    onClick: () => void,
    opts: ButtonOpts = {},
  ) {
    super(scene, x, y);
    this.fill = opts.fill ?? 0x7a2a45;
    const edge = scene.add.rectangle(0, 0, w, h, C.ink).setOrigin(0);
    const shade = scene.add.rectangle(1, 2, w - 2, h - 2, 0x000000, 0.35).setOrigin(0);
    this.face = scene.add.rectangle(1, 1, w - 2, h - 3, this.fill).setOrigin(0);
    this.hi = scene.add.rectangle(2, 2, w - 4, 1, 0xffffff, 0.35).setOrigin(0);
    const scale = opts.scale ?? 1;
    const textH = 7 * scale;
    const subH = opts.sub ? 7 : 0;
    const gap = opts.sub ? 3 : 0;
    const top = Math.round((h - 2 - (textH + gap + subH)) / 2);
    this.label = new Label(scene, w / 2, top, text, { align: 'center', scale, color: opts.textColor ?? C.text });
    this.add([edge, shade, this.face, this.hi, this.label]);
    if (opts.sub) {
      this.subLabel = new Label(scene, w / 2, top + textH + gap, opts.sub, { align: 'center', color: C.textDim, shadow: false });
      this.add(this.subLabel);
    }
    this.setSize(w, h);
    // Container hit areas are measured from the centred origin, hence the half-size offset.
    this.setInteractive(new Phaser.Geom.Rectangle(w / 2, h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    this.input!.cursor = 'pointer';
    this.on('pointerover', () => this.enabled && this.paint(0.12));
    this.on('pointerout', () => {
      this.pressed = false;
      this.paint(0);
    });
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      this.pressed = true;
      this.paint(-0.12);
      this.face.y = 2;
      this.label.y += 1;
    });
    this.on('pointerup', () => {
      if (!this.enabled || !this.pressed) return;
      this.pressed = false;
      this.paint(0.12);
      this.face.y = 1;
      this.label.y -= 1;
      sfx.unlock();
      sfx.click();
      onClick();
    });
    scene.add.existing(this);
  }

  private paint(delta: number): void {
    const base = this.enabled ? this.fill : 0x3a2430;
    const c = Phaser.Display.Color.ValueToColor(base);
    if (delta > 0) c.lighten(delta * 100);
    else if (delta < 0) c.darken(-delta * 100);
    this.face.setFillStyle(c.color);
    this.hi.setAlpha(this.enabled ? 0.35 : 0.1);
  }

  setEnabled(on: boolean): this {
    this.enabled = on;
    this.label.setColor(on ? C.text : 0x7a6270);
    this.paint(0);
    if (this.input) this.input.cursor = on ? 'pointer' : 'default';
    if (!on) this.setGlow(false);
    return this;
  }

  setLabel(text: string, sub?: string): this {
    this.label.setText(text);
    if (sub !== undefined) this.subLabel?.setText(sub);
    return this;
  }

  setGlow(on: boolean): this {
    if (on && !this.glow) {
      this.glow = this.scene.tweens.add({ targets: this, scale: { from: 1, to: 1.04 }, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.setScale(1);
    } else if (!on && this.glow) {
      this.glow.stop();
      this.glow = undefined;
      this.setScale(1);
    }
    return this;
  }
}
