import Phaser from 'phaser';
import { H, W } from './config';
import { DEBUG } from './target';
import { BootScene } from './scenes/Boot';
import { GameScene } from './scenes/Game';
import { TitleScene } from './scenes/Title';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#1a0a14',
  banner: false,
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { activePointers: 2 },
  scene: [BootScene, TitleScene, GameScene],
});

// Browser behaviour that must not leak into the game (CrazyGames common fixes).
window.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
});
window.addEventListener('contextmenu', (e) => e.preventDefault());

if (DEBUG) (window as unknown as { __phaser: Phaser.Game }).__phaser = game;

export { game };
