import Phaser from 'phaser';
import { sfx } from '../../audio/sfx';
import { C, FP, H, W } from '../../config';
import { Rng } from '../../rng';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { CARDS } from '../logic/cards';
import { Combat, currentCard, MAX_ENERGY, type EnemyState } from '../logic/combat';
import { ENEMIES } from '../logic/enemies';
import { FIXTURE_HELP, FIXTURE_NAMES } from '../logic/fixtures';
import { combatOpts, VARIANT_NAMES } from '../logic/run';
import type { CombatEvent, FixtureKind } from '../logic/types';
import { session } from '../session';
import { loadSalvage, writeSalvage } from '../storage';
import { CH, CW, floatText, isModal, makeCard, makeInteractive, showInspect, showReward, wait, type CardView } from '../ui';
import { addBelly, deckButton, HpBar, muteButton } from './common';
import { bobEase, isVintage, vk } from '../style';

const DEPTH = 5.5;
const K = FP.f / DEPTH;
const FLOOR_Y = Math.round(FP.yh + FP.camY * K);
const SLOTS: Record<number, number[]> = { 1: [0], 2: [-1.9, 1.9], 3: [-3.1, 0, 3.1] };
const BOSS_SLOTS = [-3.6, 0, 3.6];
const REST_Y = H - 62;
const HOVER_Y = H - 82;
const SEL_Y = H - 100;
const FIX_X = [40, 440];
const FIX_Y = 98;
const FIX_TEX: Record<FixtureKind, string> = { valve: 'prop_valve', cyst: 'prop_cyst', pod: 'prop_pod' };
const FIX_SHORT: Record<FixtureKind, string> = { valve: 'VALVE', cyst: 'CYST', pod: 'POD' };

interface EnemyView {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  bubble: Phaser.GameObjects.Container;
  bubBg: Phaser.GameObjects.Rectangle;
  bubBorder: Phaser.GameObjects.Rectangle;
  bubIcon: Phaser.GameObjects.Image;
  bubTxt: Label;
  hpFill: Phaser.GameObjects.Rectangle;
  hpTxt: Label;
  name: Label;
  status: Label;
  pips: Phaser.GameObjects.Image[];
  x: number;
  shown: number;
  gone: boolean;
}

interface FixView {
  img: Phaser.GameObjects.Image;
  label: Label;
  ring: Phaser.GameObjects.Arc;
  x: number;
}

export class SFightScene extends Phaser.Scene {
  private cb!: Combat;
  private ev: EnemyView[] = [];
  private fx: FixView[] = [];
  private cards = new Map<number, CardView>();
  private selected: number | null = null;
  private press: { uid: number; x: number; y: number; drag: boolean } | null = null;
  private busy = false;
  private hp!: HpBar;
  private shownHp = 0;
  private bolts: Phaser.GameObjects.Image[] = [];
  private drawTxt!: Label;
  private discardTxt!: Label;
  private moodTxt!: Label;
  private msg!: Label;
  private pstat!: Label;
  private aim!: Phaser.GameObjects.Graphics;
  private arrows: Phaser.GameObjects.Triangle[] = [];
  private flipBtn?: Button;
  private flash!: Phaser.GameObjects.Rectangle;
  private seenHand = new Set<number>();
  private alive = true;

  constructor() {
    super('SFight');
  }

