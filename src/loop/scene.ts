// The street: a ring seen from inside, so the road curls up into the sky ahead. Pseudo-3D, drawn pixel by pixel.
import { BAYER4 } from '../art/pixel';
import { PixBuf, mixc } from './art/buf';
import { SPR } from './art/sprites';
import { C, DISTRICT_COL, FLOOR, SCENE_H, W } from './config';
import { rel, type Game } from './logic/game';
import { BINS, DISTRICTS, DROWS, LANES, RING } from './logic/types';

// camera and ring geometry (world units: one lane = LW, one ring row = 1)
const TH = 0.07; // radians of ring per row: bigger = the road curls up faster
const R = 1 / TH;
const CAMZ = 1.9;
const CAMY = 1.9;
const F = 96;
const HY = 62;
const CX = 90;
export const LW = 0.8;
const WX = 1.62; // half distance between the walls
const DMAX = 12.5;
const DMIN = -0.85;

export function proj(d: number, X: number, Y = 0, ox = 0): { x: number; y: number; s: number } {
  const phi = d * TH;
  const rad = R - Y;
  const z = rad * Math.sin(phi);
  const y = R - rad * Math.cos(phi);
  const depth = z + CAMZ;
  const s = F / depth;
  return { x: CX + ox + X * s, y: HY + (CAMY - y) * s, s };
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const hash = (a: number, b = 0) => {
  let h = (Math.imul(a + 374761393, 668265263) ^ Math.imul(b + 1274126177, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};

interface Draw {
  d: number;
  fn: () => void;
}
interface Particle {
  row: number;
  X: number;
  Y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  col: number;
}
interface Popup {
  row: number;
  X: number;
  text: string;
  col: number;
  age: number;
}

const FACADES = [0xcdb474, 0xa4b890, 0x9684b4, 0xd69c6c, 0x80acaa, 0xc2a05a];

export class Scene {
  private readonly backdrop: PixBuf;
  private readonly gd: number[] = []; // screen y -> ring distance d (ground)
  private yTop = 0;
  private parts: Particle[] = [];
  private pops: Popup[] = [];
  private ghostVis = new Map<number, number>();
  laneVis = 1;
  shake = 0;
  flash = 0;
  t = 0;

  constructor(private readonly b: PixBuf) {
    this.backdrop = new PixBuf(W, SCENE_H);
    this.makeBackdrop();
    // invert the ground projection once
    let dd = DMIN - 0.2;
    for (let y = SCENE_H - 1; y >= 0; y--) {
      let found = NaN;
      for (; dd < 16; dd += 0.004) {
        if (proj(dd, 0).y <= y + 0.5) {
          found = dd;
          break;
        }
      }
      if (Number.isNaN(found)) break;
      this.gd[y] = found;
      if (found > DMAX) {
        this.yTop = y + 1;
        break;
      }
    }
  }

  // ---------------------------------------------------------------- backdrop: sunset sky and a far skyline
  private makeBackdrop(): void {
    const bd = this.backdrop;
    const stops: [number, number][] = [
      [0, 0xf6b86a],
      [26, 0xf0966e],
      [52, 0xd070a0],
      [70, 0xa8508e],
      [SCENE_H, 0x7a3c78],
    ];
    for (let y = 0; y < SCENE_H; y++) {
      let k = 0;
      while (k < stops.length - 2 && y > stops[k + 1][0]) k++;
      const [y0, c0] = stops[k];
      const [y1, c1] = stops[k + 1];
      const t = clamp((y - y0) / (y1 - y0), 0, 1);
      for (let x = 0; x < W; x++) bd.set(x, y, BAYER4[y & 3][x & 3] / 16 + 0.03 < t ? c1 : c0);
    }
    // a low sun
    for (let y = 18; y < 60; y++)
      for (let x = 60; x < 130; x++) {
        const r = Math.hypot(x - 96, y - 44);
        if (r < 13) bd.set(x, y, 0xffe0a0);
        else if (r < 20 && BAYER4[y & 3][x & 3] < 6) bd.set(x, y, 0xf8c888);
      }
    // far domes and minarets, hazy
    const sil = 0x9a5890;
    const sil2 = 0xb36aa0;
    const tower = (cx: number, w: number, h: number, c: number) => {
      bd.rect(cx - w / 2, 50 - h, w, h + 6, c);
      bd.rect(cx - w / 2 - 1, 50 - h, w + 2, 2, c);
      bd.disc(cx, 50 - h, w / 2 + 1, c);
      bd.rect(cx, 50 - h - w / 2 - 6, 1, 6, c);
    };
    tower(40, 8, 18, sil2);
    tower(58, 6, 26, sil);
    tower(122, 6, 28, sil);
    tower(142, 9, 16, sil2);
    for (const x of [22, 78, 108, 160]) {
      bd.rect(x - 7, 40, 14, 14, sil2);
      bd.disc(x, 40, 7, sil2);
    }
    bd.rect(0, 52, W, 20, 0xa8508e);
  }

  // ---------------------------------------------------------------- effects fed by game events
  burst(row: number, lane: number, col: number, n: number, Y = 0.4): void {
    for (let i = 0; i < n; i++)
      this.parts.push({
        row,
        X: (lane - 1) * LW,
        Y,
        vx: (Math.random() - 0.5) * 1.6,
        vy: Math.random() * 1.8 + 0.4,
        age: 0,
        life: 0.5 + Math.random() * 0.3,
        col,
      });
  }

  popup(row: number, lane: number, text: string, col: number): void {
    this.pops.push({ row, X: (lane - 1) * LW, text, col, age: 0 });
  }

  // ---------------------------------------------------------------- frame
  draw(g: Game, dt: number): void {
    this.t += dt;
    this.shake = Math.max(0, this.shake - dt * 3);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.laneVis += (g.lane - this.laneVis) * Math.min(1, dt * 24);
    const ox = this.shake > 0 ? Math.round((Math.random() - 0.5) * 6 * Math.min(1, this.shake * 2)) : 0;
    const b = this.b;
    b.clipY0 = 0;
    b.clipY1 = SCENE_H;
    // sky
    for (let y = 0; y < SCENE_H; y++) for (let x = 0; x < W; x++) b.set(x, y, this.backdrop.get(x, y));
    this.ground(g, ox);
    const list: Draw[] = [];
    this.collectBuildings(g, list, ox);
    this.collectItems(g, list, ox);
    this.collectAgents(g, list, ox, dt);
    list.sort((a, c) => c.d - a.d);
    for (const it of list) it.fn();
    this.drawFx(g, dt, ox);
    if (this.flash > 0) for (let y = 0; y < SCENE_H; y++) for (let x = 0; x < W; x++) if (BAYER4[y & 3][x & 3] / 16 < this.flash * 0.5) b.blend(x, y, C.red, 0.55);
    b.clipY1 = b.h;
  }

  private ground(g: Game, ox: number): void {
    const b = this.b;
    const gl = [0, 0, 0];
    for (let y = this.yTop; y < SCENE_H; y++) {
      const d = this.gd[y];
      if (d === undefined) continue;
      const phi = d * TH;
      const s = F / (R * Math.sin(phi) + CAMZ);
      const r = g.p + d;
      const rr = ((r % RING) + RING) % RING;
      const idx = Math.floor(rr);
      const fr = rr - idx;
      const dist = Math.floor(idx / DROWS) % DISTRICTS;
      const fog = clamp((d - 1.5) / 12, 0, 1) * 0.92;
      gl[0] = gl[1] = gl[2] = 0;
      for (let i = 0; i < g.echoes.length; i++) gl[g.echoes[i].path[Math.floor(rr * BINS) % (RING * BINS)]]++;
      const x0 = Math.max(0, Math.floor(CX + ox - WX * s));
      const x1 = Math.min(W - 1, Math.ceil(CX + ox + WX * s));
      const stripe = idx % DROWS === 0 && fr < 0.14;
      for (let x = x0; x <= x1; x++) {
        const X = (x + 0.5 - CX - ox) / s;
        if (Math.abs(X) > WX) continue;
        const u = (X + 1.5 * LW) / LW;
        let col: number;
        if (u < 0 || u >= LANES) {
          col = (idx & 1 ? 0x9a8650 : 0x8c7a48) + 0;
          if (Math.abs(X) < 1.33) col = mixc(col, 0x5a4a3a, 0.35);
        } else {
          const lane = Math.floor(u);
          const tile = g.grid[dist][lane];
          col = FLOOR[tile ? tile.rune : 'hole'];
          const fu = u - lane;
          const hs = hash(Math.floor(X * 14), Math.floor(rr * 14)) & 15;
          if (hs === 0) col = mixc(col, 0xffffff, 0.12);
          else if (hs === 1) col = mixc(col, 0x000000, 0.1);
          if (!tile && hs < 6) col = mixc(col, 0x000000, 0.16);
          if (fr < 0.05 || fu < 0.035 || fu > 0.965) col = mixc(col, 0x3a2a30, 0.3);
          else if (idx & 1) col = mixc(col, 0x000000, 0.05);
          if (stripe) col = mixc(col, DISTRICT_COL[dist], 0.75);
          if (gl[lane] > 0) col = mixc(col, C.ghost, 0.1 + 0.07 * gl[lane]);
          if (lane === g.lane && !g.over) col = mixc(col, 0xffffff, 0.06);
        }
        b.set(x, y, mixc(col, C.haze, fog));
      }
    }
  }

  // ---------------------------------------------------------------- buildings along both sides, district gates
  private wq(side: number, d0: number, d1: number, y0: number, y1: number, col: number, ox: number, X = WX, a = 1): void {
    if (d1 < DMIN) return;
    d0 = Math.max(d0, DMIN);
    const p = [proj(d0, side * X, y0, ox), proj(d1, side * X, y0, ox), proj(d1, side * X, y1, ox), proj(d0, side * X, y1, ox)];
    this.b.poly(p.flatMap((q) => [q.x, q.y]), col, a);
  }

  private collectBuildings(g: Game, list: Draw[], ox: number): void {
    const base = Math.floor(g.p);
    for (let k = -1; k <= Math.ceil(DMAX) + 1; k++) {
      const abs = base + k;
      const idx = ((abs % RING) + RING) % RING;
      const d0 = abs - g.p;
      const fogT = clamp((d0 + 0.5 - 1.5) / 12, 0, 1) * 0.9;
      const fg = (c: number) => mixc(c, C.haze, fogT);
      list.push({
        d: d0 + 0.5,
        fn: () => {
          for (const side of [-1, 1]) {
            const hh = hash(idx, side);
            const hgt = 2.4 + (hh % 7) * 0.16;
            const col = FACADES[(hh >> 3) % FACADES.length];
            const lit = side < 0 ? mixc(col, 0xffe0b0, 0.12) : mixc(col, 0x4a3a6a, 0.3);
            // set-back skyline layer
            this.wq(side, d0, d0 + 1.02, 0, hgt + 0.9 + ((hh >> 8) % 4) * 0.25, fg(mixc(col, 0x6a4a7a, 0.45)), ox, WX + 0.9);
            if ((hh >> 5) % 3 === 0) this.dome(side, d0 + 0.5, hgt + 0.9, fg(mixc(col, 0x5a3a6a, 0.3)), ox, WX + 0.9);
            this.wq(side, d0, d0 + 1.02, 0, hgt, fg(lit), ox);
            this.wq(side, d0, d0 + 1.02, hgt - 0.14, hgt, fg(mixc(lit, 0xffffff, 0.22)), ox);
            this.wq(side, d0, d0 + 1.02, 0, 0.16, fg(mixc(lit, 0x2a1a3a, 0.35)), ox);
            const door = (hh >> 9) % 4 === 0;
            if (door) {
              this.wq(side, d0 + 0.2, d0 + 0.8, 0.16, 1.0, fg(0x4a2a3a), ox);
              this.wq(side, d0 + 0.26, d0 + 0.74, 0.16, 0.9, fg(0x6a3a42), ox);
            }
            const win = (hh >> 11) % 3;
            if (win < 2) {
              this.wq(side, d0 + 0.28, d0 + 0.72, 1.25, 1.95, fg(0x36244e), ox);
              this.wq(side, d0 + 0.34, d0 + 0.66, 1.31, 1.9, fg(((hh >> 13) & 1) === 0 ? 0xf0b868 : 0x5a3a72), ox);
              this.wq(side, d0 + 0.24, d0 + 0.76, 1.18, 1.25, fg(mixc(lit, 0xffffff, 0.3)), ox);
            }
            if ((hh >> 14) % 3 === 1) {
              // balcony
              this.wq(side, d0 + 0.1, d0 + 0.9, 0.98, 1.08, fg(mixc(lit, 0xffffff, 0.35)), ox, WX - 0.16);
              this.wq(side, d0 + 0.1, d0 + 0.9, 0.82, 0.98, fg(0x3a2a44), ox, WX - 0.16, 0.8);
            }
          }
        },
      });
      // the gate across the street where a district starts
      if (idx % DROWS === 0) {
        const dist = Math.floor(idx / DROWS) % DISTRICTS;
        if (d0 > DMIN && d0 < DMAX)
          list.push({
            d: d0,
            fn: () => {
              const a = proj(d0, -WX, 2.55, ox);
              const c = proj(d0, WX, 2.55, ox);
              const a2 = proj(d0, -WX, 2.05, ox);
              const c2 = proj(d0, WX, 2.05, ox);
              this.b.poly([a.x, a.y, c.x, c.y, c2.x, c2.y, a2.x, a2.y], fg(mixc(DISTRICT_COL[dist], 0x2a1a3a, 0.25)));
              const m = proj(d0, 0, 2.3, ox);
              const sx = Math.max(1, Math.round(m.s * 0.07));
              for (let i = 0; i <= dist; i++) this.b.rect(m.x - ((dist + 1) * sx * 2) / 2 + i * sx * 2, m.y - sx * 2, sx, sx * 4, fg(0xfbeed8));
            },
          });
      }
    }
  }

  private dome(side: number, d: number, y: number, col: number, ox: number, X: number): void {
    const pts: number[] = [];
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI;
      const q = proj(d + Math.cos(a) * 0.45, side * X, y + Math.sin(a) * 0.55, ox);
      pts.push(q.x, q.y);
    }
    this.b.poly(pts, col);
  }

  // ---------------------------------------------------------------- things lying in the street
  private collectItems(g: Game, list: Draw[], ox: number): void {
    const b = this.b;
    for (let dd = 0; dd < DISTRICTS; dd++)
      for (let lane = 0; lane < LANES; lane++) {
        const tile = g.grid[dd][lane];
        if (!tile) continue;
        const X = (lane - 1) * LW;
        tile.items.forEach((it, i) => {
          let d = rel(dd * DROWS + it.off, g.p);
          if (d > RING / 2) d -= RING;
          const fogT = (dd0: number) => clamp((dd0 - 1.5) / 12, 0, 1) * 0.9;
          if (it.kind === 'spike') {
            if (d + it.len < DMIN || d > DMAX) return;
            list.push({
              d: d + it.len,
              fn: () => {
                const dA = Math.max(d, DMIN);
                const f = fogT(d);
                const p = [proj(dA, X - 0.34, 0, ox), proj(d + it.len, X - 0.34, 0, ox), proj(d + it.len, X + 0.34, 0, ox), proj(dA, X + 0.34, 0, ox)];
                b.poly(p.flatMap((q) => [q.x, q.y]), mixc(0x4a2436, C.haze, f));
                for (let t = d + 0.2; t < d + it.len; t += 0.42) {
                  if (t < DMIN) continue;
                  for (const k of [-0.2, 0, 0.2]) {
                    const q = proj(t, X + k, 0, ox);
                    const w = Math.max(1, q.s * 0.075);
                    const h = Math.max(2, q.s * 0.3);
                    b.poly([q.x - w, q.y, q.x + w, q.y, q.x, q.y - h], mixc(0xe8e8f4, C.haze, f));
                    b.poly([q.x, q.y, q.x + w, q.y, q.x, q.y - h], mixc(0x8a8aa8, C.haze, f));
                  }
                }
              },
            });
            return;
          }
          if (tile.state[i] <= 0 || d < -0.35 || d > DMAX) return;
          const f = fogT(d);
          const q0 = proj(d, X, 0, ox);
          if (it.kind === 'coin') {
            list.push({
              d,
              fn: () => {
                const spin = 0.28 + 0.72 * Math.abs(Math.cos(this.t * 5 + d * 0 + dd * 2 + i));
                const q = proj(d, X, 0.34 + 0.05 * Math.sin(this.t * 4 + i + dd), ox);
                const r = Math.max(2, q.s * 0.15);
                b.ell(q0.x, q0.y, r * 0.9, r * 0.28, 0x000000, 0.3);
                b.ell(q.x, q.y, r * spin, r, mixc(C.goldDark, C.haze, f));
                b.ell(q.x, q.y, r * spin * 0.8, r * 0.82, mixc(C.gold, C.haze, f));
                if (spin > 0.5) b.ell(q.x - r * spin * 0.25, q.y - r * 0.3, Math.max(0.6, r * spin * 0.22), Math.max(0.8, r * 0.22), mixc(0xfff4b0, C.haze, f));
              },
            });
          } else if (it.kind === 'well') {
            list.push({
              d,
              fn: () => {
                const rx = q0.s * 0.34;
                b.ell(q0.x, q0.y, rx * 1.1, rx * 0.4, 0x000000, 0.3);
                b.ell(q0.x, q0.y - rx * 0.3, rx, rx * 0.45, mixc(0x8a8aa8, C.haze, f));
                b.rect(q0.x - rx, q0.y - rx * 0.3, rx * 2, rx * 0.35, mixc(0x6a6a88, C.haze, f));
                b.ell(q0.x, q0.y - rx * 0.45, rx * 0.82, rx * 0.32, mixc(0x58c8f0, C.haze, f));
                const sp = Math.sin(this.t * 6);
                b.rect(q0.x + sp * rx * 0.3, q0.y - rx * 0.55, Math.max(1, rx * 0.15), 1, mixc(0xe8fbff, C.haze, f));
                b.poly([q0.x, q0.y - rx * 1.5, q0.x + rx * 0.22, q0.y - rx * 0.6, q0.x - rx * 0.22, q0.y - rx * 0.6], mixc(0x9ae6ff, C.haze, f), 0.8);
              },
            });
          } else {
            const brute = it.kind === 'brute';
            list.push({
              d,
              fn: () => {
                const spr = brute ? SPR.brute : SPR.bandit;
                const h = q0.s * (brute ? 1.05 : 0.8);
                b.ell(q0.x, q0.y, h * 0.34, h * 0.09, 0x000000, 0.3);
                const bob = Math.round(Math.sin(this.t * 6 + i * 2 + dd) * (q0.s > 30 ? 1 : 0));
                b.sprite(spr, q0.x, q0.y + bob, h, { tint: C.haze, tintAmount: f });
                if (brute && tile.state[i] === 1) b.rect(q0.x - h * 0.2, q0.y - h - 3, h * 0.4, 2, C.red);
              },
            });
          }
        });
      }
  }

  // ---------------------------------------------------------------- you and your ghosts
  private collectAgents(g: Game, list: Draw[], ox: number, dt: number): void {
    const b = this.b;
    const frame = Math.floor(this.t * 9) % 2;
    const ids = new Set<number>();
    g.echoes.forEach((e, i) => {
      ids.add(e.id);
      const lane = g.echoLane(i);
      const cur = this.ghostVis.get(e.id) ?? lane;
      const v = cur + (lane - cur) * Math.min(1, dt * 24);
      this.ghostVis.set(e.id, v);
      list.push({
        d: 0.001 - 0.001 * i,
        fn: () => {
          const q = proj(0, (v - 1) * LW, 0, ox);
          const off = (i - 1) * 6;
          const h = q.s * 0.78;
          const bob = Math.round(Math.sin(this.t * 7 + i * 2));
          b.ell(q.x + off, q.y + 2, h * 0.3, h * 0.08, C.ghost, 0.18);
          b.sprite(frame ? SPR.runnerB : SPR.runnerA, q.x + off, q.y + bob + 2, h, { tint: C.ghost, tintAmount: 0.82, alpha: 0.55 + 0.1 * Math.sin(this.t * 6 + i) });
        },
      });
    });
    for (const k of this.ghostVis.keys()) if (!ids.has(k)) this.ghostVis.delete(k);
    list.push({
      d: 0,
      fn: () => {
        const q = proj(0, (this.laneVis - 1) * LW, 0, ox);
        const h = q.s * 0.8;
        if (g.invuln > 0 && Math.floor(this.t * 16) % 2 === 0) return;
        b.ell(q.x, q.y, h * 0.32, h * 0.09, 0x000000, 0.4);
        const bob = Math.round(Math.sin(this.t * 18) * 1);
        b.sprite(frame ? SPR.runnerB : SPR.runnerA, q.x, q.y + bob, h);
      },
    });
  }

  // ---------------------------------------------------------------- particles and popups (anchored in the world)
  private drawFx(g: Game, dt: number, ox: number): void {
    const b = this.b;
    this.parts = this.parts.filter((p) => (p.age += dt) < p.life);
    for (const p of this.parts) {
      let d = rel(p.row, g.p);
      if (d > RING / 2) d -= RING;
      if (d < DMIN || d > DMAX) continue;
      const q = proj(d, p.X + p.vx * p.age * 0.5, p.Y + p.vy * p.age - 3.5 * p.age * p.age, ox);
      b.rect(q.x, q.y, 2, 2, p.col, 1 - p.age / p.life);
    }
    this.pops = this.pops.filter((p) => (p.age += dt) < 0.9);
    for (const p of this.pops) {
      let d = rel(p.row, g.p);
      if (d > RING / 2) d -= RING;
      if (d < DMIN || d > DMAX) continue;
      const q = proj(d, p.X, 0.6, ox);
      b.textC(p.text, q.x, q.y - p.age * 22, p.col, 1, C.ink);
    }
  }
}
