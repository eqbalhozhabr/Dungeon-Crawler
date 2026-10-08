import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { C, GAME_TITLE, H, W } from '../config';
import { BASE_DECK } from '../logic/levels';
import { loadSave, writeSave } from '../storage';
import { Button } from '../ui/button';
import { Label } from '../ui/label';

export const HELP_LINES = [
  '1. PICK A TOOL. TOOLS COST ENERGY.',
  '2. TAP A GEM OR BUG TO USE IT.',
  '3. SQUEEZE MOVES THE BELT ON.',
  '   BUGS REACHING THE ACID INFECT YOU.',
  '4. YOU CAN ONLY TOUCH THE NEAREST 5',
  '   COLUMNS. FAR ITEMS MUST COME CLOSER.',
  '5. SCORE THE QUOTA, THEN ESCAPE',
  '   BEFORE THE FROG DIGESTS YOU!',
  'KEY V SWITCHES BETWEEN FIRST-PERSON AND FLAT.',
];

export function showHelp(scene: Phaser.Scene, onClose: () => void): Phaser.GameObjects.Container {
  const box = scene.add.container(0, 0).setDepth(200);
  const dim = scene.add.rectangle(0, 0, W, H, 0x000000, 0.78).setOrigin(0).setInteractive();
  const pw = 450, ph = 214;
  const px = (W - pw) / 2, py = (H - ph) / 2;
  const panel = scene.add.rectangle(px, py, pw, ph, C.panel).setOrigin(0).setStrokeStyle(2, C.panelEdge);
  const title = new Label(scene, W / 2, py + 10, 'HOW TO PLAY', { scale: 2, align: 'center', color: C.accent });
  box.add([dim, panel, title]);
  HELP_LINES.forEach((line, i) => box.add(new Label(scene, px + 14, py + 36 + i * 15, line, { color: C.text })));
  const close = new Button(scene, W / 2 - 40, py + ph - 30, 80, 22, 'GOT IT', () => {
    box.destroy();
    onClose();
  }, { fill: 0x2e7a3a });
  box.add(close);
  return box;
}

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    this.add.image(0, 0, 'bg').setOrigin(0);
    this.add.image(0, 0, 'wall_top').setOrigin(0).setPosition(0, -4);
    this.add.image(0, H - 14, 'wall_bot').setOrigin(0);

    const title = new Label(this, W / 2, 34, GAME_TITLE, { scale: 4, align: 'center', color: C.accent });
    this.tweens.add({ targets: title, y: 38, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    new Label(this, W / 2, 76, 'A TINY MINER. A VERY HUNGRY FROG.', { scale: 1, align: 'center', color: C.text });

    // cast
    const hero = this.add.image(150, 168, 'hero_idle').setScale(4);
    this.tweens.add({ targets: hero, y: 164, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const gems = [0, 1, 2, 3].map((c, i) => this.add.image(236 + i * 34, 160, `gem_${c}`).setScale(1.5));
    gems.forEach((g, i) => this.tweens.add({ targets: g, y: 154, duration: 500 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 120 }));
    const bug = this.add.image(380, 170, 'bug_0_0').setScale(2).setFlipX(true);
    this.time.addEvent({ delay: 380, loop: true, callback: () => bug.setTexture(bug.texture.key.endsWith('_0') ? 'bug_0_1' : 'bug_0_0') });

    new Button(this, W / 2 - 60, 184, 120, 26, 'PLAY', () => this.start(), { scale: 2, fill: 0x2e7a3a });
    new Button(this, W / 2 - 100, 216, 90, 20, 'HOW TO PLAY', () => showHelp(this, () => undefined), { fill: 0x5a3a7a });
    const snd = new Button(this, W / 2 + 10, 216, 90, 20, sfx.muted ? 'SOUND: OFF' : 'SOUND: ON', () => {
      sfx.setMuted(!sfx.muted);
      snd.setLabel(sfx.muted ? 'SOUND: OFF' : 'SOUND: ON');
    }, { fill: 0x5a3a7a });
    const extras = loadSave().extras;
    new Label(this, W / 2, 240, `DECK: ${BASE_DECK.length + extras.length} CARDS${extras.length ? ` (+${extras.length} REWARDS)` : ''}`, { align: 'center', color: C.textDim, shadow: false });
    if (extras.length) {
      new Button(this, W - 100, 238, 92, 16, 'RESET DECK', () => {
        loadSave().extras = [];
        writeSave();
        this.scene.restart();
      }, { fill: 0x7a2a45 });
    }
    new Label(this, W / 2, 249, 'PROTOTYPE V0.2', { align: 'center', color: C.textDim, shadow: false });

    this.input.keyboard?.on('keydown-ENTER', () => this.start());
    this.input.keyboard?.on('keydown-SPACE', () => this.start());
  }

  private start(): void {
    sfx.unlock();
    sfx.startDrone();
    const q = new URLSearchParams(window.location.search).get('seed');
    const seed = q ? Number(q) || 1 : Math.floor(Math.random() * 1e9);
    this.scene.start('Game', { seed });
  }
}
