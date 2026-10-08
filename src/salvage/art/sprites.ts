import Phaser from 'phaser';
import { drawTunnel } from '../../art/fp';
import { Px } from '../../art/pixel';
import { PAL } from '../../logic/levels';

const INK = 0x140b12;
/** true while drawing the black-and-white cartoon twin of every sprite */
let VINTAGE_DRAW = false;
const ol = (p: Px) => {
  p.outline(INK);
  if (VINTAGE_DRAW) p.outline(INK);
};
type Ramp = [number, number, number, number];

const lit = (r: Ramp) => (dx: number, dy: number): number => {
  const l = -dx * 0.45 - dy * 0.75;
  return l > 0.55 ? r[3] : l > 0.1 ? r[2] : l > -0.45 ? r[1] : r[0];
};

const blob = (p: Px, cx: number, cy: number, rx: number, ry: number, r: Ramp) => p.ellipse(cx, cy, rx, ry, lit(r));
function eye(p: Px, x: number, y: number, r: number, look = 0): void {
  p.ellipse(x, y, r, r, INK);
  p.ellipse(x, y, r - 1, r - 1, (dx, dy) => (dx + dy < 0.4 ? 0xfdf6e3 : 0xd8cdb4));
  p.ellipse(x + look, y + 0.5, r * 0.45, r * 0.5, INK);
  p.set(x + look - 1, y - 1, 0xffffff);
  if (VINTAGE_DRAW && r >= 3) {
    // pie-cut pupil
    p.set(x + look + 1, y - 1, 0xfdf6e3);
    p.set(x + look + 1, y, 0xfdf6e3);
    p.set(x + look, y - 1, 0xfdf6e3);
  }
}
function legs(p: Px, cx: number, cy: number, spread: number, n: number, len: number, c: number): void {
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const k = Math.floor(i / 2);
    const x0 = cx + side * (spread * 0.4 + k * 3);
    const x1 = cx + side * (spread * 0.4 + k * 3 + len);
    p.line(x0, cy, x1, cy + 5 + k, c);
    p.line(x1, cy + 5 + k, x1 + side * 2, cy + 9 + k, c);
    if (VINTAGE_DRAW) p.ellipse(x1 + side * 2, cy + 9 + k, 2.6, 2.6, 0xffffff); // white glove
  }
}
function mouth(p: Px, cx: number, cy: number, rx: number, ry: number, teeth: number): void {
  p.ellipse(cx, cy, rx, ry, INK);
  p.ellipse(cx, cy + 1, rx - 2, ry - 2, 0x7a1e34);
  for (let i = 0; i < teeth; i++) {
    const a = Math.PI * (0.1 + (0.8 * i) / Math.max(1, teeth - 1));
    const x = cx + Math.cos(a) * (rx - 1);
    p.set(x, cy - Math.sin(a) * (ry - 1), 0xfdf6e3);
    p.set(x, cy - Math.sin(a) * (ry - 1) + 1, 0xfdf6e3);
    const b = Math.PI + a;
    p.set(cx + Math.cos(b) * (rx - 1), cy - Math.sin(b) * (ry - 1), 0xfdf6e3);
  }
}

