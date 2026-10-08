import Phaser from 'phaser';
import { MAP_EXIT, MAP_NODES } from '../art/map';
import { sfx } from '../audio/sfx';
import { BASE_DECK, CREATURES } from '../logic/levels';
import { loadSave } from '../storage';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { H, W } from '../config';

const INK = 0x2a1420;
const NOTES: Record<number, string> = {
  0: 'EASY. PROBABLY.',
  1: 'DO NOT PANIC.',
  2: 'EXCUSE ME??',
  3: 'MY SHOES!',
  4: 'SMELLS OLD.',
};

/** The journey map: five creatures along one long gut. Tap one, then GO. */
export class MapScene extends Phaser.Scene {
  private selected = 0;
  private info!: Phaser.GameObjects.Container;

  constructor() {
    super('Map');
  }

  init(data: { select?: number }): void {
    const save = loadSave();
    this.selected = Math.min(data.select ?? save.progress, save.progress, CREATURES.length - 1);
  }

  create(): void {
    const save = loadSave();
    this.add.image(0, 0, 'map_bg').setOrigin(0);
    new Label(this, 14, 8, 'THE JOURNEY', { scale: 2, color: INK, shadow: false });
    new Label(this, 14, 26, 'FIVE BELLIES. ONE WAY OUT.', { color: 0x6a4a3a, shadow: false });
    new Label(this, 8, 218, 'MOUTH', { color: 0x6a1c2c, shadow: false });
    new Label(this, MAP_EXIT.x, MAP_EXIT.y + 18, 'THE END', { align: 'center', color: 0x6a1c2c, shadow: false });

    CREATURES.forEach((c, i) => {
      const n = MAP_NODES[i];
      const unlocked = i <= save.progress;
      const best = save.best[c.id];
      const done = !!best;
      const ring = this.add.image(n.x, n.y, done ? 'map_node_done' : 'map_node').setDepth(5);
      const face = this.add.image(n.x, n.y, unlocked ? c.portrait : 'portrait_lock').setDepth(6);
      if (!unlocked) face.setAlpha(0.7);
      ring.setInteractive({ useHandCursor: unlocked });
      ring.on('pointerup', () => {
        if (!unlocked) {
          sfx.nope();
          return;
        }
        sfx.unlock();
        sfx.select();
        this.selected = i;
        this.refresh();
      });
      for (let s = 0; s < 3; s++) {
        const on = (best?.stars ?? 0) > s;
        this.add.image(n.x - 12 + s * 12, n.y + 25, on ? 'star_on' : 'star_off').setScale(0.9).setDepth(6);
      }
      if (i === save.progress) {
        const label = new Label(this, n.x, n.y - 38, 'YOU ARE HERE', { align: 'center', color: 0x8a2a2a, shadow: false, depth: 7 });
        const arrow = new Label(this, n.x, n.y - 28, 'V', { align: 'center', color: 0x8a2a2a, shadow: false, depth: 7 });
        this.tweens.add({ targets: [label, arrow], y: '+=3', duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      } else if (unlocked) {
        new Label(this, n.x, n.y - 36, NOTES[i] ?? '', { align: 'center', color: 0x6a4a3a, shadow: false, depth: 7 });
      }
    });

    this.info = this.add.container(0, 0).setDepth(10);
    new Button(this, 370, 236, 96, 26, 'GO!', () => this.start(), { fill: 0x2e7a3a, scale: 2 }).setDepth(11);
    new Button(this, 8, 244, 54, 18, 'MENU', () => this.scene.start('Title'), { fill: 0x5a3a7a }).setDepth(11);

    const deck = BASE_DECK.length + save.extras.length;
    new Label(this, 8, 230, `DECK: ${deck} CARDS`, { color: 0x6a4a3a, shadow: false, depth: 11 });
    this.refresh();
    this.input.keyboard?.on('keydown-ENTER', () => this.start());
    this.input.keyboard?.on('keydown-SPACE', () => this.start());
  }

  private refresh(): void {
    this.info.removeAll(true);
    const c = CREATURES[this.selected];
    const best = loadSave().best[c.id];
    const panel = this.add.rectangle(68, 224, 296, 44, 0x2a1420, 0.92).setOrigin(0).setStrokeStyle(1, 0xf0e4c4);
    this.info.add(panel);
    this.info.add(new Label(this, 76, 228, c.name, { scale: 2, color: 0xffd35a }));
    this.info.add(new Label(this, 76, 245, c.quirkText, { color: 0xf4e3d7, shadow: false }));
    this.info.add(new Label(this, 76, 255, best ? `BEST ${best.score}  QUOTA ${c.quota}` : `QUOTA ${c.quota}   DIGESTS IN ${c.digestMax}`, { color: 0xa88a96, shadow: false }));
    void H;
    void W;
  }

  private start(): void {
    sfx.unlock();
    sfx.startDrone();
    const q = new URLSearchParams(window.location.search).get('seed');
    const seed = q ? Number(q) || 1 : Math.floor(Math.random() * 1e9);
    this.scene.start('Game', { level: this.selected, seed });
  }
}
