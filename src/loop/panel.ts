// Everything below the street and on top of it: the rune grid (the ring's map), the HUD, banners and hints.
import { PixBuf, mixc } from './art/buf';
import { SPR } from './art/sprites';
import { C, DISTRICT_COL, GRID, H, SCENE_H, tileRect, W } from './config';
import type { Game } from './logic/game';
import { RUNE_HELP, RUNE_NAMES } from './logic/runes';
import { BINS, DISTRICTS, DROWS, LANES, MAX_ECHOES, MAX_HP, RING, type RuneId } from './logic/types';

export const PAUSE_RECT = { x: 161, y: 1, w: 17, h: 12 };

/** Pictograms for the runes, drawn with lines like chalk marks. */
export function drawRune(b: PixBuf, rune: RuneId, cx: number, cy: number, col: number): void {
  switch (rune) {
    case 'coin':
      b.ring(cx, cy, 7, col);
      b.ring(cx, cy, 3.4, col);
      b.disc(cx, cy, 1, col);
      b.rect(cx - 1, cy - 10, 2, 2, col);
      break;
    case 'bandit':
      b.line(cx - 6, cy + 7, cx + 6, cy - 7, col);
      b.line(cx - 5, cy + 7, cx + 7, cy - 7, col);
      b.line(cx - 6, cy - 1, cx + 1, cy + 6, col);
      b.line(cx - 6, cy - 2, cx + 0, cy + 5, col);
      b.disc(cx - 7, cy + 8, 1.5, col);
      break;
    case 'brute':
      b.line(cx - 7, cy - 7, cx + 7, cy - 7, col);
      b.line(cx + 7, cy - 7, cx + 7, cy + 1, col);
      b.line(cx + 7, cy + 1, cx, cy + 9, col);
      b.line(cx, cy + 9, cx - 7, cy + 1, col);
      b.line(cx - 7, cy + 1, cx - 7, cy - 7, col);
      b.line(cx, cy - 7, cx, cy + 8, col);
      b.line(cx - 6, cy - 2, cx + 6, cy - 2, col);
      break;
    case 'spikes':
      for (const k of [-7, 0, 7]) {
        b.line(cx + k - 3, cy + 7, cx + k, cy - 7, col);
        b.line(cx + k + 3, cy + 7, cx + k, cy - 7, col);
      }
      b.line(cx - 10, cy + 8, cx + 10, cy + 8, col);
      break;
    case 'fountain':
      b.line(cx, cy - 9, cx + 5, cy, col);
      b.line(cx + 5, cy, cx + 4, cy + 5, col);
      b.line(cx + 4, cy + 5, cx, cy + 7, col);
      b.line(cx, cy + 7, cx - 4, cy + 5, col);
      b.line(cx - 4, cy + 5, cx - 5, cy, col);
      b.line(cx - 5, cy, cx, cy - 9, col);
      b.line(cx - 8, cy + 10, cx - 4, cy + 8, col);
      b.line(cx + 8, cy + 10, cx + 4, cy + 8, col);
      break;
  }
}

interface Banner {
  text: string;
  sub: string;
  age: number;
  dur: number;
}

export class Panel {
  private pos = new Map<number, { x: number; y: number }>();
  private banners: Banner[] = [];
  private hintText = '';
  private hintAge = 99;
  private hintDur = 0;
  private tipText = '';
  private tipAge = 99;
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

  tip(rune: RuneId | null): void {
    this.tipText = rune ? `${RUNE_NAMES[rune]}: ${RUNE_HELP[rune]}` : '';
    this.tipAge = 0;
  }

  reset(): void {
    this.pos.clear();
    this.banners = [];
    this.hintAge = 99;
    this.tipAge = 99;
  }

  // ---------------------------------------------------------------- grid
  draw(b: PixBuf, g: Game, dt: number, hover: { d: number; l: number } | null, showMove: boolean, hud = true): void {
    this.t += dt;
    this.tipAge += dt;
    this.hintAge += dt;
    b.clipY0 = 0;
    b.clipY1 = H;
    // panel background
    b.rect(0, SCENE_H, W, H - SCENE_H, C.panel);
    for (let y = SCENE_H; y < H; y += 2) b.rect(0, y, W, 1, 0x321a38);
    b.rect(0, SCENE_H, W, 2, C.panelEdge);
    b.rect(0, SCENE_H + 2, W, 1, 0x120818);

    const cur = g.district();
    // the line above the grid: tip for the touched tile, or a default
    const line = this.tipAge < 3 && this.tipText ? this.tipText : g.over ? '' : 'SLIDE RUNES INTO THE GAP';
    b.textC(line, W / 2, SCENE_H + 4, this.tipAge < 3 ? C.text : C.textDim);

    // district notches and the "you are here" arrow
    for (let d = 0; d < DISTRICTS; d++) {
      const r = tileRect(d, 0);
      b.rect(3, r.y + 3, 3, r.h - 6, DISTRICT_COL[d], d === cur ? 1 : 0.55);
      if (d === cur) {
        const bx = 7 + Math.round(Math.sin(this.t * 8));
        b.line(bx - 1, r.y + r.h / 2 - 3, bx + 1, r.y + r.h / 2, C.gold);
        b.line(bx - 1, r.y + r.h / 2 + 3, bx + 1, r.y + r.h / 2, C.gold);
      }
    }

    // tiles slide towards their cells
    const movable = new Set<number>();
    if (showMove)
      for (let d = 0; d < DISTRICTS; d++)
        for (let l = 0; l < LANES; l++) {
          const t = g.grid[d][l];
          if (t && g.slideCells(d, l)) movable.add(t.id);
        }
    for (let d = 0; d < DISTRICTS; d++)
      for (let l = 0; l < LANES; l++) {
        const r = tileRect(d, l);
        const t = g.grid[d][l];
        if (!t) {
          this.hole(b, r.x, r.y);
          continue;
        }
        let p = this.pos.get(t.id);
        if (!p) {
          p = { x: r.x, y: r.y };
          this.pos.set(t.id, p);
        }
        const k = Math.min(1, dt * 22);
        p.x += (r.x - p.x) * k;
        p.y += (r.y - p.y) * k;
        if (Math.abs(r.x - p.x) < 0.6) p.x = r.x;
        if (Math.abs(r.y - p.y) < 0.6) p.y = r.y;
        const isHover = hover?.d === d && hover.l === l;
        this.tile(b, Math.round(p.x), Math.round(p.y), t.rune, g.isLocked(d), movable.has(t.id), isHover, d);
      }

    this.paths(b, g);
    if (!hud) return;
    this.hud(b, g);
    this.drawBanners(b, dt);
    if (this.hintAge < this.hintDur) {
      const lines = this.hintText.split('\n');
      const h = lines.length * 9 + 6;
      const a = Math.min(1, (this.hintDur - this.hintAge) * 3, this.hintAge * 5);
      b.rect(6, 17, W - 12, h, C.ink, 0.72 * a);
      b.frame(6, 17, W - 12, h, C.panelEdge, a);
      lines.forEach((ln, i) => b.textC(ln, W / 2, 21 + i * 9, C.text, 1));
    }
  }

