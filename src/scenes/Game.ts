import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import {
  ACID_X, BOARD_X, BOARD_Y, C, CARD_H, CARD_W, CELL, COLOUR_UI, EXIT_X, GHOST_X, H, HAND_Y, PANEL_X, W,
  cellX, cellY, COLS, ROWS,
} from '../config';
import { DEBUG } from '../target';
import { GutGame, ESCAPE_BONUS_PER_TICK } from '../logic/game';
import { TINY_FROG } from '../logic/levels';
import { TOOLS } from '../logic/tools';
import type { Cell, GameEvent, Pos, ToolId } from '../logic/types';
import { loadSave, writeSave } from '../storage';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { showHelp } from './Title';

interface CellSprite {
  img: Phaser.GameObjects.Image;
  cell: Cell;
  baseY: number;
  ghost: boolean;
}

interface CardView {
  box: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  tool: ToolId;
  uid: number;
}

const TOOL_TINT: Record<ToolId, number> = { pick: 0xffe27a, zapper: 0x9ee7ff, net: 0xb7ffb0, shove: 0xffb59e };
const EPITAPHS_DIGESTED = [
  'THE FROG BURPS. YOU WERE A SNACK.',
  'DIGESTED. TASTES LIKE TINY MINER.',
  'YOU HAVE BECOME FROG ENERGY.',
  'SHOULD HAVE LEFT BY THE BACK DOOR.',
];
const EPITAPHS_SICK = [
  'TOO MANY BUGS. YOU FEEL GREEN.',
  'EVEN THE FROG FEELS BAD FOR YOU.',
  'INFECTION WINS THIS ROUND.',
];

export class GameScene extends Phaser.Scene {
  private g!: GutGame;
  private seed = 1;
  private cells = new Map<number, CellSprite>();
  private hand: CardView[] = [];
  private selected = -1;
  private busy = true;
  private ended = false;
  private pressing = false;
  private hover: Pos | null = null;
  private hl!: Phaser.GameObjects.Graphics;
  private help: Phaser.GameObjects.Container | null = null;

  // HUD
  private digestSegs: Phaser.GameObjects.Image[] = [];
  private digestLeft!: Label;
  private scoreLabel!: Label;
  private quotaFill!: Phaser.GameObjects.Image;
  private starImgs: Phaser.GameObjects.Image[] = [];
  private pips: Phaser.GameObjects.Image[][] = [];
  private bolts: Phaser.GameObjects.Image[] = [];
  private hint!: Label;
  private hero!: Phaser.GameObjects.Image;
  private heroTween?: Phaser.Tweens.Tween;
  private exitDoor!: Phaser.GameObjects.Image;
  private acid!: Phaser.GameObjects.Image;
  private wallTop!: Phaser.GameObjects.Image;
  private wallBot!: Phaser.GameObjects.Image;
  private squeezeBtn!: Button;
  private escapeBtn!: Button;
  private exitOpened = false;

  constructor() {
    super('Game');
  }

  init(data: { seed?: number }): void {
    this.seed = data.seed ?? Math.floor(Math.random() * 1e9);
  }

  // ------------------------------------------------------------------ setup
  create(): void {
    this.g = new GutGame(TINY_FROG, this.seed);
    this.cells.clear();
    this.hand = [];
    this.selected = -1;
    this.busy = true;
    this.ended = false;
    this.pressing = false;
    this.hover = null;
    this.exitOpened = false;
    this.digestSegs = [];
    this.starImgs = [];
    this.pips = [];
    this.bolts = [];

    this.buildScenery();
    this.buildHud();
    this.buildHand();
    this.buildItems();
    this.buildInput();
    this.refreshHud();

    sfx.startDrone();
    this.time.addEvent({ delay: 2600, loop: true, callback: () => !this.ended && Math.random() < 0.7 && sfx.gurgle() });

    if (DEBUG) (window as unknown as { __gut: unknown }).__gut = { scene: this, get g() { return (this as unknown as { scene: GameScene }).scene.g; } };

    this.intro();
  }

  private buildScenery(): void {
    this.add.image(0, 0, 'bg').setOrigin(0).setDepth(0);
    this.add.image(BOARD_X, BOARD_Y, 'board_bg').setOrigin(0).setDepth(1);
    this.add.image(GHOST_X, BOARD_Y, 'ghost_bg').setOrigin(0).setDepth(1);
    this.acid = this.add.image(ACID_X, BOARD_Y, 'acid_0').setOrigin(0).setDepth(1);
    let f = 0;
    this.time.addEvent({ delay: 230, loop: true, callback: () => this.acid.setTexture(`acid_${(f = (f + 1) % 4)}`) });
    this.exitDoor = this.add.image(EXIT_X, BOARD_Y, 'exit_0').setOrigin(0).setDepth(1);
    this.wallTop = this.add.image(0, BOARD_Y - 13, 'wall_top').setOrigin(0).setDepth(5);
    this.wallBot = this.add.image(0, BOARD_Y + ROWS * CELL - 1, 'wall_bot').setOrigin(0).setDepth(5);
    new Label(this, GHOST_X + CELL / 2, BOARD_Y - 11, 'NEXT', { align: 'center', color: C.accent, depth: 6 });
    new Label(this, ACID_X + CELL / 2, BOARD_Y - 11, 'ACID', { align: 'center', color: C.acid, depth: 6 });
    new Label(this, EXIT_X + CELL / 2, BOARD_Y - 11, 'EXIT', { align: 'center', color: C.text, depth: 6 });
    this.hl = this.add.graphics().setDepth(20);
  }

