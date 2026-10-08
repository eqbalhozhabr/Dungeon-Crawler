import Phaser from 'phaser';
import { Rng } from '../rng';
import { BOARD_H, BOARD_W, CARD_H, CARD_W, CELL, GEM_RAMPS, H, ROWS, W } from '../config';
import { BAYER4, dither, NONE, Px } from './pixel';

const INK = 0x1a0a14;

function add(scene: Phaser.Scene, key: string, px: Px): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, px.toCanvas());
}

// ---------------------------------------------------------------- gems
type Shape = (dx: number, dy: number) => number; // returns "gauge": <=1 inside, 0 centre

const SHAPES: Shape[] = [
  (dx, dy) => Math.abs(dx) * 0.95 + Math.abs(dy) * 0.9, // ruby: diamond
  (dx, dy) => Math.max(Math.max(Math.abs(dx), Math.abs(dy)) * 1.0, (Math.abs(dx) + Math.abs(dy)) * 0.7), // emerald: cut square
  (dx, dy) => Math.hypot(dx, dy), // sapphire: round
  (dx, dy) => Math.max(Math.abs(dy) * 1.05, Math.abs(dx) * 0.58 + Math.abs(dy) * 0.62), // topaz: hexagon
];

function drawGem(colour: number): Px {
  const S = 24;
  const px = new Px(S, S);
  const ramp = GEM_RAMPS[colour];
  const shape = SHAPES[colour];
  const cx = S / 2;
  const R = 10.4;
  const lightAng = -2.35; // light from the top-left
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const dx = (x + 0.5 - cx) / R;
      const dy = (y + 0.5 - cx) / R;
      const g = shape(dx, dy);
      if (g > 1) continue;
      let idx: number;
      if (g < 0.42) idx = 3; // table (flat top facet)
      else {
        const sector = Math.floor(((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * 8);
        const ang = ((sector + 0.5) / 8) * Math.PI * 2 - Math.PI;
        const lit = Math.cos(ang - lightAng); // -1..1
        idx = lit > 0.55 ? 4 : lit > 0.0 ? 3 : lit > -0.55 ? 2 : 1;
      }
      px.set(x, y, ramp[idx]);
    }
  // table highlight + sparkle
  px.set(7, 7, ramp[4]);
  px.set(8, 7, ramp[4]);
  px.set(7, 8, ramp[4]);
  px.outline(ramp[0]);
  return px;
}

// ---------------------------------------------------------------- bugs
const BUG_RAMPS = [
  [0x3b0a16, 0x8a1c30, 0xd8344a, 0xff7a8a],
  [0x082e1a, 0x16743f, 0x34c870, 0x8af5ad],
  [0x0b1c44, 0x1c4aa8, 0x4a90ff, 0x9cc8ff],
  [0x3e2a04, 0x9a6a0e, 0xf0b92a, 0xffe27a],
];

function drawBug(colour: number, frame: number): Px {
  const px = new Px(28, 26);
  const ramp = BUG_RAMPS[colour];
  const cx = 14;
  const cy = 14;
  // legs first (behind body)
  for (const o of [-7, -3, 3, 7]) {
    const wob = (o > 0 ? 1 : 0) ^ (Math.abs(o) > 5 ? 1 : 0) ^ frame;
    px.line(cx + o, cy + 5, cx + o + Math.sign(o) * 2, cy + 9 + wob, ramp[0]);
  }
  // silhouette extras by colour
  if (colour === 0) {
    // antennae with ball tips
    px.line(cx - 4, cy - 6, cx - 7, cy - 11, ramp[0]);
    px.line(cx + 4, cy - 6, cx + 7, cy - 11, ramp[0]);
    px.rect(cx - 9, cy - 13, 3, 3, ramp[2]);
    px.rect(cx + 6, cy - 13, 3, 3, ramp[2]);
  } else if (colour === 1) {
    // horns
    for (const s of [-1, 1]) {
      px.line(cx + s * 5, cy - 6, cx + s * 8, cy - 10, ramp[3]);
      px.line(cx + s * 6, cy - 6, cx + s * 8, cy - 9, ramp[2]);
      px.set(cx + s * 8, cy - 11, ramp[3]);
    }
  } else if (colour === 2) {
    // spiky crest
    for (const o of [-5, 0, 5]) {
      px.line(cx + o - 1, cy - 6, cx + o, cy - 10, ramp[2]);
      px.line(cx + o + 1, cy - 6, cx + o, cy - 10, ramp[2]);
      px.set(cx + o, cy - 7, ramp[2]);
    }
  } else {
    // round ears
    for (const s of [-1, 1]) px.ellipse(cx + s * 9, cy - 4, 3, 3, (_dx, _dy, g) => (g > 0.55 ? ramp[2] : ramp[3]));
  }
  // body
  px.ellipse(cx, cy, 11, 8, (dx, dy, g) => {
    const lit = -dx * 0.6 - dy * 0.9;
    let idx = lit > 0.55 ? 3 : lit > 0.0 ? 2 : lit > -0.45 ? 2 : 1;
    if (g > 0.78 && dy > 0.2) idx = 1;
    if (idx === 2 && Math.abs(lit) < 0.12 && (Math.round(dx * 8) + Math.round(dy * 8)) % 2 === 0) idx = 1;
    return ramp[idx];
  });
  // markings: belly dots
  for (const [ox, oy] of [[-7, 2], [7, 2], [0, 6]]) px.set(cx + ox, cy + oy, ramp[1]);
  // eyes
  for (const s of [-1, 1]) {
    const ex = s < 0 ? cx - 6 : cx + 2;
    px.rect(ex, cy - 4, 4, 4, 0xffffff);
    px.set(ex + (s < 0 ? 2 : 1), cy - 2, INK);
    px.set(ex + (s < 0 ? 2 : 1), cy - 3, INK);
    // angry brow
    px.line(s < 0 ? cx - 7 : cx + 6, s < 0 ? cy - 7 : cy - 5, s < 0 ? cx - 3 : cx + 2, s < 0 ? cy - 5 : cy - 7, ramp[0]);
  }
  // fangs
  px.rect(cx - 3, cy + 2, 7, 1, ramp[0]);
  px.set(cx - 3, cy + 3, 0xffffff);
  px.set(cx + 3, cy + 3, 0xffffff);
  px.outline(INK);
  return px;
}

// ---------------------------------------------------------------- bone
function drawBone(): Px {
  const px = new Px(24, 24);
  const base = 0xe8dcc0;
  const shade = 0xb8a888;
  for (let t = 0; t <= 1; t += 0.02) {
    const x = 5 + t * 14;
    const y = 18 - t * 14;
    px.ellipse(x, y, 1.9, 1.9, base);
  }
  px.ellipse(5, 18, 3, 3, base);
  px.ellipse(8, 20, 3, 3, base);
  px.ellipse(18, 5, 3, 3, base);
  px.ellipse(15.5, 3.5, 3, 3, base);
  px.ellipse(3.5, 15.5, 3, 3, base);
  px.ellipse(20.5, 8, 3, 3, base);
  // soft shade bottom-right
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) if (px.get(x, y) === base && x - y > 3 && (x + y) % 2 === 0) px.set(x, y, shade);
  px.set(6, 17, 0xffffff);
  px.outline(INK);
  return px;
}

