import Phaser from 'phaser';
import { Px } from '../../art/pixel';

// Every found object is drawn by code from a few shapes (no image files). 24x24, inked outline.
// A hand-drawn replacement later only needs to be a 24x24 (or 48x48) PNG with the same key.
const INK = 0x140b12;
const STEEL = [0x3a4558, 0x6f7f96, 0xaebccd, 0xe9f1f8];
const WOOD = [0x3b2314, 0x6a4122, 0x9a6232];
const GOLD = [0x7a4a08, 0xc98a14, 0xffc93c, 0xfff0a0];
const RED = [0x5c1020, 0xa82638, 0xe8505e];
const GREEN = [0x1c4a1c, 0x3f9a34, 0x9be85a];
const PAPER = [0xa89a82, 0xe0d4bc, 0xfff6e2];

function thick(p: Px, x0: number, y0: number, x1: number, y1: number, c: number, w = 2): void {
  const horiz = Math.abs(x1 - x0) >= Math.abs(y1 - y0);
  for (let k = 0; k < w; k++) {
    const o = k - Math.floor((w - 1) / 2);
    if (horiz) p.line(x0, y0 + o, x1, y1 + o, c);
    else p.line(x0 + o, y0, x1 + o, y1, c);
  }
}
const carve = (p: Px, cx: number, cy: number, rx: number, ry: number) => {
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) p.set(x, y, -1);
};
const ring = (p: Px, cx: number, cy: number, r: number, c: number, w = 1) => {
  for (let a = 0; a < 64; a++) {
    const t = (a / 64) * Math.PI * 2;
    for (let k = 0; k < w; k++) p.set(cx + Math.cos(t) * (r - k), cy + Math.sin(t) * (r - k), c);
  }
};

