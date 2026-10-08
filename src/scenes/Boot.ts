import Phaser from 'phaser';
import { registerFont } from '../art/font';
import { generateFpTextures } from '../art/fp';
import { generateTextures } from '../art/sprites';
import { sfx } from '../audio/sfx';

// Everything is generated here: there are no image/audio files to download.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    registerFont(this);
    generateTextures(this);
    generateFpTextures(this);
    // iOS: the AudioContext can be "interrupted" (call, app switch); a touch revives it.
    document.addEventListener('touchend', () => sfx.unlock(), { passive: true });
    this.scene.start('Title');
  }
}
