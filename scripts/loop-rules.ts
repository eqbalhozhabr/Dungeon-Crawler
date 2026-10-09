// Rule checks for the Alley Echo engine: npx tsx scripts/loop-rules.ts
import { Game } from '../src/loop/logic/game';
import { ANY, countSeats, exactly, FREE, meets, REACH, type Demand } from '../src/loop/logic/formation';
import { freshState, itemsFor } from '../src/loop/logic/runes';
import { DROWS, RING, type RuneId, type Tile } from '../src/loop/logic/types';

let fails = 0;
const ok = (c: boolean, m: string) => {
  if (!c) {
    fails++;
    console.log('FAIL', m);
  } else console.log('ok  ', m);
};

let uid = 1000;
const tile = (rune: RuneId): Tile => {
  const t: Tile = { id: uid++, rune, variant: 1, items: itemsFor(rune, 1, 0), state: [] };
  t.state = freshState(t, 0);
  return t;
};
/** A game on an empty street (or the given runes), no start delay. */
function alley(rows?: RuneId[][], seed = 1): Game {
  const g = new Game(seed);
  g.delay = 0;
  const r = rows ?? [['bare', 'bare', 'bare'], ['bare', 'bare', 'bare'], ['bare', 'bare', 'bare']];
  r.forEach((row, d) => row.forEach((x, l) => (g.grid[d][l] = tile(x))));
  return g;
}
/** Run until the lap counter reaches `lap` (a few frames past the seal). */
const toLap = (g: Game, lap: number) => {
  let guard = 0;
  while (g.lap < lap && !g.over && guard++ < 60 * 60 * 10) g.step(1 / 60);
};
const run = (g: Game, rows: number, dt = 1 / 60) => {
  const to = g.p + rows;
  while (g.p < to && !g.over) g.step(dt);
};
const demandOf = (...n: ({ lo: number; hi: number } | number)[]): Demand => n.map((x) => (typeof x === 'number' ? exactly(x) : x));

