/*
 * Cat Merge — game engine (no DOM, usable from the browser and from Node).
 *
 * A "piece" is a straight bar of `len` cells (a cat that has stretched) or a fish.
 *   { id, kind: 'cat' | 'fish', level, len, axis: 'h' | 'v', r, c }   (r, c = top-left cell)
 *
 * Rules shared by every mode:
 *   - a swipe slides every piece as far as it can in that direction;
 *   - a cat blocked by a cat of the same level merges with it (once per piece per swipe);
 *   - the merged cat stretches into whatever free space it can find
 *     (see findPlacement), so merging does not always free cells;
 *   - a cat that grows to the full width of the board becomes a "legend" and leaves.
 */
(function (root) {
  'use strict';

  const DIRS = { left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] };

  const STRETCH_LEN = [1, 1, 2, 3, 4, 5];

  const MODES = {
    // Plain 2048 with cats: merging always frees a cell.
    classic: {
      id: 'classic', n: 4, maxLevel: 11, fish: false,
      lenOf: () => 1,
      mergeLen: () => 1,
    },
    // Higher levels are longer cats; the 6th level fills a whole row/column.
    stretch: {
      id: 'stretch', n: 5, maxLevel: 6, fish: false,
      lenOf: (lv) => STRETCH_LEN[lv - 1],
      mergeLen: (a, b, lv) => STRETCH_LEN[lv - 1],
    },
    // Length comes from eating fish, level comes from merging.
    fish: {
      id: 'fish', n: 5, maxLevel: 9, fish: true,
      lenOf: () => 1,
      mergeLen: (a, b) => Math.max(a.len, b.len),
    },
  };

  const LEGEND_BONUS = 500;
  const EAT_SCORE = 20;
  const BOOST_MOVES = 5; // after a legend, merges are worth double for this many moves

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

  function clone(state) {
    return JSON.parse(JSON.stringify(state));
  }

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

  function makePiece(state, props) {
    return Object.assign({ id: state.nextId++, kind: 'cat', level: 1, len: 1, axis: 'h', r: 0, c: 0 }, props);
  }

  /*
   * Where does a freshly merged / fed cat of length `len` go?
   * The bar must sit on cells that are free or that belonged to the pieces that just
   * joined (`union`). We prefer to cover as many of those cells as possible, then the
   * axis of the swipe, then the far end of the swipe direction.
   * `require` (optional) lists cells the bar must cover. Returns null if nothing fits.
   */
  function findPlacement(state, grid, len, prefAxis, union, require, d) {
    const n = state.n;
    const axes = len === 1 ? ['h'] : [prefAxis, prefAxis === 'h' ? 'v' : 'h'];
    let best = null;
    let bestScore = -Infinity;
    for (const axis of axes) {
      const rMax = axis === 'v' ? n - len : n - 1;
      const cMax = axis === 'h' ? n - len : n - 1;
      for (let r = 0; r <= rMax; r++) {
        for (let c = 0; c <= cMax; c++) {
          let overlap = 0;
          let proj = 0;
          let ok = true;
          const covered = new Set();
          for (let i = 0; i < len; i++) {
            const rr = axis === 'v' ? r + i : r;
            const cc = axis === 'h' ? c + i : c;
            const k = rr * n + cc;
            covered.add(k);
            if (union.has(k)) overlap++;
            else if (grid[rr][cc]) { ok = false; break; }
            proj += d[0] * rr + d[1] * cc;
          }
          if (!ok || overlap === 0) continue;
          if (require) {
            let all = true;
            for (const k of require) if (!covered.has(k)) { all = false; break; }
            if (!all) continue;
          }
          const score = overlap * 100 + (axis === prefAxis ? 10 : 0) + proj / len;
          if (score > bestScore) {
            bestScore = score;
            best = { axis, r, c };
          }
        }
      }
    }
    return best;
  }

  function createGame(modeId, rng) {
    const mode = MODES[modeId];
    const state = {
      modeId, n: mode.n, pieces: [], nextId: 1,
      score: 0, legends: 0, boost: 0, over: false,
    };
    spawn(state, rng || Math.random);
    spawn(state, rng || Math.random);
    return state;
  }

  function spawn(state, rng) {
    const mode = MODES[state.modeId];
    const grid = buildGrid(state);
    const empty = [];
    for (let r = 0; r < state.n; r++) for (let c = 0; c < state.n; c++) if (!grid[r][c]) empty.push([r, c]);
    if (!empty.length) return null;
    const [r, c] = empty[Math.floor(rng() * empty.length)];
    const fishCount = state.pieces.filter((p) => p.kind === 'fish').length;
    let piece;
    if (mode.fish && fishCount < 2 && rng() < 0.25) {
      piece = makePiece(state, { kind: 'fish', level: 0, len: 1, r, c });
    } else {
      const level = rng() < 0.9 ? 1 : 2;
      piece = makePiece(state, { level, len: mode.lenOf(level), r, c });
    }
    state.pieces.push(piece);
    return piece;
  }

  // Slide everything one swipe. Mutates `state`; returns { moved, events }.
  function slide(state, dirName) {
    const mode = MODES[state.modeId];
    const n = state.n;
    const d = DIRS[dirName];
    const dAxis = d[0] === 0 ? 'h' : 'v';
    const events = [];
    const done = new Set();
    const gone = new Set();
    const mult = state.boost > 0 ? 2 : 1;
    const snap = (p) => ({ id: p.id, level: p.level, len: p.len, axis: p.axis, r: p.r, c: p.c });
    let moved = false;

    const lead = (p) => Math.max(...cellsOf(p).map(([r, c]) => d[0] * r + d[1] * c));
    const order = state.pieces.slice().sort((a, b) => lead(b) - lead(a));

    const remove = (p) => {
      gone.add(p.id);
      state.pieces = state.pieces.filter((x) => x.id !== p.id);
    };

    const legend = (p) => {
      remove(p);
      state.legends++;
      state.score += LEGEND_BONUS;
      events.push({ type: 'legend', level: p.level, len: p.len, axis: p.axis, r: p.r, c: p.c });
    };

    const tryMerge = (a, b) => {
      const level = a.level + 1;
      const len = Math.min(mode.mergeLen(a, b, level), n);
      const union = new Set([...cellsOf(a), ...cellsOf(b)].map(([r, c]) => r * n + c));
      const pl = findPlacement(state, buildGrid(state), len, dAxis, union, null, d);
      if (!pl) return false;
      const from = { a: snap(a), b: snap(b) };
      remove(a);
      remove(b);
      const merged = makePiece(state, { level, len, axis: pl.axis, r: pl.r, c: pl.c });
      state.pieces.push(merged);
      done.add(merged.id);
      const gain = Math.pow(2, level) * mult;
      state.score += gain;
      events.push(Object.assign({ type: 'merge', gain }, snap(merged), from));
      if (merged.len >= n) legend(merged);
      return true;
    };

    const tryEat = (cat, fish) => {
      const len = Math.min(cat.len + 1, n);
      const prefAxis = cat.len === 1 ? dAxis : cat.axis;
      const union = new Set([...cellsOf(cat), ...cellsOf(fish)].map(([r, c]) => r * n + c));
      const require = new Set(cellsOf(cat).map(([r, c]) => r * n + c));
      const pl = findPlacement(state, buildGrid(state), len, prefAxis, union, require, d);
      if (!pl) return false;
      const eaten = snap(fish);
      remove(fish);
      cat.len = len;
      cat.axis = pl.axis;
      cat.r = pl.r;
      cat.c = pl.c;
      done.add(cat.id);
      state.score += EAT_SCORE;
      events.push({ type: 'eat', id: cat.id, fish: eaten, gain: EAT_SCORE });
      if (cat.len >= n) legend(cat);
      return true;
    };

    const interact = (p, b) => {
      if (p.kind === 'cat' && b.kind === 'cat') {
        if (p.level === b.level && p.level < mode.maxLevel && !done.has(p.id) && !done.has(b.id)) {
          return tryMerge(p, b);
        }
        return false;
      }
      if (p.kind !== b.kind) {
        const cat = p.kind === 'cat' ? p : b;
        const fish = p.kind === 'fish' ? p : b;
        if (!done.has(cat.id)) return tryEat(cat, fish);
      }
      return false;
    };

    for (const p of order) {
      if (gone.has(p.id)) continue;
      for (;;) {
        const own = new Set(cellsOf(p).map(([r, c]) => r * n + c));
        const target = cellsOf(p)
          .map(([r, c]) => [r + d[0], c + d[1]])
          .filter(([r, c]) => !own.has(r * n + c));
        if (target.some(([r, c]) => r < 0 || c < 0 || r >= n || c >= n)) break;
        const grid = buildGrid(state);
        const blockers = [];
        for (const [r, c] of target) {
          const b = grid[r][c];
          if (b && !blockers.includes(b)) blockers.push(b);
        }
        if (!blockers.length) {
          p.r += d[0];
          p.c += d[1];
          moved = true;
          continue;
        }
        for (const b of blockers) {
          if (interact(p, b)) { moved = true; break; }
        }
        break;
      }
    }
    return { moved, events };
  }

  function isOver(state) {
    for (const dir of Object.keys(DIRS)) {
      if (slide(clone(state), dir).moved) return false;
    }
    return true;
  }

  // One full turn: slide, then spawn. Returns a new state (the old one is untouched).
  function move(state, dirName, rng) {
    const next = clone(state);
    const boosted = next.boost > 0;
    const res = slide(next, dirName);
    if (!res.moved) return { state, moved: false, events: [], over: state.over };
    if (boosted) next.boost--;
    if (res.events.some((e) => e.type === 'legend')) next.boost = BOOST_MOVES;
    const sp = spawn(next, rng || Math.random);
    const events = res.events;
    if (sp) events.push({ type: 'spawn', id: sp.id });
    next.over = isOver(next);
    return { state: next, moved: true, events, over: next.over };
  }

  const api = { MODES, BOOST_MOVES, DIRS, createGame, move, slide, spawn, isOver, cellsOf, buildGrid, clone, mulberry32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CatEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
