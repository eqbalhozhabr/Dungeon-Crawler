import Phaser from 'phaser';
import { sfx } from '../../audio/sfx';
import { C, H, W } from '../../config';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { showDeck } from '../ui';
import { session } from '../session';

/** Belly background with the two "boil" frames, vignette and grain on top. Returns a stop() for cleanup. */
export function addBelly(scene: Phaser.Scene, pal: 'pink' | 'rust' = 'pink', dimAlpha = 0): void {
  const bg = scene.add.image(0, 0, `sv_bg_${pal}_0`).setOrigin(0).setDepth(0);
  let f = 0;
  scene.time.addEvent({
    delay: 420,
    loop: true,
    callback: () => {
      f = 1 - f;
      bg.setTexture(`sv_bg_${pal}_${f}`);
    },
  });
  scene.add.image(0, 0, 'fx_vignette').setOrigin(0).setDepth(600).setAlpha(0.85);
  const grain = scene.add.image(0, 0, 'fx_grain_0').setOrigin(0).setDepth(601).setAlpha(0.5);
  let g = 0;
  scene.time.addEvent({
    delay: 110,
    loop: true,
    callback: () => {
      g = (g + 1) % 3;
      grain.setTexture(`fx_grain_${g}`);
    },
  });
  if (dimAlpha > 0) scene.add.rectangle(0, 0, W, H, C.ink, dimAlpha).setOrigin(0).setDepth(2);
}

/** HP readout used by the map and the rooms: heart, bar, numbers. */
export class HpBar {
  private fill: Phaser.GameObjects.Rectangle;
  private txt: Label;
  constructor(scene: Phaser.Scene, readonly x: number, readonly y: number, readonly w = 70, depth = 700) {
    scene.add.image(x, y, 'ui_heart').setOrigin(0, 0).setDepth(depth);
    scene.add.rectangle(x + 13, y, w + 2, 10, C.ink).setOrigin(0).setDepth(depth);
    scene.add.rectangle(x + 14, y + 1, w, 8, 0x4a1a28).setOrigin(0).setDepth(depth);
    this.fill = scene.add.rectangle(x + 14, y + 1, w, 8, 0xe8505e).setOrigin(0).setDepth(depth);
    scene.add.rectangle(x + 14, y + 1, w, 2, 0xffffff, 0.25).setOrigin(0).setDepth(depth);
    this.txt = new Label(scene, x + 14 + w / 2, y + 2, '', { align: 'center', depth: depth + 1 });
  }
  set(hp: number, max: number): void {
    this.fill.width = Math.max(0, Math.round((this.w * hp) / max));
    this.txt.setText(`${Math.max(0, hp)}/${max}`);
  }
}

export function muteButton(scene: Phaser.Scene, x = W - 22, y = 4): void {
  const lab = new Label(scene, 0, 0, sfx.muted ? 'SND OFF' : 'SND ON', { align: 'center', color: C.textDim, depth: 800 });
  const b = scene.add.container(x, y, [scene.add.rectangle(0, 0, 40, 12, C.ink, 0.7).setOrigin(0.5, 0), lab]).setDepth(800);
  lab.setPosition(0, 2);
  b.setSize(40, 12);
  b.setInteractive(new Phaser.Geom.Rectangle(20, 6, 40, 12), Phaser.Geom.Rectangle.Contains);
  b.on('pointerup', () => {
    sfx.unlock();
    sfx.setMuted(!sfx.muted);
    lab.setText(sfx.muted ? 'SND OFF' : 'SND ON');
  });
}

export function deckButton(scene: Phaser.Scene, x: number, y: number, onClose?: () => void): Button {
  return new Button(
    scene,
    x,
    y,
    62,
    18,
    `DECK ${session.run?.deck.length ?? 0}`,
    () => {
      if (!session.run) return;
      showDeck(scene, session.run.deck, { title: 'YOUR DECK', sub: 'EVERY OBJECT HAS A FIGHT SIDE AND A TOOL SIDE' }, () => onClose?.());
    },
    { fill: 0x3a2a4a },
  ).setDepth(700) as Button;
}
