import Phaser from 'phaser';
import { sfx } from '../../audio/sfx';
import { C, FP, H, W } from '../../config';
import { Label } from '../../ui/label';
import { ensureWalkFrames, WALK_FRAMES } from '../art/sprites';
import { ENEMIES } from '../logic/enemies';
import { VARIANT_NAMES, type Room } from '../logic/run';
import { session } from '../session';
import { floatText } from '../ui';
import { addWalkOverlays, deckButton, HpBar, muteButton } from './common';
import { vk } from '../style';

const FPS = 11;
const WALK_MS = 2600;
const FLAVOUR = [
  'THE BELLY CLENCHES AROUND YOU...',
  'SOMETHING GURGLES AHEAD.',
  'THE WALLS PULSE. KEEP MOVING.',
  'YOU WADE THROUGH WARM SLIME...',
  'A DISTANT HICCUP ECHOES.',
];
const NAMES: Record<string, string> = {
  fight: 'FIGHT', elite: 'ELITE FIGHT', boss: 'MAMA LEECH', valve: 'RUSTY VALVE', cyst: 'FAT CYST', alcove: 'DARK ALCOVE', pool: 'ACID POOL', corpse: 'FALLEN DIVER',
};

function roomTexture(r: Room): { key: string; scale: number } {
  if (r.enemies) {
    const main = r.kind === 'boss' ? 'mama' : r.enemies.find((e) => ENEMIES[e].elite) ?? r.enemies[0];
    return { key: `en_${ENEMIES[main].art}`, scale: ENEMIES[main].boss ? 0.8 : 1 };
  }
  return { key: `prop_${r.kind}`, scale: 1 };
}

function roomLine(r: Room): string {
  if (r.enemies) return r.enemies.map((e) => ENEMIES[e].name).join(', ');
  return '';
}