{
  // a coin tile: you take each coin once, they are back next lap
  const g = alley([['bare', 'coin', 'bare'], ['bare', 'bare', 'bare'], ['bare', 'bare', 'bare']]);
  g.setLane(1);
  g.step(1 / 60);
  run(g, DROWS - 0.1);
  ok(g.coins === 4, `4 coins on a coin tile (got ${g.coins})`);
  toLap(g, 1);
  run(g, DROWS - 0.1);
  ok(g.coins === 8, `coins respawn next lap (coins ${g.coins})`);
}
{
  // thieves die to one hit and pay 2; a ghost's kill is yours when you share the lane
  const g = alley([['bare', 'bandit', 'bare'], ['bare', 'bare', 'bare'], ['bare', 'bare', 'bare']]);
  g.step(1 / 60);
  run(g, DROWS - 0.1);
  ok(g.kills === 2 && g.coins === 4 && g.hp === 3, `2 thieves killed for 4 coins, no damage (kills ${g.kills}, coins ${g.coins}, hp ${g.hp})`);
}
{
  // spikes cost a heart, ghosts walk through
  const g = alley([['bare', 'spikes', 'bare'], ['bare', 'bare', 'bare'], ['bare', 'bare', 'bare']]);
  g.step(1 / 60);
  run(g, DROWS - 0.1);
  ok(g.hp < 3, `spikes cost hp (hp ${g.hp})`);
}
{
  // the street keeps a clear stretch around the seal and every district keeps a safe lane
  let bad = 0;
  let spill = 0;
  for (let s = 1; s <= 200; s++) {
    const g = new Game(s);
    for (let d = 0; d < 3; d++) {
      if (g.grid[d].filter((t) => t.rune === 'spikes').length > 1) bad++;
      for (const t of g.grid[d]) for (const it of t.items) if (it.off < 2.5 || it.off + it.len > 8.4) spill++;
    }
  }
  ok(bad === 0, 'no starting district has two spike lanes');
  ok(spill === 0, 'nothing lies in the open stretch around the seal (rows 0-2.5 and 8.4-12 of a district)');
}
{
  // the seal: the seat is the lane you stand in at the crossing, and ghosts keep it
  const g = alley(undefined, 3);
  g.setLane(2);
  g.step(1 / 60);
  ok(g.formations.seats[0] === 2, 'your lane when the run starts is your first seat');
  g.setLane(0);
  toLap(g, 1);
  ok(g.formations.seats.length === 2 && g.echoes.length === 1, 'a ghost appears after the first lap');
  ok(g.echoes[0].seat === 2 && g.echoes[0].path[0] === 2, 'the ghost stands at the seal where you stood (even if you left at once)');
  ok(g.echoLane(0, 20) === 0, 'and then repeats your lane further on');
}
{
  // opening and shutting the seal; warm-up laps do not count; streak and multiplier
  const g = alley(undefined, 5);
  const D = g.formations.demands;
  const seats = [0, 1, 2, 0, 1];
  for (let j = 0; j < 5; j++) {
    g.setLane(seats[j]);
    // all lanes exact to the real crowd: open when we repeat the seats
    const win = seats.slice(Math.max(0, j - REACH + 1), j + 1);
    D[j] = countSeats(win).map((k) => exactly(k));
    g.setLane(seats[j]);
    while (g.lap < j && !g.over) g.step(1 / 60);
    if (j === 0) g.step(1 / 60);
    // we are just past the seal of lap j
  }
  ok(g.history.length >= 4 && g.history.slice(0, 4).every(Boolean), `repeating the planned seats opens every seal (history ${g.history.join(',')})`);
  ok(g.streak === g.history.length - 2, `the streak counts only scoring laps (streak ${g.streak}, seals ${g.history.length})`);
  ok(g.mult === Math.min(4, 1 + 0.5 * g.streak), `multiplier follows the streak (x${g.mult})`);
}
{
  // a shut seal in a scoring lap breaks the streak and halves the coins of that lap
  const g = alley([['coin', 'coin', 'coin'], ['bare', 'bare', 'bare'], ['bare', 'bare', 'bare']], 7);
  toLap(g, 2);
  g.formations.demands[3] = demandOf(5, 0, 0); // impossible with 4 runners in 3 lanes? 5 > crowd: never met
  g.streak = 3;
  g.setLane(1);
  toLap(g, 3);
  ok(g.streak === 0 && g.mult === 0.5, `a shut seal resets the streak and halves the lap (streak ${g.streak}, x${g.mult})`);
  const before = g.points;
  g.setLane(1);
  run(g, DROWS - 0.1);
  ok(Math.abs(g.points - before - 4 * 0.5) < 0.01, `coins of a shut lap are worth half (${g.points - before})`);
}
{
  // formations: a player who always takes a seat that fits every announced demand is never cornered
  let fail = 0;
  let total = 0;
  let greedyFail = 0;
  for (let seed = 1; seed <= 150; seed++) {
    for (const mode of ['planner', 'greedy'] as const) {
      const g = alley(undefined, seed);
      g.hp = 99; // the alley gets spikes after a while: this test is about seals only
      const f = g.formations;
      for (let j = 0; j < 24; j++) {
        if (g.over) break;
        const j2 = f.seats.length; // seat to choose now
        const known = f.seats.slice(Math.max(0, j2 - REACH + 1), j2);
        const fitsNow = [0, 1, 2].filter((s) => meets(f.demands[j2], countSeats([...known, s])));
        const fits = [0, 1, 2].filter((s) => f.fits(s, j2));
        const pool = mode === 'planner' ? (fits.length ? fits : fitsNow) : fitsNow.length ? fitsNow : [0, 1, 2];
        g.setLane(pool[(seed + j) % pool.length]);
        if (j2 === 0) g.step(1 / 60);
        else toLap(g, j2); // reach the seal of lap j2 (it is crossed while the lap becomes j2)
        if (j2 >= 2) {
          total += mode === 'planner' ? 1 : 0;
          const okNow = g.history[j2];
          if (!okNow) mode === 'planner' ? fail++ : greedyFail++;
        }
      }
    }
  }
  ok(fail === 0, `taking only seats that fit all announced demands never fails a seal (${fail} of ${total})`);
  ok(greedyFail > total * 0.05, `looking only at this lap's demand fails sometimes (${greedyFail} of ${total})`);
}
{
  // demands are announced four laps ahead and every new one is solvable for a player who kept to the plan
  const g = alley(undefined, 11);
  ok(g.formations.demands.length === REACH, `${REACH} demands are known at the start`);
  g.step(1 / 60);
  ok(g.formations.demands.length === REACH + 1, 'taking a seat announces one more');
  ok(meets([exactly(1), FREE, { lo: 1, hi: ANY }], [1, 0, 3]) && !meets([exactly(1), FREE, { lo: 1, hi: ANY }], [1, 2, 0]), 'exact, free and "at least" needs behave');
}
{
  // the alley gets worse every third lap
  const g = alley([['coin', 'coin', 'coin'], ['bare', 'bare', 'bare'], ['bare', 'bare', 'bare']], 9);
  const evs: string[] = [];
  let guard = 0;
  while (g.lap < 3 && !g.over && guard++ < 60 * 200) {
    g.hp = 3;
    g.step(1 / 60);
    for (const e of g.events) evs.push(e.t);
    g.events.length = 0;
  }
  ok(evs.includes('upgrade'), 'an upgrade happens at lap 3');
}
{
  // determinism: same seed, same inputs, same result
  const play = (seed: number) => {
    const g = new Game(seed);
    for (let i = 0; i < 60 * 40; i++) {
      if (i % 90 === 0) g.setLane((i / 90) % 3);
      g.step(1 / 60);
      g.events.length = 0;
    }
    return [g.coins, g.hp, g.lap, g.p.toFixed(3), g.formations.demands.length].join('/');
  };
  ok(play(5) === play(5), 'same seed gives the same run');
  ok(RING === 3 * DROWS, 'ring size');
}
console.log(fails ? `\n${fails} FAILED` : '\nall rules ok');
process.exit(fails ? 1 : 0);
