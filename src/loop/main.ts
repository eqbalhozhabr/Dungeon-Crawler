// Alley Echo: canvas, input, scenes (title / play / pause / game over) and the glue between rules, art and sound.
import { DEBUG } from '../target';
import { PixBuf } from './art/buf';
import { C, GAME_TITLE, GRID, H, SCENE_H, W } from './config';
import { botLane, botSlide } from './logic/bot';
import { Game, rel } from './logic/game';
import { LANES, RING, type GameEvent } from './logic/types';
import { Sound } from './audio';
import { PAUSE_RECT, Panel, drawRune } from './panel';
import { Scene } from './scene';
import { loadSave, writeSave } from './storage';

type Mode = 'title' | 'play' | 'pause' | 'over';
interface Btn {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

const host = document.getElementById('game')!;
const canvas = document.createElement('canvas');
canvas.width = W;
canvas.height = H;
host.appendChild(canvas);
const ctx = canvas.getContext('2d')!;
const buf = new PixBuf(W, H);
const scene = new Scene(buf);
const panel = new Panel();
const sound = new Sound();
const save = loadSave();
sound.muted = save.muted;

let mode: Mode = 'title';
const seedParam = Number(new URLSearchParams(location.search).get('seed'));
const newSeed = () => (seedParam > 0 ? seedParam : (Date.now() ^ (Math.random() * 1e9)) >>> 0);
let game = new Game(newSeed());
let demo = true; // the title screen runs a bot in the background
let botPlays = false;
let overT = 0;
let newBest = false;
let hover: { d: number; l: number } | null = null;
let buttons: Btn[] = [];
let page = 0; // title "how to play" page, 0 = none
const prevGhost = new Map<number, number>();
let prevLane = game.lane;
let tipRune = 0;
let rngS = 12345;
const rnd = () => {
  rngS = (rngS * 1664525 + 1013904223) >>> 0;
  return rngS / 4294967296;
};

// ---------------------------------------------------------------- layout: whole device pixels, never blurry
function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  const vw = host.clientWidth;
  const vh = host.clientHeight;
  const s = Math.max(1 / dpr, Math.floor(Math.min(vw / W, vh / H) * dpr) / dpr);
  canvas.style.width = `${W * s}px`;
  canvas.style.height = `${H * s}px`;
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- run control
function startRun(): void {
  game = new Game(newSeed());
  demo = false;
  mode = 'play';
  prevGhost.clear();
  prevLane = game.lane;
  panel.reset();
  newBest = false;
  save.runs++;
  writeSave();
  sound.drone(true);
  sound.start();
}

function toTitle(): void {
  game = new Game(newSeed());
  demo = true;
  mode = 'title';
  page = 0;
  panel.reset();
  prevGhost.clear();
  sound.drone(false);
}

function setPause(p: boolean): void {
  if (p && mode === 'play') {
    mode = 'pause';
    sound.drone(false);
  } else if (!p && mode === 'pause') {
    mode = 'play';
    sound.drone(true);
  }
}

function endRun(): void {
  mode = 'over';
  overT = 0;
  sound.drone(false);
  if (game.score > save.best) {
    save.best = game.score;
    newBest = true;
  }
  save.bestLaps = Math.max(save.bestLaps, game.lap + 1);
  writeSave();
}

// ---------------------------------------------------------------- events -> sound and effects
function handleEvents(g: Game, quiet: boolean): void {
  for (const e of g.events as GameEvent[]) {
    switch (e.t) {
      case 'coin':
        scene.popup(e.row, e.lane, `+${e.n}`, e.who < 0 ? C.gold : C.ghost);
        scene.burst(e.row, e.lane, e.who < 0 ? C.gold : C.ghost, e.fromKill ? 6 : 3);
        if (!quiet) sound.note(e.who < 0 ? -1 : g.echoes[e.who] ? g.echoes[e.who].id % 3 : 0, Sound.degree(e.lane, e.row), e.fromKill ? 1 : 0.8);
        break;
      case 'strike':
        scene.burst(e.row, e.lane, 0xffffff, e.kill ? 8 : 3, 0.5);
        if (!quiet) sound.strike(e.kill, e.who);
        break;
      case 'hurt':
        scene.shake = 0.5;
        scene.flash = 0.6;
        scene.popup(g.p, e.lane, '-1', C.red);
        if (!quiet) sound.hurt();
        break;
      case 'heal':
        scene.popup(g.p, e.lane, 'HEAL', C.good);
        if (!quiet) sound.heal();
        break;
      case 'slide':
        if (!quiet) sound.slide();
        break;
      case 'lap':
        panel.banner(`LAP ${e.lap + 1}`, e.echoes === 1 ? '1 GHOST RUNS WITH YOU' : e.echoes ? `${e.echoes} GHOSTS RUN WITH YOU` : '', 1.6);
        if (!quiet) sound.lap();
        break;
      case 'upgrade':
        break;
      case 'tremor':
        panel.banner('THE ALLEY SHIFTS', 'A RUNE TURNED WORSE, ONE TILE MOVED', 2.4);
        scene.shake = 0.7;
        if (!quiet) sound.tremor();
        break;
      case 'over':
        if (!quiet) sound.over();
        endRun();
        break;
    }
  }
  g.events.length = 0;
}

/** Lane changes are notes: yours plucked, each ghost's in its own voice, so a ghost replays your melody. */
function laneNotes(g: Game): void {
  if (g.lane !== prevLane) {
    sound.note(-1, Sound.degree(g.lane, g.p), 0.5);
    prevLane = g.lane;
  }
  g.echoes.forEach((e, i) => {
    const l = g.echoLane(i);
    const was = prevGhost.get(e.id);
    if (was !== undefined && was !== l) sound.note(e.id % 3, Sound.degree(l, g.p), 0.55);
    prevGhost.set(e.id, l);
  });
}

// ---------------------------------------------------------------- first-run hints, each shown once
function hints(g: Game): void {
  if (panel.hasHint() || demo) return;
  const say = (id: string, text: string, dur = 4.5): boolean => {
    if (save.hints.includes(id)) return false;
    save.hints.push(id);
    writeSave();
    panel.hint(text, dur);
    return true;
  };
  if (g.time > 0.4 && say('steer', 'TAP OR DRAG THE STREET\nTO CHANGE LANE\nYOU HIT WHAT IS IN YOUR LANE')) return;
  if (g.lap === 0 && g.p > 12 && say('coins', 'GRAB COINS, DODGE SPIKES\nTHIEVES DIE TO ONE HIT')) return;
  if (g.lap === 1 && g.p > 1 && say('ghost', 'A GHOST REPEATS YOUR LAP\nITS ROUTE: BLUE ON THE MAP', 5.5)) return;
  if (g.lap === 1 && g.p > 10 && say('slide', 'TAP GLOWING RUNES TO SLIDE\nTHEM INTO THE GAP\nREBUILD THE ALLEY AHEAD', 6)) return;
  if (!save.hints.includes('steer')) return;
  for (let l = 0; l < LANES; l++)
    for (let d = 0; d < 3; d++) {
      const t = g.grid[d][l];
      if (t?.rune === 'brute' && t.state[0] > 0 && rel(d * 10 + 5, g.p) < 8 && say('brute', 'A BRUTE NEEDS TWO HITS\nRUN ITS LANE WITH A GHOST')) return;
    }
}

// ---------------------------------------------------------------- input
const logical = (e: PointerEvent): { x: number; y: number } => {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
};
const laneAt = (x: number) => (x < W / 3 ? 0 : x < (2 * W) / 3 ? 1 : 2);
const tileAt = (x: number, y: number): { d: number; l: number } | null => {
  const l = Math.floor((x - GRID.x) / GRID.tw);
  const row = Math.floor((y - GRID.y) / GRID.th);
  if (l < 0 || l >= 3 || row < 0 || row >= 3) return null;
  return { d: 2 - row, l };
};
const hit = (b: Btn, x: number, y: number) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
let steer = -1;

function press(id: string): void {
  sound.click();
  switch (id) {
    case 'play':
    case 'again':
    case 'restart':
      startRun();
      break;
    case 'how':
      page = page === 0 ? 1 : page >= 3 ? 0 : page + 1;
      break;
    case 'resume':
      setPause(false);
      break;
    case 'title':
      toTitle();
      break;
    case 'sound':
      sound.setMuted(!sound.muted);
      save.muted = sound.muted;
      writeSave();
      break;
  }
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  sound.unlock();
  const { x, y } = logical(e);
  for (const b of buttons) if (hit(b, x, y)) return press(b.id);
  if (mode !== 'play') return;
  if (x >= PAUSE_RECT.x && y <= PAUSE_RECT.y + PAUSE_RECT.h + 2) return setPause(true);
  if (y < SCENE_H) {
    steer = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    game.setLane(laneAt(x));
  } else {
    const c = tileAt(x, y);
    if (!c) return;
    const t = game.grid[c.d][c.l];
    panel.tip(t ? t.rune : null);
    if (t && !game.slide(c.d, c.l)) {
      sound.click();
      if (game.isLocked(c.d)) panel.tip(t.rune);
    }
  }
});
canvas.addEventListener('pointermove', (e) => {
  const { x, y } = logical(e);
  hover = mode === 'play' && e.pointerType === 'mouse' ? tileAt(x, y) : null;
  if (hover && mode === 'play' && game.grid[hover.d][hover.l]) {
    const r = game.grid[hover.d][hover.l]!.rune;
    if (tipRune !== game.grid[hover.d][hover.l]!.id) {
      tipRune = game.grid[hover.d][hover.l]!.id;
      panel.tip(r);
    }
  }
  if (e.pointerId === steer && mode === 'play') game.setLane(laneAt(x));
});
const release = (e: PointerEvent) => {
  if (e.pointerId === steer) steer = -1;
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('pointerleave', () => (hover = null));
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });

window.addEventListener('keydown', (e) => {
  sound.unlock();
  const k = e.key.toLowerCase();
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault();
  if (k === 'm') return press('sound');
  if (mode === 'title') {
    if (k === 'enter' || k === ' ') press('play');
  } else if (mode === 'play') {
    if (k === 'arrowleft' || k === 'a') game.moveLane(-1);
    else if (k === 'arrowright' || k === 'd') game.moveLane(1);
    else if (k === '1' || k === '2' || k === '3') game.setLane(Number(k) - 1);
    else if (k === 'p' || k === ' ') setPause(true);
  } else if (mode === 'pause') {
    if (k === 'p' || k === ' ' || k === 'enter') setPause(false);
    else if (k === 'r') press('restart');
  } else if (mode === 'over' && overT > 0.6) {
    if (k === 'enter' || k === ' ' || k === 'r') press('again');
  }
});
window.addEventListener('blur', () => setPause(true));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) setPause(true);
});

// ---------------------------------------------------------------- drawing the screens
function button(id: string, label: string, x: number, y: number, w: number, h: number, primary = false): void {
  buttons.push({ id, label, x, y, w, h });
  const pulse = primary ? 0.5 + 0.5 * Math.sin(performance.now() / 260) : 0;
  buf.rect(x, y, w, h, primary ? C.tileA : C.panel);
  buf.rect(x, y, w, 1, primary ? 0xffc890 : C.panelEdge);
  buf.rect(x, y + h - 2, w, 2, primary ? C.tileEdge : 0x120818);
  buf.frame(x, y, w, h, primary ? mixGold(pulse) : C.panelEdge);
  buf.textC(label, x + w / 2, y + Math.round((h - 7) / 2), primary ? C.ink : C.text);
}
const mixGold = (t: number) => (t > 0.5 ? C.gold : 0xc88a3a);

