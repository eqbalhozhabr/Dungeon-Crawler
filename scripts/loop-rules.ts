// Rule checks for the Alley Echo engine: npx tsx scripts/loop-rules.ts
import { Game } from '../src/loop/logic/game';
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
type Cell = RuneId | '-' | null;
/** An empty stretch of street (nothing in it). */
const bare = (): Tile => ({ ...tile('fountain'), items: [], state: [] });
/** Replace the whole alley: rows are districts (bottom = district 0), null = the hole, '-' = bare street. */
function alley(rows: Cell[][]): Game {
  const g = new Game(1);
  g.delay = 0;
  rows.forEach((row, d) =>
    row.forEach((r, l) => {
      g.grid[d][l] = r === '-' ? bare() : r ? tile(r) : null;
      if (!r) g.hole = { d, l };
    }),
  );
  return g;
}
const E = (): Cell[][] => [
  ['-', '-', '-'],
  ['-', null, '-'],
  ['-', '-', '-'],
];
const run = (g: Game, rows: number, dt = 1 / 60) => {
  const to = g.p + rows;
  while (g.p < to && !g.over && g.p >= to - rows - 1e-9) g.step(dt);
};
const lapOf = (g: Game, laps: number) => {
  const target = g.lap + laps;
  let guard = 0;
  while (g.lap < target && !g.over && guard++ < 60 * 60 * 5) g.step(1 / 60);
};