  create(): void {
    const run = session.run!;
    const room = session.room!;
    this.alive = true;
    this.events.once('shutdown', () => (this.alive = false));
    this.ev = [];
    this.fx = [];
    this.cards.clear();
    this.seenHand.clear();
    this.selected = null;
    this.press = null;
    this.busy = true;
    this.arrows = [];
    this.bolts = [];
    this.data.set('modal', 0);
    this.cb = new Combat(run.deck, run.hp, run.maxHp, room.enemies!, new Rng(run.rng.int(1e9)), combatOpts(room));
    this.shownHp = this.cb.hp;
    this.cameras.main.fadeIn(250, 10, 3, 8);
    addBelly(this, room.kind === 'boss' ? 'rust' : 'pink');

    const n = room.enemies!.length;
    const slots = room.kind === 'boss' ? BOSS_SLOTS : SLOTS[n];
    this.cb.enemies.forEach((e, i) => this.buildEnemy(e, i, FP.cx + slots[i] * K));
    this.cb.fixtures.forEach((f, i) => this.buildFixture(f.kind, i));
    if (isVintage()) {
      let boil = false;
      this.time.addEvent({
        delay: 170,
        loop: true,
        callback: () => {
          boil = !boil;
          this.cb.enemies.forEach((e, i) => !this.ev[i].gone && this.ev[i].sprite.setTexture(`en_${e.def.art}_v${boil ? '1' : ''}`));
        },
      });
    }

    this.hp = new HpBar(this, 6, 6, 60);
    this.hp.set(this.shownHp, this.cb.maxHp);
    this.pstat = new Label(this, 6, 48, '', { depth: 700, color: 0xffe9a8 });
    this.drawTxt = new Label(this, 6, H - 56, '', { depth: 700, color: C.textDim });
    this.discardTxt = new Label(this, W - 6, H - 40, '', { depth: 700, color: C.textDim, align: 'right' });
    this.moodTxt = new Label(this, W / 2, 6, '', { depth: 700, align: 'center', color: C.textDim });
    this.msg = new Label(this, W / 2, 18, '', { depth: 700, align: 'center', color: 0xffe9a8 });
    new Button(this, W - 80, H - 68, 74, 22, 'END TURN', () => this.endTurn(), { fill: 0x2f6a7a }).setDepth(700);
    deckButton(this, W - 80, 20);
    muteButton(this);
    this.aim = this.add.graphics().setDepth(800);
    this.flash = this.add.rectangle(0, 0, W, H, 0xff2a3a, 0).setOrigin(0).setDepth(750);

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.keyboard?.on('keydown-SPACE', () => this.endTurn());

    const intro: string[] = [];
    if (room.variant === 'thief') intro.push('A THIEF! KILL IT BEFORE IT ESCAPES WITH A CARD.');
    else if (room.variant === 'acid') intro.push('THE ACID RISES FROM TURN 3 AND HURTS EVERYONE.');
    else if (room.variant === 'ambush') intro.push('AMBUSH! THEY STRIKE FIRST.');
    else if (this.firstFight()) intro.push('TAP A CARD, THEN AN ENEMY. FLIP A CARD TO SEE BOTH SIDES.');
    else if (room.mood === 'hiccup') intro.push('THIS BELLY IS HICCUPY!');
    this.setMsg(intro[0] ?? '');
    sfx.startDrone?.();

    const ev = this.cb.start();
    this.refreshAll();
    void this.animate(ev).then(() => {
      if (!this.alive) return;
      this.refreshAll();
      this.busy = false;
      void this.checkEnd();
    });
  }

  private firstFight(): boolean {
    return session.run!.step <= 1;
  }

  // ------------------------------------------------------------------ build
  private buildEnemy(e: EnemyState, i: number, x: number): void {
    const sprite = this.add.image(x, FLOOR_Y, vk(`en_${e.def.art}`)).setOrigin(0.5, 1).setDepth(10 + i);
    sprite.setScale(e.def.boss ? 1 : e.def.elite ? 1.25 : 1.5);
    const shadow = this.add.ellipse(x, FLOOR_Y - 1, sprite.displayWidth * 0.8, 9, 0x000000, 0.4).setDepth(9);
    this.tweens.add({ targets: sprite, y: FLOOR_Y - 4, duration: 700 + i * 170, yoyo: true, repeat: -1, ease: bobEase() });
    const top = Math.max(36, FLOOR_Y - sprite.displayHeight - 14);
    const bubble = this.add.container(x, top).setDepth(40);
    const bubBg = this.add.rectangle(0, 0, 42, 16, C.ink, 0.88).setOrigin(0.5);
    const bubBorder = this.add.rectangle(0, 0, 42, 16).setStrokeStyle(1, C.panelEdge).setOrigin(0.5);
    const bubIcon = this.add.image(-13, 0, 'ic_i_attack').setScale(0.6);
    const bubTxt = new Label(this, 4, -3, '', { color: 0xffe0d0 });
    bubble.add([bubBg, bubBorder, bubIcon, bubTxt]);
    const by = FLOOR_Y + 5;
    this.add.rectangle(x, by, 42, 9, C.ink).setOrigin(0.5, 0).setDepth(40);
    this.add.rectangle(x - 20, by + 1, 40, 7, 0x4a1a28).setOrigin(0, 0).setDepth(40);
    const hpFill = this.add.rectangle(x - 20, by + 1, 40, 7, 0xe8505e).setOrigin(0, 0).setDepth(41);
    const hpTxt = new Label(this, x, by + 1, '', { align: 'center', depth: 42 });
    const name = new Label(this, x, by + 11, e.def.name, { align: 'center', depth: 40, color: 0xb89aa8 });
    const status = new Label(this, x, by + 20, '', { align: 'center', depth: 40 });
    this.ev.push({ sprite, shadow, bubble, bubBg, bubBorder, bubIcon, bubTxt, hpFill, hpTxt, name, status, pips: [], x, shown: e.hp, gone: false });
  }

  private buildFixture(kind: FixtureKind, i: number): void {
    const x = FIX_X[i % 2];
    const img = this.add.image(x, FIX_Y, vk(FIX_TEX[kind])).setScale(0.5).setDepth(12);
    const ring = this.add.circle(x, FIX_Y, 34).setStrokeStyle(2, 0x6ae8ff).setDepth(13).setVisible(false);
    this.tweens.add({ targets: ring, alpha: 0.35, duration: 400, yoyo: true, repeat: -1 });
    const label = new Label(this, x, FIX_Y + 32, FIXTURE_NAMES[kind], { align: 'center', depth: 14, color: 0xb8d8e0 });
    this.fx.push({ img, label, ring, x });
  }

