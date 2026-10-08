import Phaser from 'phaser';
import { sfx } from '../../audio/sfx';
import { C, FP, H, W } from '../../config';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { CARDS } from '../logic/cards';
import { BASH_COST, NEEDS } from '../logic/run';
import type { CardInst, RoomKind } from '../logic/types';
import { session } from '../session';
import { loadSalvage, writeSalvage } from '../storage';
import { CW, floatText, makeCard, makeInteractive, showReward, wait, type CardView } from '../ui';
import { addBelly, deckButton, HpBar, muteButton } from './common';
import { vk } from '../style';

const FLOOR_Y = Math.round(FP.yh + FP.camY * (FP.f / 5.5));
const REST_Y = H - 112;
const SEL_Y = H - 122;

const TITLES: Record<string, [string, string]> = {
  valve: ['A RUSTY VALVE', 'SOMETHING IS LOCKED BEHIND IT.'],
  cyst: ['A FAT CYST', 'IT IS FULL OF GOOD STUFF.'],
  alcove: ['A DARK ALCOVE', 'THINGS GLITTER IN THERE.'],
  corpse: ['A FALLEN DIVER', 'THE LEVIATHAN GOT THEM TOO. THE KIT IS STILL HERE.'],
};
const NEED_TEXT: Record<string, string> = { valve: 'NEEDS: PRY OR KEY', cyst: 'NEEDS: CUT OR DIG (HEALS TOO)', alcove: 'NEEDS: LIGHT' };

export class SExploreScene extends Phaser.Scene {
  private hand: CardInst[] = [];
  private views = new Map<number, CardView>();
  private selected: number | null = null;
  private busy = false;
  private msg!: Label;
  private prop!: Phaser.GameObjects.Image;
  private kind!: RoomKind;
  private hpBar!: HpBar;

  constructor() {
    super('SExplore');
  }

  create(): void {
    const run = session.run!;
    this.kind = session.room!.kind;
    this.busy = false;
    this.selected = null;
    this.views.clear();
    this.cameras.main.fadeIn(250, 10, 3, 8);
    addBelly(this, 'pink', this.kind === 'alcove' ? 0.35 : 0);
    this.prop = this.add.image(FP.cx, FLOOR_Y + (this.kind === 'alcove' ? 8 : 0), vk(`prop_${this.kind}`)).setOrigin(0.5, 1).setDepth(10);
    this.add.ellipse(FP.cx, FLOOR_Y - 1, this.prop.displayWidth * 0.8, 10, 0, 0.4).setDepth(9);
    if (this.kind === 'alcove') {
      // darkness that the right light removes
      const dark = this.add.rectangle(0, 0, W, H - 120, 0x000000, 0.45).setOrigin(0).setDepth(11);
      dark.setData('dark', true);
    }
    const [name, desc] = TITLES[this.kind];
    new Label(this, W / 2, 8, name, { align: 'center', scale: 2, color: C.accent, depth: 700 });
    new Label(this, W / 2, 28, desc, { align: 'center', color: C.text, depth: 700 });
    this.msg = new Label(this, W / 2, 40, NEED_TEXT[this.kind] ?? 'FREE LOOT', { align: 'center', color: 0xffe9a8, depth: 700 });
    this.hpBar = new HpBar(this, 6, 6, 60);
    this.hpBar.set(run.hp, run.maxHp);
    deckButton(this, 6, 22);
    muteButton(this);

    if (this.kind === 'corpse') {
      new Button(this, W / 2 - 55, H - 56, 110, 26, 'SEARCH IT', () => this.search(), { fill: 0xa83a58, scale: 1 }).setDepth(700).setGlow(true);
      return;
    }
    // the explore hand: five objects from your deck
    this.hand = run.exploreHand(5);
    const need = NEEDS[this.kind] ?? [];
    const step = 62;
    const x0 = Math.round(W / 2 - (step * (this.hand.length - 1) + CW) / 2) - 4;
    this.hand.forEach((inst, i) => {
      const fits = CARDS[inst.id].tools.some((t) => need.includes(t));
      const v = makeCard(this, inst.id, { uid: inst.uid, bonus: inst.bonus, state: fits ? 'match' : 'dim' });
      v.setPosition(x0 + i * step, H + 10).setDepth(100 + i);
      this.tweens.add({ targets: v, y: REST_Y, duration: 240, delay: i * 50, ease: 'Back.easeOut' });
      makeInteractive(v);
      v.input!.cursor = 'pointer';
      v.on('pointerup', () => this.tapCard(inst, fits));
      this.views.set(inst.uid, v);
    });
    if (!this.hand.some((c) => CARDS[c.id].tools.some((t) => need.includes(t)))) this.msg.setText(`${NEED_TEXT[this.kind]}   NONE IN HAND!`).setColor(0xff8a7a);
    new Button(this, 6, H - 50, 74, 24, 'LEAVE', () => this.leave(), { fill: 0x4a3340, sub: 'NO PRIZE' }).setDepth(700);
    new Button(this, W - 80, H - 50, 74, 24, 'BASH IT', () => this.bash(), { fill: 0x7a3a2a, sub: `-${BASH_COST} HP` }).setDepth(700);
  }

