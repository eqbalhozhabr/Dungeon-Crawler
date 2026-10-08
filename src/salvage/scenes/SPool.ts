import Phaser from 'phaser';
import { sfx } from '../../audio/sfx';
import { C, H, W } from '../../config';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { CARDS } from '../logic/cards';
import { POOL_HEAL } from '../logic/run';
import { session } from '../session';
import { loadSalvage, writeSalvage } from '../storage';
import { floatText, showDeck, wait } from '../ui';
import { addBelly, deckButton, HpBar, muteButton } from './common';

export class SPoolScene extends Phaser.Scene {
  private hp!: HpBar;
  private busy = false;
  private msg!: Label;

  constructor() {
    super('SPool');
  }

  create(): void {
    const run = session.run!;
    this.busy = false;
    this.cameras.main.fadeIn(250, 10, 3, 8);
    addBelly(this, 'pink');
    this.add.image(240, 168, 'prop_pool').setOrigin(0.5, 1).setDepth(10).setScale(1.5);
    new Label(this, W / 2, 8, 'AN ACID POOL', { align: 'center', scale: 2, color: C.accent, depth: 700 });
    new Label(this, W / 2, 26, 'IT BURNS, BUT IT ALSO CLEANS AND SOFTENS. CHOOSE ONE.', { align: 'center', color: C.text, depth: 700 });
    this.msg = new Label(this, W / 2, 38, '', { align: 'center', color: 0xffe9a8, depth: 700 });
    this.hp = new HpBar(this, 6, 6, 60);
    this.hp.set(run.hp, run.maxHp);
    deckButton(this, 6, 22);
    muteButton(this);
    const y = 196;
    new Button(this, 20, y, 136, 38, 'REST', () => this.rest(), { fill: 0x2f7a3a, scale: 2, sub: `HEAL ${POOL_HEAL} HP` }).setDepth(700);
    new Button(this, 172, y, 136, 38, 'GROW', () => this.grow(), { fill: 0x2f6a9a, scale: 2, sub: 'A CARD GETS +1 FOREVER' }).setDepth(700);
    new Button(this, 324, y, 136, 38, 'DISSOLVE', () => this.dissolve(), { fill: 0x8a3a5a, scale: 2, sub: 'REMOVE A CARD' }).setDepth(700);
  }

  private rest(): void {
    if (this.busy) return;
    this.busy = true;
    const run = session.run!;
    const g = run.heal(POOL_HEAL);
    sfx.gem(1);
    floatText(this, 70, 30, `+${g}`, 0x6bdc3c, 2);
    this.hp.set(run.hp, run.maxHp);
    void wait(this, 700).then(() => this.finish());
  }

  private grow(): void {
    if (this.busy) return;
    const run = session.run!;
    const pool = run.deck.filter((c) => CARDS[c.id].fight.some((f) => f.t === 'dmg' || f.t === 'heal'));
    this.busy = true;
    showDeck(this, pool, { title: 'GROW A CARD', sub: 'PICK ONE: ITS FIRST DAMAGE OR HEAL NUMBER GOES UP BY 1, FOR GOOD', pick: true, backLabel: 'BACK' }, (uid) => {
      if (uid === null) {
        this.busy = false;
        return;
      }
      const c = run.deck.find((d) => d.uid === uid)!;
      c.bonus += 1;
      sfx.set();
      this.msg.setText(`${CARDS[c.id].name} GREW +${c.bonus}`);
      void wait(this, 800).then(() => this.finish());
    });
  }

  private dissolve(): void {
    if (this.busy) return;
    const run = session.run!;
    if (run.deck.length <= 6) {
      sfx.nope();
      this.msg.setText('YOUR DECK IS TOO SMALL TO LOSE ANYTHING');
      return;
    }
    this.busy = true;
    showDeck(this, run.deck, { title: 'DISSOLVE A CARD', sub: 'PICK ONE TO LOSE FOR GOOD. A THIN DECK IS A SHARP DECK.', pick: true, backLabel: 'BACK' }, (uid) => {
      if (uid === null) {
        this.busy = false;
        return;
      }
      const c = run.deck.find((d) => d.uid === uid)!;
      run.remove(uid);
      sfx.sizzle();
      this.msg.setText(`${CARDS[c.id].name} DISSOLVED`);
      void wait(this, 800).then(() => this.finish());
    });
  }

  private finish(): void {
    const run = session.run!;
    run.advance();
    const s = loadSalvage();
    s.deepest = Math.max(s.deepest, run.step);
    writeSalvage();
    this.cameras.main.fadeOut(220, 10, 3, 8);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('SMap'));
  }
}
void H;