  // ------------------------------------------------------------------ display sync
  private refreshAll(): void {
    this.hp.set(this.shownHp, this.cb.maxHp);
    this.cb.enemies.forEach((_, i) => this.refreshEnemy(i));
    this.refreshFixtures();
    this.refreshEnergy();
    this.syncHand();
    this.refreshMood();
    this.refreshPlayerStatus();
  }

  private refreshFixtures(): void {
    this.cb.fixtures.forEach((f, i) => {
      const v = this.fx[i];
      if (f.used) {
        v.img.setTint(0x444044).setAlpha(0.75);
        v.label.setText('SPENT').setColor(0x7a6a72);
      }
    });
  }

  private refreshPlayerStatus(): void {
    const t: string[] = [];
    if (this.cb.pDazzle > 0) t.push('DAZZLED: NEXT ATTACK HALF');
    if (this.cb.pBurn > 0) t.push(`BURNING ${this.cb.pBurn} TURNS`);
    if (this.cb.tied > 0) t.push('TIED: -1 ENERGY NEXT TURN');
    if (this.cb.peeked) t.push('PEEKING: FACES REVEALED');
    this.pstat.setText(t.join('\n'));
  }

  private bubbleSet(v: EnemyView, icon: string, text: string, color: number): void {
    v.bubIcon.setTexture(icon);
    v.bubTxt.setText(text).setColor(color);
    const w = Math.max(30, 22 + v.bubTxt.textWidth);
    v.bubBg.width = w;
    v.bubBorder.width = w;
    v.bubIcon.x = -w / 2 + 11;
    v.bubTxt.x = -w / 2 + 21;
  }

  private refreshEnemy(i: number): void {
    const e = this.cb.enemies[i];
    const v = this.ev[i];
    if (v.gone) return;
    v.hpFill.width = Math.max(0, Math.round((40 * v.shown) / e.max));
    v.hpTxt.setText(`${Math.max(0, v.shown)}/${e.max}`);
    const st: string[] = [];
    if (e.sleep > 0) st.push('ASLEEP');
    if (e.dazzle > 0) st.push('DAZZLED');
    if (e.burn > 0) st.push(`BURN ${e.burn}`);
    v.status.setText(st.join(' '));
    v.status.setColor(e.sleep > 0 ? 0x8ab8ff : e.dazzle > 0 ? 0xfff08a : 0xff9a4a);
    // what it will do
    const d = this.cb.describe(i);
    if (d.sleeping) this.bubbleSet(v, 'ic_i_idle', 'ZZ', 0x8ab8ff);
    else if (d.cardId) {
      const icon = `ic_${CARDS[d.cardId].icon}`;
      if (d.ambiguous) this.bubbleSet(v, icon, '?', 0xffd35a);
      else if (d.face === 'tool') this.bubbleSet(v, icon, FIX_SHORT[d.fixture!], 0x6ae8ff);
      else {
        const f = d.fight!;
        const per = e.dazzle > 0 ? Math.floor(f.n / 2) : f.n;
        if (f.kind === 'dmg') this.bubbleSet(v, icon, f.hits > 1 ? `${per}X${f.hits}` : String(per), e.dazzle > 0 ? 0xfff08a : 0xffc8b8);
        else if (f.kind === 'steal') this.bubbleSet(v, icon, `${per} STEAL`, 0xffd35a);
        else if (f.kind === 'heal') this.bubbleSet(v, icon, `+${f.n}`, 0xa8f0a0);
        else if (f.kind === 'status') this.bubbleSet(v, icon, f.label, 0xfff08a);
        else this.bubbleSet(v, icon, '', 0xffffff);
      }
    } else if (d.natural) {
      const it = d.natural;
      const per = e.dazzle > 0 ? Math.floor(it.n / 2) : it.n;
      this.bubbleSet(v, it.kind === 'drain' ? 'ic_i_drain' : it.kind === 'heal' ? 'ic_i_heal' : 'ic_i_attack', it.kind === 'heal' ? `+${it.n}` : it.hits ? `${per}X${it.hits}` : String(per), 0xffc8b8);
    }
    // the objects it still holds
    v.pips.forEach((p) => p.destroy());
    v.pips = [];
    const by = FLOOR_Y + 5 + 30;
    const n = e.kit.length;
    e.kit.forEach((id, k) => {
      const cur = k === e.kitIdx % n;
      const img = this.add.image(v.x + (k - (n - 1) / 2) * 14, by, `ic_${CARDS[id].icon}`).setScale(0.55).setDepth(41).setAlpha(cur ? 1 : 0.5);
      v.pips.push(img);
    });
  }

  private refreshEnergy(): void {
    this.bolts.forEach((b) => b.destroy());
    this.bolts = [];
    const total = Math.max(MAX_ENERGY, this.cb.energy);
    for (let i = 0; i < total; i++) {
      const b = this.add.image(7 + i * 11, 33, 'ui_bolt').setOrigin(0, 0).setDepth(700);
      if (i >= this.cb.energy) b.setTint(0x4a3a4a);
      this.bolts.push(b);
    }
    this.drawTxt.setText(`DRAW ${this.cb.drawPile.length}`);
    this.discardTxt.setText(`DISCARD ${this.cb.discard.length}`);
  }