// ---------------------------------------------------------------- hero
function drawHero(mood: 'idle' | 'cheer' | 'hurt'): Px {
  const px = new Px(18, 24);
  const skin = mood === 'hurt' ? 0xb4d47a : 0xf2b98c;
  // legs + boots
  px.rect(5, 19, 3, 3, 0x1c4aa8);
  px.rect(10, 19, 3, 3, 0x1c4aa8);
  px.rect(4, 22, 4, 2, 0x4a3306);
  px.rect(10, 22, 4, 2, 0x4a3306);
  // body
  px.rect(4, 14, 10, 6, 0x3f86ff);
  px.rect(4, 14, 10, 1, 0x8bbcff);
  px.rect(8, 15, 2, 5, 0x1c4aa8);
  px.rect(7, 17, 4, 2, 0xffd042); // pocket / badge
  // arms
  if (mood === 'cheer') {
    px.rect(2, 8, 2, 7, 0xd8344a);
    px.rect(14, 8, 2, 7, 0xd8344a);
    px.rect(1, 6, 3, 3, skin);
    px.rect(14, 6, 3, 3, skin);
  } else {
    px.rect(2, 14, 2, 5, 0xd8344a);
    px.rect(14, 14, 2, 5, 0xd8344a);
    px.rect(2, 19, 2, 2, skin);
    px.rect(14, 19, 2, 2, skin);
  }
  // face
  px.rect(5, 9, 8, 6, skin);
  if (mood === 'hurt') {
    px.line(6, 10, 7, 11, INK);
    px.line(7, 10, 6, 11, INK);
    px.line(10, 10, 11, 11, INK);
    px.line(11, 10, 10, 11, INK);
    px.rect(8, 13, 2, 1, INK);
  } else if (mood === 'cheer') {
    px.set(6, 11, INK);
    px.set(7, 10, INK);
    px.set(8, 11, INK);
    px.set(10, 11, INK);
    px.set(11, 10, INK);
    px.set(12, 11, INK);
    px.rect(7, 13, 4, 1, INK);
    px.rect(8, 14, 2, 1, 0xd8344a);
  } else {
    px.rect(6, 10, 2, 2, INK);
    px.rect(10, 10, 2, 2, INK);
    px.set(6, 10, 0xffffff);
    px.set(10, 10, 0xffffff);
    px.rect(8, 13, 2, 1, INK);
  }
  // helmet
  px.ellipse(9, 7, 6.5, 4.5, (dx, dy) => (dx + dy < -0.5 ? 0xffe27a : 0xffc233));
  px.rect(3, 8, 12, 2, 0xe0a21e);
  px.rect(7, 3, 4, 3, 0xfff6c8); // lamp
  px.rect(8, 4, 2, 1, 0xffffff);
  px.outline(INK);
  return px;
}

