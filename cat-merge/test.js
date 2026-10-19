// Run with: node cat-merge/test.js
const assert = require('assert');
const E = require('./engine.js');

function board(modeId, pieces) {
  const state = { modeId, n: E.MODES[modeId].n, pieces: [], nextId: 1, score: 0, legends: 0, over: false };
  for (const p of pieces) state.pieces.push(Object.assign({ id: state.nextId++, kind: 'cat', level: 1, len: 1, axis: 'h' }, p));
  return state;
}
const summary = (s) => s.pieces.map((p) => `${p.kind}${p.level}:${p.len}${p.axis}@${p.r},${p.c}`).sort();

// classic: 2048 behaviour
{
  const s = board('classic', [{ r: 0, c: 0 }, { r: 0, c: 1 }]);
  const res = E.slide(s, 'left');
  assert(res.moved);
  assert.deepStrictEqual(summary(s), ['cat2:1h@0,0']);
}
{
  const s = board('classic', [0, 1, 2, 3].map((c) => ({ r: 0, c })));
  E.slide(s, 'left');
  assert.deepStrictEqual(summary(s), ['cat2:1h@0,0', 'cat2:1h@0,1']); // no chain merge
}
{
  const s = board('classic', [{ r: 0, c: 0 }, { r: 0, c: 3, level: 2 }]);
  E.slide(s, 'left');
  assert.deepStrictEqual(summary(s), ['cat1:1h@0,0', 'cat2:1h@0,1']);
}

// stretch: two level-2 cats become a level-3 cat that is 2 cells long, no cell freed
{
  const s = board('stretch', [{ r: 2, c: 0, level: 2 }, { r: 2, c: 1, level: 2 }]);
  E.slide(s, 'right');
  assert.deepStrictEqual(summary(s), ['cat3:2h@2,3']);
}
{
  const s = board('stretch', [{ r: 0, c: 1, level: 2 }, { r: 1, c: 1, level: 2 }]);
  E.slide(s, 'down');
  assert.deepStrictEqual(summary(s), ['cat3:2v@3,1']); // direction decides orientation
}
// stretch: level 5 + level 5 side by side fill a row -> legend, row cleared
{
  const s = board('stretch', [
    { r: 0, c: 0, level: 5, len: 4 }, { r: 1, c: 0, level: 5, len: 4 },
  ]);
  const res = E.slide(s, 'down');
  assert(res.moved);
  assert.strictEqual(s.pieces.length, 0);
  assert.strictEqual(s.legends, 1);
  assert(res.events.some((e) => e.type === 'legend'));
}
// stretch: merge is refused when the longer cat has nowhere to go
{
  const s = board('stretch', [
    { r: 3, c: 0, level: 5, len: 4 }, { r: 4, c: 0, level: 5, len: 4 },
    { r: 3, c: 4, level: 1 }, { r: 4, c: 4, level: 2 },
    { r: 0, c: 0, level: 1 }, { r: 0, c: 1, level: 2 }, { r: 0, c: 2, level: 3 }, { r: 0, c: 3, level: 4 },
  ]);
  const res = E.slide(s, 'down');
  assert.strictEqual(s.legends, 0);
  assert(!res.events.some((e) => e.type === 'merge'));
}
// stretch: ...but it may stretch the other way if a free column exists
{
  const s = board('stretch', [
    { r: 0, c: 0, level: 5, len: 4 }, { r: 1, c: 0, level: 5, len: 4 },
    { r: 0, c: 4, level: 1 }, { r: 1, c: 4, level: 1 },
  ]);
  E.slide(s, 'down');
  assert.strictEqual(s.legends, 1);
}
// stretch: a long cat slides sideways as a block
{
  const s = board('stretch', [{ r: 0, c: 0, level: 4, len: 3 }]);
  E.slide(s, 'down');
  assert.deepStrictEqual(summary(s), ['cat4:3h@4,0']);
}

// fish: eating makes the cat longer
{
  const s = board('fish', [{ r: 0, c: 0 }, { r: 0, c: 2, kind: 'fish', level: 0 }]);
  E.slide(s, 'right');
  assert.deepStrictEqual(summary(s), ['cat1:2h@0,3']);
}
{
  const s = board('fish', [{ r: 0, c: 0, len: 4 }, { r: 1, c: 0, kind: 'fish', level: 0 }]);
  s.pieces[0].len = 4;
  // cat is 4 long on row 0, fish under its first cell; eating grows it to 5 = full row = legend
  E.slide(s, 'down');
  assert.strictEqual(s.legends, 1);
}

// game over on a locked board
{
  const pieces = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) pieces.push({ r, c, level: r * 4 + c + 1 });
  assert(E.isOver(board('classic', pieces)));
}

// fuzz: invariants hold after thousands of random moves in every mode
for (const modeId of Object.keys(E.MODES)) {
  const rng = E.mulberry32(42);
  let s = E.createGame(modeId, rng);
  let games = 0;
  let legends = 0;
  for (let i = 0; i < 4000; i++) {
    const dirs = Object.keys(E.DIRS);
    const res = E.move(s, dirs[Math.floor(rng() * 4)], rng);
    s = res.state;
    const seen = new Set();
    for (const p of s.pieces) {
      for (const [r, c] of E.cellsOf(p)) {
        assert(r >= 0 && c >= 0 && r < s.n && c < s.n, `${modeId}: out of bounds`);
        assert(!seen.has(r * s.n + c), `${modeId}: overlap at ${r},${c}`);
        seen.add(r * s.n + c);
      }
      assert(p.len < s.n, `${modeId}: full-width cat should have left`);
    }
    if (res.over) { legends += s.legends; games++; s = E.createGame(modeId, rng); }
  }
  console.log(`${modeId}: ok (${games} games finished, ${legends} legends)`);
}
console.log('all tests passed');
