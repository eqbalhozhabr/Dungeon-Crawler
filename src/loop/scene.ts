// The street: the OUTSIDE of a drum seen through a fisheye lens (camera.ts), pseudo-3D, drawn pixel by pixel.
import { BAYER4 } from '../art/pixel';
import { PixBuf, mixc } from './art/buf';
import { SPR } from './art/sprites';
import { buildGroundMap, proj, scaleAt, type GroundMap } from './camera';
import { C, FLOOR, SCENE_H, W } from './config';
import { countSeats, crowd, describeNeed, meets } from './logic/formation';
import { rel, type Game } from './logic/game';
import { BINS, DISTRICTS, DROWS, LANES, RING } from './logic/types';

export const LW = 0.8; // lane width in world units
const WX = 1.62; // half distance between the walls
const DMIN = -1.1;
const DCAP = 16;

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
  private readonly gm: GroundMap;
  /** Buildings and things are drawn out to here; beyond it the curve of the drum hides the road. */
  private readonly dMax: number;
  private parts: Particle[] = [];
  private pops: Popup[] = [];
  private ghostVis = new Map<number, number>();
  laneVis = 1;
  shake = 0;
  flash = 0;
  t = 0;

  constructor(private readonly b: PixBuf) {
    this.gm = buildGroundMap(WX, DMIN - 0.2, DCAP);
    this.dMax = Math.min(this.gm.dMax - 0.4, 13.5);
    this.backdrop = new PixBuf(W, SCENE_H);
    this.makeBackdrop();
  }

  // ---------------------------------------------------------------- backdrop: sunset sky and a far skyline on the horizon
  private makeBackdrop(): void {
    const bd = this.backdrop;
    const hy = Math.round(proj(this.dMax + 0.4, 0).y);
    const stops: [number, number][] = [
      [0, 0xf6b86a],
      [Math.round(hy * 0.45), 0xf0966e],
      [Math.round(hy * 0.8), 0xd070a0],
      [hy, 0xa8508e],
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
    for (let y = 0; y < hy; y++)
      for (let x = 55; x < 135; x++) {
        const r = Math.hypot(x - 96, y - (hy - 22));
        if (r < 13) bd.set(x, y, 0xffe0a0);
        else if (r < 20 && BAYER4[y & 3][x & 3] < 6) bd.set(x, y, 0xf8c888);
      }
    // far domes and minarets on the rim of the drum, hazy
    const sil = 0x9a5890;
    const sil2 = 0xb36aa0;
    const tower = (cx: number, w: number, h: number, c: number) => {
      bd.rect(cx - w / 2, hy - h, w, h + 6, c);
      bd.rect(cx - w / 2 - 1, hy - h, w + 2, 2, c);
      bd.disc(cx, hy - h, w / 2 + 1, c);
      bd.rect(cx, hy - h - w / 2 - 6, 1, 6, c);
    };
    tower(36, 8, 16, sil2);
    tower(56, 6, 24, sil);
    tower(124, 6, 26, sil);
    tower(146, 9, 14, sil2);
    for (const x of [20, 76, 108, 162]) {
      bd.rect(x - 7, hy - 12, 14, 14, sil2);
      bd.disc(x, hy - 12, 7, sil2);
    }
    bd.rect(0, hy, W, SCENE_H - hy, 0xa8508e);
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
    for (let y = 0; y < SCENE_H; y++) for (let x = 0; x < W; x++) b.set(x, y, this.backdrop.get(x, y));
    this.ground(g, ox);
    const list: Draw[] = [];
    this.collectBuildings(g, list, ox);
    this.collectSeal(g, list, ox);
    this.collectItems(g, list, ox);
    this.collectAgents(g, list, ox, dt);
    list.sort((a, c) => c.d - a.d);
    for (const it of list) it.fn();
    this.drawFx(g, dt, ox);
    if (this.flash > 0) for (let y = 0; y < SCENE_H; y++) for (let x = 0; x < W; x++) if (BAYER4[y & 3][x & 3] / 16 < this.flash * 0.5) b.blend(x, y, C.red, 0.55);
    b.clipY1 = b.h;
  }

  /** Every pixel of the road asks the ground map which road point it shows, then colours it. */
  private ground(g: Game, ox: number): void {
    const b = this.b;
    const { d: gd, x: gx } = this.gm;
    const gl = [0, 0, 0];
    const span = this.dMax - 1.5;
    let lastRow = -1;
    let idx = 0;
    let fr = 0;
    let dist = 0;
    let rr = 0;
    let lastD = NaN;
    for (let y = 0; y < SCENE_H; y++) {
      for (let x = 0; x < W; x++) {
        const k = y * W + x;
        const d = gd[k];
        if (Number.isNaN(d) || d > this.dMax + 0.3) continue;
        const X = gx[k];
        if (d !== lastD) {
          lastD = d;
          const r = g.p + d;
          rr = ((r % RING) + RING) % RING;
          idx = Math.floor(rr);
          fr = rr - idx;
          dist = Math.floor(idx / DROWS) % DISTRICTS;
          if (idx !== lastRow) {
            lastRow = idx;
          }
          gl[0] = gl[1] = gl[2] = 0;
          for (let i = 0; i < g.echoes.length; i++) gl[g.echoes[i].path[Math.floor(rr * BINS) % (RING * BINS)]]++;
        }
        const fog = clamp((d - 1.5) / span, 0, 1) * 0.92;
        const stripe = idx === 0 && fr < 0.14;
        const u = (X + 1.5 * LW) / LW;
        let col: number;
        if (u < 0 || u >= LANES) {
          col = idx & 1 ? 0x9a8650 : 0x8c7a48;
          if (Math.abs(X) < 1.33) col = mixc(col, 0x5a4a3a, 0.35);
        } else {
          const lane = Math.floor(u);
          const tile = g.grid[dist][lane];
          col = FLOOR[tile.rune];
          const fu = u - lane;
          const hs = hash(Math.floor(X * 14), Math.floor(rr * 14)) & 15;
          if (hs === 0) col = mixc(col, 0xffffff, 0.12);
          else if (hs === 1) col = mixc(col, 0x000000, 0.1);
          if (fr < 0.05 || fu < 0.035 || fu > 0.965) col = mixc(col, 0x3a2a30, 0.3);
          else if (idx & 1) col = mixc(col, 0x000000, 0.05);
          if (stripe) col = mixc(col, C.gold, 0.7);
          if (gl[lane] > 0) col = mixc(col, C.ghost, 0.1 + 0.07 * gl[lane]);
          if (lane === g.lane && !g.over) col = mixc(col, 0xffffff, 0.06);
        }
        b.set(x + ox, y, mixc(col, C.haze, fog));
      }
    }
  }

  // ---------------------------------------------------------------- surfaces: a grid of small quads through the lens, so edges bend
  /** A rectangle in (u,v) in the world, drawn as a grid of projected quads. `at` maps u,v in 0..1 to a world point. */
  private surf(at: (u: number, v: number) => [number, number, number], col: number, ox: number, a = 1, nu = 0, nv = 0): void {
    const q = (u: number, v: number) => {
      const w = at(u, v);
      return proj(w[0], w[1], w[2], ox);
    };
    if (!nu || !nv) {
      const p0 = q(0, 0);
      const p1 = q(1, 0);
      const p2 = q(0, 1);
      nu = clamp(Math.ceil(Math.hypot(p1.x - p0.x, p1.y - p0.y) / 14), 1, 6);
      nv = clamp(Math.ceil(Math.hypot(p2.x - p0.x, p2.y - p0.y) / 14), 1, 8);
    }
    const grid: { x: number; y: number }[][] = [];
    for (let j = 0; j <= nv; j++) {
      const row: { x: number; y: number }[] = [];
      for (let i = 0; i <= nu; i++) row.push(q(i / nu, j / nv));
      grid.push(row);
    }
    for (let j = 0; j < nv; j++)
      for (let i = 0; i < nu; i++) {
        const A = grid[j][i];
        const B = grid[j][i + 1];
        const Cc = grid[j + 1][i + 1];
        const D = grid[j + 1][i];
        this.b.poly([A.x, A.y, B.x, B.y, Cc.x, Cc.y, D.x, D.y], col, a);
      }
  }

  private wq(side: number, d0: number, d1: number, y0: number, y1: number, col: number, ox: number, X = WX, a = 1): void {
    if (d1 < DMIN || d0 > this.dMax + 1) return;
    d0 = Math.max(d0, DMIN);
    this.surf((u, v) => [d0 + (d1 - d0) * u, side * X, y0 + (y1 - y0) * v], col, ox, a);
  }

  // ---------------------------------------------------------------- buildings along both sides, district gates
  private collectBuildings(g: Game, list: Draw[], ox: number): void {
    const base = Math.floor(g.p);
    for (let k = -1; k <= Math.ceil(this.dMax) + 1; k++) {
      const abs = base + k;
      const idx = ((abs % RING) + RING) % RING;
      const d0 = abs - g.p;
      const fogT = clamp((d0 + 0.5 - 1.5) / (this.dMax - 1.5), 0, 1) * 0.9;
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
      // an arch across the street at every district boundary; the one at the start of the lap is the seal
      if (idx % DROWS === 0) {
        const seal = idx === 0;
        if (d0 > DMIN && d0 < this.dMax && !(seal && d0 < 0.2))
          list.push({
            d: d0,
            fn: () => {
              const col = seal ? mixc(0xd8a838, 0x2a1a3a, 0.2) : mixc(0x9a8a9a, 0x2a1a3a, 0.35);
              this.surf((u, v) => [d0, -WX + 2 * WX * u, 2.05 + 0.5 * v], fg(col), ox, 1, 8, 2);
              if (seal) {
                const m = proj(d0, 0, 2.3, ox);
                const sx = Math.max(1, Math.round(scaleAt(d0, 0, ox).sx * 0.07));
                for (let i = -1; i <= 1; i++) this.b.rect(m.x + i * sx * 3 - sx / 2, m.y - sx * 2, sx, sx * 4, fg(0xfff0c0));
              }
            },
          });
      }
    }
  }

  private dome(side: number, d: number, y: number, col: number, ox: number, X: number): void {
    const pts: number[] = [];
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI;
      const q = proj(d + Math.cos(a) * 0.45, side * X, y + Math.sin(a) * 0.55, ox);
      pts.push(q.x, q.y);
    }
    this.b.poly(pts, col);
  }

  // ---------------------------------------------------------------- the seal: three plates on the road, one per lane
  private collectSeal(g: Game, list: Draw[], ox: number): void {
    // the seal at row 0 is behind you for the first rows of a lap (then it shows the formation just checked)
    const near = g.p < 1.2;
    const j = near ? Math.max(0, g.nextSeal - 1) : g.nextSeal;
    const d = near ? -g.p : RING - g.p;
    if (d < -0.5 || d > this.dMax) return;
    const info = g.sealInfo(j);
    const lanes = countSeats([...info.ghosts, ...(info.live ? [g.lane] : [])]);
    const complete = info.ghosts.length + (info.live ? 1 : 0) === crowd(j);
    const met = complete && meets(info.demand, lanes);
    const fog = clamp((d - 1.5) / (this.dMax - 1.5), 0, 1) * 0.9;
    list.push({
      d: d - 0.01,
      fn: () => {
        const b = this.b;
        for (let l = 0; l < LANES; l++) {
          const X = (l - 1) * LW;
          const need = info.demand[l];
          const edge = met ? 0x6bdc70 : need.lo > 0 ? C.gold : need.hi === 0 ? 0xe0485a : 0x6a5a7a;
          this.surf((u, v) => [d - 0.45 + 0.9 * u, X - 0.35 + 0.7 * v, 0], mixc(edge, C.haze, fog), ox, 1, 0, 0);
          this.surf((u, v) => [d - 0.38 + 0.76 * u, X - 0.29 + 0.58 * v, 0], mixc(0x3a2448, C.haze, fog), ox, 1, 0, 0);
          const c = proj(d, X, 0, ox);
          const sc = scaleAt(d, X, ox);
          const label = describeNeed(need);
          if (sc.sx >= 16) {
            const scale = sc.sx >= 40 ? 3 : sc.sx >= 26 ? 2 : 1;
            const w = b.textWidth(label, scale);
            b.text(label, c.x - w / 2, c.y - (scale * 7) / 2, mixc(need.lo === 0 && need.hi === 0 ? 0xe0485a : need.lo === 0 ? 0xb89aa6 : C.gold, C.haze, fog), scale, C.ink);
          } else if (need.lo > 0) {
            const r = Math.max(1, sc.sx * 0.07);
            for (let i = 0; i < Math.min(need.lo, 3); i++) b.disc(c.x + (i - (Math.min(need.lo, 3) - 1) / 2) * r * 2.6, c.y, r, mixc(C.gold, C.haze, fog));
          }
          // runners already standing there: ghosts that will still be around at the seal (blue rings)
          let n = 0;
          for (const s of info.ghosts) if (s === l) n++;
          const r2 = Math.max(1.5, sc.sx * 0.085);
          for (let i = 0; i < n; i++) b.ring(c.x + (i - (n - 1) / 2) * r2 * 2.6, c.y + sc.sy * 0.26, r2, C.ghost);
        }
      },
    });
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
          const fogT = (dd0: number) => clamp((dd0 - 1.5) / (this.dMax - 1.5), 0, 1) * 0.9;
          if (it.kind === 'spike') {
            if (d + it.len < DMIN || d > this.dMax) return;
            list.push({
              d: d + it.len,
              fn: () => {
                const dA = Math.max(d, DMIN);
                const f = fogT(d);
                this.surf((u, v) => [dA + (d + it.len - dA) * u, X - 0.34 + 0.68 * v, 0], mixc(0x4a2436, C.haze, f), ox, 1, 0, 0);
                for (let t = d + 0.2; t < d + it.len; t += 0.42) {
                  if (t < DMIN || t > this.dMax) continue;
                  for (const k of [-0.2, 0, 0.2]) {
                    const q = proj(t, X + k, 0, ox);
                    const sc = scaleAt(t, X + k, ox);
                    const w = Math.max(1, sc.sx * 0.075);
                    const h = Math.max(2, sc.sy * 0.3);
                    b.poly([q.x - w, q.y, q.x + w, q.y, q.x, q.y - h], mixc(0xe8e8f4, C.haze, f));
                    b.poly([q.x, q.y, q.x + w, q.y, q.x, q.y - h], mixc(0x8a8aa8, C.haze, f));
                  }
                }
              },
            });
            return;
          }
          if (tile.state[i] <= 0 || d < -0.35 || d > this.dMax) return;
          const f = fogT(d);
          const q0 = proj(d, X, 0, ox);
          const sc = scaleAt(d, X, ox);
          if (it.kind === 'coin') {
            list.push({
              d,
              fn: () => {
                const spin = 0.28 + 0.72 * Math.abs(Math.cos(this.t * 5 + dd * 2 + i));
                const q = proj(d, X, 0.34 + 0.05 * Math.sin(this.t * 4 + i + dd), ox);
                const r = Math.max(2, sc.sx * 0.15);
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
                const rx = sc.sx * 0.34;
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
            list.push({
              d,
              fn: () => {
                const spr = SPR.bandit;
                const h = sc.sy * 0.8;
                b.ell(q0.x, q0.y, h * 0.34, h * 0.09, 0x000000, 0.3);
                const bob = Math.round(Math.sin(this.t * 6 + i * 2 + dd) * (h > 24 ? 1 : 0));
                b.sprite(spr, q0.x, q0.y + bob, h, { tint: C.haze, tintAmount: f });
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
          const h = scaleAt(0, (v - 1) * LW, ox).sy * 0.78;
          const off = (i - 1) * 6;
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
        const X = (this.laneVis - 1) * LW;
        const q = proj(0, X, 0, ox);
        const h = scaleAt(0, X, ox).sy * 0.8;
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
      if (d < DMIN || d > this.dMax) continue;
      const q = proj(d, p.X + p.vx * p.age * 0.5, p.Y + p.vy * p.age - 3.5 * p.age * p.age, ox);
      b.rect(q.x, q.y, 2, 2, p.col, 1 - p.age / p.life);
    }
    this.pops = this.pops.filter((p) => (p.age += dt) < 0.9);
    for (const p of this.pops) {
      let d = rel(p.row, g.p);
      if (d > RING / 2) d -= RING;
      if (d < DMIN || d > this.dMax) continue;
      const q = proj(d, p.X, 0.6, ox);
      b.textC(p.text, q.x, q.y - p.age * 22, p.col, 1, C.ink);
    }
  }
}