// ---------------------------------------------------------------- icons
function drawIcons(scene: Phaser.Scene): void {
  const k = INK;
  const S = 0xc9d6e6; // steel
  const s = 0x7f93ab;
  const w = 0xa8683a; // wood
  const y = 0xffd042;
  const o = 0xff9a2e;

  const pick = new Px(13, 13);
  pick.ascii(0, 0, [
    '....kkkkk....',
    '..kkSSSSSkk..',
    '.kSSssskkSSk.',
    'kSSk...kkSSSk',
    'kSk....kwkSsk',
    'kk....kwwk.kk',
    '.....kwwk....',
    '....kwwk.....',
    '...kwwk......',
    '..kwwk.......',
    '.kwwk........',
    '.kwk.........',
    '..k..........',
  ], { k, S, s, w });
  add(scene, 'ico_pick', pick);

  const zap = new Px(13, 13);
  zap.ascii(0, 0, [
    '......kkkk...',
    '.....kyyyyk..',
    '....kyyyyk...',
    '...kyyyyk....',
    '..kyyyyyyyk..',
    '...kkkyyyk...',
    '......kyyk...',
    '.....kyyk....',
    '....kyyk.....',
    '....kyok.....',
    '...kyk.......',
    '...kk........',
    '.............',
  ], { k, y, o });
  add(scene, 'ico_zapper', zap);

  const net = new Px(13, 13);
  net.ellipse(6, 6, 6, 6, (dx, dy, g) => (g > 0.62 ? S : (Math.round(dx * 6) + 12) % 4 === 0 || (Math.round(dy * 6) + 12) % 4 === 0 ? s : NONE));
  net.line(6, 12, 6, 12, k);
  net.outline(k);
  add(scene, 'ico_net', net);

  const shove = new Px(13, 13);
  shove.ascii(0, 0, [
    '.............',
    '.....k.......',
    '....kSk......',
    '...kSSkkkkkk.',
    '..kSSSSSSSSk.',
    '.kSSSSSSSSSk.',
    '..kSSSSSSSSk.',
    '...kSSkkkkkk.',
    '....kSk......',
    '.....k.......',
    '.............',
    '.............',
    '.............',
  ], { k, S });
  add(scene, 'ico_shove', shove);

  // energy bolt (full / empty)
  for (const [key, c1, c2] of [['bolt_on', y, o], ['bolt_off', 0x4a2a3a, 0x3a1c2a]] as const) {
    const b = new Px(7, 10);
    b.ascii(0, 0, [
      '...kkk.',
      '..kccck',
      '.kcck..',
      'kcccccK',
      '.kkcck.',
      '...kck.',
      '..kck..',
      '..kdk..',
      '.kk....',
      '.......',
    ].map((r) => r.replace('K', 'k')), { k: key === 'bolt_on' ? k : 0x2a1020, c: c1, d: c2 });
    add(scene, key, b);
  }

  // star
  for (const [key, c] of [['star_on', y], ['star_off', 0x7a5468]] as const) {
    const st = new Px(11, 11);
    st.ascii(0, 0, [
      '.....k.....',
      '....kck....',
      '....kck....',
      'kkkkkckkkkk',
      'kcccccccccK',
      '.kcccccccK.',
      '..kcccccK..',
      '..kcccccK..',
      '.kcccKcccK.',
      '.kccK.kccK.',
      '.kk.....kk.',
    ].map((r) => r.replace(/K/g, 'k')), { k: key === 'star_on' ? k : 0x2a1020, c });
    add(scene, key, st);
  }

  // infection pip
  for (const [key, c] of [['pip_on', 0xff4a4a], ['pip_off', 0x3a1c2a]] as const) {
    const p = new Px(7, 7);
    p.ellipse(3.5, 3.5, 3.4, 3.4, (dx, dy) => (key === 'pip_on' && dx + dy < -0.4 ? 0xffb0b0 : c));
    p.outline(0x2a1020);
    add(scene, key, p);
  }
}

