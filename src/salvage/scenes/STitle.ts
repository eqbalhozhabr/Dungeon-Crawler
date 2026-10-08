import Phaser from 'phaser';
import { sfx } from '../../audio/sfx';
import { C, H, W } from '../../config';
import { Button } from '../../ui/button';
import { Label } from '../../ui/label';
import { loadSalvage } from '../storage';
import { newRun } from '../session';
import { addBelly, muteButton } from './common';
import { bobEase, isVintage, setVintage, vk } from '../style';

export class STitleScene extends Phaser.Scene {
  constructor() {
    super('STitle');
  }

  create(): void {
    addBelly(this, 'pink');
    this.add.rectangle(0, 0, W, H, C.ink, 0.35).setOrigin(0).setDepth(3);
    // the cast, standing in a row like in a fight
    const row: [string, number, number][] = [['en_mite', 84, 196], ['en_slug', 398, 200], ['en_tick', 28, 204], ['en_leech', 452, 168]];
    row.forEach(([k, x, y], i) => {
      const s = this.add.image(x, y, vk(k)).setOrigin(0.5, 1).setDepth(5).setScale(0.8);
      this.tweens.add({ targets: s, y: y - 3, duration: 900 + i * 130, yoyo: true, repeat: -1, ease: bobEase() });
    });
    const logo = new Label(this, W / 2, 30, 'GULLET', { align: 'center', scale: 5, color: C.accent, depth: 10 });
    new Label(this, W / 2, 72, 'SALVAGE', { align: 'center', scale: 5, color: 0xf4e3d7, depth: 10 });
    this.tweens.add({ targets: logo, y: 33, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    new Label(this, W / 2, 118, 'SWALLOWED WHOLE. EVERYTHING YOU FIND INSIDE', { align: 'center', color: C.text, depth: 10 });
    new Label(this, W / 2, 128, 'FIGHTS IN A BRAWL, AND OPENS DOORS IN A ROOM.', { align: 'center', color: C.text, depth: 10 });
    const s = loadSalvage();
    new Label(this, W / 2, 205, s.runs ? `RUNS ${s.runs}   WINS ${s.wins}   DEEPEST ${Math.min(8, s.deepest)}/8` : 'A DECKBUILDER FROM INSIDE A MONSTER', { align: 'center', color: C.textDim, depth: 10 });
    new Button(this, W / 2 - 60, 224, 120, 28, 'START RUN', () => this.begin(), { scale: 2, fill: 0xa83a58 }).setDepth(10).setGlow(true);
    muteButton(this);
    new Button(this, 6, H - 22, 96, 16, isVintage() ? 'STYLE: 1930S' : 'STYLE: COLOUR', () => {
      setVintage(!isVintage());
      this.scene.restart();
    }, { fill: 0x3a2a4a }).setDepth(10);
    this.input.keyboard?.on('keydown-SPACE', () => this.begin());
    sfx.startDrone?.();
  }

  private begin(): void {
    sfx.unlock();
    newRun();
    this.scene.start('SWalk');
  }
}
