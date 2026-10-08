import Phaser from 'phaser';
import { H, W } from '../config';
import { loadSalvage, writeSalvage } from './storage';

// Art style switch. "Vintage" = a 1930s rubber-hose cartoon look made from the same code-drawn art:
// grey-and-sepia film, boiling outlines, stepped animation, pie-cut eyes, gloved hands, scratches and flicker.

export const isVintage = (): boolean => loadSalvage().vintage;

export function setVintage(on: boolean): void {
  loadSalvage().vintage = on;
  writeSalvage();
}

/** Swap a texture key for its vintage twin when that style is on. */
export const vk = (key: string): string => (isVintage() ? `${key}_v` : key);

/** Animation that moves in jerky steps, like a cartoon shot on twos. */
export const stepEase = (t: number): number => Math.round(t * 5) / 5;
export const bobEase = (): string | ((t: number) => number) => (isVintage() ? stepEase : 'Sine.easeInOut');

/** Call once per scene (after its background is added). */
export function applyStyle(scene: Phaser.Scene): void {
  if (!isVintage()) return;
  const cam = scene.cameras.main;
  if (cam.postFX) {
    const m = cam.postFX.addColorMatrix();
    m.grayscale(1);
    m.contrast(0.35, true);
    m.sepia(true);
  }
  // film damage on top
  const g = scene.add.graphics().setDepth(980);
  const flick = scene.add.rectangle(0, 0, W, H, 0x000000, 0).setOrigin(0).setDepth(979);
  let n = 0;
  scene.time.addEvent({
    delay: 83, // 12 frames a second
    loop: true,
    callback: () => {
      n++;
      flick.setAlpha(Phaser.Math.FloatBetween(0, 0.12));
      g.clear();
      // vertical scratches
      for (let i = 0; i < 2; i++) {
        if (Math.random() < 0.45) {
          const x = Phaser.Math.Between(0, W);
          g.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.15, 0.4)).fillRect(x, 0, 1, H);
        }
      }
      // dust and hairs
      for (let i = 0; i < 6; i++) g.fillStyle(0x000000, 0.5).fillRect(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), Phaser.Math.Between(1, 2), Phaser.Math.Between(1, 2));
      if (n % 9 === 0) g.fillStyle(0x000000, 0.35).fillRect(Phaser.Math.Between(0, W - 12), Phaser.Math.Between(0, H), Phaser.Math.Between(6, 12), 1);
    },
  });
}