function drawMoreIcons(scene: Phaser.Scene): void {
  const k = INK;
  // magnet: red horseshoe with silver tips
  const mg = new Px(13, 13);
  for (let y = 0; y < 13; y++)
    for (let x = 0; x < 13; x++) {
      const dx = x + 0.5 - 6.5, dy = y + 0.5 - 6.2;
      const r = Math.hypot(dx, dy);
      if (y <= 6 && r <= 6 && r >= 2.9) mg.set(x, y, dx + dy < -2 ? 0xff7a8a : 0xd8344a);
      else if (y > 6 && y <= 10 && ((x >= 1 && x <= 3) || (x >= 9 && x <= 11))) mg.set(x, y, x === 1 || x === 9 ? 0xff7a8a : 0xd8344a);
      else if (y > 10 && y <= 12 && ((x >= 1 && x <= 3) || (x >= 9 && x <= 11))) mg.set(x, y, 0xe8f0ff);
    }
  mg.outline(k);
  add(scene, 'ico_magnet', mg);

  // broom
  const br = new Px(13, 13);
  br.ascii(0, 0, [
    '..........kk.',
    '.........kwwk',
    '........kwwk.',
    '.......kwwk..',
    '......kwwk...',
    '....kkkwk....',
    '...kYYYYYkk..',
    '..kYyYyYyYYk.',
    '.kYyYyYyYyYk.',
    '.kYyYyYyYyYk.',
    '..kkkkkkkkk..',
    '.............',
    '.............',
  ], { k, w: 0xa8683a, Y: 0xf0b92a, y: 0xb8800e });
  add(scene, 'ico_broom', br);

  // antidote bottle
  const an = new Px(13, 13);
  an.ascii(0, 0, [
    '....kkkk.....',
    '....kwwk.....',
    '....kwwk.....',
    '...kkwwkk....',
    '..kggggggk...',
    '.kgGGggggk...',
    '.kgGgggggk...',
    '.kgggggggk...',
    '.kgggggggk...',
    '..kgggggk....',
    '...kkkkk.....',
    '.............',
    '.............',
  ], { k, w: 0xe8dcc0, g: 0x2fc06a, G: 0xb0ffd0 });
  add(scene, 'ico_antidote', an);

  // danger marker
  const wn = new Px(9, 12);
  wn.ascii(0, 0, [
    '....k....',
    '...kRk...',
    '..kRRRk..',
    '..kRwRk..',
    '.kRRwRRk.',
    '.kRRwRRk.',
    'kRRRwRRRk',
    'kRRRRRRRk',
    'kRRRwRRRk',
    'kRRRRRRRk',
    '.kkkkkkk.',
    '.........',
  ], { k, R: 0xff4a4a, w: 0xffffff });
  add(scene, 'warn', wn);

  // energy orb
  const orb = new Px(38, 38);
  orb.ellipse(19, 19, 17, 17, (dx, dy, g) => {
    const lit = -dx * 0.55 - dy * 0.75;
    if (g > 0.86) return 0x0a3a48;
    if (lit > 0.7 && g < 0.5) return 0x9ef4ff;
    return lit > 0.15 ? 0x38d6e8 : lit > -0.35 ? 0x1693a8 : 0x0f6478;
  });
  orb.outline(k);
  add(scene, 'orb', orb);

  const sh = new Px(24, 8);
  sh.ellipse(12, 4, 11.5, 3.5, 0x000000);
  add(scene, 'shadow', sh);
}

