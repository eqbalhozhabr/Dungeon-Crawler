import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import {
  ACID_X, BOARD_X, BOARD_Y, C, CARD_H, CARD_W, CELL, COLOUR_UI, COLS, EXIT_X, FP, GHOST_X, H, HAND_Y, PANEL_X, ROWS, W,
  cellX, cellY, fpDist, fpLaneX, fpProject,
} from '../config';
import { DEBUG } from '../target';
import { ESCAPE_BONUS_PER_TICK, GutGame } from '../logic/game';
import { REWARD_POOL, tinyFrog } from '../logic/levels';
import { TOOLS } from '../logic/tools';
import type { Cell, GameEvent, Pos, ToolId } from '../logic/types';
import { Rng } from '../rng';
import { loadSave, writeSave, type ViewMode } from '../storage';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { showHelp } from './Title';

interface CellSprite {
  img: Phaser.GameObjects.Image;
  shadow?: Phaser.GameObjects.Image;
  warn?: Phaser.GameObjects.Image;
  cell: Cell;
  /** Logical belt position: -2..-1 = waiting at the mouth, 0..7 = on the belt, 8 = in the acid. May be fractional while moving. */
  col: number;
  row: number;
  /** True while an effect (fly to the score bar, squash...) owns the sprite. */
  free: boolean;
  ghost: boolean;
}

interface CardView {
  box: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  tool: ToolId;
  uid: number;
}

const TOOL_TINT: Record<ToolId, number> = {
  pick: 0xffe27a, zapper: 0x9ee7ff, net: 0xb7ffb0, shove: 0xffb59e, magnet: 0xff9aa8, broom: 0xffd27a, antidote: 0x9affc4,
};
const EPITAPHS_DIGESTED = [
  'THE FROG BURPS. YOU WERE A SNACK.',
  'DIGESTED. TASTES LIKE TINY MINER.',
  'YOU HAVE BECOME FROG ENERGY.',
  'SHOULD HAVE LEFT BY THE BACK DOOR.',
];
const EPITAPHS_SICK = ['TOO MANY BUGS. YOU FEEL GREEN.', 'EVEN THE FROG FEELS BAD FOR YOU.', 'INFECTION WINS THIS ROUND.'];

export class GameScene extends Phaser.Scene {
  private g!: GutGame;
  private carry: GutGame | null = null;
  private seed = 1;
  private view: ViewMode = 'fp';
  private cells = new Map<number, CellSprite>();
  private hand: CardView[] = [];
  private selected = -1;
  private hoverCard = -1;
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
  private orbLabel?: Label;
  private hint!: Label;
  private hero?: Phaser.GameObjects.Image;
  private heroTween?: Phaser.Tweens.Tween;
  private exitDoor!: Phaser.GameObjects.Image;
  private acid!: Phaser.GameObjects.Image;
  private wallTop?: Phaser.GameObjects.Image;
  private wallBot?: Phaser.GameObjects.Image;
  private squeezeBtn!: Button;
  private escapeBtn!: Button;
  private exitOpened = false;

  constructor() {
    super('Game');
  }

  init(data: { seed?: number; game?: GutGame; view?: ViewMode }): void {
    this.carry = data.game ?? null;
    this.seed = data.seed ?? Math.floor(Math.random() * 1e9);
    this.view = data.view ?? loadSave().view;
  }

  private get fp(): boolean {
    return this.view === 'fp';
  }

  // ------------------------------------------------------------------ setup
  create(): void {
    this.g = this.carry ?? new GutGame(tinyFrog(loadSave().extras), this.seed);
    this.seed = this.g.seed;
    this.cells.clear();
    this.hand = [];
    this.selected = -1;
    this.hoverCard = -1;
    this.busy = true;
    this.ended = false;
    this.pressing = false;
    this.hover = null;
    this.exitOpened = this.g.canEscape();
    this.digestSegs = [];
    this.starImgs = [];
    this.pips = [];
    this.bolts = [];
    this.hero = undefined;
    this.orbLabel = undefined;

    this.buildScenery();
    this.buildTopHud();
    if (this.fp) this.buildFpUi();
    else this.buildFlatUi();
    this.syncHand(!this.carry);
    this.buildItems();
    this.buildInput();
    this.refreshHud();
    if (this.exitOpened) this.showOpenDoor();

    sfx.startDrone();
    this.time.addEvent({ delay: 2600, loop: true, callback: () => !this.ended && Math.random() < 0.7 && sfx.gurgle() });

    if (DEBUG) (window as unknown as { __gut: unknown }).__gut = { scene: this };

    if (this.carry) {
      this.busy = false;
      this.autoHint();
    } else void this.intro();
  }

