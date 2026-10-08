import Phaser from 'phaser';
import { sfx } from '../../audio/sfx';
import { C, H, W } from '../../config';
import { Label } from '../../ui/label';
import { ENEMIES } from '../logic/enemies';
import type { Room } from '../logic/run';
import { session } from '../session';
import { loadSalvage, writeSalvage } from '../storage';
import { addBelly, deckButton, HpBar, muteButton } from './common';

const NAMES: Record<string, string> = {
  fight: 'FIGHT',
  elite: 'ELITE FIGHT',
  boss: 'BOSS',
  valve: 'RUSTY VALVE',
  cyst: 'FAT CYST',
  alcove: 'DARK ALCOVE',
  pool: 'ACID POOL',
  corpse: 'FALLEN DIVER',
};
const HINT: Record<string, string> = {
  valve: 'NEEDS PRY OR KEY. BASHING COSTS 4 HP.',
  cyst: 'NEEDS CUT OR DIG. HEALS A LITTLE.',
  alcove: 'NEEDS LIGHT. TREASURE HIDES IN THE DARK.',
  pool: 'REST, GROW A CARD OR DISSOLVE ONE.',
  corpse: 'FREE LOOT. TAKE ONE ITEM.',
};

export class SMapScene extends Phaser.Scene {
  constructor() {
    super('SMap');
  }

  create(): void {
    const run = session.run;
    if (!run) {
      this.scene.start('STitle');
      return;
    }
    if (run.lost || run.won) {
      this.scene.start('SEnd');
      return;
    }
    const save = loadSalvage();
    save.deepest = Math.max(save.deepest, run.step);
    writeSalvage();
    addBelly(this, 'pink', 0.45);
    new Label(this, W / 2, 8, 'THE BELLY OF THE LEVIATHAN', { align: 'center', scale: 1, color: C.accent, depth: 700 });
    new Label(this, W / 2, 20, `STEP ${run.step + 1} OF ${run.map.length}`, { align: 'center', color: C.textDim, depth: 700 });
    const hp = new HpBar(this, 6, 6, 60);
    hp.set(run.hp, run.maxHp);
    deckButton(this, 6, 22);
    muteButton(this);
    const tip = new Label(this, W / 2, 232, '', { align: 'center', color: C.text, depth: 700 });
    const tip2 = new Label(this, W / 2, 244, '', { align: 'center', color: C.textDim, depth: 700 });

    const n = run.map.length;
    const x0 = 36;
    const dx = (W - 2 * x0) / (n - 1);
    const pos = (s: number, k: number, cnt: number) => ({ x: x0 + s * dx, y: 128 + (cnt === 1 ? 0 : (k - 0.5) * 70) });
    // paths
    const g = this.add.graphics().setDepth(5);
    for (let s = 0; s < n - 1; s++)
      run.map[s].forEach((_, a) =>
        run.map[s + 1].forEach((_, b) => {
          const p = pos(s, a, run.map[s].length);
          const q = pos(s + 1, b, run.map[s + 1].length);
          g.lineStyle(2, s < run.step ? 0x6a3a54 : 0xa87a8a, s < run.step ? 0.5 : 0.9);
          const len = Math.hypot(q.x - p.x, q.y - p.y);
          for (let t = 0; t < len; t += 6) g.fillStyle(s < run.step ? 0x6a3a54 : 0xd8a8b4, 1).fillRect(p.x + ((q.x - p.x) * t) / len, p.y + ((q.y - p.y) * t) / len, 2, 2);
        }),
      );
    run.map.forEach((opts, s) =>
      opts.forEach((room, k) => {
        const { x, y } = pos(s, k, opts.length);
        const cur = s === run.step;
        const past = s < run.step;
        const key = room.kind === 'fight' ? 'n_fight' : `n_${room.kind}`;
        this.add.circle(x, y, 17, C.ink).setDepth(6);
        const disc = this.add.circle(x, y, 15, cur ? 0x7a2f4b : past ? 0x2a1a24 : 0x3a2234).setDepth(7);
        const ic = this.add.image(x, y, `ic_${key}`).setDepth(8).setAlpha(past ? 0.35 : 1);
        if (!cur && !past) ic.setAlpha(0.85);
        if (cur) {
          this.tweens.add({ targets: [disc, ic], scale: 1.12, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          const ring = this.add.circle(x, y, 19).setStrokeStyle(2, C.accent).setDepth(9);
          this.tweens.add({ targets: ring, alpha: 0.3, duration: 520, yoyo: true, repeat: -1 });
          disc.setInteractive({ useHandCursor: true });
          disc.on('pointerover', () => this.describe(room, tip, tip2));
          disc.on('pointerup', () => {
            sfx.unlock();
            sfx.click();
            this.enter(room, k);
          });
        } else {
          disc.setInteractive();
          disc.on('pointerover', () => this.describe(room, tip, tip2));
        }
        if (past) new Label(this, x, y + 20, 'DONE', { align: 'center', color: 0x7a6270, depth: 8 });
      }),
    );
    // sensible default text: describe what is up next
    this.describe(run.map[run.step][0], tip, tip2);
    this.add.rectangle(W / 2, 262, 1, 1, 0, 0);
    if (run.map[run.step].length > 1) new Label(this, W / 2, 34, 'CHOOSE YOUR WAY', { align: 'center', color: 0xffe9a8, depth: 700 });
    else new Label(this, W / 2, 34, 'TAP THE GLOWING ROOM', { align: 'center', color: 0xffe9a8, depth: 700 });
  }

  private describe(room: Room, a: Label, b: Label): void {
    a.setText(NAMES[room.kind] ?? room.kind);
    if (room.enemies) b.setText(room.enemies.map((e) => ENEMIES[e].name).join(', ') + (room.mood === 'hiccup' ? '  (HICCUPY)' : ''));
    else b.setText(HINT[room.kind] ?? '');
  }

  private enter(room: Room, k: number): void {
    const run = session.run!;
    session.room = room;
    void k;
    const target = room.enemies ? 'SFight' : room.kind === 'pool' ? 'SPool' : 'SExplore';
    this.cameras.main.fadeOut(220, 10, 3, 8);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(target));
    void run;
  }
}
void H;