  private hole(b: PixBuf, x: number, y: number): void {
    const w = GRID.tw;
    const h = GRID.th;
    b.rect(x + 1, y + 1, w - 2, h - 2, 0x2a1230);
    const glow = 0.45 + 0.35 * Math.sin(this.t * 4);
    b.rect(x + 3, y + 3, w - 6, h - 6, 0xf0b040, 0.12 + 0.12 * glow);
    b.frame(x + 3, y + 3, w - 6, h - 6, 0xf0b040, 0.35 + 0.4 * glow);
    const cx = x + w / 2;
    const cy = y + h / 2;
    b.line(cx - 4, cy, cx + 4, cy, 0xffd880, 0.6 + 0.4 * glow);
    b.line(cx, cy - 4, cx, cy + 4, 0xffd880, 0.6 + 0.4 * glow);
  }

  private tile(b: PixBuf, x: number, y: number, rune: RuneId, locked: boolean, movable: boolean, hover: boolean, d: number): void {
    const w = GRID.tw;
    const h = GRID.th;
    const base = (x / w + d) % 2 < 1 ? C.tileA : C.tileB;
    b.rect(x + 1, y + 1, w - 2, h - 2, base);
    b.rect(x + 1, y + 1, w - 2, 1, mixc(base, 0xffffff, 0.25));
    b.rect(x + 1, y + h - 2, w - 2, 1, mixc(base, 0x000000, 0.25));
    b.frame(x, y, w, h, C.tileEdge);
    // chalk circle around the glyph
    b.ring(x + w / 2, y + h / 2, 11.5, mixc(base, 0x6a3a8a, 0.35));
    drawRune(b, rune, x + w / 2, y + h / 2, locked ? C.runeDim : C.rune);
    if (locked) {
      b.rect(x + 1, y + 1, w - 2, h - 2, 0x1d1026, 0.38);
      b.sprite(SPR.lock, x + w - 7, y + 10, 8);
    } else if (movable) {
      const a = 0.35 + 0.35 * Math.sin(this.t * 7);
      b.frame(x + 1, y + 1, w - 2, h - 2, 0xfff0b0, a);
      b.frame(x + 2, y + 2, w - 4, h - 4, 0xfff0b0, a * 0.5);
    }
    if (hover) b.frame(x, y, w, h, C.text);
  }

  // ---------------------------------------------------------------- where you and your ghosts run, on the map
  private paths(b: PixBuf, g: Game): void {
    const at = (rr: number, lane: number) => {
      const d = Math.min(DISTRICTS - 1, Math.floor(rr / DROWS));
      const f = (rr - d * DROWS) / DROWS;
      return { x: GRID.x + (lane + 0.5) * GRID.tw, y: GRID.y + (2 - d) * GRID.th + GRID.th * (1 - f) };
    };
    const trace = (lanes: Uint8Array, to: number, col: number, a: number, off: number, from = 0) => {
      let prev: { x: number; y: number } | null = null;
      for (let rr = from; rr <= to; rr += 0.5) {
        const lane = lanes[Math.min(RING * BINS - 1, Math.floor(rr * BINS))];
        const q = at(Math.min(RING - 0.01, rr), lane);
        if (prev) b.line(prev.x + off, prev.y, q.x + off, q.y, col, a);
        prev = q;
      }
    };
    g.echoes.forEach((e, i) => {
      trace(e.path, g.p, C.ghost, 0.2, (i - 1) * 2);
      trace(e.path, RING - 0.5, C.ghost, 0.5, (i - 1) * 2, g.p);
    });
    trace(g.path, g.p, 0xff7a8a, 0.8, 0);
    // playhead
    const q = at(g.p, g.lane);
    b.rect(GRID.x, Math.round(q.y), GRID.tw * LANES, 1, C.gold, 0.85);
    b.rect(GRID.x - 3, Math.round(q.y) - 1, 3, 3, C.gold);
    b.rect(GRID.x + GRID.tw * LANES, Math.round(q.y) - 1, 3, 3, C.gold);
    g.echoes.forEach((_, i) => {
      const gq = at(g.p, g.echoLane(i));
      b.disc(gq.x + (i - 1) * 2, gq.y, 2.2, C.ghost, 0.95);
    });
    b.disc(q.x, q.y, 3, 0xffffff);
    b.disc(q.x, q.y, 2, C.red);
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
    // pause
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