const ENEMY_SPRITES: Record<string, () => Px> = {
  mite: () => {
    const p = new Px(66, 54);
    legs(p, 33, 30, 18, 6, 12, 0x5a2a18);
    blob(p, 33, 28, 22, 17, [0x7a3418, 0xb45a28, 0xe08a3c, 0xffc078]);
    blob(p, 33, 20, 12, 8, [0x8a4220, 0xc46a30, 0xe89a4c, 0xffd090]);
    for (let i = 0; i < 6; i++) p.line(14 + i * 7, 36 - Math.abs(i - 2.5), 16 + i * 7, 40 - Math.abs(i - 2.5), 0x7a3418);
    eye(p, 25, 23, 5, 1);
    eye(p, 41, 23, 5, -1);
    p.line(26, 14, 22, 9, 0x5a2a18);
    p.line(40, 14, 44, 9, 0x5a2a18);
    p.rect(30, 33, 2, 4, 0xfdf6e3);
    p.rect(35, 33, 2, 4, 0xfdf6e3);
    ol(p);
    return p;
  },
  tick: () => {
    const p = new Px(52, 46);
    legs(p, 26, 26, 14, 8, 9, 0x3a1a1a);
    blob(p, 26, 24, 17, 15, [0x4a1420, 0x8a2a38, 0xc4505a, 0xff8a90]);
    blob(p, 26, 14, 8, 6, [0x2a1a1a, 0x4a2a2a, 0x6a4040, 0x8a6060]);
    eye(p, 22, 17, 3);
    eye(p, 31, 17, 3);
    p.rect(25, 21, 2, 3, 0xfdf6e3);
    for (const [x, y] of [[18, 28], [34, 30], [26, 33]]) p.set(x, y, 0xffb0b8);
    ol(p);
    return p;
  },
  slug: () => {
    const p = new Px(90, 56);
    p.ellipse(44, 47, 40, 7, 0x2a6a1a); // slime puddle
    blob(p, 46, 34, 38, 15, [0x1c4a1c, 0x3f9a34, 0x76d24a, 0xc8ff8a]);
    blob(p, 22, 24, 15, 14, [0x1c4a1c, 0x4aa83c, 0x86e052, 0xd0ff98]);
    p.line(14, 14, 10, 3, 0x2f7a2a);
    p.line(26, 12, 28, 2, 0x2f7a2a);
    eye(p, 10, 3, 4, -1);
    eye(p, 28, 2, 4, 1);
    for (let i = 0; i < 9; i++) p.set(40 + i * 5, 26 + (i % 3), 0xc8ff8a);
    for (const x of [52, 62, 70]) {
      p.set(x, 44, 0xc8ff8a);
      p.set(x, 45, 0xc8ff8a);
    }
    p.ellipse(14, 31, 5, 2, 0x1c4a1c);
    ol(p);
    return p;
  },
  leech: () => {
    const p = new Px(90, 62);
    blob(p, 52, 38, 36, 17, [0x2a0f2e, 0x5a2058, 0x94408a, 0xd078c0]);
    for (let i = 0; i < 7; i++) {
      p.line(28 + i * 8, 24 + Math.abs(i - 3), 30 + i * 8, 52 - Math.abs(i - 3), 0x2a0f2e);
    }
    blob(p, 22, 34, 18, 18, [0x34123a, 0x6a2a66, 0xa44ca0, 0xe088d4]);
    mouth(p, 14, 36, 12, 12, 7);
    eye(p, 26, 22, 4);
    eye(p, 36, 24, 3);
    p.ellipse(70, 44, 14, 8, 0x5a2058);
    p.ellipse(76, 46, 10, 6, 0x34123a);
    ol(p);
    return p;
  },
  thief: () => {
    const p = new Px(56, 50);
    p.ellipse(34, 40, 14, 8, 0x6a4122); // stolen sack on its back
    p.ellipse(34, 38, 12, 8, 0x9a6232);
    p.rect(32, 30, 4, 3, 0xd8c8a0);
    legs(p, 24, 32, 12, 6, 8, 0x2a2040);
    blob(p, 24, 28, 17, 14, [0x2a1a46, 0x5a3a8a, 0x8a66c4, 0xc8aaff]);
    p.rect(8, 22, 34, 6, INK); // bandit mask
    eye(p, 17, 25, 3, 1);
    eye(p, 31, 25, 3, -1);
    blob(p, 24, 13, 9, 5, [0x2a2a2a, 0x4a4a4a, 0x6a6a6a, 0x8a8a8a]); // cap
    p.rect(14, 16, 22, 2, 0x2a2a2a);
    p.rect(22, 33, 3, 3, 0xfdf6e3);
    p.rect(27, 33, 3, 3, 0xfdf6e3);
    ol(p);
    return p;
  },
  warden: () => {
    const p = new Px(104, 100);
    // a stack of pale discs: the tapeworm stands upright like a guard
    for (let i = 0; i < 7; i++) {
      const y = 92 - i * 10;
      const rx = 26 - i * 1.4;
      blob(p, 52, y, rx, 7, [0xa89a6a, 0xd8caa0, 0xf4ecc8, 0xfffbe8]);
      p.line(52 - rx + 2, y + 3, 52 + rx - 2, y + 3, 0x8a7c52);
    }
    blob(p, 52, 22, 24, 17, [0x6a4a2a, 0xa07c4a, 0xd8ac70, 0xffe0a0]);
    mouth(p, 52, 28, 14, 8, 9);
    eye(p, 38, 14, 5, 1);
    eye(p, 66, 14, 5, -1);
    p.line(30, 8, 40, 11, INK);
    p.line(74, 8, 64, 11, INK);
    // keys on a ring: it is the warden
    for (let k = 0; k < 3; k++) p.rect(10 + k * 3, 56 + k * 4, 5, 3, 0xffc93c);
    p.line(8, 54, 12, 66, 0xaaa);
    ol(p);
    return p;
  },
  mama: () => {
    const p = new Px(200, 130);
    blob(p, 100, 82, 92, 42, [0x3a0f3a, 0x7a2a6a, 0xb4509a, 0xf088d4]);
    for (let i = 0; i < 12; i++) p.line(26 + i * 12, 54 + Math.abs(i - 6), 30 + i * 12, 118 - Math.abs(i - 6) * 1.2, 0x3a0f3a);
    blob(p, 100, 52, 50, 40, [0x44164a, 0x8a3a7a, 0xc464ae, 0xffa0e8]);
    mouth(p, 100, 62, 34, 24, 15);
    eye(p, 70, 28, 9, 2);
    eye(p, 130, 28, 9, -2);
    eye(p, 100, 20, 6);
    p.line(60, 16, 82, 24, INK);
    p.line(140, 16, 118, 24, INK);
    p.line(61, 17, 83, 25, INK);
    p.line(139, 17, 117, 25, INK);
    for (const x of [78, 100, 122]) p.rect(x, 90, 3, 10, 0x76d24a);
    ol(p);
    return p;
  },
};