  private tapCard(inst: CardInst, fits: boolean): void {
    if (this.busy) return;
    const def = CARDS[inst.id];
    if (!fits) {
      sfx.nope();
      this.msg.setText(def.tools.length ? `${def.name} CANNOT DO THAT.` : `${def.name} IS NO TOOL.`).setColor(0xff8a7a);
      return;
    }
    if (this.selected !== inst.uid) {
      this.selected = inst.uid;
      sfx.select();
      this.views.forEach((v, id) => v.setY(id === inst.uid ? SEL_Y : REST_Y));
      this.msg.setText(`TAP ${def.name} AGAIN TO USE IT`).setColor(0xffe9a8);
      return;
    }
    void this.use(inst);
  }

  private async use(inst: CardInst): Promise<void> {
    this.busy = true;
    const run = session.run!;
    const v = this.views.get(inst.uid)!;
    this.tweens.add({ targets: v, x: FP.cx - CW / 2, y: FLOOR_Y - 90, scale: 0.5, alpha: 0.3, duration: 230, ease: 'Cubic.easeIn' });
    await wait(this, 230);
    v.destroy();
    this.views.delete(inst.uid);
    const out = run.explore(this.kind, inst.uid);
    await this.openProp(out.healed > 0 ? `HEALED ${out.healed}` : '', out.consumed ? `${CARDS[inst.id].name} IS USED UP` : '');
    this.hpBar.set(run.hp, run.maxHp);
    this.reward(out.options, this.kind === 'alcove' ? 'YOU SEE TREASURE!' : 'IT OPENS!');
  }

  private async openProp(healText: string, note: string): Promise<void> {
    sfx.open();
    this.tweens.add({ targets: this.prop, scale: 1.15, duration: 160, yoyo: true });
    this.cameras.main.shake(180, 0.006);
    this.children.list.forEach((o) => {
      if ((o as Phaser.GameObjects.Rectangle).getData?.('dark')) this.tweens.add({ targets: o, alpha: 0, duration: 400 });
    });
    if (healText) floatText(this, FP.cx, FLOOR_Y - 100, healText, 0x6bdc3c, 2);
    if (note) floatText(this, FP.cx, FLOOR_Y - 80, note, 0xff8a7a);
    await wait(this, 520);
  }

  private async bash(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const run = session.run!;
    const out = run.explore(this.kind, null);
    sfx.hurt();
    this.cameras.main.shake(200, 0.01);
    floatText(this, 70, 30, `-${out.hpLost}`, 0xff5a5a, 2);
    this.hpBar.set(run.hp, run.maxHp);
    await wait(this, 400);
    await this.openProp('', '');
    this.reward(out.options, 'YOU BASHED IT OPEN.');
  }

  private search(): void {
    if (this.busy) return;
    this.busy = true;
    const out = session.run!.explore('corpse', null);
    sfx.open();
    this.reward(out.options, 'YOU SEARCH THE BODY.');
  }

  private reward(ids: string[], sub: string): void {
    const run = session.run!;
    showReward(this, ids.map((id) => ({ id })), { title: 'CHOOSE YOUR REWARD', sub: `${sub} TAKE ONLY ONE.`, noThanks: 'NO THANKS' }, (id) => {
      if (id) run.add(id);
      this.finish();
    });
  }

  private leave(): void {
    if (this.busy) return;
    this.busy = true;
    this.finish();
  }

  private finish(): void {
    const run = session.run!;
    run.advance();
    const s = loadSalvage();
    s.deepest = Math.max(s.deepest, run.step);
    writeSalvage();
    this.cameras.main.fadeOut(220, 10, 3, 8);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('SWalk'));
  }
}