type Draw = (p: Px) => void;
const ICONS: Record<string, Draw> = {
  boathook: (p) => {
    thick(p, 4, 21, 17, 7, WOOD[1], 2);
    thick(p, 5, 20, 17, 6, WOOD[2], 1);
    thick(p, 17, 7, 20, 4, STEEL[1], 2);
    p.line(20, 4, 21, 8, STEEL[2]);
    p.line(21, 8, 18, 11, STEEL[2]);
    p.line(18, 11, 17, 9, STEEL[3]);
  },
  knife: (p) => {
    for (let i = 0; i < 12; i++) {
      p.rect(8 + i, 15 - i, 3, 3, STEEL[i % 4 < 2 ? 2 : 1]);
    }
    p.line(9, 17, 20, 6, STEEL[3]);
    thick(p, 3, 21, 8, 16, WOOD[1], 3);
    p.rect(7, 14, 4, 2, GOLD[1]);
  },
  lantern: (p) => {
    p.rect(8, 3, 8, 2, STEEL[1]);
    p.line(9, 3, 12, 0, STEEL[2]);
    p.line(15, 3, 12, 0, STEEL[2]);
    p.rect(7, 5, 10, 2, STEEL[0]);
    p.rect(8, 7, 8, 11, GOLD[2]);
    p.rect(10, 9, 4, 7, GOLD[3]);
    p.rect(8, 7, 1, 11, GOLD[1]);
    p.rect(15, 7, 1, 11, GOLD[0]);
    p.rect(7, 18, 10, 3, STEEL[0]);
    p.rect(8, 18, 8, 1, STEEL[1]);
  },
  shovel: (p) => {
    thick(p, 17, 3, 11, 13, WOOD[1], 2);
    p.rect(15, 2, 5, 2, WOOD[2]);
    for (let i = 0; i < 5; i++) p.rect(5 + i, 12 + i, 8 - i, 1, STEEL[i < 2 ? 3 : 2]);
    p.ellipse(10, 17, 5, 4.5, (dx, dy) => (dx + dy < -0.3 ? STEEL[3] : dx + dy > 0.4 ? STEEL[0] : STEEL[2]));
    p.line(8, 14, 12, 19, STEEL[1]);
  },
  rope: (p) => {
    p.ellipse(11, 12, 8, 8, TAN(0));
    carve(p, 11, 12, 5, 5);
    for (let a = 0; a < 20; a++) {
      const t = (a / 20) * Math.PI * 2;
      p.set(11 + Math.cos(t) * 8, 12 + Math.sin(t) * 8, 0x8a6a3a);
      p.set(11 + Math.cos(t) * 5.5, 12 + Math.sin(t) * 5.5, 0x8a6a3a);
    }
    p.ellipse(11, 12, 6.5, 6.5, (dx, dy, g) => (g > 0.6 && (Math.round(dx * 9) + Math.round(dy * 9)) % 2 === 0 ? 0xe8cc88 : TAN(1)));
    carve(p, 11, 12, 3.2, 3.2);
    thick(p, 17, 18, 21, 22, 0xc6a460, 2);
    p.line(21, 22, 22, 20, 0xc6a460);
  },
  key: (p) => {
    ring(p, 8, 8, 5, GOLD[2], 2);
    ring(p, 8, 8, 6, GOLD[1], 1);
    thick(p, 12, 12, 20, 20, GOLD[2], 2);
    p.rect(17, 19, 3, 3, GOLD[2]);
    p.rect(14, 16, 3, 3, GOLD[1]);
    p.set(5, 5, GOLD[3]);
    p.set(6, 4, GOLD[3]);
  },
  beans: (p) => {
    p.rect(6, 6, 12, 14, STEEL[1]);
    p.rect(6, 9, 12, 8, RED[1]);
    p.rect(6, 6, 12, 2, STEEL[3]);
    p.rect(6, 18, 12, 2, STEEL[0]);
    p.rect(9, 11, 3, 3, 0xe8c58a);
    p.rect(13, 12, 3, 3, 0xe8c58a);
    p.rect(11, 14, 2, 2, 0xc98a14);
    p.rect(6, 9, 1, 8, RED[2]);
    p.ellipse(12, 5, 6, 2, STEEL[2]);
  },
  boot: (p) => {
    p.rect(7, 3, 8, 12, WOOD[1]);
    p.rect(7, 3, 2, 12, WOOD[2]);
    p.rect(7, 14, 14, 5, WOOD[1]);
    p.rect(15, 12, 5, 3, WOOD[1]);
    p.rect(7, 19, 15, 3, WOOD[0]);
    p.rect(7, 3, 8, 2, 0xd8c8a0);
    p.line(9, 9, 13, 9, 0xd8c8a0);
    p.line(9, 12, 13, 12, 0xd8c8a0);
  },
  pan: (p) => {
    thick(p, 14, 14, 22, 21, WOOD[1], 3);
    p.ellipse(9, 10, 8, 7, (dx, dy) => (dx + dy < -0.5 ? STEEL[1] : 0x2a3140));
    p.ellipse(9, 10, 6, 5, (dx, dy) => (dx + dy < -0.4 ? 0x4a566a : 0x1c222e));
    p.set(6, 7, STEEL[3]);
    p.set(7, 6, STEEL[3]);
  },
  hook: (p) => {
    p.line(12, 2, 12, 15, STEEL[2]);
    p.line(13, 2, 13, 15, STEEL[1]);
    ring(p, 8, 16, 4, STEEL[2], 2);
    p.rect(4, 12, 6, 6, -1);
    p.line(4, 16, 4, 12, STEEL[2]);
    p.line(5, 12, 3, 14, STEEL[3]);
    p.rect(11, 1, 4, 2, GOLD[1]);
    p.line(8, 20, 12, 19, STEEL[2]);
    p.line(12, 19, 13, 15, STEEL[2]);
  },
  scissors: (p) => {
    thick(p, 13, 11, 5, 2, STEEL[2], 2);
    thick(p, 11, 11, 19, 2, STEEL[1], 2);
    ring(p, 8, 18, 3, RED[1], 2);
    ring(p, 15, 18, 3, RED[2], 2);
    thick(p, 9, 15, 12, 11, STEEL[1], 2);
    thick(p, 14, 15, 12, 11, STEEL[2], 2);
  },
  spoon: (p) => {
    thick(p, 8, 20, 16, 9, STEEL[2], 2);
    p.ellipse(17, 6, 4.5, 5.5, (dx, dy) => (dx + dy < -0.3 ? STEEL[3] : dx + dy > 0.5 ? STEEL[1] : STEEL[2]));
  },
  net: (p) => {
    p.ellipse(12, 12, 9, 9, 0x3b6a4e);
    carve(p, 12, 12, 8, 8);
    for (let k = -8; k <= 8; k += 4) {
      p.line(12 + k, 4, 12 + k, 20, 0x9be0b4);
      p.line(4, 12 + k, 20, 12 + k, 0x9be0b4);
    }
    ring(p, 12, 12, 9, 0x8a6a3a, 1);
    p.rect(11, 20, 3, 3, WOOD[1]);
    p.line(3, 3, 8, 8, 0x1c2e24);
  },
  matches: (p) => {
    p.rect(4, 12, 16, 9, RED[1]);
    p.rect(4, 12, 16, 2, RED[2]);
    p.rect(6, 16, 12, 2, 0xe8c58a);
    p.line(9, 11, 15, 4, WOOD[2]);
    p.line(10, 11, 16, 4, WOOD[1]);
    p.rect(15, 2, 3, 3, RED[2]);
    p.set(16, 1, GOLD[3]);
    p.set(17, 0, GOLD[2]);
    p.set(14, 1, GOLD[2]);
  },
  cleaver: (p) => {
    p.rect(3, 4, 15, 10, STEEL[2]);
    p.rect(3, 4, 15, 2, STEEL[3]);
    p.rect(3, 12, 15, 2, STEEL[1]);
    p.rect(14, 7, 2, 2, STEEL[0]);
    p.rect(4, 6, 8, 1, STEEL[3]);
    thick(p, 18, 8, 22, 9, WOOD[1], 3);
    p.rect(17, 7, 2, 4, GOLD[1]);
  },
  bandage: (p) => {
    p.rect(4, 7, 16, 11, PAPER[1]);
    p.rect(4, 7, 16, 2, PAPER[2]);
    p.rect(4, 16, 16, 2, PAPER[0]);
    p.rect(10, 9, 4, 7, RED[2]);
    p.rect(8, 11, 8, 3, RED[2]);
    p.line(4, 12, 1, 14, PAPER[1]);
  },
  crowbar: (p) => {
    thick(p, 6, 21, 17, 6, STEEL[2], 2);
    p.line(7, 21, 18, 6, STEEL[3]);
    thick(p, 17, 6, 20, 4, STEEL[1], 2);
    p.line(20, 4, 21, 7, STEEL[1]);
    p.rect(4, 20, 3, 3, STEEL[0]);
  },
  lockpick: (p) => {
    thick(p, 4, 20, 15, 9, STEEL[2], 1);
    p.line(15, 9, 19, 7, STEEL[3]);
    p.line(19, 7, 19, 11, STEEL[3]);
    p.rect(2, 19, 4, 4, RED[1]);
    thick(p, 6, 21, 17, 11, STEEL[1], 1);
    p.set(17, 12, STEEL[3]);
  },
  pickaxe: (p) => {
    thick(p, 5, 21, 17, 9, WOOD[1], 2);
    p.line(6, 20, 17, 8, WOOD[2]);
    for (let i = 0; i < 9; i++) {
      const y = 3 + Math.round(Math.sin((i / 8) * Math.PI) * -2) + Math.round(Math.abs(i - 4) * 0.9);
      p.rect(8 + i * 1.4, y, 3, 3, i % 2 ? STEEL[2] : STEEL[3]);
    }
    p.set(8, 7, STEEL[2]);
    p.set(21, 7, STEEL[2]);
  },
  flare: (p) => {
    thick(p, 7, 21, 15, 9, RED[1], 4);
    p.line(8, 20, 15, 10, RED[2]);
    p.rect(13, 6, 4, 4, STEEL[1]);
    p.ellipse(16, 4, 3, 3.6, (dx, dy) => (dx * dx + dy * dy < 0.25 ? GOLD[3] : GOLD[2]));
    p.set(19, 1, GOLD[3]);
    p.set(13, 1, GOLD[3]);
    p.set(21, 4, GOLD[2]);
    p.set(11, 4, GOLD[2]);
  },
  harpoon: (p) => {
    thick(p, 3, 21, 17, 7, WOOD[1], 2);
    p.line(4, 20, 17, 6, WOOD[2]);
    for (let i = 0; i < 6; i++) p.rect(16 + i, 7 - i, 2, 2, STEEL[i % 2 ? 3 : 2]);
    p.line(14, 11, 18, 9, STEEL[2]);
    p.line(16, 5, 20, 7, STEEL[2]);
    p.line(15, 9, 16, 13, STEEL[1]);
    p.line(19, 3, 20, 1, STEEL[3]);
  },
  flask: (p) => {
    p.rect(10, 2, 4, 5, 0xbfe4ec);
    p.rect(9, 1, 6, 2, WOOD[1]);
    p.ellipse(12, 15, 8, 7, (dx, dy) => (dy < -0.1 ? 0xbfe4ec : dx < -0.3 ? GREEN[2] : GREEN[1]));
    p.rect(10, 7, 4, 3, 0xbfe4ec);
    p.set(8, 13, 0xffffff);
    p.set(14, 16, GREEN[2]);
    p.set(10, 17, GREEN[2]);
  },
  medkit: (p) => {
    p.rect(3, 7, 18, 13, PAPER[2]);
    p.rect(3, 18, 18, 2, PAPER[0]);
    p.rect(8, 4, 8, 3, STEEL[1]);
    p.rect(10, 9, 4, 9, RED[2]);
    p.rect(7, 12, 10, 3, RED[2]);
  },
  sandwich: (p) => {
    p.ellipse(12, 8, 9, 5, (_dx, dy) => (dy < -0.2 ? 0xe8b868 : 0xc98a3a));
    p.rect(3, 12, 18, 2, GREEN[1]);
    p.rect(4, 14, 16, 2, RED[2]);
    p.rect(3, 16, 18, 2, 0xfff0a0);
    p.rect(3, 18, 18, 3, 0xc98a3a);
    p.rect(3, 19, 18, 2, 0xa8702a);
    p.set(8, 6, 0xfff0c0);
    p.set(14, 5, 0xfff0c0);
  },
  whetstone: (p) => {
    p.rect(3, 9, 18, 8, 0x7a8290);
    p.rect(3, 9, 18, 2, 0xa8b0be);
    p.rect(3, 15, 18, 2, 0x4a5262);
    p.rect(6, 12, 5, 1, 0x4a5262);
    for (const [x, y] of [[18, 5], [21, 8], [20, 3], [15, 4]]) p.set(x, y, GOLD[3]);
    p.line(20, 5, 22, 3, GOLD[2]);
  },
  anchor: (p) => {
    ring(p, 12, 5, 2, STEEL[2], 1);
    p.rect(11, 7, 3, 12, STEEL[1]);
    p.rect(12, 7, 1, 12, STEEL[3]);
    p.rect(7, 9, 11, 2, STEEL[2]);
    for (let a = 0; a < 18; a++) {
      const t = Math.PI * (0.05 + (a / 18) * 0.9);
      p.rect(12 + Math.cos(t) * 9 - 1, 14 + Math.sin(t) * 7 - 1, 3, 3, STEEL[a % 3 ? 2 : 1]);
    }
    p.line(3, 14, 5, 11, STEEL[2]);
    p.line(21, 14, 19, 11, STEEL[2]);
  },
  bell: (p) => {
    p.ellipse(12, 12, 9, 9, (dx, dy) => (dx + dy < -0.4 ? 0xe8b058 : dx + dy > 0.5 ? 0x7a4a18 : 0xc98a2a));
    p.rect(2, 12, 20, 9, -1);
    p.rect(3, 12, 18, 8, 0xc98a2a);
    p.rect(3, 12, 18, 1, 0xe8b058);
    p.rect(3, 19, 18, 2, 0x7a4a18);
    p.ellipse(12, 11, 3, 3, (dx, dy) => (dx + dy < -0.3 ? 0xe0f6ff : 0x5ab0d8));
    p.rect(11, 1, 3, 3, STEEL[1]);
    p.rect(12, 0, 1, 2, STEEL[2]);
    for (const x of [5, 9, 15, 19]) p.set(x, 15, 0x7a4a18);
  },
  // intent icons (also 24x24, drawn big and used small)
  i_attack: (p) => {
    thick(p, 4, 20, 19, 5, STEEL[2], 3);
    p.line(5, 20, 20, 5, STEEL[3]);
    thick(p, 3, 18, 8, 23, WOOD[2], 2);
    p.rect(3, 15, 8, 3, GOLD[1]);
    p.set(21, 3, STEEL[3]);
  },
  i_drain: (p) => {
    p.ellipse(12, 14, 7, 8, (dx, dy) => (dx + dy < -0.3 ? RED[2] : RED[1]));
    p.rect(11, 3, 2, 3, RED[1]);
    p.rect(10, 5, 4, 3, RED[1]);
    p.set(9, 10, 0xffd0d8);
    p.set(9, 11, 0xffd0d8);
  },
  i_heal: (p) => {
    p.rect(9, 3, 6, 18, GREEN[2]);
    p.rect(3, 9, 18, 6, GREEN[2]);
    p.rect(10, 4, 4, 16, GREEN[1]);
    p.rect(4, 10, 16, 4, GREEN[1]);
  },
  i_steal: (p) => {
    p.rect(5, 10, 14, 10, 0xe8a078);
    for (let k = 0; k < 4; k++) p.rect(5 + k * 4, 3 + (k % 2) * 2, 3, 8, 0xe8a078);
    p.rect(2, 13, 4, 3, 0xe8a078);
    p.rect(5, 18, 14, 2, 0xb87050);
  },
  i_idle: (p) => {
    thick(p, 4, 6, 12, 6, 0xd8e8ff, 2);
    p.line(12, 6, 4, 14, 0xd8e8ff);
    thick(p, 4, 14, 12, 14, 0xd8e8ff, 2);
    thick(p, 13, 12, 19, 12, 0xa8c8ff, 1);
    p.line(19, 12, 13, 18, 0xa8c8ff);
    p.line(13, 18, 19, 18, 0xa8c8ff);
  },
};