const PROP_SPRITES: Record<string, () => Px> = {
  valve: () => {
    const p = new Px(110, 120);
    p.rect(44, 20, 22, 90, 0x6f7f96);
    p.rect(44, 20, 6, 90, 0xaebccd);
    p.rect(60, 20, 6, 90, 0x3a4558);
    for (const y of [44, 80]) p.rect(40, y, 30, 6, 0x3a4558);
    // the wheel
    for (let a = 0; a < 80; a++) {
      const t = (a / 80) * Math.PI * 2;
      for (let k = 0; k < 3; k++) p.set(55 + Math.cos(t) * (34 - k), 40 + Math.sin(t) * (34 - k) * 0.95, 0xc43a2a);
    }
    for (let s = 0; s < 4; s++) {
      const t = (s / 4) * Math.PI;
      p.line(55 - Math.cos(t) * 32, 40 - Math.sin(t) * 30, 55 + Math.cos(t) * 32, 40 + Math.sin(t) * 30, 0xe8503a);
    }
    p.ellipse(55, 40, 7, 7, (dx, dy) => (dx + dy < -0.2 ? 0xe9f1f8 : 0x6f7f96));
    for (let i = 0; i < 6; i++) p.set(20 + i * 14, 98, 0xb06a40); // rust
    ol(p);
    return p;
  },
  cyst: () => {
    const p = new Px(110, 100);
    blob(p, 55, 56, 46, 38, [0x8a2a48, 0xc45a74, 0xf090a4, 0xffd0d8]);
    blob(p, 55, 52, 30, 22, [0xc08a5a, 0xe8b878, 0xf8dca0, 0xfff6c8]);
    p.ellipse(55, 52, 18, 12, (dx, dy) => (dx + dy < -0.3 ? 0xfff6c8 : 0xe8c878));
    // veins
    for (let i = 0; i < 7; i++) p.line(55, 56, 14 + i * 14, 20 + (i % 2) * 70, 0xa0304e);
    for (let i = 0; i < 4; i++) p.set(30 + i * 15, 24 + (i % 2) * 4, 0xffffff);
    p.rect(52, 48, 6, 6, 0xffd042);
    ol(p);
    return p;
  },
  alcove: () => {
    const p = new Px(120, 130);
    p.ellipse(60, 70, 50, 58, 0x7a2f4b);
    p.ellipse(60, 74, 40, 50, 0x21101a);
    p.ellipse(60, 78, 30, 40, INK);
    // glittering things inside: only visible with a light
    for (const [x, y, c] of [[52, 92, 0xffc93c], [70, 98, 0x9be0ff], [60, 84, 0xffffff], [46, 104, 0xff8a9a]] as number[][]) {
      p.rect(x, y, 3, 3, c);
      p.set(x + 1, y - 2, c);
      p.set(x - 1, y + 1, c);
    }
    p.rect(8, 118, 104, 12, 0x52213a);
    ol(p);
    return p;
  },
  corpse: () => {
    const p = new Px(130, 76);
    p.ellipse(65, 66, 56, 8, 0x21101a);
    // a previous visitor: boots up, backpack, helmet with a lamp
    blob(p, 56, 50, 34, 16, [0x2a3a28, 0x4a6a40, 0x7ea060, 0xb8d890]);
    blob(p, 98, 46, 14, 12, [0x5a3a1e, 0x8a5a2a, 0xb8843c, 0xe8b868]);
    p.rect(104, 34, 18, 8, 0x6a4122);
    blob(p, 28, 40, 11, 11, [0xb8ae98, 0xd8ceb8, 0xf2ead8, 0xffffff]);
    p.rect(20, 28, 18, 6, 0xc98a14);
    p.rect(26, 24, 6, 5, 0xffc93c);
    p.rect(24, 40, 3, 3, INK);
    p.rect(31, 40, 3, 3, INK);
    p.rect(104, 56, 12, 8, 0x6a4122);
    p.rect(108, 58, 14, 6, 0x3b2314);
    p.line(80, 40, 96, 26, 0x4a6a40);
    ol(p);
    return p;
  },
  pod: () => {
    const p = new Px(100, 110);
    p.rect(44, 60, 12, 50, 0x3a6a4a);
    p.rect(44, 60, 4, 50, 0x6aa87a);
    p.ellipse(50, 40, 30, 26, (_dx, _dy, g) => (g < 0.18 ? 0xf0ffff : g < 0.45 ? 0xa8f4ff : g < 0.8 ? 0x4ac8e8 : 0x2878a8));
    p.ellipse(42, 30, 8, 5, 0xffffff);
    for (const [x, y] of [[20, 20], [82, 24], [14, 52], [88, 58], [50, 6]]) {
      p.rect(x, y, 3, 3, 0xa8f4ff);
    }
    ol(p);
    return p;
  },
  pool: () => {
    const p = new Px(190, 52);
    p.ellipse(95, 30, 92, 20, (_dx, dy) => (dy < -0.4 ? 0xd4ff7a : dy < 0.1 ? 0x8cf03e : 0x4fb52e));
    p.ellipse(95, 32, 74, 13, (dx, dy) => (dx + dy < -0.5 ? 0x8cf03e : 0x2a7a22));
    for (const [x, y] of [[40, 24], [76, 36], [120, 22], [150, 34], [100, 28]]) {
      p.ellipse(x, y, 4, 2, 0xd4ff7a);
      p.set(x, y - 3, 0xffffff);
    }
    ol(p);
    return p;
  },
};

