/*
 * Cat Box — placement-puzzle engine (no DOM, usable from the browser and from Node).
 *
 * A "cat" is a straight bar of `len` cells with a colour:
 *   { id, color, len, axis: 'h' | 'v', r, c }          (r, c = top-left cell)
 * The tray holds the cats the player may place:
 *   { tid, color, len, axis }
 *
 * Rules:
 *   - drop a cat from the tray on empty cells of the box;
 *   - cats of the same colour that touch end to end fuse into one longer cat
 *     (a single cell cat can fuse along either axis);
 *   - a full row/column clears: every cat touching it leaves;
 *   - a cat as long as the box is wide is a "legend": it leaves with a big bonus.
 *   - in modes with mixedClear = false only legends clear (mixed full lines stay).
 */
(function (root) {
  'use strict';

  const MODES = {
    calm: { id: 'calm', n: 5, colors: ['orange', 'gray', 'cream'], mixedClear: true },
    hard: { id: 'hard', n: 5, colors: ['orange', 'gray'], mixedClear: false },
  };

  const TRAY_SIZE = 3;
  const LEGEND_BONUS = 500;
  const BOOST_MOVES = 3; // after a legend the next placements score double
  const LEN_WEIGHTS = [[1, 0.35], [2, 0.4], [3, 0.25]];

  function clone(state) { return JSON.parse(JSON.stringify(state)); }
  const snap = (p) => ({ id: p.id, color: p.color, len: p.len, axis: p.axis, r: p.r, c: p.c });

  function cellsOf(p) {
    const out = [];
    for (let i = 0; i < p.len; i++) out.push(p.axis === 'v' ? [p.r + i, p.c] : [p.r, p.c + i]);
    return out;
  }

  function buildGrid(state) {
    const grid = Array.from({ length: state.n }, () => Array(state.n).fill(null));
    for (const p of state.pieces) for (const [r, c] of cellsOf(p)) grid[r][c] = p;
    return grid;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- placement ---------- */

  function canPlace(state, piece, r, c) {
    const n = state.n;
    const p = { len: piece.len, axis: piece.axis, r, c };
    const grid = buildGrid(state);
    for (const [rr, cc] of cellsOf(p)) {
      if (rr < 0 || cc < 0 || rr >= n || cc >= n || grid[rr][cc]) return false;
    }
    return true;
  }

  function anyPlacement(state, piece) {
    const axes = piece.len === 1 ? ['h'] : ['h', 'v'];
    for (const axis of axes) {
      for (let r = 0; r < state.n; r++) {
        for (let c = 0; c < state.n; c++) {
          if (canPlace(state, { len: piece.len, axis }, r, c)) return true;
        }
      }
    }
    return false;
  }

  function hasMoves(state) {
    return state.tray.some((t) => t && anyPlacement(state, t));
  }

  /* ---------- tray ---------- */

  function genPiece(state, rng) {
    const mode = MODES[state.modeId];
    let x = rng();
    let len = LEN_WEIGHTS[LEN_WEIGHTS.length - 1][0];
    for (const [l, w] of LEN_WEIGHTS) { if (x < w) { len = l; break; } x -= w; }
    // lean towards colours that are already on the board so fusing is on offer
    const onBoard = [...new Set(state.pieces.map((p) => p.color))].filter((c) => mode.colors.includes(c));
    const pool = onBoard.length && rng() < 0.6 ? onBoard : mode.colors;
    const color = pool[Math.floor(rng() * pool.length)];
    return { tid: state.nextId++, color, len, axis: 'h' };
  }

  function genTray(state, rng) {
    let tray = [];
    for (let attempt = 0; attempt < 40; attempt++) {
      tray = [];
      for (let i = 0; i < TRAY_SIZE; i++) tray.push(genPiece(state, rng));
      if (tray.some((t) => anyPlacement(state, t))) return tray;
    }
    return tray;
  }

  function createGame(modeId, rng) {
    const mode = MODES[modeId];
    const state = {
      modeId, n: mode.n, pieces: [], tray: [], nextId: 1,
      score: 0, legends: 0, boost: 0, streak: 0, over: false,
    };
    state.tray = genTray(state, rng || Math.random);
    state.over = !hasMoves(state);
    return state;
  }

  function rotate(state, i) {
    const t = state.tray[i];
    if (!t || t.len === 1) return state;
    const next = clone(state);
    next.tray[i].axis = t.axis === 'h' ? 'v' : 'h';
    return next;
  }

  /* ---------- fusing ---------- */

  // Merge `p` with same-coloured cats touching its ends. Returns { piece, parts } or null.
  function fuse(state, p) {
    const n = state.n;
    const grid = buildGrid(state);
    const axes = p.len === 1 ? ['h', 'v'] : [p.axis];
    let best = null;
    for (const axis of axes) {
      const dr = axis === 'v' ? 1 : 0;
      const dc = axis === 'h' ? 1 : 0;
      const members = [p];
      let sr = p.r, sc = p.c;
      let er = p.r + dr * (p.len - 1), ec = p.c + dc * (p.len - 1);
      const compatible = (q) => q && q.color === p.color && (q.len === 1 || q.axis === axis) && !members.includes(q);
      for (;;) { // backwards
        const r = sr - dr, c = sc - dc;
        if (r < 0 || c < 0) break;
        const q = grid[r][c];
        if (!compatible(q)) break;
        members.push(q);
        sr = r - dr * (q.len - 1);
        sc = c - dc * (q.len - 1);
      }
      for (;;) { // forwards
        const r = er + dr, c = ec + dc;
        if (r >= n || c >= n) break;
        const q = grid[r][c];
        if (!compatible(q)) break;
        members.push(q);
        er = r + dr * (q.len - 1);
        ec = c + dc * (q.len - 1);
      }
      const total = members.reduce((s, m) => s + m.len, 0);
      if (!best || total > best.total) best = { axis, members, total, sr, sc };
    }
    if (!best || best.members.length < 2) return null;
    const parts = best.members
      .map(snap)
      .sort((a, b) => (best.axis === 'h' ? a.c - b.c : a.r - b.r));
    const ids = new Set(best.members.map((m) => m.id));
    state.pieces = state.pieces.filter((q) => !ids.has(q.id));
    const piece = { id: state.nextId++, color: p.color, len: best.total, axis: best.axis, r: best.sr, c: best.sc };
    state.pieces.push(piece);
    return { piece, parts };
  }

  /* ---------- clearing ---------- */

  function clearLines(state) {
    const n = state.n;
    const mode = MODES[state.modeId];
    const grid = buildGrid(state);
    const lines = [];
    const consider = (axis, index, cells) => {
      if (!cells.every(Boolean)) return;
      const single = cells.every((q) => q === cells[0]) && cells[0].len >= n;
      lines.push({ axis, index, kind: single ? 'legend' : 'mixed' });
    };
    for (let r = 0; r < n; r++) consider('h', r, grid[r]);
    for (let c = 0; c < n; c++) consider('v', c, grid.map((row) => row[c]));
    const active = lines.filter((l) => l.kind === 'legend' || mode.mixedClear);
    if (!active.length) return null;
    const cats = new Set();
    for (const l of active) {
      for (let i = 0; i < n; i++) cats.add(l.axis === 'h' ? grid[l.index][i] : grid[i][l.index]);
    }
    return { lines: active, cats: [...cats] };
  }

  /* ---------- a turn ---------- */

  function place(state, i, r, c, rng) {
    const t = state.tray[i];
    if (state.over || !t || !canPlace(state, t, r, c)) return { ok: false, state, events: [] };
    const next = clone(state);
    next.tray[i] = null;
    const events = [];
    const boosted = next.boost > 0;
    let gain = t.len;

    const placed = { id: next.nextId++, color: t.color, len: t.len, axis: t.axis, r, c };
    next.pieces.push(placed);
    events.push(Object.assign({ type: 'place' }, snap(placed)));

    const f = fuse(next, placed);
    if (f) {
      gain += f.piece.len * 5;
      events.push(Object.assign({ type: 'fuse', parts: f.parts }, snap(f.piece)));
    }

    let legends = 0;
    const cl = clearLines(next);
    if (cl) {
      const removed = new Set(cl.cats.map((q) => q.id));
      const legendCats = cl.cats.filter((q) => q.len >= next.n);
      const others = cl.cats.filter((q) => q.len < next.n);
      legends = legendCats.length;
      let base = others.reduce((s, q) => s + q.len * 10, 0) * cl.lines.length;
      next.streak += 1;
      if (next.streak >= 2) base *= 1 + 0.5 * (next.streak - 1);
      gain += base + legends * LEGEND_BONUS;
      next.pieces = next.pieces.filter((q) => !removed.has(q.id));
      next.legends += legends;
      events.push({
        type: 'clear',
        lines: cl.lines,
        streak: next.streak,
        cats: cl.cats.map((q) => Object.assign(snap(q), { legend: q.len >= next.n })),
      });
    } else {
      next.streak = 0;
    }

    const total = Math.round(gain * (boosted ? 2 : 1));
    next.score += total;
    if (boosted) next.boost--;
    if (legends) next.boost = BOOST_MOVES;
    events.push({ type: 'score', gain: total, boosted });

    if (next.tray.every((x) => !x)) {
      next.tray = genTray(next, rng || Math.random);
      events.push({ type: 'refill' });
    }
    next.over = !hasMoves(next);
    return { ok: true, state: next, events };
  }

  // What would dropping tray piece `i` at (r, c) do? Used for the drag preview.
  function preview(state, i, r, c) {
    const res = place(state, i, r, c, () => 0.5);
    if (!res.ok) return { valid: false, fuseIds: [], lines: [] };
    const live = new Set(state.pieces.map((q) => q.id));
    const fuseEv = res.events.find((e) => e.type === 'fuse');
    const clearEv = res.events.find((e) => e.type === 'clear');
    return {
      valid: true,
      fuseIds: fuseEv ? fuseEv.parts.map((q) => q.id).filter((id) => live.has(id)) : [],
      lines: clearEv ? clearEv.lines : [],
    };
  }

  const api = {
    MODES, TRAY_SIZE, BOOST_MOVES, LEGEND_BONUS,
    createGame, place, rotate, preview, canPlace, anyPlacement, hasMoves,
    cellsOf, buildGrid, clone, mulberry32,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CatBox = api;
})(typeof window !== 'undefined' ? window : globalThis);