  private buildHud(): void {
    const lvl = this.g.level;
    // digestion bar
    new Label(this, 8, 3, 'DIGESTION', { color: C.textDim });
    this.digestLeft = new Label(this, 224, 3, '', { align: 'right', color: C.text });
    const segW = Math.floor(216 / lvl.digestMax) - 1;
    for (let i = 0; i < lvl.digestMax; i++) {
      this.digestSegs.push(this.add.image(8 + i * (segW + 1), 13, 'px').setOrigin(0).setScale(segW, 9).setDepth(8));
    }
    // quota bar
    new Label(this, 248, 3, 'ESCAPE QUOTA', { color: C.textDim });
    this.scoreLabel = new Label(this, 472, 3, '', { align: 'right', color: C.accent });
    const barX = 248, barW = 224, top = lvl.stars[1];
    this.add.image(barX, 13, 'px').setOrigin(0).setScale(barW, 9).setTint(0x4e2a42).setDepth(8);
    this.quotaFill = this.add.image(barX, 13, 'px').setOrigin(0).setScale(0, 9).setTint(0xffd35a).setDepth(9);
    [lvl.quota, lvl.stars[0], lvl.stars[1]].forEach((v, i) => {
      const x = barX + Math.min(1, v / top) * (barW - 6);
      this.add.image(x - 1, 12, 'px').setOrigin(0).setScale(1, 11).setTint(0x1a0a14).setDepth(10);
      const s = this.add.image(x + 1, 18, 'star_off').setDepth(11);
      this.starImgs.push(s);
      void i;
    });

    // right panel
    new Label(this, PANEL_X, 43, lvl.name, { color: C.accent });
    new Label(this, PANEL_X, 54, 'INFECTION', { color: C.textDim });
    for (let c = 0; c < 4; c++) {
      const y = 72 + c * 15;
      this.add.image(PANEL_X + 8, y, `bug_${c}_0`).setScale(0.5).setDepth(8);
      const row: Phaser.GameObjects.Image[] = [];
      for (let i = 0; i < lvl.infectionMax; i++) row.push(this.add.image(PANEL_X + 28 + i * 11, y, 'pip_off').setDepth(8));
      this.pips.push(row);
    }
    new Label(this, PANEL_X + 50, 134, 'ENERGY', { color: C.textDim });
    for (let i = 0; i < lvl.maxEnergy; i++) this.bolts.push(this.add.image(PANEL_X + 58 + i * 16, 156, 'bolt_on').setScale(2).setDepth(8));
    this.hero = this.add.image(PANEL_X + 22, 172, 'hero_idle').setScale(2).setDepth(8);
    this.setMood('idle');

    // hint line
    this.hint = new Label(this, W / 2, 212, '', { scale: 2, align: 'center', color: C.text, depth: 12 });

    // buttons
    this.squeezeBtn = new Button(this, 316, 228, 84, 38, 'SQUEEZE', () => this.doSqueeze(), { fill: 0x2e7a3a, sub: 'SPACE' });
    this.escapeBtn = new Button(this, 404, 228, 68, 38, 'ESCAPE', () => this.doEscape(), { fill: 0xb8731a, sub: `QUOTA ${lvl.quota}` });
    this.escapeBtn.setEnabled(false);
    this.squeezeBtn.setDepth(15);
    this.escapeBtn.setDepth(15);

    // small utility buttons in the top wall
    const help = new Button(this, 430, BOARD_Y - 12, 18, 11, '?', () => this.openHelp(), { fill: 0x5a3a7a });
    const snd = new Button(this, 452, BOARD_Y - 12, 18, 11, sfx.muted ? 'X' : 'S', () => {
      sfx.setMuted(!sfx.muted);
      snd.setLabel(sfx.muted ? 'X' : 'S');
    }, { fill: 0x5a3a7a });
    help.setDepth(15);
    snd.setDepth(15);
  }

  private openHelp(): void {
    if (this.help || this.ended) return;
    this.busy = true;
    this.help = showHelp(this, () => {
      this.help = null;
      this.busy = false;
    });
  }

  private buildHand(): void {
    this.syncHand(true);
  }