/** The outlines wobble from frame to frame ("boil"): shift bands of rows by a pixel. */
function boilPx(src: Px): Px {
  const o = new Px(src.w, src.h);
  for (let y = 0; y < src.h; y++) {
    const off = ((Math.imul(y >> 2, 2654435761) >>> 28) % 3) - 1;
    for (let x = 0; x < src.w; x++) o.set(x + off, y, src.get(x, y));
  }
  return o;
}

export function generateSalvageArt(scene: Phaser.Scene): void {
  const put = (key: string, px: Px) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, px.toCanvas());
  };
  for (const [k, f] of Object.entries(ENEMY_SPRITES)) put(`en_${k}`, f());
  for (const [k, f] of Object.entries(PROP_SPRITES)) put(`prop_${k}`, f());
  VINTAGE_DRAW = true;
  for (const [k, f] of Object.entries(ENEMY_SPRITES)) {
    const base = f();
    put(`en_${k}_v`, base);
    put(`en_${k}_v1`, boilPx(base));
  }
  for (const [k, f] of Object.entries(PROP_SPRITES)) put(`prop_${k}_v`, f());
  VINTAGE_DRAW = false;
  for (const [name, pal] of Object.entries({ pink: PAL.pink, rust: PAL.rust })) {
    for (let b = 0; b < 2; b++) put(`sv_bg_${name}_${b}`, drawTunnel(pal, b, false));
  }
  // small UI bits
  const heart = new Px(11, 10);
  heart.ascii(0, 0, ['.###..###..', '#####.#####'.slice(0, 11), '###########', '###########', '.#########.', '..#######..', '...#####...', '....###....', '.....#.....'], { '#': 0xe8505e });
  heart.outline(INK);
  put('ui_heart', heart);
  const bolt = new Px(9, 11);
  bolt.ascii(0, 0, ['....##...', '...###...', '..###....', '.######..', '...###...', '..###....', '..##.....', '.#.......'], { '#': 0xffd35a });
  bolt.outline(INK);
  put('ui_bolt', bolt);
}

export const WALK_FRAMES = 8;

/** The tunnel as seen while walking: the same cells, shifted forward by 1/8 of a cell per frame (loops seamlessly). */
export function ensureWalkFrames(scene: Phaser.Scene, name: 'pink' | 'rust'): void {
  if (scene.textures.exists(`sv_walk_${name}_0`)) return;
  const pal = name === 'pink' ? PAL.pink : PAL.rust;
  for (let k = 0; k < WALK_FRAMES; k++) scene.textures.addCanvas(`sv_walk_${name}_${k}`, drawTunnel(pal, 0, false, k / WALK_FRAMES).toCanvas());
}
