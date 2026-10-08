import Phaser from 'phaser';
import { Px } from './pixel';

// Creature portraits (28x28), drawn by code. Placeholders for hand-drawn art later (see docs/ART_BRIEF.md).
const INK = 0x1a0a14;

function ramp(base: number[]): { d: number; m: number; l: number } {
  return { d: base[0], m: base[1], l: base[2] };
}

function shadeBody(px: Px, cx: number, cy: number, rx: number, ry: number, c: { d: number; m: number; l: number }): void {
  px.ellipse(cx, cy, rx, ry, (dx, dy, g) => {
    const lit = -dx * 0.55 - dy * 0.8;
    if (g > 0.8 && dy > 0.2) return c.d;
    return lit > 0.5 ? c.l : lit > -0.25 ? c.m : c.d;
  });
}

function eye(px: Px, x: number, y: number, r: number, pupil = 0): void {
  px.ellipse(x, y, r, r, 0xffffff);
  px.ellipse(x + pupil, y + 0.5, r * 0.45, r * 0.45, INK);
}

function frog(): Px {
  const px = new Px(28, 28);
  const c = ramp([0x1c6b2a, 0x3fb04a, 0x8be070]);
  shadeBody(px, 14, 17, 12, 8.5, c);
  px.ellipse(8, 9, 4.6, 4.6, c.m);
  px.ellipse(20, 9, 4.6, 4.6, c.m);
  eye(px, 8, 9, 3.2, 1);
  eye(px, 20, 9, 3.2, -1);
  px.line(5, 20, 23, 20, INK);
  px.line(5, 20, 4, 18, INK);
  px.line(23, 20, 24, 18, INK);
  px.set(12, 15, INK);
  px.set(16, 15, INK);
  px.outline(INK);
  return px;
}

function toad(): Px {
  const px = new Px(28, 28);
  const c = ramp([0x4a4a1c, 0x8a8a3a, 0xc4c46a]);
  shadeBody(px, 14, 16, 12.5, 9.5, c);
  for (const [x, y] of [[7, 13], [21, 13], [12, 11], [17, 12], [9, 19], [19, 19], [14, 21]]) px.ellipse(x, y, 1.6, 1.6, 0x5c5c24);
  eye(px, 9, 8, 2.8, 1);
  eye(px, 19, 8, 2.8, -1);
  px.rect(6, 21, 16, 1, INK);
  px.ellipse(23.5, 5, 2, 2, 0xcfeaff); // hiccup bubble
  px.outline(INK);
  return px;
}

function hippo(): Px {
  const px = new Px(28, 28);
  const c = ramp([0x4a5a8a, 0x7e90c4, 0xb4c4ee]);
  shadeBody(px, 14, 14, 12, 10.5, c);
  px.ellipse(5, 5, 2.6, 2.6, c.m);
  px.ellipse(23, 5, 2.6, 2.6, c.m);
  px.ellipse(14, 20, 10.5, 6.5, 0xd8b4c8);
  px.ellipse(10, 19, 1.3, 1.8, INK);
  px.ellipse(18, 19, 1.3, 1.8, INK);
  eye(px, 8, 10, 2.2);
  eye(px, 20, 10, 2.2);
  px.line(8, 24, 20, 24, INK);
  px.outline(INK);
  return px;
}

function slug(): Px {
  const px = new Px(28, 28);
  const c = ramp([0xa8741a, 0xe8b02a, 0xffe27a]);
  px.line(9, 12, 7, 3, INK);
  px.line(19, 12, 21, 3, INK);
  px.ellipse(7, 3, 2.4, 2.4, c.m);
  px.ellipse(21, 3, 2.4, 2.4, c.m);
  eye(px, 7, 3, 1.8);
  eye(px, 21, 3, 1.8);
  shadeBody(px, 14, 19, 13, 7.5, c);
  px.ellipse(9, 17, 1.4, 1.4, INK);
  px.ellipse(19, 17, 1.4, 1.4, INK);
  px.line(11, 21, 17, 21, INK);
  px.rect(4, 25, 3, 2, 0x9cf03e); // slime drips
  px.rect(20, 26, 3, 2, 0x9cf03e);
  px.outline(INK);
  return px;
}

function mammoth(): Px {
  const px = new Px(28, 28);
  const c = ramp([0x5a3a1c, 0x8a5a2c, 0xc08a50]);
  shadeBody(px, 14, 13, 12.5, 10.5, c);
  for (let x = 4; x < 25; x += 4) px.line(x, 4, x + 2, 1, c.m); // shaggy tuft
  px.ellipse(3, 14, 3, 5, c.m);
  px.ellipse(25, 14, 3, 5, c.m);
  eye(px, 9, 11, 2, 0);
  eye(px, 19, 11, 2, 0);
  px.rect(12, 14, 4, 11, c.m); // trunk
  px.rect(12, 25, 6, 2, c.m);
  px.line(8, 18, 6, 25, 0xf4efe0); // tusks
  px.line(20, 18, 22, 25, 0xf4efe0);
  px.set(6, 26, 0xf4efe0);
  px.set(22, 26, 0xf4efe0);
  px.set(11, 6, 0x6a9a4a); // moss
  px.set(16, 5, 0x6a9a4a);
  px.set(20, 7, 0x6a9a4a);
  px.outline(INK);
  return px;
}

function lock(): Px {
  const px = new Px(28, 28);
  px.rect(8, 13, 12, 10, 0x8a93a6);
  px.rect(8, 13, 12, 2, 0xb8c0d0);
  for (let y = 5; y < 14; y++) { px.set(10, y, 0x8a93a6); px.set(11, y, 0x8a93a6); px.set(16, y, 0x8a93a6); px.set(17, y, 0x8a93a6); }
  px.rect(10, 4, 8, 2, 0x8a93a6);
  px.rect(13, 16, 2, 4, INK);
  px.outline(INK);
  return px;
}

export function generatePortraits(scene: Phaser.Scene): void {
  const items: [string, () => Px][] = [
    ['portrait_frog', frog],
    ['portrait_toad', toad],
    ['portrait_hippo', hippo],
    ['portrait_slug', slug],
    ['portrait_mammoth', mammoth],
    ['portrait_lock', lock],
  ];
  for (const [key, fn] of items) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, fn().toCanvas());
  }
}
