import Phaser from 'phaser';
import { H, W } from '../config';
import { DEBUG } from '../target';
import { SBootScene } from './scenes/SBoot';
import { SEndScene } from './scenes/SEnd';
import { SExploreScene } from './scenes/SExplore';
import { SFightScene } from './scenes/SFight';
import { SMapScene } from './scenes/SMap';
import { SPoolScene } from './scenes/SPool';
import { STitleScene } from './scenes/STitle';
import { session } from './session';

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
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 2 },
  scene: [SBootScene, STitleScene, SMapScene, SFightScene, SExploreScene, SPoolScene, SEndScene],
});

window.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
});
window.addEventListener('contextmenu', (e) => e.preventDefault());

if (DEBUG) {
  const w = window as unknown as { __phaser: Phaser.Game; __sv: typeof session };
  w.__phaser = game;
  w.__sv = session;
}

export { game };
