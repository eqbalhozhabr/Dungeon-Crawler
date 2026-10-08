import Phaser from 'phaser';
import { FP, H, W } from '../config';
import { dither, NONE, Px } from './pixel';
import { drawRing } from './sprites';

// First-person belly tunnel, rendered once at boot by casting a ray for every pixel
// (floor, ceiling, side walls, far end). Same camera as fpProject() in config.ts.

function hash(ix: number, iy: number, salt: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(salt, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Cellular noise: distance to the nearest (f1) and second nearest (f2) feature point. */
function voronoi(u: number, v: number): { f1: number; f2: number } {
  const iu = Math.floor(u), iv = Math.floor(v);
  let f1 = 9, f2 = 9;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const px = iu + dx + hash(iu + dx, iv + dy, 1);
      const py = iv + dy + hash(iu + dx, iv + dy, 2);
      const d = Math.hypot(px - u, py - v);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
  return { f1, f2 };
}

const FLESH = [0x12050c, 0x21101a, 0x361626, 0x52213a, 0x7a2f4b, 0xa84a63, 0xd8788a];

function pickTone(level: number, x: number, y: number): number {
  const l = Math.max(0, Math.min(FLESH.length - 1.001, level));
  const base = Math.floor(l);
  return FLESH[base + (dither(x, y, l - base) ? 1 : 0)];
}

function castRay(x: number, y: number) {
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

export function drawTunnel(): Px {
  const px = new Px(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const { d, surf, X, Y } = castRay(x, y);
      if (d > FP.dEnd) {
        // the far end: the creature's mouth, a faint glow in the dark
        const mx = (x + 0.5 - FP.cx) / (FP.f / FP.dEnd);
        const my = (FP.camY - 1.5) - ((y + 0.5 - FP.yh) / (FP.f / FP.dEnd)) * -1;
        const rr = Math.hypot(mx / 2.6, (my - 1.5 + 1.5) / 1.7);
        const glow = Math.max(0, 1 - rr) * 3.2;
        px.set(x, y, pickTone(0.3 + glow * 0.9, x, y));
        continue;
      }
      const u = (surf === 'wall' ? Y : X) * 1.3;
      const v = d * 1.1 + (surf === 'wall' ? (X > 0 ? 3.7 : 0) : 0);
      const { f1, f2 } = voronoi(u, v);
      const membrane = f2 - f1 < 0.11;
      const dome = 1 - Math.min(1, f1 * 1.5);
      const fog = Math.max(0, 1 - (d - 2.5) / 11);
      let light = (0.55 + 0.85 * dome) * fog * 3.5;
      if (membrane) light += 1.1 * fog;
      if (surf === 'ceil') light *= 0.7;
      if (surf === 'floor') {
        const inBelt = Math.abs(X) <= 2.5 * FP.lane && d >= 2.5 && d <= 11.5;
        if (inBelt) {
          light += 0.8 * fog;
          const m = X / FP.lane + 2.5;
          const laneLine = Math.abs(m - Math.round(m)) < (0.6 * d) / FP.f / FP.lane;
          const cross = Math.abs(d - 0.5 - Math.round(d - 0.5)) < 0.6 * d * d / (FP.f * FP.camY);
          if (laneLine || cross) light -= 1.4 * fog + 0.4;
          // dashed line where the player's reach ends (columns 0-2 are too far to touch)
          if (Math.abs(d - 8.5) < 1.3 * d * d / (FP.f * FP.camY) && (x >> 1) % 2 === 0) {
            px.set(x, y, 0xd9a93a);
            continue;
          }
        }
      }
      px.set(x, y, pickTone(light, x, y));
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
      // foam where the belt drops in
      if (d > 3.5 - 0.22 * (1 + Math.sin(X * 4 + frame))) t = 3.9;
      const l = Math.max(0, Math.min(3.99, t));
      const b = Math.floor(l);
      px.set(x, y, ramp[b + (dither(x, sy, l - b) && b < 4 ? 1 : 0)]);
      // bubbles
      if (hash(x >> 2, (sy >> 2) + frame, 9) > 0.985) px.set(x, y, ramp[4]);
    }
  return px;
}

export function generateFpTextures(scene: Phaser.Scene): void {
  const put = (key: string, px: Px) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, px.toCanvas());
  };
  put('fp_bg', drawTunnel());
  const y0 = 204;
  for (let f = 0; f < 4; f++) put(`fp_acid_${f}`, drawAcidFrame(f, y0, H - y0));
  for (let o = 0; o < 3; o++) {
    const px = new Px(40, 40);
    drawRing(px, 20, 20, 19, o);
    put(`fp_exit_${o}`, px);
  }
  void NONE;
}
