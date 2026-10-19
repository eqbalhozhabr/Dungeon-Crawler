/*
 * What should the child practise next?
 * The pool of letters starts small and grows as targets are mastered.
 * Letters the child gets wrong more often come up more often.
 */
(function (root) {
  'use strict';

  const KEY = 'letterland.learn';

  function createLearner(opts) {
    const letters = opts.letters;
    const similar = opts.similar || [];
    const rng = opts.rng || Math.random;
    const storage = opts.storage || null;
    const need = opts.need || 3; // correct pickups to master a target
    const data = { unlocked: opts.startUnlocked || 3, done: 0, stats: {} };
    try {
      const raw = storage && storage.getItem(KEY);
      if (raw) Object.assign(data, JSON.parse(raw));
    } catch (e) { /* ignore */ }

    let target = null;
    let progress = 0;

    const save = () => { try { if (storage) storage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ } };
    const stat = (ch) => data.stats[ch] || (data.stats[ch] = { ok: 0, bad: 0 });
    const pool = () => letters.slice(0, Math.min(data.unlocked, letters.length));

    function weightedPick(items, weightOf) {
      const ws = items.map(weightOf);
      let x = rng() * ws.reduce((a, b) => a + b, 0);
      for (let i = 0; i < items.length; i++) { x -= ws[i]; if (x <= 0) return i; }
      return items.length - 1;
    }

    function pickTarget() {
      let cands = pool().filter((l) => !target || l.ch !== target.ch);
      if (!cands.length) cands = pool();
      const i = weightedPick(cands, (l) => { const s = stat(l.ch); return 1 / (1 + s.ok) + 0.4 * Math.min(s.bad, 5); });
      target = cands[i];
      progress = 0;
      return target;
    }

    // wrong answers for a gate: prefer letters that look like the target
    function distractors(n) {
      const group = similar.find((g) => g.includes(target.ch)) || [];
      let cands = pool().filter((l) => l.ch !== target.ch);
      if (cands.length < n) { // early on the pool is tiny: borrow the next letters
        const extra = letters.filter((l) => l.ch !== target.ch && !cands.includes(l));
        cands = cands.concat(extra.slice(0, n - cands.length + 2));
      }
      const out = [];
      while (out.length < n && cands.length) {
        const i = weightedPick(cands, (l) => (group.includes(l.ch) ? 3 : 1));
        out.push(cands.splice(i, 1)[0].ch);
      }
      return out;
    }

    function correct(ch) {
      stat(ch).ok++;
      progress++;
      if (progress >= need) {
        data.done++;
        if (data.done % 2 === 0 && data.unlocked < letters.length) data.unlocked++;
        save();
        return { mastered: true, progress };
      }
      save();
      return { mastered: false, progress };
    }

    function wrong(pickedCh) {
      if (target) stat(target.ch).bad++;
      stat(pickedCh);
      save();
    }

    const learned = () => letters.filter((l) => stat(l.ch).ok >= need).map((l) => l.ch);
    function reset() { data.unlocked = opts.startUnlocked || 3; data.done = 0; data.stats = {}; save(); }

    return {
      pool, pickTarget, distractors, correct, wrong, learned, reset, save,
      get target() { return target; },
      get progress() { return progress; },
      get need() { return need; },
      get unlocked() { return data.unlocked; },
      stat,
    };
  }

  const api = { createLearner };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LetterLearn = api;
})(typeof window !== 'undefined' ? window : globalThis);
