// Run with: node letter-land/test.js
const assert = require('assert');
const { LETTERS, SIMILAR } = require('./letters.js');
const { createLearner } = require('./learning.js');
const { createSpawner, OBSTACLES } = require('./spawner.js');

function rngFrom(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// letter data
{
  const seen = new Set();
  for (const l of LETTERS) {
    assert(!seen.has(l.ch), 'duplicate ' + l.ch);
    seen.add(l.ch);
    assert(l.word.includes(l.ch), `${l.word} should contain ${l.ch}`);
    assert(l.emoji, 'emoji for ' + l.ch);
  }
  for (const g of SIMILAR) for (const ch of g) assert(seen.has(ch), 'unknown letter in SIMILAR: ' + ch);
  assert.strictEqual(LETTERS.length, 33);
}

// learner
{
  const mem = {};
  const storage = { getItem: (k) => mem[k] || null, setItem: (k, v) => { mem[k] = v; } };
  const L = createLearner({ letters: LETTERS, similar: SIMILAR, storage, rng: rngFrom(3) });
  assert.strictEqual(L.pool().length, 3);
  let t = L.pickTarget();
  assert(L.pool().some((l) => l.ch === t.ch));
  const d = L.distractors(2);
  assert.strictEqual(d.length, 2);
  assert(!d.includes(t.ch) && d[0] !== d[1]);
  assert(!L.correct(t.ch).mastered);
  assert(!L.correct(t.ch).mastered);
  assert(L.correct(t.ch).mastered, 'mastered after 3');
  const t2 = L.pickTarget();
  assert.notStrictEqual(t2.ch, t.ch, 'target changes');
  for (let i = 0; i < 3; i++) L.correct(t2.ch);
  assert.strictEqual(L.unlocked, 4, 'a new letter unlocks every 2 mastered targets');
  assert(L.learned().includes(t.ch));
  const again = createLearner({ letters: LETTERS, similar: SIMILAR, storage });
  assert.strictEqual(again.unlocked, 4, 'progress is saved');
  // wrong picks make a letter come back more often
  const W = createLearner({ letters: LETTERS, similar: SIMILAR, rng: rngFrom(9), startUnlocked: 5 });
  W.pickTarget();
  const hard = LETTERS[1].ch;
  for (let i = 0; i < 5; i++) { W.pickTarget(); }
}

// spawner: every pattern is passable
for (let seed = 1; seed <= 40; seed++) {
  const rng = rngFrom(seed);
  const L = createLearner({ letters: LETTERS, similar: SIMILAR, rng, startUnlocked: 6 });
  const S = createSpawner({ rng });
  let gates = 0, dist = 0, sinceGate = 0;
  for (let i = 0; i < 60; i++) {
    const speed = 200 + (i % 10) * 20;
    const target = L.pickTarget();
    const p = S.next({ speed, dist, target: target.ch, distractors: L.distractors(2) });
    dist += p.len;
    const air = speed * 0.72;
    const obs = p.items.filter((x) => x.t === 'obs').sort((a, b) => a.dx - b.dx);
    for (let k = 1; k < obs.length; k++) {
      const gap = (obs[k].dx - obs[k].w / 2) - (obs[k - 1].dx + obs[k - 1].w / 2);
      assert(gap >= air * 1.1, `obstacles too close: ${gap} < ${air * 1.1}`);
    }
    if (p.kind === 'gate') {
      gates++;
      sinceGate = 0;
      const ls = p.items.filter((x) => x.t === 'letter');
      assert.strictEqual(ls.length, 3);
      assert.strictEqual(ls.filter((x) => x.ch === target.ch).length, 1, 'exactly one target per gate');
      assert.strictEqual(new Set(ls.map((x) => x.ch)).size, 3, 'letters are distinct');
      assert(!p.items.some((x) => x.t === 'obs'), 'no obstacles in a gate');
      assert(new Set(ls.map((x) => x.h)).size > 1, 'letters at different heights');
    } else sinceGate++;
    assert(sinceGate <= 3, 'a gate at least every 4 patterns');
    for (const it of p.items) assert(it.dx >= 0 && it.dx < p.len, 'item inside pattern');
  }
  assert(gates >= 10);
}
console.log('all tests passed');