  private refreshMood(): void {
    const parts: string[] = [];
    if (this.cb.mood === 'hiccup') parts.push(this.cb.hiccupNow ? 'HICCUP! ENEMIES ACT TWICE AFTER THIS TURN' : `HICCUPY BELLY, TURN ${this.cb.turn}`);
    else parts.push(`CALM BELLY, TURN ${this.cb.turn}`);
    if (this.cb.acidNow) parts.push(`ACID ${this.cb.acidNow}/TURN`);
    this.moodTxt.setText(parts.join('  ')).setColor(this.cb.hiccupNow ? 0xff7a6a : this.cb.acidNow ? 0x9be85a : C.textDim);
  }

  private setMsg(t: string): void {
    this.msg.setText(t);
  }

  // ------------------------------------------------------------------ hand
  private layout(n: number): { x0: number; step: number } {
    const step = Math.min(CW - 4, n > 1 ? (330 - CW) / (n - 1) : 0);
    const total = n > 1 ? step * (n - 1) + CW : CW;
    return { x0: Math.round(W / 2 - total / 2) - 4, step };
  }

  private syncHand(): void {
    this.cards.forEach((c) => c.destroy());
    this.cards.clear();
    this.flipBtn?.destroy();
    this.flipBtn = undefined;
    const hand = this.cb.hand;
    const { x0, step } = this.layout(hand.length);
    hand.forEach((inst, i) => {
      const playable = this.cb.costOf(inst) <= this.cb.energy;
      const view = makeCard(this, inst.id, { uid: inst.uid, bonus: inst.bonus, temp: inst.temp, free: inst.free, state: playable ? 'normal' : 'dim' });
      const x = x0 + i * step;
      const fresh = !this.seenHand.has(inst.uid);
      this.seenHand.add(inst.uid);
      const sel = this.selected === inst.uid;
      const y = sel ? SEL_Y : REST_Y;
      view.setPosition(x, fresh ? H + 10 : y).setDepth(100 + i);
      if (fresh) this.tweens.add({ targets: view, y, duration: 220, delay: i * 40, ease: 'Back.easeOut' });
      makeInteractive(view);
      view.input!.cursor = 'pointer';
      view.on('pointerover', () => {
        if (this.busy || this.press || this.selected === inst.uid) return;
        view.setY(HOVER_Y).setDepth(400);
      });
      view.on('pointerout', () => {
        if (this.selected === inst.uid || (this.press && this.press.uid === inst.uid)) return;
        view.setY(REST_Y).setDepth(100 + i);
      });
      view.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (this.busy || isModal(this)) return;
        if (p.rightButtonDown()) {
          this.inspectCard(inst.id);
          return;
        }
        this.press = { uid: inst.uid, x: p.x, y: p.y, drag: false };
      });
      if (sel) view.setDepth(450);
      this.cards.set(inst.uid, view);
    });
    this.drawArrows();
  }

  private select(uid: number | null): void {
    this.selected = uid;
    this.aim.clear();
    this.cards.forEach((v, id) => {
      const idx = this.cb.hand.findIndex((c) => c.uid === id);
      v.setY(id === uid ? SEL_Y : REST_Y).setDepth(id === uid ? 450 : 100 + idx);
    });
    this.flipBtn?.destroy();
    this.flipBtn = undefined;
    if (uid !== null) {
      const v = this.cards.get(uid);
      const inst = this.cb.card(uid);
      if (v && inst) {
        this.flipBtn = new Button(this, v.x + CW / 2 - 17, SEL_Y - 16, 34, 13, 'FLIP', () => this.inspectCard(inst.id), { fill: 0x4a3a6a }).setDepth(460) as Button;
      }
    }
    this.drawArrows();
    if (uid !== null) sfx.select();
    else sfx.deselect();
  }

  private inspectCard(id: string): void {
    sfx.select();
    showInspect(this, [id], CARDS[id].name, 'EVERY OBJECT HAS A FIGHT SIDE AND A TOOL SIDE');
  }

  private drawArrows(): void {
    this.arrows.forEach((a) => a.destroy());
    this.arrows = [];
    this.fx.forEach((f) => f.ring.setVisible(false));
    if (this.selected === null) return;
    const inst = this.cb.card(this.selected);
    if (!inst) return;
    if (CARDS[inst.id].target === 'enemy') {
      for (const i of this.cb.alive()) {
        const v = this.ev[i];
        const a = this.add.triangle(v.x, v.bubble.y - 16, 0, 0, 12, 0, 6, 8, 0xffd35a).setDepth(60);
        this.tweens.add({ targets: a, y: a.y + 4, duration: 320, yoyo: true, repeat: -1 });
        this.arrows.push(a);
      }
    }
    for (const f of this.cb.toolTargets(this.selected)) this.fx[f].ring.setVisible(true);
  }

  // ------------------------------------------------------------------ input
  private enemyAt(x: number, y: number): number | null {
    for (const i of this.cb.alive()) {
      const b = this.ev[i].sprite.getBounds();
      if (x >= b.x - 6 && x <= b.right + 6 && y >= b.y - 22 && y <= b.bottom + 30) return i;
    }
    return null;
  }

  private fixtureAt(x: number, y: number): number | null {
    for (let i = 0; i < this.fx.length; i++) if (Math.hypot(x - this.fx[i].x, y - FIX_Y) < 38) return i;
    return null;
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.busy || isModal(this)) return;
    if (this.press && !this.press.drag && Math.hypot(p.x - this.press.x, p.y - this.press.y) > 9) {
      this.press.drag = true;
      if (this.selected !== this.press.uid) this.select(this.press.uid);
    }
    this.drawAim(p);
  }

  private drawAim(p: Phaser.Input.Pointer): void {
    this.aim.clear();
    if (this.selected === null || p.y > H - 108) return;
    const view = this.cards.get(this.selected);
    const inst = this.cb.card(this.selected);
    if (!view || !inst) return;
    const need = CARDS[inst.id].target === 'enemy';
    if (!need && !(this.press?.drag)) return;
    const hitE = need ? this.enemyAt(p.x, p.y) : null;
    const hitF = this.fixtureAt(p.x, p.y);
    const okF = hitF !== null && this.cb.canTool(this.selected, hitF);
    const tx = okF ? this.fx[hitF!].x : hitE !== null ? this.ev[hitE].x : p.x;
    const ty = okF ? FIX_Y : hitE !== null ? this.ev[hitE].sprite.y - this.ev[hitE].sprite.displayHeight / 2 : p.y;
    const sx = view.x + CW / 2;
    const sy = SEL_Y;
    const len = Math.hypot(tx - sx, ty - sy);
    const good = okF || hitE !== null || !need;
    const col = okF ? 0x6ae8ff : good ? 0xffd35a : 0xa88a96;
    this.aim.fillStyle(col, 1);
    for (let t = 6; t < len - 6; t += 7) this.aim.fillRect(Math.round(sx + ((tx - sx) * t) / len), Math.round(sy + ((ty - sy) * t) / len), 2, 2);
    this.aim.lineStyle(1, col, 1).strokeCircle(tx, ty, good ? 9 : 5);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (this.busy || isModal(this)) return;
    const pr = this.press;
    this.press = null;
    this.aim.clear();
    if (pr) {
      const inst = this.cb.card(pr.uid);
      if (!inst) return;
      const def = CARDS[inst.id];
      if (pr.drag) {
        const hf = this.fixtureAt(p.x, p.y);
        if (hf !== null && this.cb.canTool(pr.uid, hf)) void this.doTool(pr.uid, hf);
        else if (def.target === 'enemy') {
          const hit = this.enemyAt(p.x, p.y);
          if (hit !== null) void this.doPlay(pr.uid, hit);
          else this.select(null);
        } else if (p.y < H - 110) void this.doPlay(pr.uid);
        else this.select(null);
        return;
      }
      if (this.selected === pr.uid) {
        if (def.target === 'none') void this.doPlay(pr.uid);
        else if (this.cb.alive().length === 1) void this.doPlay(pr.uid, this.cb.alive()[0]);
        else this.select(null);
      } else {
        this.select(pr.uid);
        const tt = this.cb.toolTargets(pr.uid);
        if (this.cb.costOf(inst) > this.cb.energy) {
          sfx.nope();
          this.setMsg('NOT ENOUGH ENERGY');
        } else if (tt.length) this.setMsg('TAP AN ENEMY TO FIGHT, OR THE GLOWING FIXTURE TO USE ITS TOOL SIDE');
        else if (def.target === 'enemy' && this.cb.alive().length > 1) this.setMsg('NOW TAP AN ENEMY');
        else this.setMsg('TAP THE CARD AGAIN TO USE IT');
      }
      return;
    }
    const hit = this.enemyAt(p.x, p.y);
    const hf = this.fixtureAt(p.x, p.y);
    if (this.selected !== null) {
      const inst = this.cb.card(this.selected);
      if (inst && hf !== null && this.cb.canTool(this.selected, hf)) void this.doTool(this.selected, hf);
      else if (inst && CARDS[inst.id].target === 'enemy' && hit !== null) void this.doPlay(this.selected, hit);
      else if (p.y < H - 105 && p.x < W - 90 && hit === null) this.select(null);
      return;
    }
    if (hit !== null) this.inspectEnemy(hit);
    else if (hf !== null) {
      const f = this.cb.fixtures[hf];
      this.setMsg(`${FIXTURE_NAMES[f.kind]}: ${f.used ? 'ALREADY USED' : FIXTURE_HELP[f.kind]}`);
    }
  }

  private inspectEnemy(i: number): void {
    const e = this.cb.enemies[i];
    sfx.select();
    if (!e.kit.length) {
      this.setMsg(`${e.def.name} HOLDS NOTHING. IT FIGHTS WITH ITS BARE HANDS.`);
      return;
    }
    const cur = currentCard(e)!;
    const rest = e.kit.filter((_, k) => k !== e.kitIdx % e.kit.length);
    showInspect(this, [cur, ...rest], `${e.def.name} PLAYS: ${CARDS[cur].name}`, 'IT MAY USE EITHER SIDE. YOU CANNOT TELL WHICH.');
  }

  // ------------------------------------------------------------------ actions
  private async doPlay(uid: number, tgt?: number): Promise<void> {
    if (this.busy) return;
    const inst = this.cb.card(uid);
    if (!inst) return;
    if (!this.cb.canPlay(uid, tgt)) {
      sfx.nope();
      this.setMsg(this.cb.costOf(inst) > this.cb.energy ? 'NOT ENOUGH ENERGY' : 'CANNOT USE THAT NOW');
      return;
    }
    const def = CARDS[inst.id];
    const dest = tgt !== undefined ? { x: this.ev[tgt].x, y: this.ev[tgt].sprite.y - this.ev[tgt].sprite.displayHeight / 2 } : { x: W / 2, y: 110 };
    const ev = this.cb.play(uid, tgt);
    await this.afterPlay(uid, dest, ev, def.target === 'enemy' ? 'shove' : 'set');
  }

  private async doTool(uid: number, f: number): Promise<void> {
    if (this.busy) return;
    const inst = this.cb.card(uid);
    if (!inst || !this.cb.canTool(uid, f)) {
      sfx.nope();
      return;
    }
    const ev = this.cb.playTool(uid, f);
    await this.afterPlay(uid, { x: this.fx[f].x, y: FIX_Y }, ev, 'open');
  }

  private async afterPlay(uid: number, dest: { x: number; y: number }, ev: CombatEvent[], snd: 'shove' | 'set' | 'open'): Promise<void> {
    this.busy = true;
    const view = this.cards.get(uid);
    this.selected = null;
    this.arrows.forEach((a) => a.destroy());
    this.arrows = [];
    this.fx.forEach((f) => f.ring.setVisible(false));
    this.flipBtn?.destroy();
    this.flipBtn = undefined;
    this.setMsg('');
    if (view) {
      view.setDepth(900);
      this.tweens.add({ targets: view, x: dest.x - CW / 2, y: dest.y - CH / 2, scale: 0.5, alpha: 0.2, duration: 200, ease: 'Cubic.easeIn' });
      await wait(this, 190);
      view.destroy();
      this.cards.delete(uid);
    }
    sfx[snd]();
    await this.animate(ev);
    if (!this.alive) return;
    this.refreshAll();
    this.busy = false;
    await this.checkEnd();
  }

  private async endTurn(): Promise<void> {
    if (this.busy || this.cb.result || isModal(this)) return;
    this.busy = true;
    this.select(null);
    this.setMsg('');
    this.cards.forEach((v) => this.tweens.add({ targets: v, y: H + 20, duration: 160, ease: 'Cubic.easeIn' }));
    await wait(this, 170);
    const ev = this.cb.endTurn();
    await this.animate(ev);
    if (!this.alive) return;
    this.refreshAll();
    this.busy = false;
    await this.checkEnd();
  }

  private async checkEnd(): Promise<void> {
    if (!this.cb.result || !this.alive) return;
    this.busy = true;
    const run = session.run!;
    const room = session.room!;
    run.hp = Math.max(0, this.cb.hp);
    for (const uid of this.cb.removedFromDeck()) run.remove(uid);
    if (this.cb.result === 'lose') {
      await wait(this, 700);
      run.lost = true;
      this.scene.start('SEnd');
      return;
    }
    await wait(this, 600);
    if (room.kind === 'boss') {
      run.won = true;
      this.scene.start('SEnd');
      return;
    }
    sfx.win();
    const opts = run.rewardOptions(3, { minRarity: room.kind === 'elite' ? 1 : 0 });
    const left = this.cb.leftovers().filter((id) => !opts.includes(id)).slice(0, 2);
    showReward(
      this,
      [...opts.map((id) => ({ id })), ...left.map((id) => ({ id, temp: true }))],
      { title: 'CHOOSE YOUR REWARD', sub: left.length ? 'TAKE ONLY ONE.  GREEN ONES WERE TAKEN FROM ENEMIES AND NOT USED' : 'TAKE ONLY ONE', noThanks: 'NO THANKS' },
      (id) => {
        if (id) run.add(id);
        run.advance();
        const s = loadSalvage();
        s.deepest = Math.max(s.deepest, run.step);
        writeSalvage();
        this.cameras.main.fadeOut(220, 10, 3, 8);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('SWalk'));
      },
    );
  }

  // ------------------------------------------------------------------ event animation
  private enemyMid(i: number): { x: number; y: number } {
    const v = this.ev[i];
    return { x: v.x, y: v.sprite.y - v.sprite.displayHeight / 2 };
  }

  private tint(color: number, alpha = 0.35, dur = 300): void {
    this.flash.setFillStyle(color).setAlpha(alpha);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: dur });
  }

  private flyIcon(fromX: number, fromY: number, icon: string, label: string, color: number): Promise<void> {
    const img = this.add.image(fromX, fromY, `ic_${icon}`).setDepth(900).setScale(1.6);
    floatText(this, fromX, fromY - 24, label, color);
    this.tweens.add({ targets: img, x: W / 2, y: H - 30, scale: 0.8, duration: 420, ease: 'Cubic.easeInOut', onComplete: () => img.destroy() });
    return wait(this, 440);
  }

  private async animate(events: CombatEvent[]): Promise<void> {
    for (const e of events) {
      if (!this.alive) return;
      switch (e.t) {
        case 'dmg': {
          const v = this.ev[e.i];
          const m = this.enemyMid(e.i);
          v.shown = Math.max(0, v.shown - e.n);
          sfx.pick();
          floatText(this, m.x, m.y - 10, `-${e.n}`, 0xffffff, 2);
          v.sprite.setTintFill(0xffffff);
          this.time.delayedCall(70, () => v.sprite.active && v.sprite.clearTint());
          this.tweens.add({ targets: v.sprite, x: v.x + 3, duration: 40, yoyo: true, repeat: 2 });
          this.cameras.main.shake(70, 0.003);
          this.refreshEnemy(e.i);
          if (e.fatal) {
            await wait(this, 120);
            v.gone = true;
            v.bubble.setVisible(false);
            v.status.setText('');
            v.pips.forEach((p) => p.destroy());
            v.pips = [];
            sfx.pfft();
            this.tweens.add({ targets: v.sprite, alpha: 0, scaleY: v.sprite.scaleY * 0.3, scaleX: v.sprite.scaleX * 1.25, duration: 300, ease: 'Cubic.easeIn' });
            this.tweens.add({ targets: [v.shadow, v.name, v.hpTxt, v.hpFill], alpha: 0, duration: 300 });
            await wait(this, 260);
          } else await wait(this, 140);
          break;
        }
        case 'status': {
          const m = this.enemyMid(e.i);
          floatText(this, m.x, m.y - 14, e.s === 'sleep' ? 'ZZZ' : e.s === 'dazzle' ? 'DAZZLED' : 'BURNING', e.s === 'sleep' ? 0x8ab8ff : e.s === 'dazzle' ? 0xfff08a : 0xff9a4a);
          sfx.zap();
          this.refreshEnemy(e.i);
          await wait(this, 160);
          break;
        }
        case 'pstatus':
          floatText(this, 70, 40, e.s === 'dazzle' ? 'DAZZLED!' : e.s === 'sleep' ? 'TIED UP!' : 'BURNING!', 0xfff08a);
          sfx.zap();
          this.tint(0xfff08a, 0.25);
          await wait(this, 220);
          break;
        case 'burn': {
          const m = this.enemyMid(e.i);
          floatText(this, m.x, m.y - 4, `BURN ${e.n}`, 0xff9a4a);
          sfx.sizzle();
          this.ev[e.i].shown = Math.max(0, this.ev[e.i].shown - e.n);
          this.refreshEnemy(e.i);
          await wait(this, 160);
          break;
        }
        case 'pburn':
          this.shownHp = Math.max(0, this.shownHp - e.n);
          this.hp.set(this.shownHp, this.cb.maxHp);
          floatText(this, 70, 36, `BURN -${e.n}`, 0xff9a4a, 1);
          sfx.sizzle();
          await wait(this, 220);
          break;
        case 'acid':
          floatText(this, W / 2, 110, `THE ACID RISES: ${e.n}`, 0x9be85a, 2);
          this.tint(0x4fb52e, 0.3, 500);
          sfx.gurgle();
          await wait(this, 360);
          break;
        case 'spit': {
          const m = this.enemyMid(e.i);
          const inst = this.cb.hand.find((c) => c.uid === e.uid);
          await this.flyIcon(m.x, m.y, inst ? CARDS[inst.id].icon : 'boot', 'DROPPED!', 0x9be85a);
          sfx.gem(2);
          break;
        }
        case 'disarm': {
          const m = this.enemyMid(e.i);
          const inst = this.cb.hand.find((c) => c.uid === e.uid);
          sfx.nope();
          this.refreshEnemy(e.i);
          await this.flyIcon(m.x, m.y, inst ? CARDS[inst.id].icon : 'boot', 'DISARMED!', 0xffd35a);
          break;
        }
        case 'grab': {
          const m = this.enemyMid(e.i);
          const inst = this.cb.hand.find((c) => c.uid === e.uid);
          sfx.net();
          this.refreshEnemy(e.i);
          await this.flyIcon(m.x, m.y, inst ? CARDS[inst.id].icon : 'boot', 'GRABBED! FREE!', 0x6ae8ff);
          break;
        }
        case 'fixture': {
          const f = this.fx[e.f];
          const names: Record<FixtureKind, [string, number]> = { valve: ['ACID!', 0x9be85a], cyst: ['GOO!', 0xff9ab0], pod: ['FLASH!', 0x8af0ff] };
          floatText(this, f.x, FIX_Y - 40, names[e.kind][0], names[e.kind][1], 2);
          this.tint(names[e.kind][1], 0.3, 400);
          this.tweens.add({ targets: f.img, scale: 0.62, duration: 120, yoyo: true });
          sfx.open();
          this.cameras.main.shake(180, 0.006);
          f.img.setTint(0x444044);
          await wait(this, 380);
          break;
        }
        case 'peek':
          floatText(this, W / 2, 100, 'PEEK! FACES REVEALED', 0xffe9a8);
          sfx.zap();
          this.cb.enemies.forEach((_, i) => this.refreshEnemy(i));
          await wait(this, 220);
          break;
        case 'heal':
          if (e.n > 0) {
            this.shownHp = Math.min(this.cb.maxHp, this.shownHp + e.n);
            this.hp.set(this.shownHp, this.cb.maxHp);
            floatText(this, 70, 36, `+${e.n}`, 0x6bdc3c, 2);
            sfx.gem(1);
          }
          await wait(this, 100);
          break;
        case 'enemyHeal': {
          const v = this.ev[e.i];
          const m = this.enemyMid(e.i);
          v.shown += e.n;
          if (e.n > 0) floatText(this, m.x, m.y - 10, `+${e.n}`, 0x9be85a);
          this.refreshEnemy(e.i);
          await wait(this, 160);
          break;
        }
        case 'energy':
          this.refreshEnergy();
          floatText(this, 30, 46, `+${e.n} ENERGY`, 0xffd35a);
          await wait(this, 80);
          break;
        case 'sharpen':
          floatText(this, W / 2, 120, `ATTACKS +${e.n}`, 0xffd35a, 2);
          sfx.zap();
          await wait(this, 200);
          break;
        case 'hiccup':
          floatText(this, W / 2, 60, 'HIC!', 0xff7a6a, 4);
          sfx.gurgle();
          this.cameras.main.shake(380, 0.012);
          await wait(this, 520);
          break;
        case 'act': {
          const v = this.ev[e.i];
          if (e.idle) {
            floatText(this, v.x, v.sprite.y - v.sprite.displayHeight, 'ZZZ', 0x8ab8ff);
            await wait(this, 260);
            break;
          }
          if (e.cardId) {
            // the moment the hidden face is revealed
            const m = this.enemyMid(e.i);
            const def = CARDS[e.cardId];
            const img = this.add.image(m.x, m.y - 6, `ic_${def.icon}`).setDepth(890).setScale(2.4);
            const lab = new Label(this, m.x, m.y + 18, `${def.name}: ${e.face === 'tool' ? 'TOOL SIDE!' : 'FIGHT SIDE'}`, { align: 'center', depth: 891, color: e.face === 'tool' ? 0x6ae8ff : 0xffc8b8 });
            await wait(this, 520);
            img.destroy();
            lab.destroy();
          }
          this.tweens.add({ targets: v.sprite, scale: v.sprite.scale * 1.18, y: v.sprite.y + 8, duration: 130, yoyo: true, ease: 'Quad.easeOut' });
          await wait(this, 140);
          break;
        }
        case 'hurt':
          this.shownHp = Math.max(0, this.shownHp - e.n);
          this.hp.set(this.shownHp, this.cb.maxHp);
          if (e.n > 0) {
            floatText(this, 70, 36, `-${e.n}`, 0xff5a5a, 2);
            sfx.hurt();
            this.cameras.main.shake(160, 0.006);
            this.tint(0xff2a3a, 0.35, 260);
          } else floatText(this, 70, 36, 'MISS', 0xfff08a);
          await wait(this, 230);
          break;
        case 'steal': {
          const v = this.ev[e.i];
          floatText(this, v.x, v.sprite.y - v.sprite.displayHeight - 4, 'STOLEN!', 0xffd35a, 2);
          sfx.nope();
          await wait(this, 300);
          break;
        }
        case 'returned':
          floatText(this, W / 2, 120, 'YOU GET YOUR CARD BACK!', 0x9be85a);
          sfx.gem(1);
          await wait(this, 300);
          break;
        case 'flee': {
          const v = this.ev[e.i];
          v.gone = true;
          v.bubble.setVisible(false);
          v.pips.forEach((p) => p.destroy());
          v.pips = [];
          floatText(this, v.x, v.sprite.y - v.sprite.displayHeight - 4, e.lost ? 'ESCAPED WITH YOUR CARD!' : 'IT RAN AWAY!', e.lost ? 0xff5a5a : 0xffd35a, 1);
          if (e.lost) sfx.lose();
          else sfx.nope();
          this.tweens.add({ targets: [v.sprite, v.shadow, v.name, v.hpTxt, v.hpFill, v.status], x: '+=260', alpha: 0, duration: 520, ease: 'Cubic.easeIn' });
          await wait(this, 560);
          break;
        }
        case 'turn':
          if (e.n > 1) {
            floatText(this, W / 2, 100, 'YOUR TURN', 0xf4e3d7, 2);
            this.cb.enemies.forEach((_, i) => this.refreshEnemy(i));
          }
          break;
        case 'win':
          await wait(this, 80);
          break;
        case 'lose':
          sfx.lose();
          await wait(this, 200);
          break;
        default:
          break;
      }
    }
  }
}
void VARIANT_NAMES;
void ENEMIES;