function dim(a: number, y0 = 0, y1 = H): void {
  buf.rect(0, y0, W, y1 - y0, C.ink, a);
}

function drawTitle(): void {
  dim(0.45, 28, 200);
  const t = performance.now() / 1000;
  buf.textC('ALLEY', W / 2, 40, C.gold, 5, C.goldDark);
  buf.textC('ECHO', W / 2, 78 + Math.round(Math.sin(t * 2)), C.ghost, 5, 0x2a5a78);
  buf.textC('RUN THE LOOP.', W / 2, 122, C.text, 1, C.ink);
  buf.textC('YOUR PAST SELF RUNS WITH YOU.', W / 2, 132, C.text, 1, C.ink);
  button('play', 'PLAY', 40, 150, 100, 20, true);
  button('how', page ? 'NEXT >' : 'HOW TO PLAY', 40, 176, 100, 16);
  if (save.best > 0) buf.textC(`BEST ${save.best}`, W / 2, 196, C.gold, 1, C.ink);
  // rune row as decoration
  (['coin', 'bandit', 'brute', 'spikes', 'fountain'] as const).forEach((r, i) => drawRune(buf, r, 24 + i * 33, 12, 0xfff0d0));
  if (page) drawHow();
  button('sound', sound.muted ? 'SOUND OFF' : 'SOUND ON', 4, 300, 58, 14);
  buf.textC('M MUTES', 134, 303, C.textDim);
}

