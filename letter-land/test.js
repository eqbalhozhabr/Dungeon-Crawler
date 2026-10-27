// Run with: node letter-land/test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { LETTERS } = require('./letters.js');
const WP = require('./wordplay.js');
const { createSpawner, OBSTACLES } = require('./spawner.js');

function rngFrom(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// word data
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'words.json'), 'utf8'));
const data = { levels: raw.levels, words: raw.words };
{
  const known = new Set(LETTERS.map((l) => l.ch));
  const ids = new Set();
  for (const w of data.words) {
    assert(!ids.has(w.id), 'duplicate id ' + w.id); ids.add(w.id);
    assert.strictEqual(w.letters.join(''), w.display.replace(/‌/g, ''), `${w.id}: letters do not spell ${w.display}`);
    for (const c of w.letters.concat(w.distractors)) assert(known.has(c), `${w.id}: unknown letter ${c}`);
    assert(w.distractors.length >= 2, w.id + ' needs distractors');
    assert(!w.distractors.some((c) => w.letters.includes(c)), `${w.id}: a wrong letter is part of the word`);
    assert(data.levels.some((l) => l.level === w.level), w.id + ' has no level');
  }
  assert.strictEqual(data.levels.length, 5);
  // helps get switched off one by one as the levels go up
  const h = (n) => data.levels.find((l) => l.level === n).helps;
  assert(h(1).ghost && !h(2).ghost && h(2).audio && !h(3).audio && h(3).image && !h(4).image);
  // the emoji file covers every word
  const emoji = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'emoji.json'), 'utf8'));
  for (const w of data.words) assert(emoji[w.id], 'emoji for ' + w.id);
}

// non-joining letters
{
  assert.deepStrictEqual(WP.joinNotes({ display: 'دریا' }), ['د', 'ر']);
  assert.deepStrictEqual(WP.joinNotes({ display: 'پروانه' }), ['ر', 'و', 'ا']);
  assert.deepStrictEqual(WP.joinNotes({ display: 'کتاب' }), ['ا']);
  assert.deepStrictEqual(WP.joinNotes({ display: 'باد' }), ['ا']);   // the last د does not count
}

// a session plays through words and levels
{
  const S = WP.createSession({ data, level: 1, rng: rngFrom(5) });
  assert.strictEqual(S.level, 1);
  const seenWords = [];
  let levelUps = 0;
  for (let n = 0; n < 40 && S.level < 5; n++) {
    const w = S.word;
    assert.strictEqual(w.level, S.level);
    seenWords.push(w.id);
    for (let i = 0; i < w.letters.length; i++) {
      const gate = S.gateLetters();
      assert(gate.includes(S.needed()), 'the needed letter is always in the gate');
      assert.strictEqual(new Set(gate).size, gate.length, 'gate letters are distinct');
      assert.strictEqual(gate.length, 1 + WP.EXTRA[S.level].distractors);
      const wrong = gate.find((c) => c !== S.needed());
      assert(!S.pick(wrong).correct, 'a wrong letter does not move on');
      assert.strictEqual(S.slot, i);
      const res = S.pick(S.needed());
      assert(res.correct);
      assert.strictEqual(!!res.wordDone, i === w.letters.length - 1);
    }
    if (S.advance() === 'level') levelUps++;
  }
  assert.strictEqual(S.level, 5, 'rounds lead to the next level');
  assert.strictEqual(levelUps, 4);
  // words do not repeat inside a round
  const round = seenWords.slice(0, 3);
  assert.strictEqual(new Set(round).size, 3);
}

// the special round only uses words with several non-joining letters
{
  const S = WP.createSession({ data, level: 6, rng: rngFrom(2) });
  assert.strictEqual(S.info().name, WP.SPECIAL.name);
  for (let i = 0; i < 20; i++) {
    assert(WP.joinNotes(S.word).length >= 2, S.word.display);
    S.word.letters.forEach(() => S.pick(S.needed()));
    S.advance();
    assert.strictEqual(S.level, 6, 'the special round stays in itself');
  }
}

// spawner: every pattern is passable
const KINDS = Object.keys(OBSTACLES);
for (let seed = 1; seed <= 40; seed++) {
  const rng = rngFrom(seed);
  const S = WP.createSession({ data, level: 1 + (seed % 5), rng });
  const sp = createSpawner({ rng });
  let gates = 0, dist = 0, sinceGate = 0;
  for (let i = 0; i < 60; i++) {
    const speed = 200 + (i % 10) * 20;
    const every = S.extra().gateEvery;
    const p = sp.next({ speed, dist, letters: S.gateLetters(), kinds: KINDS.slice(seed % 5, (seed % 5) + 4), gateEvery: every });
    dist += p.len;
    const air = speed * 0.72;
    const obs = p.items.filter((x) => x.t === 'obs').sort((a, b) => a.dx - b.dx);
    for (let k = 1; k < obs.length; k++) {
      const gap = (obs[k].dx - obs[k].w / 2) - (obs[k - 1].dx + obs[k - 1].w / 2);
      assert(gap >= air * 1.1, `obstacles too close: ${gap} < ${air * 1.1}`);
    }
    if (p.kind === 'gate') {
      gates++; sinceGate = 0;
      const ls = p.items.filter((x) => x.t === 'letter');
      assert.strictEqual(ls.length, 1 + S.extra().distractors);
      assert.strictEqual(ls.filter((x) => x.ch === S.needed()).length, 1, 'exactly one needed letter per gate');
      assert(!p.items.some((x) => x.t === 'obs'), 'no obstacles in a gate');
      assert(new Set(ls.map((x) => x.h)).size > 1, 'letters at different heights');
      assert(ls.every((x) => x.h >= 140), 'letters are in the air, not on the running path');
      const xs = ls.map((x) => x.dx).sort((a, b) => a - b);
      for (let k = 1; k < xs.length; k++) assert(xs[k] - xs[k - 1] >= 230, 'letters are far apart');
    } else sinceGate++;
    assert(sinceGate <= Math.max(every, 1) + 1, 'a gate often enough');
    for (const it of p.items) assert(it.dx >= 0 && it.dx < p.len, 'item inside pattern');
  }
  assert(gates >= 10, 'gates are frequent');
}
// no second gate while one is still on the road
{
  const rng = rngFrom(1);
  const sp = createSpawner({ rng });
  const kinds = [];
  for (let i = 0; i < 30; i++) kinds.push(sp.next({ speed: 220, dist: 2000, letters: ['ب', 'پ', 'ت'], gateEvery: 1, noGate: true }).kind);
  assert(!kinds.includes('gate'));
}
console.log('all tests passed');