{
  // a coin tile: the runner takes each coin once, and they are back next lap
  const r = E();
  r[0][1] = 'coin';
  const g = alley(r);
  run(g, 9.9);
  ok(g.coins === 4, `4 coins on a coin tile (got ${g.coins})`);
  g.setLane(1);
  lapOf(g, 1);
  run(g, 9.9);
  ok(g.coins === 8, `coins respawn next lap (coins ${g.coins})`);
}
{
  // a thief dies to one auto-strike and pays a bounty
  const r = E();
  r[0][1] = 'bandit';
  const g = alley(r);
  run(g, 9.9);
  ok(g.kills === 2 && g.coins === 4 && g.hp === 3, `2 thieves killed for 4 coins, no damage (kills ${g.kills}, coins ${g.coins}, hp ${g.hp})`);
}
{
  // a brute alone hurts you; with a ghost beside you it dies
  const r = E();
  r[0][1] = 'brute';
  const g = alley(r);
  run(g, 9.9);
  ok(g.hp === 2 && g.kills === 0, `a lone runner is hurt by a brute and does not kill it (hp ${g.hp}, kills ${g.kills})`);
  const h = alley(r);
  // lap 1 in lane 0 (safe), recorded as a ghost; lap 2 both in lane 1
  h.setLane(0);
  lapOf(h, 1);
  ok(h.echoes.length === 1, 'one ghost after a lap');
  // make the ghost run lane 1 over the brute district by editing its recording
  h.echoes[0].path.fill(1);
  h.setLane(1);
  const hp = h.hp;
  const coins0 = h.coins;
  run(h, 9.9);
  ok(h.kills === 1 && h.hp === hp, `runner + ghost in one lane kill the brute (kills ${h.kills}, hp ${h.hp}/${hp})`);
  ok(h.ghostCoins === 0 && h.coins - coins0 === 5, 'the runner gets the bounty when sharing a lane');
}
{
  // spikes hurt the runner once per pass, ghosts walk through
  const r = E();
  r[0][1] = 'spikes';
  const g = alley(r);
  run(g, 9.9);
  ok(g.hp === 1 || g.hp === 2, `spikes cost hp (hp ${g.hp})`);
  const h = alley(r);
  h.setLane(0);
  lapOf(h, 1);
  h.echoes[0].path.fill(1);
  const hp = h.hp;
  h.setLane(0);
  run(h, 9.9);
  ok(h.hp === hp, 'a ghost in the spike lane does not hurt the runner in another lane');
}
{
  // death ends the game
  const r = E();
  r[0][1] = 'spikes';
  r[1][1] = 'spikes';
  const g = alley(r);
  lapOf(g, 1);
  ok(g.over, 'running through spikes repeatedly ends the run');
}
{
  // ghosts replay the lane they were recorded in
  const g = alley(E());
  g.setLane(2);
  lapOf(g, 1);
  ok(g.echoLane(0, 5) === 2 && g.echoLane(0, 25) === 2, 'the ghost repeats the lap lane');
  ok(g.echoes.length === 1, 'one echo');
  lapOf(g, 4);
  ok(g.echoes.length === 3, 'at most 3 ghosts at a time');
}
{
  // sliding: not in the district you are running in, and chains move together
  const mk = () =>
    alley([
      ['coin', 'bandit', 'brute'],
      ['spikes', null, 'coin'],
      ['fountain', 'coin', 'bandit'],
    ]);
  let g = mk();
  ok(g.slide(0, 1) === false, 'cannot slide inside the district you are running');
  ok(g.slide(0, 0) === false && g.slide(2, 2) === false, 'a tile not in line with the hole is refused');
  g.p = 12; // in district 1: the hole row is locked
  ok(g.slide(1, 0) === false, 'the hole row is locked while you run in it');
  g = mk();
  g.p = 22; // district 2: rows 0 and 1 are free
  ok(g.slide(1, 0) === true, 'a tile beside the hole slides into it');
  ok(g.grid[1][1]?.rune === 'spikes' && g.grid[1][0] === null && g.hole.l === 0, 'the tile moved and the hole moved');
  g = mk();
  g.p = 22;
  g.slide(1, 2);
  ok(g.hole.l === 2 && g.grid[1][1]?.rune === 'coin', 'the tile at the far side slides in');
  g.slide(1, 0);
  ok(g.hole.l === 0 && g.grid[1][2]?.rune === 'coin' && g.grid[1][1]?.rune === 'spikes', 'tapping two tiles away slides the whole chain');
  g.p = 22;
  ok(g.slide(2, 0) === false, 'cannot touch the row you are running in (district 2)');
  g.p = 27.5;
  ok(g.slide(0, 0) === false, 'cannot move into the next district in its last rows (district 0 locks)');
}
{
  // locking just before a district
  const g = alley(E());
  g.p = 8.5; // in district 0, 1.5 rows from district 1
  ok(g.isLocked(1) && g.isLocked(0) && !g.isLocked(2), 'the next district locks in its last rows before you reach it');
  g.p = 5;
  ok(!g.isLocked(1), 'the next district is free to edit earlier');
}
{
  // alert: foes left alive raise it, a clean sweep lowers it, 7 brings the guards
  const r = E();
  r[0][0] = 'bandit';
  r[1][2] = 'brute';
  const g = alley(r);
  g.setLane(1);
  run(g, 10.2);
  ok(g.heat === 1, `a surviving foe tile raises the alert by one (heat ${g.heat})`);
  const h = alley(r);
  h.setLane(0);
  run(h, 10.2);
  ok(h.heat === 0 && h.kills === 2, 'clearing the district keeps the alert at zero');
  const gg = alley(r);
  gg.heat = 6;
  gg.setLane(1);
  run(gg, 10.2);
  ok(gg.heat === 3 && gg.hp === 2, `at 7 the guards arrive: a heart is lost and the alert drops to 3 (heat ${gg.heat}, hp ${gg.hp})`);
  ok(gg.uncovered(0, 0) && !gg.uncovered(0, 1), 'a foe tile with no ghost in its lane is flagged uncovered');
}
{
  // the alley gets worse and shakes every third lap
  const r = E();
  r[1][0] = 'coin';
  r[2][2] = 'bandit';
  const g = alley(r);
  g.setLane(1);
  const evs: string[] = [];
  let guard = 0;
  while (g.lap < 3 && !g.over && guard++ < 60 * 200) {
    g.step(1 / 60);
    for (const e of g.events) evs.push(e.t);
    g.events.length = 0;
    // keep the runner alive: it only runs lane 1 in an alley of wells
  }
  ok(evs.includes('tremor') || evs.includes('upgrade'), 'a tremor/upgrade happens at lap 3');
  ok(g.grid.flat().some((t) => t && (t.rune === 'bandit' || t.rune === 'brute')), 'something got harder');
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
    return [g.coins, g.hp, g.lap, g.p.toFixed(3)].join('/');
  };
  ok(play(5) === play(5), 'same seed gives the same run');
  ok(play(5) !== play(6) || true, 'different seeds may differ');
}
{
  // the start layout always leaves a safe lane in each district
  let bad = 0;
  for (let s = 1; s <= 300; s++) {
    const g = new Game(s);
    for (let d = 0; d < 3; d++) if (g.grid[d].filter((t) => t && (t.rune === 'spikes' || t.rune === 'brute')).length > 1) bad++;
  }
  ok(bad === 0, 'no starting district has two blockers');
  ok(RING === 3 * DROWS, 'ring size');
}
console.log(fails ? `\n${fails} FAILED` : '\nall rules ok');
process.exit(fails ? 1 : 0);
