import Phaser from 'phaser';
import { sfx } from '../../audio/sfx';
import { C, H, W } from '../../config';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { session, newRun } from '../session';
import { loadSalvage, writeSalvage } from '../storage';
import { addBelly, muteButton } from './common';
import { vk } from '../style';

export class SEndScene extends Phaser.Scene {
  constructor() {
    super('SEnd');
  }

  create(): void {
    const run = session.run;
    if (!run) {
      this.scene.start('STitle');
      return;
    }
    const won = run.won;
    const s = loadSalvage();
    s.runs += 1;
    if (won) s.wins += 1;
    s.deepest = Math.max(s.deepest, won ? run.map.length : run.step);
    writeSalvage();
    this.cameras.main.fadeIn(300, 10, 3, 8);
    addBelly(this, won ? 'pink' : 'rust', 0.4);
    if (won) {
      sfx.win();
      this.add.image(W / 2, 182, vk('en_mama')).setOrigin(0.5, 1).setScale(0.6).setAlpha(0.95).setDepth(5).setAngle(8);
    } else sfx.lose();
    new Label(this, W / 2, 24, won ? 'SPAT OUT!' : 'DIGESTED', { align: 'center', scale: 5, color: won ? C.accent : 0xff7a6a, depth: 10 });
    new Label(this, W / 2, 68, won ? 'MAMA LEECH HICCUPS YOU RIGHT BACK OUT.' : 'THE LEVIATHAN ADDS YOU TO ITS COLLECTION.', { align: 'center', color: C.text, depth: 10 });
    new Label(this, W / 2, 84, `REACHED STEP ${won ? run.map.length : Math.min(run.step + 1, run.map.length)} OF ${run.map.length}   DECK ${run.deck.length} CARDS   HP ${run.hp}/${run.maxHp}`, { align: 'center', color: C.textDim, depth: 10 });
    new Button(this, W / 2 - 60, 196, 120, 26, 'NEW RUN', () => {
      newRun();
      this.scene.start('SWalk');
    }, { scale: 2, fill: 0xa83a58 }).setDepth(10).setGlow(true);
    new Button(this, W / 2 - 60, 228, 120, 20, 'TITLE', () => this.scene.start('STitle'), { fill: 0x4a3340 }).setDepth(10);
    muteButton(this);
  }
}
void H;
