// Balance bots for "Alley Echo": play whole runs with simple lane heuristics and print survival and score.
// usage: npx tsx scripts/loop-sim.ts [runs] [bot] [look]   (bot = dodger | planner | sloppy | lazy)
//   planner = dodger + slides runes to put foes in ghost lanes and hazards out of them
import { botLane } from '../src/loop/logic/bot';
import { Game } from '../src/loop/logic/game';
import { DISTRICTS, DROWS, LANES, type Tile } from '../src/loop/logic/types';

const runs = Number(process.argv[2] ?? 300);
const botName = process.argv[3] ?? 'dodger';
const LOOK = Number(process.argv[4] ?? 3.4); // how far ahead the bot looks (rows): smaller = slower reactions

function decide(g: Game, rnd: () => number): void {
  if (botName === 'lazy') return;
  const err = botName === 'sloppy' ? 0.01 : 0;
  if (rnd() < err) g.setLane(Math.floor(rnd() * LANES));
  else g.setLane(botLane(g, LOOK));
}

/** How good a layout is for the current ghosts: foes under ghosts, hazards away from them, no district with two blockers. */
function layoutScore(g: Game, grid: (Tile | null)[][]): number {
  let v = 0;
  for (let d = 0; d < DISTRICTS; d++) {
    let blockers = 0;
    for (let l = 0; l < LANES; l++) {
      const t = grid[d][l];
      if (!t) continue;
      const ghosts = (row: number) => g.ghostsIn(l, row);
      if (t.rune === 'bandit') v += ghosts(d * DROWS + 5) > 0 ? 2 : -2;
      if (t.rune === 'brute') v += ghosts(d * DROWS + 5) > 0 ? 3 : -3;
      if (t.rune === 'coin') v += ghosts(d * DROWS + 5) > 0 ? 1 : 0;
      if (t.rune === 'spikes' || t.rune === 'brute') blockers++;
      if (t.rune === 'spikes') v += ghosts(d * DROWS + 5) > 0 ? -0.5 : 1; // ghosts waste their walk on spikes
    }
    if (blockers >= 2) v -= 4;
    if (blockers >= 3) v -= 8;
  }
  return v;
}

function trySlide(g: Game): void {
  let best: { d: number; l: number } | null = null;
  let bv = layoutScore(g, g.grid);
  for (let d = 0; d < DISTRICTS; d++)
    for (let l = 0; l < LANES; l++) {
      const chain = g.slideCells(d, l);
      if (!chain || chain.length !== 2) continue; // single steps only
      const copy = g.grid.map((r) => r.slice());
      copy[chain[0].d][chain[0].l] = copy[chain[1].d][chain[1].l];
      copy[chain[1].d][chain[1].l] = null;
      const v = layoutScore(g, copy);
      if (v > bv + 0.01) {
        bv = v;
        best = { d, l };
      }
    }
  if (best) g.slide(best.d, best.l);
}

const tally: Record<string, number> = {};
const rows: { laps: number; score: number; ghost: number; kills: number; slides: number }[] = [];
for (let s = 1; s <= runs; s++) {
  const g = new Game(s);
  let seed = s * 7919;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  let t = 0;
  while (!g.over && g.lap < 40 && t < 600) {
    decide(g, rnd);
    if (botName === 'planner' && Math.floor(t * 4) !== Math.floor((t - 1 / 60) * 4)) trySlide(g); // 4 looks per second
    g.step(1 / 60);
    for (const e of g.events) tally[e.t] = (tally[e.t] ?? 0) + 1;
    g.events.length = 0;
    t += 1 / 60;
  }
  rows.push({ laps: g.lap, score: g.score, ghost: g.ghostCoins / Math.max(1, g.coins), kills: g.kills, slides: g.slides });
}
const avg = (f: (r: (typeof rows)[0]) => number) => rows.reduce((a, r) => a + f(r), 0) / rows.length;
const laps = rows.map((r) => r.laps).sort((a, b) => a - b);
console.log(`bot=${botName} runs=${runs}`);
console.log(`laps survived: avg ${avg((r) => r.laps).toFixed(1)}  p10 ${laps[Math.floor(runs * 0.1)]}  median ${laps[Math.floor(runs / 2)]}  p90 ${laps[Math.floor(runs * 0.9)]}  max ${laps[runs - 1]}`);
console.log(`score: avg ${avg((r) => r.score).toFixed(0)}   share of coins taken by ghosts: ${(avg((r) => r.ghost) * 100).toFixed(0)}%   kills/run ${avg((r) => r.kills).toFixed(1)}   slides/run ${avg((r) => r.slides).toFixed(0)}`);
console.log('events per run:', Object.entries(tally).map(([k, v]) => `${k} ${(v / runs).toFixed(1)}`).join('  '));
