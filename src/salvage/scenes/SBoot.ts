import Phaser from 'phaser';
import { registerFont } from '../../art/font';
import { generateFpTextures } from '../../art/fp';
import { sfx } from '../../audio/sfx';
import { generateIcons } from '../art/icons';
import { generateSalvageArt } from '../art/sprites';
import { Px } from '../../art/pixel';

export class SBootScene extends Phaser.Scene {
  constructor() {
    super('SBoot');
  }

  create(): void {
    registerFont(this);
    generateFpTextures(this);
    generateIcons(this);
    generateSalvageArt(this);
    const one = new Px(1, 1);
    one.set(0, 0, 0xffffff);
    if (!this.textures.exists('px')) this.textures.addCanvas('px', one.toCanvas());
    document.addEventListener('touchend', () => sfx.unlock(), { passive: true });
    this.scene.start('STitle');
  }
}