const HOW: string[][] = [
  ['THE LOOP', '', 'THE ALLEY IS A RING.', 'YOU RUN IT AGAIN AND AGAIN.', 'STEER BETWEEN 3 LANES.', 'YOU HIT WHAT IS IN YOUR LANE:', 'THIEVES DIE, COINS ARE YOURS.', 'SPIKES AND BRUTES HURT.'],
  ['ECHOES', '', 'AT THE END OF A LAP YOUR', 'RUN BECOMES A GHOST.', 'IT REPEATS YOUR LANES NEXT', 'LAP AND HITS AND GRABS.', 'GHOSTS NEVER GET HURT.', 'BRUTES NEED TWO HITS AT ONCE.'],
  ['THE MAP', '', 'THE 9 RUNES BELOW ARE THE', 'ALLEY: 3 DISTRICTS, 3 LANES.', 'SLIDE RUNES INTO THE GAP TO', 'REBUILD THE STREET AHEAD.', 'PUT HAZARDS WHERE NO ONE', 'RUNS, FOES WHERE GHOSTS RUN.'],
];
function drawHow(): void {
  dim(0.85, 28, 200);
  const p = HOW[page - 1];
  buf.textC(p[0], W / 2, 40, C.gold, 2, C.goldDark);
  for (let i = 2; i < p.length; i++) buf.textC(p[i], W / 2, 62 + (i - 2) * 11, C.text, 1, C.ink);
  buf.textC(`${page}/3`, W / 2, 176, C.textDim);
}

function drawPause(): void {
  dim(0.7);
  buf.textC('PAUSED', W / 2, 90, C.gold, 3, C.goldDark);
  button('resume', 'RESUME', 40, 130, 100, 20, true);
  button('restart', 'RESTART', 40, 156, 100, 16);
  button('sound', sound.muted ? 'SOUND OFF' : 'SOUND ON', 40, 178, 100, 16);
  buf.textC('A D / ARROWS / 1 2 3 STEER', W / 2, 212, C.textDim);
  buf.textC('P OR SPACE PAUSES', W / 2, 224, C.textDim);
}

function drawOver(): void {
  const a = Math.min(0.78, overT * 1.2);
  dim(a);
  if (overT < 0.5) return;
  const y = 40;
  buf.textC('THE LOOP ENDS', W / 2, y, C.red, 2, 0x000000);
  buf.textC('SCORE', W / 2, y + 30, C.textDim, 1);
  buf.textC(String(game.score), W / 2, y + 42, C.gold, 4, C.goldDark);
  if (newBest) buf.textC('NEW BEST!', W / 2, y + 76, C.good, 2, 0x000000);
  else buf.textC(`BEST ${save.best}`, W / 2, y + 78, C.textDim, 1);
  const lines = [`LAPS  ${game.lap + 1}`, `COINS  ${game.coins}`, `GHOSTS TOOK  ${Math.round((game.ghostCoins / Math.max(1, game.coins)) * 100)}%`, `FOES  ${game.kills}`];
  lines.forEach((s, i) => buf.textC(s, W / 2, y + 98 + i * 11, C.text, 1, C.ink));
  button('again', 'AGAIN', 40, 200 + 8, 100, 20, true);
  button('title', 'TITLE', 40, 232 + 8, 100, 16);
}

// ---------------------------------------------------------------- main loop
let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  buttons = [];
  if (mode === 'play' || mode === 'title' || mode === 'over') {
    if (mode === 'title' || botPlays) {
      if (!game.over) {
        game.setLane(botLane(game, 3.4));
        if (rnd() < dt * 0.6) botSlide(game, rnd);
      } else toTitle();
    }
    if (mode === 'over') overT += dt;
    if (!game.over) game.step(dt);
    if (mode === 'play') {
      laneNotes(game);
      sound.tick(Math.floor(game.p) % RING);
    }
    handleEvents(game, mode === 'title');
    if (mode === 'play') hints(game);
  }
  scene.draw(game, mode === 'pause' ? 0 : dt);
  panel.draw(buf, game, mode === 'pause' ? 0 : dt, hover, game.slides < 6 && !demo, mode !== 'title');
  if (mode === 'title') drawTitle();
  else if (mode === 'pause') drawPause();
  else if (mode === 'over') drawOver();
  buf.toCanvas(ctx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

document.title = GAME_TITLE;

if (DEBUG) {
  // test hooks (never in portal builds): drive the game from scripts/loop-smoke.mjs and the screenshot script
  (window as unknown as Record<string, unknown>).__loop = {
    get game() {
      return game;
    },
    get mode() {
      return mode;
    },
    start: startRun,
    toTitle,
    pause: setPause,
    bot: (on: boolean) => (botPlays = on),
    /** Fast-forward the current run with the bot. */
    skip: (secs: number) => {
      for (let t = 0; t < secs && !game.over; t += 1 / 60) {
        game.setLane(botLane(game, 3.4));
        game.step(1 / 60);
        handleEvents(game, true);
      }
    },
    save,
  };
}
