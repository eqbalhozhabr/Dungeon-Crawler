// Everything below the street and on top of it: the seal board (the next four formations), the HUD, banners and hints.
import { PixBuf } from './art/buf';
import { SPR } from './art/sprites';
import { C, H, SCENE_H, W } from './config';
import { countSeats, crowd, describeNeed, meets, type Demand } from './logic/formation';
import type { Game } from './logic/game';
import { LANES, MAX_ECHOES, MAX_HP, REACH_LAPS, SCORING_FROM } from './logic/types';

export const PAUSE_RECT = { x: 161, y: 1, w: 17, h: 12 };

const COL = { x: 8, w: 39, gap: 4, y: 221, h: 62 };
const OK = 0x6bdc70;
const BAD = 0xe0485a;
const PLATE = 0x3a2448;

export type Status = 'ok' | 'bad' | 'open';

/** One lane's need drawn as a number on a plate. */
export function drawNeedGlyph(b: PixBuf, n: { lo: number; hi: number }, cx: number, cy: number, scale: number, a = 1): void {
  const col = n.lo === 0 && n.hi === 0 ? BAD : n.lo === 0 ? C.textDim : C.gold;
  const s = describeNeed(n);
  const w = b.textWidth(s, scale);
  b.text(s, cx - w / 2, cy - (7 * scale) / 2, col, scale, a < 1 ? -1 : C.ink);
}

interface Banner {
  text: string;
  sub: string;
  age: number;
  dur: number;
}

export class Panel {
  private banners: Banner[] = [];
  private hintText = '';
  private hintAge = 99;
  private hintDur = 0;
  t = 0;

  banner(text: string, sub = '', dur = 1.8): void {
    this.banners.push({ text, sub, age: 0, dur });
  }

  hint(text: string, dur = 4): void {
    this.hintText = text;
    this.hintAge = 0;
    this.hintDur = dur;
  }

  hasHint(): boolean {
    return this.hintAge < this.hintDur;
  }

  reset(): void {
    this.banners = [];
    this.hintAge = 99;
  }

  draw(b: PixBuf, g: Game, dt: number, hud = true): void {
    this.t += dt;
    this.hintAge += dt;
    b.clipY0 = 0;
    b.clipY1 = H;
    b.rect(0, SCENE_H, W, H - SCENE_H, C.panel);
    for (let y = SCENE_H; y < H; y += 2) b.rect(0, y, W, 1, 0x321a38);
    b.rect(0, SCENE_H, W, 2, C.panelEdge);
    b.rect(0, SCENE_H + 2, W, 1, 0x120818);

    b.textC(g.lap < SCORING_FROM ? 'WARM-UP: SCORING STARTS LAP 3' : 'YOUR SEAT BECOMES A GHOST', W / 2, SCENE_H + 6, C.textDim);
    for (let k = 0; k < REACH_LAPS; k++) this.column(b, g, g.nextSeal + k, COL.x + k * (COL.w + COL.gap), k === 0);

    if (!hud) return;
    this.streakRow(b, g);
    this.hud(b, g);
    this.drawBanners(b, dt);
    if (this.hintAge < this.hintDur) {
      const lines = this.hintText.split('\n');
      const h = lines.length * 9 + 6;
      const a = Math.min(1, (this.hintDur - this.hintAge) * 3, this.hintAge * 5);
      b.rect(6, 17, W - 12, h, C.ink, 0.78 * a);
      b.frame(6, 17, W - 12, h, C.panelEdge, a);
      lines.forEach((ln, i) => b.textC(ln, W / 2, 21 + i * 9, C.text, 1));
    }
  }

  // ---------------------------------------------------------------- one formation of the board
  /** Can this formation still be met, given the seats already taken and how many are still to come? */
  static status(demand: Demand, counts: number[], unknown: number): Status {
    if (unknown === 0) return meets(demand, counts) ? 'ok' : 'bad';
    let need = 0;
    for (let i = 0; i < LANES; i++) {
      if (counts[i] > demand[i].hi) return 'bad';
      need += Math.max(0, demand[i].lo - counts[i]);
    }
    return need > unknown ? 'bad' : 'open';
  }