function TAN(i: number): number {
  return [0xc6a460, 0xa88442][i];
}

/** Map nodes and prop pictograms (24x24). */
const NODES: Record<string, Draw> = {
  n_fight: (p) => {
    thick(p, 4, 20, 19, 5, STEEL[2], 3);
    thick(p, 20, 20, 5, 5, STEEL[1], 3);
    p.rect(2, 18, 6, 2, GOLD[1]);
    p.rect(17, 18, 6, 2, GOLD[1]);
  },
  n_elite: (p) => {
    p.ellipse(12, 12, 8, 8, (dx, dy) => (dx + dy < -0.3 ? 0xf2ead8 : 0xb8ae98));
    p.rect(7, 10, 4, 4, INK);
    p.rect(13, 10, 4, 4, INK);
    p.rect(11, 15, 2, 3, INK);
    p.line(5, 6, 3, 1, 0xf2ead8);
    p.line(19, 6, 21, 1, 0xf2ead8);
    p.rect(8, 19, 8, 2, 0xf2ead8);
    p.set(10, 20, INK);
    p.set(13, 20, INK);
  },
  n_boss: (p) => {
    p.ellipse(12, 12, 10, 10, RED[1]);
    p.ellipse(12, 12, 7, 7, 0xf8f0d8);
    p.ellipse(12, 12, 3.5, 3.5, INK);
    p.set(10, 10, 0xffffff);
    p.set(11, 10, 0xffffff);
  },
  n_valve: (p) => {
    ring(p, 12, 12, 8, 0xc43a2a, 2);
    for (let a = 0; a < 6; a++) {
      const t = (a / 6) * Math.PI;
      p.line(12 - Math.cos(t) * 8, 12 - Math.sin(t) * 8, 12 + Math.cos(t) * 8, 12 + Math.sin(t) * 8, 0xc43a2a);
    }
    p.rect(10, 10, 4, 4, STEEL[2]);
  },
  n_cyst: (p) => {
    p.ellipse(12, 13, 9, 8, (dx, dy) => (dx + dy < -0.4 ? 0xf0b0b8 : dx + dy > 0.4 ? 0xa04a60 : 0xd8788a));
    p.ellipse(12, 12, 4, 3, 0xf8e2a0);
    p.set(8, 8, 0xffffff);
    p.set(9, 7, 0xffffff);
  },
  n_alcove: (p) => {
    p.ellipse(12, 14, 9, 10, 0x52213a);
    p.ellipse(12, 15, 7, 8, INK);
    p.rect(11, 14, 2, 2, GOLD[3]);
    p.set(13, 17, GOLD[2]);
    p.set(9, 16, GOLD[2]);
    p.rect(3, 20, 18, 3, 0x52213a);
  },
  n_pool: (p) => {
    p.ellipse(12, 15, 10, 6, (_dx, dy) => (dy < -0.3 ? 0xd4ff7a : 0x8cf03e));
    p.ellipse(12, 15, 7, 3.5, 0x4fb52e);
    p.set(8, 9, 0xd4ff7a);
    p.set(8, 8, 0xd4ff7a);
    p.set(15, 7, 0xd4ff7a);
    p.set(15, 6, 0xd4ff7a);
  },
  n_corpse: (p) => {
    p.ellipse(12, 12, 7, 6, (dx, dy) => (dx + dy < -0.3 ? 0xf2ead8 : 0xb8ae98));
    p.rect(8, 10, 3, 3, INK);
    p.rect(13, 10, 3, 3, INK);
    p.rect(9, 17, 6, 3, 0xf2ead8);
    thick(p, 3, 21, 21, 21, 0xb8ae98, 2);
    p.line(4, 17, 8, 21, 0xb8ae98);
  },
};

export const ICON_SIZE = 24;
export const CARD_ICONS = Object.keys(ICONS).filter((k) => !k.startsWith('i_'));

export function generateIcons(scene: Phaser.Scene): void {
  const put = (key: string, px: Px) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, px.toCanvas());
  };
  for (const [key, draw] of Object.entries({ ...ICONS, ...NODES })) {
    const px = new Px(ICON_SIZE, ICON_SIZE);
    draw(px);
    px.outline(INK);
    put(`ic_${key}`, px);
  }
}