// ---------------------------------------------------------------- environment
function drawBackground(): Px {
  const px = new Px(W, H);
  const rng = new Rng(7);
  const sites: { x: number; y: number }[] = [];
  for (let i = 0; i < 46; i++) sites.push({ x: rng.next() * W, y: rng.next() * H });
  const tones = [0x1c0813, 0x26101c, 0x321626, 0x3f1b30];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let d1 = 1e9, d2 = 1e9;
      for (const s of sites) {
        const d = Math.hypot(s.x - x, s.y - y);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
      }
      const edge = d2 - d1;
      // darker towards the screen edges
      const vx = (x / W - 0.5) * 2, vy = (y / H - 0.5) * 2;
      const vig = Math.min(1, Math.hypot(vx * 0.9, vy * 1.0));
      let t = 0.25 + (1 - Math.min(1, d1 / 46)) * 0.55 - vig * 0.55;
      if (edge < 2.2) t = Math.max(t, 0.8) + 0.2; // membrane veins
      t = Math.max(0, Math.min(1, t));
      const lvl = t * 3;
      const base = Math.floor(lvl);
      const up = dither(x, y, lvl - base);
      px.set(x, y, tones[Math.min(3, base + (up ? 1 : 0))]);
    }
  return px;
}

function drawWall(): Px {
  const w = 480, h = 14;
  const px = new Px(w, h);
  const ramp = [0x3a1226, 0x5a1d38, 0x7f2c4b, 0xb04a5c, 0xe08a98];
  for (let x = 0; x < w; x++) {
    const edge = Math.round(9 + 2 * Math.sin(x * 0.21) + 1.4 * Math.sin(x * 0.067 + 1.3));
    for (let y = 0; y <= edge; y++) {
      const dpth = edge - y;
      let idx = dpth > 6 ? 0 : dpth > 3 ? 1 : dpth > 1 ? 2 : 3;
      if (dpth === 0) idx = 4;
      if (dpth === 1 && (x & 1) === 0) idx = 4;
      if (idx === 1 && dither(x, y, 0.4)) idx = 0;
      px.set(x, y, ramp[idx]);
    }
    // little villi
    if (x % 17 === 5) {
      for (let k = 1; k <= 3; k++) px.set(x, edge + k, ramp[k === 3 ? 4 : 3]);
      px.set(x + 1, edge + 1, ramp[2]);
    }
  }
  return px;
}

function drawBoardBg(): Px {
  const px = new Px(BOARD_W, BOARD_H);
  const rng = new Rng(11);
  const A = 0x3b1527, B = 0x461a2e, edge = 0x2b0e1c, spec = 0x56223c;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < BOARD_W / CELL; c++) {
      const base = (r + c) % 2 === 0 ? A : B;
      for (let y = 0; y < CELL; y++)
        for (let x = 0; x < CELL; x++) {
          let col = base;
          if (x === 0 || y === 0) col = edge;
          else if (rng.next() < 0.035) col = spec;
          px.set(c * CELL + x, r * CELL + y, col);
        }
    }
  // recessed look: darken the top rows slightly
  for (let y = 0; y < 6; y++) for (let x = 0; x < BOARD_W; x++) if (dither(x, y, (6 - y) / 8)) px.set(x, y, edge);
  return px;
}

function drawGhostBg(): Px {
  const px = new Px(CELL, BOARD_H);
  for (let y = 0; y < BOARD_H; y++)
    for (let x = 0; x < CELL; x++) {
      const lines = (x + y) % 8 === 0;
      px.set(x, y, lines ? 0x3b1527 : 0x2a0e1c);
    }
  return px;
}

function drawAcid(frame: number): Px {
  const px = new Px(CELL, BOARD_H);
  const rng = new Rng(100 + frame);
  const ramp = [0x1d5a1a, 0x2f8a26, 0x56c030, 0x8cf03e, 0xd4ff7a];
  for (let y = 0; y < BOARD_H; y++)
    for (let x = 0; x < CELL; x++) {
      const wave = Math.sin((y + frame * 6) * 0.35 + x * 0.12) * 0.5 + 0.5;
      const t = 0.2 + wave * 0.45 + (1 - x / CELL) * 0.15;
      const lvl = t * 3;
      const base = Math.floor(lvl);
      px.set(x, y, ramp[Math.min(3, base + (dither(x, y, lvl - base) ? 1 : 0))]);
    }
  // foam on the left edge where the belt drops in
  for (let y = 0; y < BOARD_H; y++) {
    const w = 2 + Math.round(1.5 * Math.sin((y + frame * 5) * 0.5));
    for (let x = 0; x < w; x++) px.set(x, y, x === w - 1 ? ramp[3] : ramp[4]);
  }
  // bubbles
  for (let i = 0; i < 9; i++) {
    const bx = 4 + rng.int(CELL - 8);
    const by = 3 + rng.int(BOARD_H - 6);
    const r = 1 + rng.int(2);
    px.ellipse(bx, by, r + 0.4, r + 0.4, (_dx, _dy, g) => (g > 0.5 ? ramp[4] : ramp[2]));
  }
  return px;
}

