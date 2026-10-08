import Phaser from 'phaser';
import { H, W } from '../config';
import { BAYER4, dither, Px } from './pixel';

/** Where the creatures sit on the map (screen pixels), and the winding gut that joins them. */
export const MAP_NODES = [
  { x: 62, y: 178 },
  { x: 142, y: 124 },
  { x: 226, y: 168 },
  { x: 316, y: 114 },
  { x: 400, y: 70 },
];
export const MAP_EXIT = { x: 446, y: 36 };

const PATH_POINTS = [{ x: 22, y: 206 }, ...MAP_NODES, MAP_EXIT];

function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
}

function smoothPath(): { x: number; y: number }[] {
  const pts = PATH_POINTS;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[i], c = pts[i + 1], d = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < 24; s++) {
      const t = s / 24;
      out.push({ x: catmull(a.x, b.x, c.x, d.x, t), y: catmull(a.y, b.y, c.y, d.y, t) });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Parchment with a hand-inked intestine winding from the mouth (bottom left) to the exit (top right). */
function drawMap(): Px {
  const px = new Px(W, H);
  const paper = [0xe2cda0, 0xd8c196, 0xcbb284, 0xb89a68];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = Math.abs(x - W / 2) / (W / 2), dy = Math.abs(y - H / 2) / (H / 2);
      const edge = Math.max(dx, dy);
      let t = Math.max(0, (edge - 0.72) * 3.2);
      t += ((x * 7 + y * 13) % 11 === 0 ? 0.12 : 0) + (BAYER4[y & 3][x & 3] / 16 - 0.5) * 0.18;
      const idx = t > 0.9 ? 3 : t > 0.5 ? 2 : t > 0.12 ? 1 : 0;
      px.set(x, y, paper[idx]);
    }
  // the gut: ink outline, pink body, light stripe
  const path = smoothPath();
  for (const p of path) px.ellipse(p.x, p.y, 11, 11, 0x2a1420);
  for (const p of path) px.ellipse(p.x, p.y, 9, 9, 0xd08a96);
  for (const p of path) px.ellipse(p.x - 1, p.y - 2, 5, 3.4, 0xeaaab4);
  // wrinkles on the gut
  for (let i = 0; i < path.length; i += 6) {
    const a = path[i], b = path[Math.min(path.length - 1, i + 1)];
    const nx = -(b.y - a.y), ny = b.x - a.x;
    const l = Math.hypot(nx, ny) || 1;
    px.line(a.x + (nx / l) * 8, a.y + (ny / l) * 8, a.x - (nx / l) * 8, a.y - (ny / l) * 8, 0xb06a78);
  }
  // mouth at the start, exit ring at the end
  px.ellipse(18, 208, 11, 9, 0x2a1420);
  px.ellipse(18, 208, 8, 6, 0x6a1c2c);
  for (let x = 12; x < 25; x += 4) px.rect(x, 202, 2, 3, 0xf4efe0);
  px.ellipse(MAP_EXIT.x, MAP_EXIT.y, 14, 14, 0x2a1420);
  px.ellipse(MAP_EXIT.x, MAP_EXIT.y, 11, 11, 0xd08a96);
  px.ellipse(MAP_EXIT.x, MAP_EXIT.y, 5, 5, (_dx, _dy, g) => (g > 0.5 ? 0xfff0b0 : 0xffffff));
  // stains and little ink doodles
  for (const [x, y, r] of [[330, 200, 9], [120, 232, 7], [440, 150, 6], [255, 60, 8]]) {
    for (let a = 0; a < 20; a++) if (dither(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 0.6)) px.set(x + Math.cos(a) * r, y + Math.sin(a) * r, 0xb89a68);
  }
  // frame
  for (let x = 0; x < W; x++) { px.set(x, 0, 0x2a1420); px.set(x, 1, 0x2a1420); px.set(x, H - 1, 0x2a1420); px.set(x, H - 2, 0x2a1420); }
  for (let y = 0; y < H; y++) { px.set(0, y, 0x2a1420); px.set(1, y, 0x2a1420); px.set(W - 1, y, 0x2a1420); px.set(W - 2, y, 0x2a1420); }
  return px;
}

export function generateMapTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('map_bg')) scene.textures.remove('map_bg');
  scene.textures.addCanvas('map_bg', drawMap().toCanvas());
  // node ring
  const ring = new Px(40, 40);
  ring.ellipse(20, 20, 19, 19, 0x2a1420);
  ring.ellipse(20, 20, 17, 17, 0xf0e4c4);
  ring.ellipse(20, 20, 15, 15, 0xc9b283);
  if (scene.textures.exists('map_node')) scene.textures.remove('map_node');
  scene.textures.addCanvas('map_node', ring.toCanvas());
  const done = new Px(40, 40);
  done.ellipse(20, 20, 19, 19, 0x2a1420);
  done.ellipse(20, 20, 17, 17, 0xffe070);
  done.ellipse(20, 20, 15, 15, 0xe8c050);
  if (scene.textures.exists('map_node_done')) scene.textures.remove('map_node_done');
  scene.textures.addCanvas('map_node_done', done.toCanvas());
}