  private buildScenery(): void {
    if (this.fp) {
      this.add.image(0, 0, 'fp_bg').setOrigin(0).setDepth(0);
      this.acid = this.add.image(0, 204, 'fp_acid_0').setOrigin(0).setDepth(1);
      let f = 0;
      this.time.addEvent({ delay: 230, loop: true, callback: () => this.acid.setTexture(`fp_acid_${(f = (f + 1) % 4)}`) });
      const door = this.fpDoorPos();
      this.exitDoor = this.add.image(door.x, door.y, 'fp_exit_0').setScale(door.sx, door.sy).setDepth(2);
      new Label(this, door.x, door.y + door.sy * 21, 'EXIT', { align: 'center', color: C.text, depth: 3 });
      const reachP = fpProject(-2.5 * FP.lane, 0, fpDist(this.g.minCol - 0.5));
      new Label(this, reachP.x - 4, reachP.y - 4, 'OUT OF REACH', { align: 'right', color: 0xd9a93a, depth: 3 }).setAlpha(0.85);
      this.hl = this.add.graphics().setDepth(6);
      return;
    }
    this.add.image(0, 0, 'bg').setOrigin(0).setDepth(0);
    this.add.image(BOARD_X, BOARD_Y, 'board_bg').setOrigin(0).setDepth(1);
    this.add.image(GHOST_X, BOARD_Y, 'ghost_bg').setOrigin(0).setDepth(1);
    this.acid = this.add.image(ACID_X, BOARD_Y, 'acid_0').setOrigin(0).setDepth(1);
    let f = 0;
    this.time.addEvent({ delay: 230, loop: true, callback: () => this.acid.setTexture(`acid_${(f = (f + 1) % 4)}`) });
    this.exitDoor = this.add.image(EXIT_X, BOARD_Y, 'exit_0').setOrigin(0).setDepth(1);
    // dim the columns that are out of reach
    const far = this.g.minCol;
    if (far > 0) this.add.image(BOARD_X, BOARD_Y, 'px').setOrigin(0).setScale(far * CELL, ROWS * CELL).setTint(0x000000).setAlpha(0.38).setDepth(2);
    this.wallTop = this.add.image(0, BOARD_Y - 13, 'wall_top').setOrigin(0).setDepth(5);
    this.wallBot = this.add.image(0, BOARD_Y + ROWS * CELL - 1, 'wall_bot').setOrigin(0).setDepth(5);
    new Label(this, GHOST_X + CELL / 2, BOARD_Y - 11, 'NEXT', { align: 'center', color: C.accent, depth: 6 });
    if (far > 0) new Label(this, BOARD_X + (far * CELL) / 2, BOARD_Y - 11, 'OUT OF REACH', { align: 'center', color: 0xd9a93a, depth: 6 });
    new Label(this, ACID_X + CELL / 2, BOARD_Y - 11, 'ACID', { align: 'center', color: C.acid, depth: 6 });
    new Label(this, EXIT_X + CELL / 2, BOARD_Y - 11, 'EXIT', { align: 'center', color: C.text, depth: 6 });
    this.hl = this.add.graphics().setDepth(20);
  }

  private fpDoorPos(): { x: number; y: number; sx: number; sy: number } {
    const p = fpProject(FP.wall - 0.02, 1.4, 5.4);
    const s = (p.ppc * 1.8) / 40;
    return { x: p.x, y: p.y, sx: s * 0.5, sy: s };
  }

  private showOpenDoor(): void {
    this.exitDoor.setTexture(this.fp ? 'fp_exit_2' : 'exit_2');
  }

  private buildTopHud(): void {
    const lvl = this.g.level;
    new Label(this, 8, 3, 'DIGESTION', { color: C.textDim, depth: 12 });
    this.digestLeft = new Label(this, 224, 3, '', { align: 'right', color: C.text, depth: 12 });
    const segW = Math.floor(216 / lvl.digestMax) - 1;
    for (let i = 0; i < lvl.digestMax; i++) {
      this.digestSegs.push(this.add.image(8 + i * (segW + 1), 13, 'px').setOrigin(0).setScale(segW, 9).setDepth(12));
    }
    new Label(this, 248, 3, 'ESCAPE QUOTA', { color: C.textDim, depth: 12 });
    this.scoreLabel = new Label(this, 472, 3, '', { align: 'right', color: C.accent, depth: 12 });
    const barX = 248, barW = 224, top = lvl.stars[1];
    this.add.image(barX, 13, 'px').setOrigin(0).setScale(barW, 9).setTint(0x4e2a42).setDepth(12);
    this.quotaFill = this.add.image(barX, 13, 'px').setOrigin(0).setScale(0, 9).setTint(0xffd35a).setDepth(13);
    [lvl.quota, lvl.stars[0], lvl.stars[1]].forEach((v) => {
      const x = barX + Math.min(1, v / top) * (barW - 6);
      this.add.image(x - 1, 12, 'px').setOrigin(0).setScale(1, 11).setTint(0x1a0a14).setDepth(14);
      this.starImgs.push(this.add.image(x + 1, 18, 'star_off').setDepth(15));
    });
    this.hint = new Label(this, W / 2, this.fp ? 46 : 212, '', { scale: 2, align: 'center', color: C.text, depth: 30 });
  }

  private buildInfection(x: number, y0: number, dy: number, pipX: number, iconX: number): void {
    for (let c = 0; c < 4; c++) {
      const y = y0 + c * dy;
      this.add.image(iconX, y, `bug_${c}_0`).setScale(0.5).setDepth(12);
      const row: Phaser.GameObjects.Image[] = [];
      for (let i = 0; i < this.g.level.infectionMax; i++) row.push(this.add.image(pipX + i * 11, y, 'pip_off').setDepth(12));
      this.pips.push(row);
    }
    void x;
  }

