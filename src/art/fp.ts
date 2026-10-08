import Phaser from 'phaser';
import { FP, H, W } from '../config';
import { PAL } from '../logic/levels';
import { dither, Px } from './pixel';
import { drawRing } from './sprites';

// First-person belly tunnel, rendered by casting a ray for every pixel (floor, ceiling, side walls,
// far end). Same camera as fpProject() in config.ts. Inked, cel-shaded look: flat colour bands inside
// each cell, thick dark membranes, light only where the lamp reaches. Two "boil" variants whose lines
// wobble slightly are swapped a few times a second (hand-drawn feel).

function hash(ix: number, iy: number, salt: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(salt, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Cellular noise: distance to the nearest (f1) and second nearest (f2) feature point. */
function voronoi(u: number, v: number, boil: number): { f1: number; f2: number } {
  const iu = Math.floor(u), iv = Math.floor(v);
  let f1 = 9, f2 = 9;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const jx = (hash(iu + dx, iv + dy, 20 + boil) - 0.5) * 0.14;
      const jy = (hash(iu + dx, iv + dy, 30 + boil) - 0.5) * 0.14;
      const px = iu + dx + hash(iu + dx, iv + dy, 1) + jx;
      const py = iv + dy + hash(iu + dx, iv + dy, 2) + jy;
      const d = Math.hypot(px - u, py - v);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
  return { f1, f2 };
}

export function castRay(x: number, y: number) {
  const dx = (x + 0.5 - FP.cx) / FP.f;
  const dy = (y + 0.5 - FP.yh) / FP.f;
  let d = 1e9;
  let surf: 'floor' | 'ceil' | 'wall' = 'wall';
  if (dy > 1e-6) {
    const t = FP.camY / dy;
    if (t < d) { d = t; surf = 'floor'; }
  } else if (dy < -1e-6) {
    const t = (FP.camY - FP.ceil) / dy;
    if (t < d) { d = t; surf = 'ceil'; }
  }
  if (Math.abs(dx) > 1e-6) {
    const t = FP.wall / Math.abs(dx);
    if (t < d) { d = t; surf = 'wall'; }
  }
  return { d, surf, X: dx * d, Y: FP.camY - dy * d };
}

export function drawTunnel(pal: number[], boil: number): Px {
  const px = new Px(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const { d, surf, X, Y } = castRay(x, y);
      if (d > FP.dEnd) {
        px.set(x, y, pal[1]); // far end wall: dark, the exit door is a sprite on top
        continue;
      }
      const u = (surf === 'wall' ? Y : X) * 1.25;
      const v = d * 1.0 + (surf === 'wall' ? (X > 0 ? 3.7 : 0) : 0);
      const { f1, f2 } = voronoi(u, v, boil);
      const edge = f2 - f1;
      const fog = Math.max(0, Math.min(1, 1 - (d - 2.5) / 10.5));
      const dome = 1 - Math.min(1, f1 * 1.45);
      let level = (1.3 + 2.9 * dome) * (0.3 + 0.7 * fog) + (surf === 'ceil' ? -0.7 : 0);
      if (surf === 'floor') {
        const inBelt = Math.abs(X) <= 2.5 * FP.lane && d >= 2.5 && d <= 11.5;
        if (inBelt) {
          level += 0.9 * fog + 0.3;
          const m = X / FP.lane + 2.5;
          if (Math.abs(m - Math.round(m)) < (0.7 * d) / FP.f / FP.lane) {
            px.set(x, y, pal[0]); // lane lines
            continue;
          }
        }
      }
      if (edge < 0.11 + (1 - fog) * 0.04) {
        px.set(x, y, pal[0]); // inked membrane
        continue;
      }
      if (edge < 0.2) level += 0.9; // rim light next to the ink
      const l = Math.max(0, Math.min(pal.length - 1.01, level));
      let idx = Math.floor(l);
      if (d > 8.5 && dither(x, y, l - idx)) idx += 1; // soft only in the fog
      px.set(x, y, pal[Math.min(pal.length - 1, idx)]);
    }
  return px;
}

export function drawAcidFrame(frame: number, y0: number, h: number): Px {
  const px = new Px(W, h);
  const ramp = [0x14420f, 0x2a7a22, 0x4fb52e, 0x8cf03e, 0xd4ff7a];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < W; x++) {
      const sy = y + y0;
      const { d, surf, X } = castRay(x, sy);
      if (surf !== 'floor' || d >= 3.5 || d < 0.4 || Math.abs(X) > FP.wall) continue;
      const wave = Math.sin(d * 5.5 + X * 1.7 + frame * 1.57) * 0.5 + Math.sin(X * 3.1 - d * 2.2 - frame * 1.1) * 0.5;
      let t = 1.1 + wave * 0.9 + (3.5 - d) * 0.35;
      if (d > 3.5 - 0.22 * (1 + Math.sin(X * 4 + frame))) t = 3.9; // foam
      const l = Math.max(0, Math.min(3.99, t));
      const b = Math.floor(l);
      px.set(x, y, ramp[b + (dither(x, sy, l - b) && b < 4 ? 1 : 0)]);
      if (hash(x >> 2, (sy >> 2) + frame, 9) > 0.985) px.set(x, y, ramp[4]); // bubbles
    }
  return px;
}

/** Sparse black dots (ordered dither) that darken the corners: pixel-art vignette. */
function drawVignette(): Px {
  const px = new Px(W, H);
  const cx = FP.cx, cy = 150;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const r = Math.hypot((x - cx) / 300, (y - cy) / 190);
      const t = Math.max(0, Math.min(1, (r - 0.45) / 0.75));
      if (dither(x, y, t * t * 0.95)) px.set(x, y, 0x000000);
    }
  return px;
}

function drawGrain(seed: number): Px {
  const px = new Px(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const h = hash(x, y, 500 + seed);
      if (h < 0.012) px.set(x, y, 0x000000);
      else if (h > 0.9965) px.set(x, y, 0xffffff);
    }
  return px;
}

const generated = new Set<string>();

/** The belly of one creature (two boil frames). Cached per palette so it only costs time once. */
export function ensureTunnel(scene: Phaser.Scene, paletteName: string, pal: number[]): void {
  for (let b = 0; b < 2; b++) {
    const key = `fp_bg_${paletteName}_${b}`;
    if (scene.textures.exists(key)) continue;
    scene.textures.addCanvas(key, drawTunnel(pal, b).toCanvas());
    generated.add(key);
  }
}

export function paletteName(pal: number[]): string {
  const hit = Object.entries(PAL).find(([, v]) => v === pal);
  return hit ? hit[0] : 'pink';
}

export function generateFpTextures(scene: Phaser.Scene): void {
  const put = (key: string, px: Px) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, px.toCanvas());
  };
  const y0 = 204;
  for (let f = 0; f < 4; f++) put(`fp_acid_${f}`, drawAcidFrame(f, y0, H - y0));
  for (let o = 0; o < 3; o++) {
    const px = new Px(56, 56);
    drawRing(px, 28, 28, 27, o);
    put(`fp_exit_${o}`, px);
  }
  put('fx_vignette', drawVignette());
  for (let g = 0; g < 3; g++) put(`fx_grain_${g}`, drawGrain(g));
}