  private column(b: PixBuf, g: Game, j: number, x: number, first: boolean): void {
    const info = g.sealInfo(j);
    const lanes = countSeats([...info.ghosts, ...(info.live ? [g.lane] : [])]);
    const n = crowd(j);
    const unknown = n - info.ghosts.length - (info.live ? 1 : 0);
    const st = Panel.status(info.demand, lanes, unknown);
    const edge = st === 'ok' && unknown === 0 ? OK : st === 'bad' ? BAD : first ? C.gold : C.panelEdge;
    b.rect(x - 1, COL.y, COL.w + 2, COL.h, C.ink, 0.35);
    b.frame(x - 1, COL.y, COL.w + 2, COL.h, edge, first ? 1 : 0.8);
    b.textC(`LAP ${j + 1}`, x + COL.w / 2, COL.y + 3, first ? C.gold : C.text);
    for (let l = 0; l < LANES; l++) {
      const px = x + 1 + l * 13;
      const py = COL.y + 14;
      b.rect(px, py, 12, 13, PLATE);
      b.frame(px, py, 12, 13, info.demand[l].lo > 0 ? 0x8a6a2a : 0x4a3458);
      drawNeedGlyph(b, info.demand[l], px + 6, py + 7, 1);
      // seats taken so far: ghosts (blue) stack up, you (red) on top
      let level = 0;
      for (const s of info.ghosts) if (s === l) b.disc(px + 6, COL.y + 52 - level++ * 6, 2.6, C.ghost);
      if (info.live && g.lane === l) {
        b.disc(px + 6, COL.y + 52 - level * 6, 3, 0xffffff);
        b.disc(px + 6, COL.y + 52 - level * 6, 2, C.red);
      }
    }
    if (unknown > 0) b.textC(`?${unknown}`, x + COL.w / 2, COL.y + 53, C.textDim);
    else if (first) b.textC(st === 'ok' ? 'OK' : '!', x + COL.w / 2, COL.y + 53, st === 'ok' ? OK : BAD);
    // thin separators between the three lanes' stacks
    b.rect(x + 13, COL.y + 29, 1, 22, 0x4a3458, 0.5);
    b.rect(x + 26, COL.y + 29, 1, 22, 0x4a3458, 0.5);
  }

  /** Streak, multiplier and the last seals. */
  private streakRow(b: PixBuf, g: Game): void {
    const y = COL.y + COL.h + 4;
    b.text('STREAK', 8, y, C.textDim);
    for (let i = 0; i < 8; i++) {
      const on = i < g.streak;
      b.rect(46 + i * 9, y, 7, 7, on ? C.gold : 0x3a2040);
      if (on) b.rect(46 + i * 9, y, 7, 1, 0xfff0b0);
    }
    const m = `X${g.mult % 1 === 0 ? g.mult.toFixed(0) : g.mult.toFixed(1)}`;
    b.text(m, 130, y, g.mult > 1 ? C.gold : g.mult < 1 ? BAD : C.text, 1, C.ink);
    // last seals: green open, red shut, dim = warm-up
    const hist = g.history.slice(-12);
    b.text('SEALS', 8, y + 11, C.textDim);
    b.disc(12, y + 25, 2.6, C.ghost);
    b.text('GHOSTS', 18, y + 22, C.textDim);
    b.disc(76, y + 25, 3, 0xffffff);
    b.disc(76, y + 25, 2, C.red);
    b.text('YOU', 82, y + 22, C.textDim);
    hist.forEach((ok, i) => {
      const lapIdx = g.history.length - hist.length + i;
      const warm = lapIdx < SCORING_FROM;
      b.rect(46 + i * 10, y + 10, 8, 8, ok ? OK : BAD, warm ? 0.45 : 1);
    });
  }

  // ---------------------------------------------------------------- top bar
  private hud(b: PixBuf, g: Game): void {
    b.clipY1 = H;
    b.rect(0, 0, W, 14, C.ink, 0.6);
    for (let i = 0; i < MAX_HP; i++) b.sprite(i < g.hp ? SPR.heart : SPR.heartEmpty, 8 + i * 10, 11, 6);
    b.textC(`LAP ${g.lap + 1}`, 78, 2, C.text, 1, C.ink);
    for (let i = 0; i < MAX_ECHOES; i++) {
      const on = i < g.echoes.length;
      b.sprite(SPR.runnerA, 62 + i * 8 + 30, 13, 7, { tint: on ? C.ghost : 0x6a5a7a, tintAmount: 0.85, alpha: on ? 0.95 : 0.4 });
    }
    const s = String(g.score);
    b.disc(120, 6, 3, C.gold);
    b.disc(120, 6, 1.5, C.goldDark);
    b.text(s, 126, 2, C.gold, 1, C.ink);
    b.rect(PAUSE_RECT.x, PAUSE_RECT.y, PAUSE_RECT.w, PAUSE_RECT.h, C.panel, 0.7);
    b.rect(PAUSE_RECT.x + 6, PAUSE_RECT.y + 3, 2, 6, C.text);
    b.rect(PAUSE_RECT.x + 10, PAUSE_RECT.y + 3, 2, 6, C.text);
  }

  private drawBanners(b: PixBuf, dt: number): void {
    this.banners = this.banners.filter((x) => (x.age += dt) < x.dur);
    const bn = this.banners[0];
    if (!bn) return;
    const a = Math.min(1, bn.age * 6, (bn.dur - bn.age) * 4);
    const y = 76 - Math.round((1 - a) * 6);
    b.rect(0, y - 4, W, bn.sub ? 34 : 22, C.ink, 0.6 * a);
    b.textC(bn.text, W / 2, y, C.gold, 2, 0x000000);
    if (bn.sub) b.textC(bn.sub, W / 2, y + 19, C.text, 1, C.ink);
  }
}