/** Walking through the belly: the tunnel moves, the next rooms grow out of the dark, forks are real tunnel mouths. */
export class SWalkScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Image;
  private t = 0;
  private lastStep = -1;
  private walking = true;
  private entering = false;
  private pal: 'pink' | 'rust' = 'pink';
  private mouths: { c: Phaser.GameObjects.Container; room: Room; side: number; glow: Phaser.GameObjects.Arc }[] = [];
  private ahead?: Phaser.GameObjects.Image;
  private hint!: Label;
  private title!: Label;

  constructor() {
    super('SWalk');
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
    this.t = 0;
    this.lastStep = -1;
    this.walking = true;
    this.entering = false;
    this.mouths = [];
    const opts = run.map[run.step];
    this.pal = opts.some((o) => o.kind === 'boss') ? 'rust' : 'pink';
    ensureWalkFrames(this, this.pal);
    this.cameras.main.fadeIn(300, 10, 3, 8);
    this.bg = this.add.image(0, 0, `sv_walk_${this.pal}_0`).setOrigin(0).setDepth(0);
    addWalkOverlays(this);

    this.drawProgress();
    new HpBar(this, 6, 6, 60).set(run.hp, run.maxHp);
    deckButton(this, 6, 22);
    muteButton(this);
    this.title = new Label(this, W / 2, 232, FLAVOUR[(run.step + run.seed) % FLAVOUR.length], { align: 'center', color: C.textDim, depth: 700 });
    this.hint = new Label(this, W / 2, 244, '', { align: 'center', color: 0xffe9a8, depth: 700 });

    // what is ahead
    if (opts.length === 1) {
      const pic = roomTexture(opts[0]);
      this.ahead = this.add.image(FP.cx, 74, vk(pic.key)).setOrigin(0.5, 1).setDepth(8).setScale(0.05).setTintFill(0x000000).setAlpha(0.9);
      this.ahead.setData('end', pic.scale);
      this.tweens.add({ targets: this.ahead, scale: pic.scale * 0.9, y: 160, duration: WALK_MS, ease: 'Quad.easeIn' });
    } else {
      opts.forEach((room, k) => this.buildMouth(room, k, opts.length));
    }
    // sometimes something drifts by
    if (run.step > 0 && (run.step * 7 + run.seed) % 5 < 2) this.time.delayedCall(500, () => this.spawnSnack());

    sfx.gurgle();
    this.time.delayedCall(WALK_MS, () => this.arrive());
    this.input.on('pointerup', () => {
      // tapping while walking hurries up
      if (this.walking && this.t > 700) this.t = Math.max(this.t, WALK_MS - 250);
    });
  }

  private drawProgress(): void {
    const run = session.run!;
    const n = run.map.length;
    const x0 = 100;
    const dx = (W - 2 * x0) / (n - 1);
    const g = this.add.graphics().setDepth(700);
    g.lineStyle(2, 0x6a3a54, 1).lineBetween(x0, 14, W - x0, 14);
    run.map.forEach((opts, s) => {
      const x = x0 + s * dx;
      const cur = s === run.step;
      const done = s < run.step;
      g.fillStyle(C.ink, 1).fillCircle(x, 14, 8);
      g.fillStyle(done ? 0x6a3a54 : cur ? 0xffd35a : 0x2a1a24, 1).fillCircle(x, 14, 6);
      const k = opts[0].kind === 'fight' ? 'n_fight' : `n_${opts[0].kind}`;
      this.add.image(x, 14, `ic_${k}`).setScale(0.45).setDepth(701).setAlpha(done ? 0.4 : cur ? 1 : 0.7);
    });
  }

  private buildMouth(room: Room, k: number, n: number): void {
    const side = n === 1 ? 0 : k === 0 ? -1 : 1;
    const c = this.add.container(FP.cx + side * 16, 82).setDepth(8).setScale(0.12);
    const glow = this.add.circle(0, 6, 56, 0xffd35a, 0.0);
    const dark = this.add.ellipse(0, 10, 96, 120, C.ink);
    const rim = this.add.ellipse(0, 10, 100, 124).setStrokeStyle(4, 0x7a2f4b);
    const inner = this.add.ellipse(0, 14, 74, 96, 0x000000);
    const key = room.kind === 'fight' ? 'n_fight' : `n_${room.kind}`;
    const icon = this.add.image(0, -4, `ic_${key}`).setScale(2);
    const name = new Label(this, 0, 76, room.variant && room.kind === 'fight' ? VARIANT_NAMES[room.variant] : NAMES[room.kind], { align: 'center', color: 0xffe9a8, scale: 1 });
    const sub = new Label(this, 0, 88, roomLine(room), { align: 'center', color: C.textDim });
    c.add([glow, dark, rim, inner, icon, name, sub]);
    c.setSize(100, 124);
    this.mouths.push({ c, room, side, glow });
    this.tweens.add({ targets: c, scale: 1, x: FP.cx + side * 112, y: 108, duration: WALK_MS, ease: 'Cubic.easeIn' });
  }

  private arrive(): void {
    if (this.entering) return;
    this.walking = false;
    sfx.deselect();
    if (this.mouths.length === 0) {
      this.hint.setText('...');
      this.time.delayedCall(450, () => this.enter(session.run!.map[session.run!.step][0]));
      return;
    }
    this.hint.setText('THE TUNNEL SPLITS. TAP A WAY.');
    this.title.setText('');
    this.mouths.forEach((m) => {
      m.c.setInteractive(new Phaser.Geom.Rectangle(0, 0, 100, 124), Phaser.Geom.Rectangle.Contains);
      m.c.input!.cursor = 'pointer';
      m.c.on('pointerover', () => m.glow.setFillStyle(0xffd35a, 0.18));
      m.c.on('pointerout', () => m.glow.setFillStyle(0xffd35a, 0));
      m.c.on('pointerup', () => {
        sfx.unlock();
        sfx.click();
        this.enter(m.room, m);
      });
      this.tweens.add({ targets: m.c, y: m.c.y - 3, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
  }

  private enter(room: Room, m?: (typeof this.mouths)[number]): void {
    if (this.entering) return;
    this.entering = true;
    this.walking = true; // keep the tunnel moving while we go in
    this.hint.setText(`ENTERING: ${NAMES[room.kind]}`);
    if (m) this.tweens.add({ targets: m.c, scale: 3.2, x: FP.cx + m.side * 60, y: 150, duration: 700, ease: 'Cubic.easeIn' });
    this.mouths.filter((o) => o !== m).forEach((o) => this.tweens.add({ targets: o.c, alpha: 0, duration: 300 }));
    if (this.ahead) {
      this.tweens.add({ targets: this.ahead, scale: (this.ahead.getData('end') as number) * 1.15, duration: 700, ease: 'Cubic.easeIn' });
      this.time.delayedCall(350, () => this.ahead?.clearTint());
    }
    this.cameras.main.fadeOut(420, 10, 3, 8);
    this.time.delayedCall(600, () => {
      session.room = room;
      this.scene.start(room.enemies ? 'SFight' : room.kind === 'pool' ? 'SPool' : 'SExplore');
    });
  }

  private spawnSnack(): void {
    const run = session.run!;
    const c = this.add.container(FP.cx + 6, 96).setDepth(9).setScale(0.2);
    c.add(this.add.image(0, 0, 'ic_beans').setScale(1.4));
    c.setSize(40, 40);
    c.setInteractive(new Phaser.Geom.Rectangle(0, 0, 40, 40), Phaser.Geom.Rectangle.Contains);
    c.input!.cursor = 'pointer';
    let taken = false;
    c.on('pointerup', () => {
      if (taken) return;
      taken = true;
      const g = run.heal(3);
      sfx.gem(1);
      floatText(this, c.x, c.y - 20, g > 0 ? `YUM +${g} HP` : 'YUM', 0x6bdc3c, 1);
      this.tweens.add({ targets: c, alpha: 0, scale: 0.1, duration: 200, onComplete: () => c.destroy() });
    });
    this.tweens.add({ targets: c, x: FP.cx - 70, y: 200, scale: 1.6, duration: 2200, ease: 'Quad.easeIn', onComplete: () => c.destroy() });
  }

  update(_t: number, dt: number): void {
    if (!this.walking) return;
    this.t += dt;
    const f = Math.floor((this.t / 1000) * FPS) % WALK_FRAMES;
    if (f !== this.lastStep) {
      this.lastStep = f;
      this.bg.setTexture(`sv_walk_${this.pal}_${f}`);
      if (f % 4 === 0) sfx.shove();
    }
    // a gentle bob like walking
    this.cameras.main.setScroll(0, Math.sin(this.t / 140) * 1.4);
  }
}
void H;
