// Run with: node cat-box/test.js
const assert = require('assert');
const E = require('./engine.js');

function game(modeId, pieces, tray) {
  const s = E.createGame(modeId, E.mulberry32(1));
  s.pieces = pieces.map((p, i) => Object.assign({ id: 100 + i, color: 'orange', len: 1, axis: 'h' }, p));
  s.nextId = 1000;
  s.tray = (tray || []).map((t, i) => Object.assign({ tid: 900 + i, color: 'orange', len: 1, axis: 'h' }, t));
  while (s.tray.length < 3) s.tray.push(null);
  s.over = false;
  return s;
}
const sum = (s) => s.pieces.map((p) => `${p.color}${p.len}${p.axis}@${p.r},${p.c}`).sort();
const put = (s, i, r, c) => { const res = E.place(s, i, r, c, E.mulberry32(2)); assert(res.ok, `place failed at ${r},${c}`); return res; };

// fusing
{
  let s = game('calm', [{ r: 0, c: 0 }], [{ len: 2 }]);
  s = put(s, 0, 0, 1).state;
  assert.deepStrictEqual(sum(s), ['orange3h@0,0']);
}
{ // bridge two cats with one
  let s = game('calm', [{ r: 0, c: 0 }, { r: 0, c: 2 }], [{ len: 1 }]);
  s = put(s, 0, 0, 1).state;
  assert.deepStrictEqual(sum(s), ['orange3h@0,0']);
}
{ // a single cell cat can join a vertical bar
  let s = game('calm', [{ r: 3, c: 2, len: 2, axis: 'v' }], [{ len: 1 }]);
  s = put(s, 0, 2, 2).state;
  assert.deepStrictEqual(sum(s), ['orange3v@2,2']);
}
{ // different colours do not fuse
  let s = game('calm', [{ r: 0, c: 0, color: 'gray' }], [{ len: 1 }]);
  s = put(s, 0, 0, 1).state;
  assert.strictEqual(s.pieces.length, 2);
}
{ // perpendicular bars do not fuse
  let s = game('calm', [{ r: 0, c: 0, len: 2, axis: 'v' }], [{ len: 2 }]);
  s = put(s, 0, 0, 1).state;
  assert.strictEqual(s.pieces.length, 2);
}

// legend: 3 + 2 of one colour fills the row
{
  let s = game('calm', [{ r: 2, c: 0, len: 3 }], [{ len: 2 }]);
  const res = put(s, 0, 2, 3);
  assert.strictEqual(res.state.pieces.length, 0);
  assert.strictEqual(res.state.legends, 1);
  assert(res.state.score >= E.LEGEND_BONUS);
  assert.strictEqual(res.state.boost, E.BOOST_MOVES);
  const clear = res.events.find((e) => e.type === 'clear');
  assert(clear.cats[0].legend);
}

// mixed full line clears whole cats (calm), not in hard
const row = [
  { r: 0, c: 0, color: 'orange' }, { r: 0, c: 1, color: 'gray', len: 2, axis: 'v' },
  { r: 0, c: 2, color: 'orange' }, { r: 0, c: 3, color: 'gray' },
];
{
  let s = game('calm', row, [{ color: 'cream', len: 1 }]);
  const res = put(s, 0, 0, 4);
  assert.strictEqual(res.state.pieces.length, 0, 'whole vertical cat leaves with the row');
  assert(res.events.some((e) => e.type === 'clear'));
}
{
  let s = game('hard', row, [{ color: 'orange', len: 1 }]);
  const res = put(s, 0, 0, 4);
  assert.strictEqual(res.state.pieces.length, row.length + 1, 'hard mode keeps mixed lines');
}

// game over
{
  const pieces = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) pieces.push({ r, c, color: (r + c) % 2 ? 'gray' : 'orange' });
  const s = game('hard', pieces, [{ len: 1 }, { len: 2 }]);
  assert(!E.hasMoves(s));
}

// preview matches the real result
{
  let s = game('calm', [{ r: 0, c: 0, len: 3 }], [{ len: 2 }]);
  const pv = E.preview(s, 0, 0, 3);
  assert(pv.valid && pv.fuseIds.length === 1 && pv.lines.length === 1 && pv.lines[0].kind === 'legend');
  assert(!E.preview(s, 0, 0, 2).valid);
}

// fuzz: random play keeps the invariants
function violations(s) {
  const grid = E.buildGrid(s);
  const seen = new Set();
  for (const p of s.pieces) {
    for (const [r, c] of E.cellsOf(p)) {
      assert(r >= 0 && c >= 0 && r < s.n && c < s.n, 'out of bounds');
      assert(!seen.has(r * s.n + c), 'overlap');
      seen.add(r * s.n + c);
    }
    assert(p.len < s.n, 'legend should have left');
    // no unfused same-colour neighbours on a shared axis
    for (const axis of p.len === 1 ? ['h', 'v'] : [p.axis]) {
      const dr = axis === 'v' ? 1 : 0, dc = axis === 'h' ? 1 : 0;
      for (const [r, c] of [[p.r - dr, p.c - dc], [p.r + dr * p.len, p.c + dc * p.len]]) {
        if (r < 0 || c < 0 || r >= s.n || c >= s.n) continue;
        const q = grid[r][c];
        if (q && q.color === p.color && (q.len === 1 || q.axis === axis) && (p.len === 1 || p.axis === axis)) {
          assert.fail('unfused neighbours');
        }
      }
    }
  }
}
for (const modeId of Object.keys(E.MODES)) {
  const rng = E.mulberry32(7);
  let games = 0, legends = 0, moves = 0;
  for (let g = 0; g < 60; g++) {
    let s = E.createGame(modeId, rng);
    for (let guard = 0; guard < 400 && !s.over; guard++) {
      const options = [];
      s.tray.forEach((t, i) => {
        if (!t) return;
        for (const axis of t.len === 1 ? ['h'] : ['h', 'v']) {
          const piece = Object.assign({}, t, { axis });
          for (let r = 0; r < s.n; r++) for (let c = 0; c < s.n; c++) if (E.canPlace(s, piece, r, c)) options.push([i, axis, r, c]);
        }
      });
      const [i, axis, r, c] = options[Math.floor(rng() * options.length)];
      while (s.tray[i].axis !== axis) s = E.rotate(s, i);
      const res = E.place(s, i, r, c, rng);
      assert(res.ok);
      s = res.state;
      violations(s);
      moves++;
    }
    games++; legends += s.legends;
  }
  console.log(`${modeId}: ok (${games} games, ${moves} moves, ${legends} legends)`);
}
console.log('all tests passed');