  private buildFlatUi(): void {
    const lvl = this.g.level;
    new Label(this, PANEL_X, 43, lvl.name, { color: C.accent });
    new Label(this, PANEL_X, 54, 'INFECTION', { color: C.textDim });
    this.buildInfection(PANEL_X, 72, 15, PANEL_X + 28, PANEL_X + 8);
    new Label(this, PANEL_X + 50, 134, 'ENERGY', { color: C.textDim });
    for (let i = 0; i < lvl.maxEnergy; i++) this.bolts.push(this.add.image(PANEL_X + 58 + i * 16, 156, 'bolt_on').setScale(2).setDepth(8));
    this.hero = this.add.image(PANEL_X + 22, 172, 'hero_idle').setScale(2).setDepth(8);
    this.setMood('idle');
    this.squeezeBtn = new Button(this, 316, 228, 84, 38, 'SQUEEZE', () => this.doSqueeze(), { fill: 0x2e7a3a, sub: 'SPACE' }).setDepth(15);
    this.escapeBtn = new Button(this, 404, 228, 68, 38, 'ESCAPE', () => this.doEscape(), { fill: 0xb8731a, sub: `QUOTA ${lvl.quota}` }).setDepth(15);
    this.escapeBtn.setEnabled(false);
    this.utilButtons(BOARD_Y - 12);
  }

  private buildFpUi(): void {
    const lvl = this.g.level;
    new Label(this, 8, 60, 'INFECTION', { color: C.textDim, depth: 12 });
    this.buildInfection(0, 78, 15, 30, 14);
    // energy orb
    this.add.image(28, 243, 'orb').setDepth(14);
    this.orbLabel = new Label(this, 28, 236, '', { scale: 2, align: 'center', color: 0xffffff, depth: 15 });
    new Label(this, 28, 217, 'ENERGY', { align: 'center', color: C.textDim, depth: 15 });
    this.squeezeBtn = new Button(this, 396, 238, 80, 28, 'SQUEEZE', () => this.doSqueeze(), { fill: 0x2e7a3a, sub: 'SPACE' }).setDepth(15);
    this.escapeBtn = new Button(this, 396, 204, 80, 28, 'ESCAPE', () => this.doEscape(), { fill: 0xb8731a, sub: `QUOTA ${lvl.quota}` }).setDepth(15);
    this.escapeBtn.setEnabled(false);
    this.utilButtons(28);
  }

  private utilButtons(y: number): void {
    const mk = (x: number, label: string, fn: () => void, fill = 0x5a3a7a) => new Button(this, x, y, 18, 11, label, fn, { fill }).setDepth(40);
    mk(408, 'V', () => this.toggleView());
    mk(430, '?', () => this.openHelp());
    const snd = mk(452, sfx.muted ? 'X' : 'S', () => {
      sfx.setMuted(!sfx.muted);
      snd.setLabel(sfx.muted ? 'X' : 'S');
    });
  }

