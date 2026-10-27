/*
 * The word game: which letter is needed next, which wrong letters go with it, when a word or a level is done.
 * Pure logic (no DOM) so it can be tested with Node.
 *
 * Levels 1-5 come from data/words.json. Level 6 is a special round about letters that do not
 * join the next letter (ا آ د ذ ر ز ژ و): it reuses the words that have at least two of them.
 */
(function (root) {
  'use strict';

  const ZWNJ = '‌';
  const NON_JOINERS = ['ا', 'آ', 'د', 'ذ', 'ر', 'ز', 'ژ', 'و'];
  const SPECIAL_LEVEL = 6;
  const SPECIAL = {
    level: SPECIAL_LEVEL, name: 'ویژه: غیرچسبان', letter_range: 'حرف‌هایی که به بعدی نمی‌چسبن', speed: 1.0,
    helps: { image: true, audio: true, ghost: true, hint: false },
  };
  // things the word file does not say: the scenery, how many wrong letters, how often a letter gate appears
  const EXTRA = {
    1: { theme: 'garden', distractors: 2, gateEvery: 1, words: 3 },
    2: { theme: 'farm', distractors: 2, gateEvery: 1, words: 3 },
    3: { theme: 'beach', distractors: 3, gateEvery: 1, words: 3 },
    4: { theme: 'snow', distractors: 3, gateEvery: 1, words: 3 },
    5: { theme: 'city', distractors: 3, gateEvery: 1, words: 3 },
    6: { theme: 'magic', distractors: 2, gateEvery: 1, words: 3 },
  };

  const isNonJoiner = (ch) => NON_JOINERS.includes(ch);
  const lettersOf = (display) => Array.from(display).filter((c) => c !== ZWNJ);

  // non-joining letters inside the word (the last letter does not count: nothing follows it)
  function joinNotes(word) {
    const ls = word.letters || lettersOf(word.display);
    const out = [];
    ls.slice(0, -1).forEach((c) => { if (isNonJoiner(c) && !out.includes(c)) out.push(c); });
    return out;
  }

  function createSession(opts) {
    const data = opts.data;
    const rng = opts.rng || Math.random;
    let level = opts.level || 1;
    let word = null, slot = 0, doneInRound = 0;
    const used = new Set();
    const completed = [];

    const info = (n) => (n === SPECIAL_LEVEL ? SPECIAL : data.levels.find((l) => l.level === n));
    const wordsOf = (n) => (n === SPECIAL_LEVEL
      ? data.words.filter((w) => joinNotes(w).length >= 2)
      : data.words.filter((w) => w.level === n));

    function shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    }

    function nextWord() {
      const pool = wordsOf(level);
      let cands = pool.filter((w) => !used.has(w.id));
      if (!cands.length) { used.clear(); cands = pool.filter((w) => !word || w.id !== word.id); }
      if (!cands.length) cands = pool;
      word = cands[Math.floor(rng() * cands.length)];
      used.add(word.id);
      slot = 0;
      return word;
    }

    function startLevel(n) {
      level = n;
      doneInRound = 0;
      used.clear();
      word = null;
      return nextWord();
    }

    const needed = () => word.letters[slot];

    // the letters of the next gate: the needed one and some look-alikes
    function gateLetters() {
      const k = EXTRA[level].distractors;
      const pool = shuffle(word.distractors.filter((c) => c !== needed()));
      return [needed()].concat(pool.slice(0, k));
    }

    function pick(ch) {
      if (ch !== needed()) return { correct: false };
      slot++;
      if (slot < word.letters.length) return { correct: true, wordDone: false };
      doneInRound++;
      completed.push(word);
      return { correct: true, wordDone: true, roundDone: doneInRound >= EXTRA[level].words };
    }

    // after a finished word: next word, or the next level once the round is complete
    function advance() {
      if (doneInRound >= EXTRA[level].words) {
        if (level < 5) { startLevel(level + 1); return 'level'; }
        doneInRound = 0; // the last levels repeat
        used.clear();
        nextWord();
        return 'again';
      }
      nextWord();
      return 'word';
    }

    startLevel(level);
    return {
      startLevel, nextWord, advance, pick, gateLetters, needed,
      info: () => info(level),
      extra: () => EXTRA[level],
      get level() { return level; },
      get word() { return word; },
      get slot() { return slot; },
      get doneInRound() { return doneInRound; },
      get completed() { return completed; },
    };
  }

  const api = { createSession, joinNotes, isNonJoiner, lettersOf, NON_JOINERS, EXTRA, SPECIAL, SPECIAL_LEVEL, ZWNJ };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LetterWordPlay = api;
})(typeof window !== 'undefined' ? window : globalThis);
