/*
 * What appears on the road. Patterns are built so that a child can always get through:
 * obstacles are far enough apart for a jump, and letter gates have no obstacles in them.
 * Item positions: dx = distance from the start of the pattern, h = height above the ground.
 */
(function (root) {
  'use strict';

  // sizes of every obstacle kind (all can be cleared by a normal jump)
  const OBSTACLES = {
    rock: { w: 54, h: 40 }, log: { w: 66, h: 38 }, bush: { w: 64, h: 54 }, basket: { w: 56, h: 50 },
    hay: { w: 56, h: 50 }, crate: { w: 52, h: 48 }, bucket: { w: 44, h: 46 },
    crab: { w: 52, h: 34 }, sandcastle: { w: 56, h: 50 }, driftwood: { w: 70, h: 30 },
    icecube: { w: 50, h: 46 }, snowpile: { w: 62, h: 42 }, pine: { w: 48, h: 58 },
    cone: { w: 40, h: 52 }, barrel: { w: 46, h: 52 }, bench: { w: 70, h: 44 },
    mushroom: { w: 52, h: 52 }, crystal: { w: 46, h: 56 }, gift: { w: 50, h: 48 },
  };
  const OBSTACLE_KINDS = ['rock', 'log', 'bush', 'basket'];
  const LOW = 55;   // reached by just running
  const HIGH = 175; // needs a jump
  const LETTER_SPACING = 120;

  function createSpawner(opts) {
    const rng = (opts && opts.rng) || Math.random;
    let sinceGate = 0;
    let count = 0;

    const pick = (arr) => arr[Math.floor(rng() * arr.length)];

    function shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    }

    /*
     * ctx: { speed, dist, letters (the letters of a gate), kinds (obstacle kinds of this scenery),
     *        gateEvery (patterns between two gates), noGate (true while another gate is still around) }
     */
    function next(ctx) {
      const air = ctx.speed * 0.72; // how far a jump carries
      const kinds = ctx.kinds && ctx.kinds.length ? ctx.kinds : OBSTACLE_KINDS;
      const every = ctx.gateEvery || 3;
      const obstacle = (dx) => { const kind = pick(kinds); return Object.assign({ t: 'obs', dx, kind }, OBSTACLES[kind]); };

      let kind;
      const wantGate = ctx.letters && ctx.letters.length && !ctx.noGate && count > 0 && sinceGate >= Math.min(every, count === 1 ? 1 : every);
      if (count === 0) kind = 'coins';
      else if (wantGate) kind = 'gate';
      else {
        const bag = ['coins', 'arc', 'arc', 'single', 'single'];
        if (ctx.dist > 1200) bag.push('double');
        kind = pick(bag);
      }
      count++;
      sinceGate = kind === 'gate' ? 0 : sinceGate + 1;
      const items = [];
      let len;

      if (kind === 'coins') {
        const n = 5 + Math.floor(rng() * 4);
        for (let i = 0; i < n; i++) items.push({ t: 'coin', dx: 40 + i * 46, h: 45 });
        len = 40 + n * 46 + 160;
      } else if (kind === 'single') {
        const o = obstacle(120);
        items.push(o);
        for (let i = 0; i < 3; i++) items.push({ t: 'coin', dx: 120 + o.w + 60 + i * 46, h: 45 });
        len = 120 + o.w + 60 + 3 * 46 + air * 0.6 + 120;
      } else if (kind === 'arc') {
        const o = obstacle(110);
        const cx = 110;
        const step = Math.max(40, air * 0.2);
        for (let i = -2; i <= 2; i++) {
          items.push({ t: 'coin', dx: cx + i * step, h: o.h + 22 + 62 * (1 - (i / 2) * (i / 2)) });
        }
        items.push(o);
        len = 110 + o.w / 2 + 2 * step + air * 0.5 + 140;
      } else if (kind === 'double') {
        const a = obstacle(110);
        const gap = Math.max(260, air * 1.15 + 40);
        const b = obstacle(0);
        b.dx = a.dx + a.w / 2 + gap + b.w / 2;
        items.push(a, b);
        for (let i = 0; i < 3; i++) items.push({ t: 'coin', dx: a.dx + a.w / 2 + gap / 2 - 46 + i * 46, h: 45 });
        len = b.dx + b.w / 2 + air * 0.6 + 140;
      } else { // gate: the needed letter among look-alikes, no obstacles
        const letters = shuffle(ctx.letters);
        const heights = letters.map(() => (rng() < 0.5 ? LOW : HIGH));
        if (heights.every((h) => h === heights[0])) heights[Math.floor(rng() * heights.length)] = heights[0] === LOW ? HIGH : LOW;
        letters.forEach((ch, i) => items.push({ t: 'letter', dx: 80 + i * LETTER_SPACING, h: heights[i], ch }));
        len = 80 + (letters.length - 1) * LETTER_SPACING + 220;
      }
      return { kind, items, len };
    }

    return { next, get sinceGate() { return sinceGate; } };
  }

  const api = { createSpawner, OBSTACLES, LOW, HIGH, LETTER_SPACING };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LetterSpawn = api;
})(typeof window !== 'undefined' ? window : globalThis);