  private toggleView(): void {
    if (this.busy || this.ended || this.help) return;
    const next: ViewMode = this.fp ? 'flat' : 'fp';
    const save = loadSave();
    save.view = next;
    writeSave();
    this.scene.restart({ game: this.g, view: next });
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

  private openHelp(): void {
    if (this.help || this.ended || this.busy) return;
    this.busy = true;
    this.help = showHelp(this, () => {
      this.help = null;
      this.busy = false;
    });
  }

  // ------------------------------------------------------------------ geometry (both views)
  /** Centre of a belt cell on screen (used for effects and by the tests). */
  screenPos(r: number, c: number): { x: number; y: number } {
    if (this.fp) {
      const p = fpProject(fpLaneX(r), 0, fpDist(c));
      return { x: p.x, y: p.y - p.ppc * 0.4 };
    }
    return { x: cellX(c), y: cellY(r) };
  }

  /** Which belt cell is under a screen point? */
  private cellAt(x: number, y: number): Pos | null {
    if (this.fp) {
      if (y <= FP.yh + 2) return null;
      const d = (FP.f * (FP.camY - 0.45)) / (y - FP.yh);
      const X = ((x - FP.cx) * d) / FP.f;
      const r = Math.round(X / FP.lane + 2);
      const c = Math.round(11 - d);
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
      return { r, c };
    }
    const c = Math.floor((x - BOARD_X) / CELL);
    const r = Math.floor((y - BOARD_Y) / CELL);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
    return { r, c };
  }

  /** Floor quad of a belt cell (first-person highlights). */
  private floorQuad(r: number, c: number, grow = 0): { x: number; y: number }[] {
    const x0 = (r - 2.5) * FP.lane - grow, x1 = (r - 1.5) * FP.lane + grow;
    const dn = fpDist(c) - 0.5 - grow, df = fpDist(c) + 0.5 + grow;
    return [fpProject(x0, 0, dn), fpProject(x1, 0, dn), fpProject(x1, 0, df), fpProject(x0, 0, df)].map((p) => ({ x: p.x, y: p.y }));
  }

  // ------------------------------------------------------------------ items
  private buildItems(): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.g.at(r, c);
        if (cell) this.makeSprite(cell, c, r, false);
      }
      const inc = this.g.incoming[r];
      if (inc) this.makeSprite(inc, -1, r, true);
    }
  }

  private makeSprite(cell: Cell, col: number, row: number, ghost: boolean): CellSprite {
    const key = cell.kind === 'gem' ? `gem_${cell.colour}` : cell.kind === 'bug' ? `bug_${cell.colour}_0` : 'bone';
    const img = this.add.image(0, 0, key).setDepth(10);
    if (this.fp) img.setOrigin(0.5, 1);
    const cs: CellSprite = { img, cell, col, row, free: false, ghost };
    if (this.fp) cs.shadow = this.add.image(0, 0, 'shadow').setDepth(5).setAlpha(0.4);
    if (cell.kind === 'bug') cs.warn = this.add.image(0, 0, 'warn').setDepth(35).setVisible(false);
    this.cells.set(cell.id, cs);
    this.place(cs, this.time.now);
    return cs;
  }

  private releaseExtras(cs: CellSprite): void {
    cs.shadow?.destroy();
    cs.warn?.destroy();
    cs.shadow = undefined;
    cs.warn = undefined;
  }

  /** Position/scale a sprite from its logical column + row. Called every frame. */
  private place(cs: CellSprite, time: number): void {
    if (cs.free || !cs.img.active) return;
    const { cell } = cs;
    const reach = cs.col >= this.g.minCol - 0.5 || cs.ghost;
    const hop = cell.kind === 'bug' ? Math.abs(Math.sin((time + cell.id * 97) / 260)) : Math.sin((time + cell.id * 97) / 420) * 0.5 + 0.5;
    let top: number;
    if (this.fp) {
      const p = fpProject(fpLaneX(cs.row), 0, fpDist(cs.col));
      const sc = (p.ppc * FP.lane * 0.74) / 24;
      const lift = Math.round(hop * p.ppc * (cell.kind === 'bug' ? 0.08 : 0.05));
      cs.img.setScale(sc).setPosition(Math.round(p.x), Math.round(p.y + p.ppc * 0.08) - lift).setDepth(10 + cs.col);
      cs.shadow?.setScale((p.ppc * FP.lane * 0.7) / 24, (p.ppc * FP.lane * 0.5) / 24).setPosition(Math.round(p.x), Math.round(p.y + p.ppc * 0.08));
      top = cs.img.y - cs.img.displayHeight;
    } else {
      cs.img.setPosition(cellX(cs.col), cellY(cs.row) + (Math.floor((time + cell.id * 97) / 500) % 2 === 0 ? 0 : -1));
      top = cs.img.y - cs.img.displayHeight / 2;
    }
    if (cell.kind === 'bug') cs.img.setTexture(`bug_${cell.colour}_${Math.floor((time + cell.id * 137) / 320) % 2}`);
    if (reach) cs.img.clearTint();
    else cs.img.setTint(0x8f7f99);
    cs.img.setAlpha(cs.ghost ? 0.5 : 1);
    // danger marker: this bug reaches the acid at the next squeeze
    if (cs.warn) {
      const danger = cell.kind === 'bug' && Math.round(cs.col) === COLS - 1 && !cs.ghost && this.g.phase === 'play';
      cs.warn.setVisible(danger);
      if (danger) {
        const lethal = this.g.infection[cell.colour] + 1 >= this.g.level.infectionMax;
        cs.warn.setPosition(Math.round(cs.img.x), Math.round(top - 8 + Math.sin(time / 120) * (lethal ? 2 : 1)));
        cs.warn.setAlpha(lethal ? 0.65 + 0.35 * Math.sin(time / 90) : 1).setScale(this.fp ? 1.2 : 1);
      }
    }
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
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!this.pressing) return;
      this.pressing = false;
      const cell = this.cellAt(p.x, p.y);
      this.hover = p.wasTouch ? null : cell;
      if (!cell || this.busy || this.selected < 0) return;
      void this.tryPlay(this.selected, cell.r, cell.c);
    });
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => {
      this.pressing = false;
      this.hover = p.wasTouch ? null : this.hover;
    });

    const kb = this.input.keyboard;
    if (kb) {
      ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'].forEach((k, i) => kb.on(`keydown-${k}`, () => this.pressCard(i)));
      kb.on('keydown-SPACE', () => this.doSqueeze());
      kb.on('keydown-ENTER', () => this.doSqueeze());
      kb.on('keydown-E', () => this.doEscape());
      kb.on('keydown-M', () => sfx.setMuted(!sfx.muted));
      kb.on('keydown-V', () => this.toggleView());
      kb.on('keydown-BACKSPACE', () => this.select(-1));
    }
  }

  private pressCard(i: number): void {
    if (this.busy || this.ended) return;
    sfx.unlock();
    const card = this.g.hand[i];
    if (!card) return;
    if (!this.g.canPlay(i) || !this.g.hasTarget(card.tool)) {
      sfx.nope();
      this.flashHint(this.g.canPlay(i) ? 'NO VALID TARGET FOR THAT TOOL.' : 'NOT ENOUGH ENERGY FOR THAT TOOL.', C.bad);
      return;
    }
    if (TOOLS[card.tool].self) {
      void this.tryPlay(i, 0, 0);
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
  private cardPos(i: number, raised: boolean): { x: number; y: number } {
    if (this.fp) return { x: FP.handX + i * (CARD_W + 4), y: raised ? H - CARD_H - 3 : H - FP.peek };
    return { x: 48 + i * (CARD_W + 4), y: raised ? HAND_Y - 3 : HAND_Y };
  }

  /** Centre of a hand card as shown right now (used by the tests). */
  cardPoint(i: number): { x: number; y: number } {
    const p = this.cardPos(i, false);
    return { x: p.x + CARD_W / 2, y: this.fp ? H - 8 : p.y + CARD_H / 2 };
  }

  private syncHand(deal: boolean): void {
    this.hand.forEach((c) => c.box.destroy());
    this.hand = [];
    this.g.hand.forEach((card, i) => {
      const tool = TOOLS[card.tool];
      const pos = this.cardPos(i, false);
      const box = this.add.container(pos.x, pos.y).setDepth(this.fp ? 25 : 14);
      const bg = this.add.image(0, 0, 'card').setOrigin(0);
      const icon = this.add.image(18, 13, `ico_${card.tool}`);
      const name = new Label(this, CARD_W / 2, 29, tool.name, { align: 'center', color: C.text });
      const key = new Label(this, 4, 4, String(i + 1), { color: C.textDim, shadow: false });
      box.add([bg, icon, name, key]);
      for (let k = 0; k < tool.cost; k++) box.add(this.add.image(CARD_W - 12 - (tool.cost - 1 - k) * 9, 13, 'bolt_on'));
      if (tool.cost === 0) box.add(new Label(this, CARD_W - 8, 9, '0', { align: 'right', color: C.textDim, shadow: false }));
      box.setSize(CARD_W, CARD_H);
      box.setInteractive(new Phaser.Geom.Rectangle(CARD_W / 2, CARD_H / 2, CARD_W, CARD_H), Phaser.Geom.Rectangle.Contains);
      box.on('pointerover', () => {
        this.hoverCard = this.g.hand.findIndex((h) => h.uid === card.uid);
        this.refreshHand();
      });
      box.on('pointerout', () => {
        this.hoverCard = -1;
        this.refreshHand();
      });
      box.on('pointerdown', () => {
        this.pressing = false;
        this.pressCard(this.hand.findIndex((h) => h.uid === card.uid));
      });
      this.hand.push({ box, bg, icon, tool: card.tool, uid: card.uid });
      if (deal) {
        box.y = H + 10;
        this.tweens.add({ targets: box, y: pos.y, duration: 240, delay: i * 70, ease: 'Back.easeOut' });
      }
    });
    this.refreshHand(!deal);
  }

  private refreshHand(setPos = true): void {
    this.hand.forEach((cv, i) => {
      const idx = this.g.hand.findIndex((h) => h.uid === cv.uid);
      const ok = idx >= 0 && this.g.canPlay(idx) && this.g.hasTarget(cv.tool);
      const sel = idx === this.selected && idx >= 0;
      cv.bg.setTexture(sel ? 'card_sel' : ok ? 'card' : 'card_dim');
      cv.icon.setAlpha(ok ? 1 : 0.45);
      if (!setPos) return;
      const raised = this.fp ? sel || (idx === this.hoverCard && !this.busy) : sel;
      const pos = this.cardPos(i, raised);
      cv.box.setPosition(pos.x, pos.y);
    });
  }

  // ------------------------------------------------------------------ play
  private async tryPlay(handIndex: number, r: number, c: number): Promise<void> {
    const tool = this.g.hand[handIndex]?.tool;
    if (!tool) return;
    if (!TOOLS[tool].self && !this.g.area(tool, r, c).length) {
      sfx.nope();
      this.flashHint(c < this.g.minCol ? 'TOO FAR AWAY. IT HAS TO COME CLOSER.' : 'THAT TOOL CANNOT TARGET THIS.', C.bad);
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
    if (tool === 'pick' || tool === 'broom') sfx.pick();
    else if (tool === 'zapper') sfx.zap();
    else if (tool === 'net' || tool === 'magnet') sfx.net();
    else if (tool === 'antidote') sfx.open();
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
    let gi = 0;
    for (const e of ev) {
      if (e.t === 'kill') {
        const cs = this.cells.get(e.id);
        this.cells.delete(e.id);
        if (cs) jobs.push(this.killFx(cs, e.colour));
      } else if (e.t === 'collect') {
        const cs = this.cells.get(e.id);
        this.cells.delete(e.id);
        if (cs) jobs.push(this.collectFx(cs, gi++));
      } else if (e.t === 'move') {
        const cs = this.cells.get(e.id);
        if (cs) jobs.push(this.tween({ targets: cs, col: e.toC, duration: 150, ease: 'Quad.easeOut' }));
      } else if (e.t === 'score') {
        const p = this.screenPos(e.r, e.c);
        this.float(p.x, p.y - 8, `+${e.pts}`, C.accent, 2);
        if (e.label) this.float(p.x, p.y + 8, e.label, e.label.startsWith('SET') ? 0xffffff : C.text, 1);
        this.setMood('cheer', 700);
      } else if (e.t === 'heal') {
        this.refreshPips();
        this.float(W / 2, H / 2 - 20, 'CURED!', C.good, 3);
      }
    }
    if (tool === 'net' || tool === 'magnet' || tool === 'broom') jobs.push(this.sweepFx(tool, at));
    if (tool === 'pick') this.pickFx(at);
    await Promise.all(jobs);
  }

  private pickFx(at: Pos): void {
    const p = this.screenPos(at.r, at.c);
    const f = this.add.image(p.x, p.y, 'px').setScale(this.fp ? 18 : CELL - 4).setTint(0xffffff).setAlpha(0.7).setDepth(40);
    this.tweens.add({ targets: f, alpha: 0, scale: this.fp ? 34 : CELL, duration: 160, onComplete: () => f.destroy() });
    this.cameras.main.shake(70, 0.0025);
  }

  private sweepFx(tool: ToolId, at: Pos): Promise<void> {
    let p: { x: number; y: number };
    if (tool === 'net') {
      const r = Math.min(at.r, ROWS - 2), c = Math.min(at.c, COLS - 2);
      const a = this.screenPos(r, c), b = this.screenPos(r + 1, c + 1);
      p = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    } else p = this.screenPos(at.r, at.c);
    const key = tool === 'net' ? 'ico_net' : tool === 'magnet' ? 'ico_magnet' : 'ico_broom';
    const img = this.add.image(p.x, p.y, key).setScale(this.fp ? 5 : 6).setAlpha(0.95).setDepth(40);
    return this.tween({ targets: img, scale: this.fp ? 3.4 : 4, alpha: 0, angle: tool === 'broom' ? -30 : 12, duration: 320, ease: 'Quad.easeOut', onComplete: () => img.destroy() });
  }

  private zapFx(kills: Extract<GameEvent, { t: 'kill' }>[], at: Pos): void {
    if (!kills.length) return;
    const gfx = this.add.graphics().setDepth(41);
    const colour = COLOUR_UI[kills[0].colour];
    const a = this.screenPos(at.r, at.c);
    for (const k of kills) {
      const b = this.screenPos(k.r, k.c);
      if (b.x === a.x && b.y === a.y) continue;
      const pts: Phaser.Math.Vector2[] = [new Phaser.Math.Vector2(a.x, a.y)];
      for (let i = 1; i < 4; i++) {
        const t = i / 4;
        pts.push(new Phaser.Math.Vector2(Math.round(a.x + (b.x - a.x) * t + Phaser.Math.Between(-5, 5)), Math.round(a.y + (b.y - a.y) * t + Phaser.Math.Between(-5, 5))));
      }
      pts.push(new Phaser.Math.Vector2(b.x, b.y));
      gfx.lineStyle(3, colour, 0.9).strokePoints(pts);
      gfx.lineStyle(1, 0xffffff, 1).strokePoints(pts);
    }
    this.tweens.add({ targets: gfx, alpha: 0, duration: 260, onComplete: () => gfx.destroy() });
  }

  private killFx(cs: CellSprite, colour: number): Promise<void> {
    cs.free = true;
    this.releaseExtras(cs);
    this.burst(cs.img.x, cs.img.y - (this.fp ? cs.img.displayHeight / 2 : 0), COLOUR_UI[colour] ?? 0xffffff, 9);
    cs.img.setTint(0xffffff);
    return this.tween({
      targets: cs.img,
      scaleX: cs.img.scaleX * 1.4,
      scaleY: cs.img.scaleY * 0.2,
      alpha: 0,
      duration: 200,
      ease: 'Quad.easeIn',
      onComplete: () => cs.img.destroy(),
    });
  }

  private collectFx(cs: CellSprite, i: number): Promise<void> {
    cs.free = true;
    this.releaseExtras(cs);
    if (this.fp) {
      const h = cs.img.displayHeight;
      cs.img.setOrigin(0.5).setPosition(cs.img.x, cs.img.y - h / 2);
    }
    this.burst(cs.img.x, cs.img.y, 0xffffff, 6);
    cs.img.clearTint().setDepth(60);
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
      },
    });
  }

  private burst(x: number, y: number, colour: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const p = this.add.image(x, y, 'px').setTint(colour).setScale(Phaser.Math.Between(2, 3)).setDepth(70);
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
    const l = new Label(this, x, y, text, { align: 'center', color, scale, depth: 75 });
    this.tweens.add({ targets: l, y: y - 18, alpha: 0, duration: 900, delay: 150, ease: 'Quad.easeOut', onComplete: () => l.destroy() });
  }

  /** Whole-screen colour flash (red when you get infected). */
  private flash(color: number, alpha: number, ms: number): void {
    const f = this.add.rectangle(0, 0, W, H, color, alpha).setOrigin(0).setDepth(90);
    this.tweens.add({ targets: f, alpha: 0, duration: ms, ease: 'Quad.easeOut', onComplete: () => f.destroy() });
  }

  // ------------------------------------------------------------------ squeeze
  private async doSqueeze(): Promise<void> {
    if (this.busy || this.ended || this.g.phase !== 'play') return;
    sfx.unlock();
    this.busy = true;
    this.select(-1);
    this.hoverCard = -1;
    this.hl.clear();
    this.hand.forEach((h) => this.tweens.add({ targets: h.box, y: H + 12, duration: 160 }));

    sfx.squeeze();
    this.cameras.main.shake(260, 0.004);
    if (this.wallTop && this.wallBot) {
      this.tweens.add({ targets: this.wallTop, y: BOARD_Y - 11, duration: 130, yoyo: true, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: this.wallBot, y: BOARD_Y + ROWS * CELL - 3, duration: 130, yoyo: true, ease: 'Sine.easeInOut' });
    }

    const ev = this.g.squeeze();
    const jobs: Promise<void>[] = [];
    const acidJobs: Promise<void>[] = [];
    for (const e of ev) {
      if (e.t === 'advance') {
        const cs = this.cells.get(e.id);
        if (!cs) continue;
        if (cs.ghost) {
          cs.ghost = false;
        }
        jobs.push(this.tween({ targets: cs, col: e.toC, duration: 320, ease: 'Sine.easeInOut', delay: 60 }));
      } else if (e.t === 'acid') {
        const cs = this.cells.get(e.id);
        this.cells.delete(e.id);
        if (cs) acidJobs.push(this.dissolve(cs, e.kind, e.colour));
      } else if (e.t === 'infect') {
        this.time.delayedCall(420, () => {
          sfx.hurt();
          this.setMood('hurt', 900);
          this.cameras.main.shake(180, 0.006);
          this.flash(0xff2a2a, 0.5, 450);
          this.refreshPips(e.colour);
        });
      } else if (e.t === 'incoming') {
        const cs = this.makeSprite({ id: e.id, kind: e.kind, colour: e.colour }, -2, e.r, true);
        jobs.push(this.tween({ targets: cs, col: -1, duration: 320, ease: 'Sine.easeInOut', delay: 60 }));
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
    const cy = cs.img.y - (this.fp ? cs.img.displayHeight / 2 : 0);
    this.burst(cs.img.x, cy, kind === 'bug' ? COLOUR_UI[colour] : 0x9bff5a, 10);
    return this.tween({
      targets: cs.img,
      delay: 330,
      alpha: 0,
      scaleY: cs.img.scaleY * 0.2,
      duration: 280,
      onStart: () => {
        cs.free = true;
        this.releaseExtras(cs);
      },
      onComplete: () => cs.img.destroy(),
    });
  }

  // ------------------------------------------------------------------ exit / end states
  private async openExit(): Promise<void> {
    if (this.exitOpened) return;
    this.exitOpened = true;
    sfx.open();
    this.exitDoor.setTexture(this.fp ? 'fp_exit_1' : 'exit_1');
    await this.wait(160);
    this.showOpenDoor();
    this.tweens.add({ targets: this.exitDoor, alpha: { from: 1, to: 0.8 }, duration: 380, yoyo: true, repeat: -1 });
    const t = new Label(this, W / 2, 90, 'EXIT OPEN!', { scale: 4, align: 'center', color: C.accent, depth: 80 });
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
    this.hand.forEach((h) => this.tweens.add({ targets: h.box, y: H + 12, duration: 160 }));
    this.refreshHud();
    this.setHint('HERE WE GO...', C.accent);

    if (this.fp) {
      // dive into the exit door, flash, done
      const door = this.fpDoorPos();
      const cam = this.cameras.main;
      cam.pan(door.x, door.y, 850, 'Cubic.easeIn');
      cam.zoomTo(3.2, 850, 'Cubic.easeIn');
      await this.wait(780);
      sfx.pfft();
      this.flash(0xffffff, 1, 700);
      await this.wait(120);
      // stop the camera effects first, otherwise they would finish later and re-apply the zoom
      cam.panEffect.reset();
      cam.zoomEffect.reset();
      cam.setZoom(1).centerOn(W / 2, H / 2);
    } else {
      this.hero?.setVisible(false);
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
    }

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

  private newRun(): void {
    this.scene.restart({ seed: Math.floor(Math.random() * 1e9) });
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
    box.add(new Label(this, px + 40, py + 78, 'GEMS', { color: C.textDim }));
    box.add(new Label(this, px + pw - 40, py + 78, `${final - bonus}`, { align: 'right' }));
    box.add(new Label(this, px + 40, py + 90, `TIME BONUS (${bonus / ESCAPE_BONUS_PER_TICK} X ${ESCAPE_BONUS_PER_TICK})`, { color: C.textDim }));
    box.add(new Label(this, px + pw - 40, py + 90, `+${bonus}`, { align: 'right' }));
    box.add(new Label(this, px + 40, py + 106, 'TOTAL', { scale: 2, color: C.accent }));
    box.add(new Label(this, px + pw - 40, py + 106, `${final}`, { scale: 2, align: 'right', color: C.accent }));
    const best = loadSave().best[this.g.level.id];
    box.add(new Label(this, W / 2, py + 126, isBest ? 'NEW BEST!' : `BEST ${best?.score ?? final}`, { align: 'center', color: isBest ? C.accent : C.textDim }));
    box.add(new Button(this, px + 20, py + ph - 30, 130, 22, 'CHOOSE REWARD', () => {
      box.destroy();
      this.showReward();
    }, { fill: 0xb8731a }));
    box.add(new Button(this, px + pw - 130, py + ph - 30, 110, 22, 'MENU', () => this.scene.start('Title'), { fill: 0x5a3a7a }));
  }

  private showReward(): void {
    const rng = new Rng(this.seed + 77);
    const bag: ToolId[] = [];
    REWARD_POOL.forEach((t) => {
      const w = t === 'magnet' || t === 'broom' || t === 'antidote' ? 3 : 1;
      for (let i = 0; i < w; i++) bag.push(t);
    });
    const choices: ToolId[] = [];
    while (choices.length < 3) {
      const t = rng.pick(bag);
      if (!choices.includes(t)) choices.push(t);
    }

    const box = this.add.container(0, 0).setDepth(100);
    box.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.93).setOrigin(0).setInteractive());
    box.add(new Label(this, W / 2, 16, 'CHOOSE YOUR REWARD', { scale: 3, align: 'center', color: C.accent }));
    box.add(new Label(this, W / 2, 46, 'TAKE ONLY ONE. IT JOINS YOUR DECK.', { align: 'center', color: C.text }));
    let chosen = false;
    choices.forEach((tool, i) => {
      const def = TOOLS[tool];
      const x = 40 + i * 148, y = 78;
      const c = this.add.container(x, y);
      const bg = this.add.image(0, 0, 'card').setOrigin(0).setScale(2);
      c.add([bg, this.add.image(36, 30, `ico_${tool}`).setScale(2), new Label(this, CARD_W, 62, def.name, { scale: 2, align: 'center' })]);
      for (let k = 0; k < def.cost; k++) c.add(this.add.image(CARD_W * 2 - 22 - (def.cost - 1 - k) * 18, 26, 'bolt_on').setScale(2));
      c.add(new Label(this, CARD_W, 92, def.blurb[0], { align: 'center', color: C.text }));
      c.add(new Label(this, CARD_W, 102, def.blurb[1], { align: 'center', color: C.text }));
      c.setSize(CARD_W * 2, CARD_H * 2);
      c.setInteractive(new Phaser.Geom.Rectangle(CARD_W, CARD_H, CARD_W * 2, CARD_H * 2 + 30), Phaser.Geom.Rectangle.Contains);
      c.on('pointerover', () => !chosen && (bg.setTexture('card_sel'), (c.y = y - 4)));
      c.on('pointerout', () => !chosen && (bg.setTexture('card'), (c.y = y)));
      c.on('pointerup', () => {
        if (chosen) return;
        chosen = true;
        sfx.unlock();
        sfx.set();
        const save = loadSave();
        save.extras = [...save.extras, tool].slice(-10);
        writeSave();
        bg.setTexture('card_sel');
        box.add(new Label(this, W / 2, 214, `ADDED ${def.name} TO YOUR DECK!`, { scale: 2, align: 'center', color: C.good }));
        this.time.delayedCall(1100, () => this.newRun());
      });
      box.add(c);
    });
    box.add(new Button(this, W / 2 - 50, 236, 100, 22, 'NO THANKS', () => !chosen && this.newRun(), { fill: 0x5a3a7a }));
  }

  private lose(reason: 'sick' | 'digested'): void {
    this.ended = true;
    this.setMood('hurt', 99999);
    sfx.lose();
    const { box, px, py, pw, ph } = this.overlay();
    box.add(new Label(this, W / 2, py + 14, reason === 'sick' ? 'TOO SICK!' : 'DIGESTED!', { scale: 3, align: 'center', color: C.bad }));
    const lines = reason === 'sick' ? EPITAPHS_SICK : EPITAPHS_DIGESTED;
    box.add(new Label(this, W / 2, py + 56, lines[this.seed % lines.length], { align: 'center', color: C.text }));
    box.add(new Label(this, W / 2, py + 76, `SCORE ${this.g.score} OF ${this.g.level.quota} NEEDED`, { align: 'center', color: C.textDim }));
    box.add(new Label(this, W / 2, py + 96, reason === 'sick' ? 'TIP: ZAP BUGS BEFORE THEY REACH THE ACID.' : 'TIP: ESCAPE EARLY. LEFTOVER TIME IS BONUS.', { align: 'center', color: C.accent }));
    box.add(new Button(this, px + 20, py + ph - 30, 120, 22, 'TRY AGAIN', () => this.newRun(), { fill: 0x2e7a3a }));
    box.add(new Button(this, px + pw - 140, py + ph - 30, 120, 22, 'MENU', () => this.scene.start('Title'), { fill: 0x5a3a7a }));
  }

  // ------------------------------------------------------------------ HUD
  private setMood(mood: 'idle' | 'cheer' | 'hurt', ms = 0): void {
    if (!this.hero) return;
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

  private digestColour(t: number): number {
    if (t > 0.8) return 0xff4a4a;
    if (t > 0.55) return 0xff9a3a;
    if (t > 0.3) return 0xffd042;
    return 0x6bdc3c;
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
    this.orbLabel?.setText(String(g.energy));
    this.refreshPips();
    const can = g.canEscape();
    const bonus = (max - g.digest) * ESCAPE_BONUS_PER_TICK;
    this.escapeBtn.setEnabled(can && !this.ended).setLabel('ESCAPE', can ? `+${bonus} BONUS` : `QUOTA ${g.level.quota}`).setGlow(can && !this.ended);
    if (this.fp) this.escapeBtn.setVisible(can && !this.ended);
    const idle = g.phase === 'play' && !this.ended && g.noMovesLeft();
    this.squeezeBtn.setGlow(idle);
    if (can && !this.exitOpened) void this.openExit();
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
    else if (g.turn === 1) this.setHint(this.fp ? 'PICK A TOOL FROM YOUR HAND BELOW.' : 'PICK A TOOL, THEN TAP THE BELT.', C.text);
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
    this.cells.forEach((cs) => this.place(cs, time));
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
    const pulse = 0.3 + 0.25 * Math.sin(time / 180);
    const cellBox = (r: number, c: number, fillA: number, lineW: number, lineA: number, grow = 0) => {
      if (this.fp) {
        const q = this.floorQuad(r, c, grow);
        if (fillA) hl.fillStyle(col, fillA).fillPoints(q, true);
        if (lineW) hl.lineStyle(lineW, col, lineA).strokePoints(q, true);
      } else {
        const x = BOARD_X + c * CELL, y = BOARD_Y + r * CELL;
        if (fillA) hl.fillStyle(col, fillA).fillRect(x + 1, y + 1, CELL - 1, CELL - 1);
        if (lineW) hl.lineStyle(lineW, col, lineA).strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
      }
    };
    // faint marks on every valid target
    if (!TOOLS[tool].self) {
      for (let r = 0; r < ROWS; r++)
        for (let c = this.g.minCol; c < COLS; c++) {
          const cell = this.g.at(r, c);
          const valid = tool === 'broom' ? this.g.area(tool, r, c).length > 0 && !!cell : tool === 'net' ? cell?.kind === 'gem' : !!cell && this.g.area(tool, r, c).length > 0;
          if (valid) cellBox(r, c, pulse * 0.35, 1, pulse + 0.2);
        }
    }
    // hover preview
    if (this.hover) {
      const area = this.g.area(tool, this.hover.r, this.hover.c);
      if (area.length) {
        for (const p of area) cellBox(p.r, p.c, 0.32, 2, 1);
        if (tool === 'shove') cellBox(area[0].r, area[0].c - 1, 0, 1, 1, -0.2);
      } else cellBox(this.hover.r, this.hover.c, 0, 1, 0.5, -0.15);
    }
  }
}