/** Puckered ring (the way out). open: 0 closed, 1 half, 2 open. */
export function drawRing(px: Px, cx: number, cy: number, R: number, open: number): void {
  const ramp = [0x3a1226, 0x5a1d38, 0x7f2c4b, 0xb04a5c, 0xe08a98];
  px.ellipse(cx, cy, R, R, (dx, dy, g) => {
    const ang = Math.atan2(dy, dx);
    const wr = Math.abs(Math.sin(ang * 6)) > 0.88 && g > 0.15;
    if (g > 0.8) return ramp[2];
    if (wr) return ramp[1];
    return g < 0.4 ? ramp[4] : ramp[3];
  });
  const holeR = [R * 0.1, R * 0.33, R * 0.6][open];
  px.ellipse(cx, cy, holeR, open === 0 ? R * 0.3 : holeR, (_dx, _dy, g) => {
    if (open === 0) return 0x1a0610;
    return g > 0.6 ? 0xfff0b0 : g > 0.25 ? 0xffffff : 0xfffbe0;
  });
  if (open === 0) px.rect(Math.round(cx - R * 0.27), Math.round(cy), Math.round(R * 0.54), 1, 0x1a0610);
}

function drawExit(open: number): Px {
  const px = new Px(CELL, BOARD_H);
  const ramp = [0x3a1226, 0x5a1d38];
  for (let y = 0; y < BOARD_H; y++) for (let x = 0; x < CELL; x++) px.set(x, y, ramp[dither(x, y, 0.45) ? 1 : 0]);
  drawRing(px, CELL / 2, BOARD_H / 2, 15, open);
  return px;
}

// ---------------------------------------------------------------- cards
function drawCard(kind: 'normal' | 'selected' | 'dim'): Px {
  const px = new Px(CARD_W, CARD_H);
  const edge = kind === 'selected' ? 0xffd35a : kind === 'dim' ? 0x4a2a3a : 0x8a5470;
  const fillA = kind === 'selected' ? 0x4a2038 : kind === 'dim' ? 0x241018 : 0x38182c;
  const fillB = kind === 'selected' ? 0x5a2a46 : kind === 'dim' ? 0x2a1220 : 0x44203a;
  for (let y = 0; y < CARD_H; y++)
    for (let x = 0; x < CARD_W; x++) {
      const border = x === 0 || y === 0 || x === CARD_W - 1 || y === CARD_H - 1;
      const corner = (x === 0 || x === CARD_W - 1) && (y === 0 || y === CARD_H - 1);
      if (corner) continue;
      px.set(x, y, border ? edge : BAYER4[y & 3][x & 3] / 16 < (1 - y / CARD_H) * 0.8 ? fillB : fillA);
    }
  if (kind === 'selected') {
    px.rect(1, 1, CARD_W - 2, 1, 0xfff0b0);
  }
  return px;
}

// ---------------------------------------------------------------- public
export function generateTextures(scene: Phaser.Scene): void {
  for (let c = 0; c < 4; c++) {
    add(scene, `gem_${c}`, drawGem(c));
    add(scene, `bug_${c}_0`, drawBug(c, 0));
    add(scene, `bug_${c}_1`, drawBug(c, 1));
  }
  add(scene, 'bone', drawBone());
  add(scene, 'hero_idle', drawHero('idle'));
  add(scene, 'hero_cheer', drawHero('cheer'));
  add(scene, 'hero_hurt', drawHero('hurt'));
  drawIcons(scene);
  drawMoreIcons(scene);

  add(scene, 'bg', drawBackground());
  const wall = drawWall();
  add(scene, 'wall_top', wall);
  add(scene, 'wall_bot', wall.flipY());
  add(scene, 'board_bg', drawBoardBg());
  add(scene, 'ghost_bg', drawGhostBg());
  for (let f = 0; f < 4; f++) add(scene, `acid_${f}`, drawAcid(f));
  for (let o = 0; o < 3; o++) add(scene, `exit_${o}`, drawExit(o));
  add(scene, 'card', drawCard('normal'));
  add(scene, 'card_sel', drawCard('selected'));
  add(scene, 'card_dim', drawCard('dim'));

  // 1x1 white pixel for particles / bars
  const one = new Px(1, 1);
  one.set(0, 0, 0xffffff);
  add(scene, 'px', one);
}