  private buildItems(): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.g.at(r, c);
        if (cell) this.makeSprite(cell, cellX(c), cellY(r), false);
      }
      const inc = this.g.incoming[r];
      if (inc) this.makeSprite(inc, cellX(-1), cellY(r), true);
    }
  }

  private makeSprite(cell: Cell, x: number, y: number, ghost: boolean): CellSprite {
    const key = cell.kind === 'gem' ? `gem_${cell.colour}` : cell.kind === 'bug' ? `bug_${cell.colour}_0` : 'bone';
    const img = this.add.image(x, y, key).setDepth(10);
    if (ghost) img.setAlpha(0.5);
    const cs: CellSprite = { img, cell, baseY: y, ghost };
    this.cells.set(cell.id, cs);
    return cs;
  }

  private async intro(): Promise<void> {
    const lvl = this.g.level;
    const name = new Label(this, W / 2, 96, lvl.name, { scale: 4, align: 'center', color: C.accent, depth: 60 });
    const tag = new Label(this, W / 2, 130, lvl.tagline, { scale: 2, align: 'center', color: C.text, depth: 60 });
    name.setAlpha(0);
    tag.setAlpha(0);
    this.tweens.add({ targets: [name, tag], alpha: 1, duration: 250 });
    sfx.gurgle();
    await this.wait(950);
    await this.tween({ targets: [name, tag], alpha: 0, y: '-=14', duration: 320 });
    name.destroy();
    tag.destroy();
    this.busy = false;
    this.autoHint();
  }

  // ------------------------------------------------------------------ input
  private buildInput(): void {
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.busy || this.selected < 0) return;
      if (p.wasTouch && !this.pressing) return;
      this.hover = this.cellAt(p.x, p.y);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      sfx.unlock();
      if (this.busy || this.ended) return;
      if (p.rightButtonDown()) {
        this.select(-1);
        return;
      }
      if (this.selected < 0) return;
      const cell = this.cellAt(p.x, p.y);
      if (cell) {
        this.pressing = true;
        this.hover = cell;
      }
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (!this.pressing) return;
      this.pressing = false;
      const cell = this.cellAt(p.x, p.y);
      this.hover = p.wasTouch ? null : cell;
      if (!cell || this.busy || this.selected < 0) return;
      void this.tryPlay(this.selected, cell.r, cell.c);
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => {
      this.pressing = false;
      this.hover = p.wasTouch ? null : this.hover;
    });

    const kb = this.input.keyboard;
    if (kb) {
      ['ONE', 'TWO', 'THREE', 'FOUR'].forEach((k, i) => kb.on(`keydown-${k}`, () => this.pressCard(i)));
      kb.on('keydown-SPACE', () => this.doSqueeze());
      kb.on('keydown-ENTER', () => this.doSqueeze());
      kb.on('keydown-E', () => this.doEscape());
      kb.on('keydown-M', () => sfx.setMuted(!sfx.muted));
      kb.on('keydown-BACKSPACE', () => this.select(-1));
    }
  }

  private cellAt(x: number, y: number): Pos | null {
    const c = Math.floor((x - BOARD_X) / CELL);
    const r = Math.floor((y - BOARD_Y) / CELL);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
    return { r, c };
  }

  private pressCard(i: number): void {
    if (this.busy || this.ended) return;
    sfx.unlock();
    if (!this.hand[i]) return;
    if (!this.g.canPlay(i) || !this.g.hasTarget(this.g.hand[i].tool)) {
      sfx.nope();
      this.flashHint(this.g.canPlay(i) ? 'NO VALID TARGET FOR THAT TOOL.' : 'NOT ENOUGH ENERGY FOR THAT TOOL.', C.bad);
      return;
    }
    this.select(this.selected === i ? -1 : i);
  }

  private select(i: number): void {
    if (i === this.selected) return;
    if (i < 0) sfx.deselect();
    else sfx.select();
    this.selected = i;
    this.hover = null;
    this.pressing = false;
    this.refreshHand();
    this.autoHint();
  }

  // ------------------------------------------------------------------ hand
  private cardX(i: number): number {
    return 48 + i * (CARD_W + 4);
  }

  private syncHand(deal: boolean): void {
    this.hand.forEach((c) => c.box.destroy());
    this.hand = [];
    this.g.hand.forEach((card, i) => {
      const tool = TOOLS[card.tool];
      const box = this.add.container(this.cardX(i), HAND_Y).setDepth(14);
      const bg = this.add.image(0, 0, 'card').setOrigin(0);
      const icon = this.add.image(18, 16, `ico_${card.tool}`);
      const name = new Label(this, CARD_W / 2, 29, tool.name, { align: 'center', color: C.text });
      const key = new Label(this, 4, 4, String(i + 1), { color: C.textDim, shadow: false });
      box.add([bg, icon, name, key]);
      for (let k = 0; k < tool.cost; k++) box.add(this.add.image(CARD_W - 12 - (tool.cost - 1 - k) * 9, 15, 'bolt_on'));
      box.setSize(CARD_W, CARD_H);
      box.setInteractive(new Phaser.Geom.Rectangle(CARD_W / 2, CARD_H / 2, CARD_W, CARD_H), Phaser.Geom.Rectangle.Contains);
      box.on('pointerdown', () => {
        // swallow the press so it never counts as a board press
        this.pressing = false;
        this.pressCard(this.hand.findIndex((h) => h.uid === card.uid));
      });
      this.hand.push({ box, bg, icon, tool: card.tool, uid: card.uid });
      if (deal) {
        box.y = HAND_Y + 34;
        box.setAlpha(0);
        this.tweens.add({ targets: box, y: HAND_Y, alpha: 1, duration: 220, delay: i * 70, ease: 'Back.easeOut' });
      }
    });
    this.refreshHand();
  }

  private refreshHand(): void {
    this.hand.forEach((cv, i) => {
      const idx = this.g.hand.findIndex((h) => h.uid === cv.uid);
      const ok = idx >= 0 && this.g.canPlay(idx) && this.g.hasTarget(cv.tool);
      const sel = idx === this.selected && idx >= 0;
      cv.bg.setTexture(sel ? 'card_sel' : ok ? 'card' : 'card_dim');
      cv.icon.setAlpha(ok ? 1 : 0.45);
      cv.box.y = sel ? HAND_Y - 3 : HAND_Y;
      cv.box.x = this.cardX(i);
    });
  }

  // ------------------------------------------------------------------ play
  private async tryPlay(handIndex: number, r: number, c: number): Promise<void> {
    const tool = this.g.hand[handIndex]?.tool;
    if (!tool) return;
    if (!this.g.area(tool, r, c).length) {
      sfx.nope();
      this.flashHint('THAT TOOL CANNOT TARGET THIS.', C.bad);
      return;
    }
    this.busy = true;
    const prevScore = this.g.score;
    const ev = this.g.play(handIndex, r, c);
    if (!ev) {
      this.busy = false;
      return;
    }
    this.selected = -1;
    this.hover = null;
    this.hl.clear();
    this.playToolSfx(tool, ev);
    await this.animateAction(tool, ev, { r, c });
    this.syncHand(false);
    this.refreshHud();
    if (this.g.score >= this.g.level.quota && prevScore < this.g.level.quota) await this.openExit();
    this.busy = false;
    this.autoHint();
  }

  private playToolSfx(tool: ToolId, ev: GameEvent[]): void {
    if (tool === 'pick') sfx.pick();
    else if (tool === 'zapper') sfx.zap();
    else if (tool === 'net') sfx.net();
    else sfx.shove();
    const gems = ev.filter((e) => e.t === 'collect').length;
    for (let i = 0; i < gems; i++) this.time.delayedCall(60 + i * 70, () => sfx.gem(i));
    const sc = ev.find((e) => e.t === 'score');
    if (sc && sc.t === 'score' && sc.label === 'SET X2!') this.time.delayedCall(200, () => sfx.set());
  }

  /** Promise wrapper around a tween; keeps the caller's own onComplete (used to destroy sprites). */
  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((res) =>
      this.tweens.add({
        ...cfg,
        onComplete: (tw, targets, ...rest) => {
          (cfg.onComplete as ((...a: unknown[]) => void) | undefined)?.(tw, targets, ...rest);
          res();
        },
      }),
    );
  }

  private wait(ms: number): Promise<void> {
    return new Promise((res) => this.time.delayedCall(ms, () => res()));
  }

  private async animateAction(tool: ToolId, ev: GameEvent[], at: Pos): Promise<void> {
    const jobs: Promise<void>[] = [];
    if (tool === 'zapper') this.zapFx(ev.filter((e): e is Extract<GameEvent, { t: 'kill' }> => e.t === 'kill'), at);
    if (tool === 'net') {
      const area = this.g.area('net', at.r, at.c);
      void area;
    }
    let gi = 0;
    for (const e of ev) {
      if (e.t === 'kill') {
        const cs = this.cells.get(e.id);
        this.cells.delete(e.id);
        if (cs) jobs.push(this.killFx(cs, e.colour));
      } else if (e.t === 'collect') {
        const cs = this.cells.get(e.id);
        this.cells.delete(e.id);
        if (cs) jobs.push(this.collectFx(cs, e.colour, gi++));
      } else if (e.t === 'move') {
        const cs = this.cells.get(e.id);
        if (cs) jobs.push(this.tween({ targets: cs.img, x: cellX(e.toC), duration: 150, ease: 'Quad.easeOut' }));
      } else if (e.t === 'score') {
        this.float(cellX(e.c), cellY(e.r) - 8, `+${e.pts}`, C.accent, 2);
        if (e.label) this.float(cellX(e.c), cellY(e.r) + 6, e.label, e.label.startsWith('SET') ? 0xffffff : C.text, 1);
        this.setMood('cheer', 700);
      }
    }
    if (tool === 'net') jobs.push(this.netFx(at));
    if (tool === 'pick') this.pickFx(at);
    await Promise.all(jobs);
  }

  private pickFx(at: Pos): void {
    const x = cellX(at.c), y = cellY(at.r);
    const f = this.add.image(x, y, 'px').setScale(CELL - 4).setTint(0xffffff).setAlpha(0.7).setDepth(30);
    this.tweens.add({ targets: f, alpha: 0, scale: CELL, duration: 160, onComplete: () => f.destroy() });
    this.cameras.main.shake(70, 0.0025);
  }

  private netFx(at: Pos): Promise<void> {
    const ar = this.g.area('net', at.r, at.c);
    void ar;
    const r = Math.min(at.r, ROWS - 2), c = Math.min(at.c, COLS - 2);
    const x = BOARD_X + (c + 1) * CELL, y = BOARD_Y + (r + 1) * CELL;
    const net = this.add.image(x, y, 'ico_net').setScale(6).setAlpha(0.95).setDepth(30);
    return this.tween({ targets: net, scale: 4, alpha: 0, angle: 12, duration: 300, ease: 'Quad.easeOut', onComplete: () => net.destroy() });
  }

  private zapFx(kills: Extract<GameEvent, { t: 'kill' }>[], at: Pos): void {
    if (!kills.length) return;
    const gfx = this.add.graphics().setDepth(31);
    const colour = COLOUR_UI[kills[0].colour];
    const x0 = cellX(at.c), y0 = cellY(at.r);
    for (const k of kills) {
      const x1 = cellX(k.c), y1 = cellY(k.r);
      if (x1 === x0 && y1 === y0) continue;
      const pts: Phaser.Math.Vector2[] = [new Phaser.Math.Vector2(x0, y0)];
      const n = 4;
      for (let i = 1; i < n; i++) {
        const t = i / n;
        pts.push(new Phaser.Math.Vector2(Math.round(x0 + (x1 - x0) * t + Phaser.Math.Between(-5, 5)), Math.round(y0 + (y1 - y0) * t + Phaser.Math.Between(-5, 5))));
      }
      pts.push(new Phaser.Math.Vector2(x1, y1));
      gfx.lineStyle(3, colour, 0.9).strokePoints(pts);
      gfx.lineStyle(1, 0xffffff, 1).strokePoints(pts);
    }
    this.tweens.add({ targets: gfx, alpha: 0, duration: 260, onComplete: () => gfx.destroy() });
  }

  private killFx(cs: CellSprite, colour: number): Promise<void> {
    this.burst(cs.img.x, cs.img.y, COLOUR_UI[colour] ?? 0xffffff, 9);
    cs.img.setTint(0xffffff);
    return this.tween({ targets: cs.img, scaleX: 1.4, scaleY: 0.2, alpha: 0, duration: 200, ease: 'Quad.easeIn', onComplete: () => cs.img.destroy() });
  }

  private collectFx(cs: CellSprite, colour: number, i: number): Promise<void> {
    this.burst(cs.img.x, cs.img.y, 0xffffff, 6);
    cs.img.setDepth(35);
    return this.tween({
      targets: cs.img,
      x: 330 + Math.min(1, this.g.score / 350) * 120,
      y: 18,
      scale: 0.4,
      duration: 380,
      delay: i * 60,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        cs.img.destroy();
        this.quotaFill.setTint(0xffffff);
        this.time.delayedCall(70, () => this.quotaFill.setTint(0xffd35a));
        void colour;
      },
    });
  }

  private burst(x: number, y: number, colour: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const p = this.add.image(x, y, 'px').setTint(colour).setScale(Phaser.Math.Between(2, 3)).setDepth(40);
      const a = Math.random() * Math.PI * 2;
      const d = 10 + Math.random() * 22;
      this.tweens.add({
        targets: p,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d + 8,
        alpha: 0,
        duration: 280 + Math.random() * 200,
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  private float(x: number, y: number, text: string, color: number, scale: number): void {
    const l = new Label(this, x, y, text, { align: 'center', color, scale, depth: 45 });
    this.tweens.add({ targets: l, y: y - 18, alpha: 0, duration: 900, delay: 150, ease: 'Quad.easeOut', onComplete: () => l.destroy() });
  }

  // ------------------------------------------------------------------ squeeze
  private async doSqueeze(): Promise<void> {
    if (this.busy || this.ended || this.g.phase !== 'play') return;
    sfx.unlock();
    this.busy = true;
    this.select(-1);
    this.hl.clear();
    // hand slides away
    this.hand.forEach((h) => this.tweens.add({ targets: h.box, y: HAND_Y + 40, alpha: 0, duration: 160 }));

    sfx.squeeze();
    this.cameras.main.shake(260, 0.004);
    this.tweens.add({ targets: this.wallTop, y: BOARD_Y - 11, duration: 130, yoyo: true, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this.wallBot, y: BOARD_Y + ROWS * CELL - 3, duration: 130, yoyo: true, ease: 'Sine.easeInOut' });

    const ev = this.g.squeeze();
    const jobs: Promise<void>[] = [];
    const acidJobs: Promise<void>[] = [];
    for (const e of ev) {
      if (e.t === 'advance') {
        const cs = this.cells.get(e.id);
        if (!cs) continue;
        const toX = e.toC >= COLS ? ACID_X + CELL / 2 : cellX(e.toC);
        if (cs.ghost) {
          cs.ghost = false;
          this.tweens.add({ targets: cs.img, alpha: 1, duration: 300 });
        }
        jobs.push(this.tween({ targets: cs.img, x: toX, duration: 320, ease: 'Sine.easeInOut', delay: 60 }));
      } else if (e.t === 'acid') {
        const cs = this.cells.get(e.id);
        this.cells.delete(e.id);
        if (cs) acidJobs.push(this.dissolve(cs, e.kind, e.colour));
      } else if (e.t === 'infect') {
        this.time.delayedCall(420, () => {
          sfx.hurt();
          this.setMood('hurt', 900);
          this.cameras.main.shake(180, 0.006);
          this.refreshPips(e.colour);
        });
      } else if (e.t === 'incoming') {
        const cs = this.makeSprite({ id: e.id, kind: e.kind, colour: e.colour }, cellX(-2), cellY(e.r), true);
        jobs.push(this.tween({ targets: cs.img, x: cellX(-1), duration: 320, ease: 'Sine.easeInOut', delay: 60 }));
      }
    }
    await Promise.all(jobs);
    await Promise.all(acidJobs);
    this.refreshHud();
    const lost = ev.find((e) => e.t === 'lost');
    if (lost && lost.t === 'lost') {
      await this.wait(300);
      this.lose(lost.reason);
      return;
    }
    this.syncHand(true);
    await this.wait(260);
    this.busy = false;
    this.autoHint();
  }

  private dissolve(cs: CellSprite, kind: string, colour: number): Promise<void> {
    sfx.sizzle();
    this.burst(cs.img.x, cs.img.y, kind === 'bug' ? COLOUR_UI[colour] : 0x9bff5a, 10);
    return this.tween({ targets: cs.img, delay: 330, alpha: 0, scaleY: 0.2, y: cs.img.y + 8, duration: 280, onComplete: () => cs.img.destroy() });
  }

  // ------------------------------------------------------------------ exit / end states
  private async openExit(): Promise<void> {
    if (this.exitOpened) return;
    this.exitOpened = true;
    sfx.open();
    this.exitDoor.setTexture('exit_1');
    await this.wait(160);
    this.exitDoor.setTexture('exit_2');
    this.tweens.add({ targets: this.exitDoor, alpha: { from: 1, to: 0.8 }, duration: 380, yoyo: true, repeat: -1 });
    const t = new Label(this, W / 2, 90, 'EXIT OPEN!', { scale: 4, align: 'center', color: C.accent, depth: 60 });
    this.tweens.add({ targets: t, y: 70, alpha: 0, duration: 1100, delay: 500, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
    this.refreshHud();
  }

  private async doEscape(): Promise<void> {
    if (this.busy || this.ended || !this.g.canEscape()) return;
    sfx.unlock();
    this.busy = true;
    this.select(-1);
    this.hl.clear();
    const res = this.g.escape();
    if (!res) {
      this.busy = false;
      return;
    }
    this.ended = true;
    this.hand.forEach((h) => this.tweens.add({ targets: h.box, y: HAND_Y + 40, alpha: 0, duration: 160 }));
    this.refreshHud();
    this.setHint('HERE WE GO...', C.accent);

    // the miner dashes down the belly towards the exit
    this.hero.setVisible(false);
    const dash = this.add.image(BOARD_X - 10, cellY(2), 'hero_cheer').setScale(2).setDepth(50);
    this.tweens.add({ targets: dash, angle: 360, duration: 900, ease: 'Sine.easeIn' });
    await this.tween({ targets: dash, x: EXIT_X + CELL / 2, duration: 900, ease: 'Sine.easeIn' });
    sfx.pfft();
    this.cameras.main.shake(300, 0.008);
    this.exitDoor.setTexture('exit_2');
    this.burst(EXIT_X + CELL / 2, cellY(2), 0xfff0b0, 24);
    this.burst(EXIT_X + CELL / 2, cellY(2), 0x8cf03e, 14);
    await this.tween({ targets: dash, x: W + 30, y: cellY(2) - 40, scale: 3, duration: 520, ease: 'Quad.easeOut' });
    dash.destroy();
    this.exitDoor.setTexture('exit_0');

    // save
    const save = loadSave();
    const prev = save.best[this.g.level.id];
    const isBest = !prev || res.final > prev.score;
    if (isBest) save.best[this.g.level.id] = { score: res.final, stars: Math.max(res.stars, prev?.stars ?? 0) };
    else if (prev && res.stars > prev.stars) prev.stars = res.stars;
    writeSave();
    this.showWin(res.final, res.bonus, res.stars, isBest);
  }

  private overlay(): { box: Phaser.GameObjects.Container; px: number; py: number; pw: number; ph: number } {
    const box = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(0, 0, W, H, 0x000000, 0.72).setOrigin(0).setInteractive();
    const pw = 300, ph = 170;
    const px = (W - pw) / 2, py = (H - ph) / 2 - 6;
    const panel = this.add.rectangle(px, py, pw, ph, C.panel).setOrigin(0).setStrokeStyle(2, C.panelEdge);
    box.add([dim, panel]);
    box.setAlpha(0);
    this.tweens.add({ targets: box, alpha: 1, duration: 250 });
    return { box, px, py, pw, ph };
  }

  private showWin(final: number, bonus: number, stars: number, isBest: boolean): void {
    const { box, px, py, pw, ph } = this.overlay();
    box.add(new Label(this, W / 2, py + 10, 'ESCAPED!', { scale: 3, align: 'center', color: C.good }));
    const starImgs: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 3; i++) {
      const s = this.add.image(W / 2 - 40 + i * 40, py + 52, 'star_off').setScale(3);
      box.add(s);
      starImgs.push(s);
    }
    for (let i = 0; i < stars; i++) {
      this.time.delayedCall(450 + i * 350, () => {
        starImgs[i].setTexture('star_on');
        sfx.gem(i * 2);
        this.tweens.add({ targets: starImgs[i], scale: { from: 5, to: 3 }, duration: 220, ease: 'Back.easeOut' });
      });
    }
    sfx.win();
    const gemsScore = final - bonus;
    box.add(new Label(this, px + 40, py + 78, `GEMS`, { color: C.textDim }));
    box.add(new Label(this, px + pw - 40, py + 78, `${gemsScore}`, { align: 'right' }));
    box.add(new Label(this, px + 40, py + 90, `TIME BONUS (${bonus / ESCAPE_BONUS_PER_TICK} X ${ESCAPE_BONUS_PER_TICK})`, { color: C.textDim }));
    box.add(new Label(this, px + pw - 40, py + 90, `+${bonus}`, { align: 'right' }));
    box.add(new Label(this, px + 40, py + 106, 'TOTAL', { scale: 2, color: C.accent }));
    box.add(new Label(this, px + pw - 40, py + 106, `${final}`, { scale: 2, align: 'right', color: C.accent }));
    const best = loadSave().best[this.g.level.id];
    box.add(new Label(this, W / 2, py + 126, isBest ? 'NEW BEST!' : `BEST ${best?.score ?? final}`, { align: 'center', color: isBest ? C.accent : C.textDim }));
    box.add(new Button(this, px + 20, py + ph - 30, 120, 22, 'PLAY AGAIN', () => this.scene.restart({ seed: Math.floor(Math.random() * 1e9) }), { fill: 0x2e7a3a }));
    box.add(new Button(this, px + pw - 140, py + ph - 30, 120, 22, 'MENU', () => this.scene.start('Title'), { fill: 0x5a3a7a }));
  }

  private lose(reason: 'sick' | 'digested'): void {
    this.ended = true;
    this.setMood('hurt', 99999);
    sfx.lose();
    const { box, px, py, pw, ph } = this.overlay();
    const title = reason === 'sick' ? 'TOO SICK!' : 'DIGESTED!';
    box.add(new Label(this, W / 2, py + 14, title, { scale: 3, align: 'center', color: C.bad }));
    const lines = reason === 'sick' ? EPITAPHS_SICK : EPITAPHS_DIGESTED;
    box.add(new Label(this, W / 2, py + 56, lines[this.seed % lines.length], { align: 'center', color: C.text }));
    box.add(new Label(this, W / 2, py + 76, `SCORE ${this.g.score} OF ${this.g.level.quota} NEEDED`, { align: 'center', color: C.textDim }));
    box.add(new Label(this, W / 2, py + 96, reason === 'sick' ? 'TIP: ZAP BUGS BEFORE THEY REACH THE ACID.' : 'TIP: ESCAPE EARLY. LEFTOVER TIME IS BONUS.', { align: 'center', color: C.accent }));
    box.add(new Button(this, px + 20, py + ph - 30, 120, 22, 'TRY AGAIN', () => this.scene.restart({ seed: Math.floor(Math.random() * 1e9) }), { fill: 0x2e7a3a }));
    box.add(new Button(this, px + pw - 140, py + ph - 30, 120, 22, 'MENU', () => this.scene.start('Title'), { fill: 0x5a3a7a }));
  }

  // ------------------------------------------------------------------ HUD
  private setMood(mood: 'idle' | 'cheer' | 'hurt', ms = 0): void {
    this.hero.setTexture(`hero_${mood}`);
    this.heroTween?.stop();
    this.hero.y = 172;
    if (mood === 'idle') this.heroTween = this.tweens.add({ targets: this.hero, y: 170, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    else if (mood === 'cheer') this.heroTween = this.tweens.add({ targets: this.hero, y: 166, duration: 140, yoyo: true, repeat: 3 });
    if (ms && mood !== 'idle' && ms < 50000) this.time.delayedCall(ms, () => !this.ended && this.setMood('idle'));
  }

  private refreshPips(colour?: number): void {
    this.pips.forEach((row, c) => {
      row.forEach((p, i) => {
        const on = i < this.g.infection[c];
        const was = p.texture.key === 'pip_on';
        p.setTexture(on ? 'pip_on' : 'pip_off');
        if (on && !was && (colour === undefined || colour === c)) this.tweens.add({ targets: p, scale: { from: 2.2, to: 1 }, duration: 250, ease: 'Back.easeOut' });
      });
    });
  }

  private refreshHud(): void {
    const g = this.g;
    const max = g.level.digestMax;
    this.digestSegs.forEach((seg, i) => {
      if (i < g.digest) seg.setTint(this.digestColour(i / (max - 1)));
      else seg.setTint(0x4e2a42);
    });
    const left = max - g.digest;
    this.digestLeft.setText(`${left} LEFT`).setColor(left <= 4 ? C.bad : C.text);
    const [two, three] = g.level.stars;
    this.scoreLabel.setText(`${g.score} / ${g.level.quota}`);
    this.quotaFill.setScale(Math.min(1, g.score / three) * 224, 9);
    [g.level.quota, two, three].forEach((v, i) => this.starImgs[i].setTexture(g.score >= v ? 'star_on' : 'star_off'));
    this.bolts.forEach((b, i) => b.setTexture(i < g.energy ? 'bolt_on' : 'bolt_off'));
    this.refreshPips();
    const can = g.canEscape();
    const bonus = (max - g.digest) * ESCAPE_BONUS_PER_TICK;
    this.escapeBtn.setEnabled(can && !this.ended).setLabel('ESCAPE', can ? `+${bonus} BONUS` : `QUOTA ${g.level.quota}`).setGlow(can && !this.ended);
    const idle = g.phase === 'play' && !this.ended && g.noMovesLeft();
    this.squeezeBtn.setGlow(idle);
    if (can && !this.exitOpened) void this.openExit();
  }

  private digestColour(t: number): number {
    if (t > 0.8) return 0xff4a4a;
    if (t > 0.55) return 0xff9a3a;
    if (t > 0.3) return 0xffd042;
    return 0x6bdc3c;
  }

  private setHint(text: string, color: number = C.text): void {
    this.hint.setText(text).setColor(color);
  }

  private flashHint(text: string, color: number): void {
    this.setHint(text, color);
    this.time.delayedCall(1400, () => this.autoHint());
  }

  private autoHint(): void {
    const g = this.g;
    if (this.ended) return;
    if (this.selected >= 0 && g.hand[this.selected]) {
      this.setHint(TOOLS[g.hand[this.selected].tool].hint, C.accent);
      return;
    }
    if (g.noMovesLeft()) this.setHint('OUT OF MOVES! SQUEEZE (SPACE).', C.accent);
    else if (g.canEscape()) this.setHint('QUOTA MET! ESCAPE OR PUSH YOUR LUCK.', C.good);
    else if (g.turn === 1) this.setHint('PICK A TOOL, THEN TAP THE BELT.', C.text);
    else if (this.dangerNearAcid()) this.setHint('BUGS ARE NEARING THE ACID!', C.bad);
    else if (g.level.digestMax - g.digest <= 4) this.setHint('DIGESTION IS ALMOST DONE!', C.bad);
    else this.setHint('PICK A TOOL, THEN TAP THE BELT.', C.textDim);
  }

  private dangerNearAcid(): boolean {
    for (let r = 0; r < ROWS; r++) for (let c = COLS - 2; c < COLS; c++) if (this.g.at(r, c)?.kind === 'bug') return true;
    return false;
  }

  // ------------------------------------------------------------------ per-frame
  update(time: number): void {
    // bugs wiggle, everything bobs a pixel
    this.cells.forEach((cs) => {
      if (!cs.img.active) return;
      const cell = cs.cell;
      if (cell.kind === 'bug') cs.img.setTexture(`bug_${cell.colour}_${Math.floor((time + cell.id * 137) / 320) % 2}`);
      cs.img.y = cs.baseY + (Math.floor((time + cell.id * 97) / 500) % 2 === 0 ? 0 : -1);
    });
    this.drawPreview(time);
  }

  private drawPreview(time: number): void {
    const hl = this.hl;
    hl.clear();
    if (this.busy || this.ended || this.selected < 0) return;
    const card = this.g.hand[this.selected];
    if (!card) return;
    const tool = card.tool;
    const col = TOOL_TINT[tool];
    const pulse = 0.35 + 0.25 * Math.sin(time / 180);
    // faint marks on every valid target
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const cell = this.g.at(r, c);
        if (!cell || cell.kind === 'bone' && tool !== 'pick' && tool !== 'shove') continue;
        const valid = tool === 'net' ? cell.kind === 'gem' : this.g.area(tool, r, c).length > 0;
        if (!valid) continue;
        const x = BOARD_X + c * CELL, y = BOARD_Y + r * CELL;
        hl.fillStyle(col, pulse);
        for (const [cx, cy] of [[x + 2, y + 2], [x + CELL - 5, y + 2], [x + 2, y + CELL - 5], [x + CELL - 5, y + CELL - 5]]) hl.fillRect(cx, cy, 3, 3);
      }
    // hover preview
    if (this.hover) {
      const area = this.g.area(tool, this.hover.r, this.hover.c);
      if (area.length) {
        for (const p of area) {
          const x = BOARD_X + p.c * CELL, y = BOARD_Y + p.r * CELL;
          hl.fillStyle(col, 0.28).fillRect(x + 1, y + 1, CELL - 1, CELL - 1);
          hl.lineStyle(2, col, 1).strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
        }
        if (tool === 'shove') {
          const p = area[0];
          const x = BOARD_X + (p.c - 1) * CELL, y = BOARD_Y + p.r * CELL;
          hl.lineStyle(1, col, 1).strokeRect(x + 4, y + 4, CELL - 8, CELL - 8);
        }
      } else {
        const x = BOARD_X + this.hover.c * CELL, y = BOARD_Y + this.hover.r * CELL;
        hl.lineStyle(1, 0xff5a5a, 0.8).strokeRect(x + 3, y + 3, CELL - 6, CELL - 6);
      }
    }
    void H;
  }
}
