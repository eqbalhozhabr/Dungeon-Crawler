// Balance bots for "Alley Echo": play whole runs with simple lane heuristics and print survival, score and seals.
// usage: [OBST=1] npx tsx scripts/loop-sim.ts [runs] [bot] [look]   (OBST=1 adds spikes, thieves and wells)
// usage: npx tsx scripts/loop-sim.ts [runs] [bot] [look]   (bot = dodger | planner | sloppy | lazy)
//   dodger  = only steers for coins and away from spikes (ignores the seal)
//   planner = dodger that also takes a seat fitting every announced demand before each seal
import { botLane } from '../src/loop/logic/bot';
import { Game } from '../src/loop/logic/game';
import { LANES, SCORING_FROM } from '../src/loop/logic/types';

const runs = Number(process.argv[2] ?? 300);
const botName = process.argv[3] ?? 'planner';
const LOOK = Number(process.argv[4] ?? 2.5); // how far ahead the bot looks (rows): smaller = slower reactions

function decide(g: Game, rnd: () => number): void {
  if (botName === 'lazy') return;
  if (botName === 'sloppy' && rnd() < 0.01) g.setLane(Math.floor(rnd() * LANES));
  else g.setLane(botLane(g, LOOK, botName === 'planner'));
}

const tally: Record<string, number> = {};
const rows: { laps: number; score: number; ghost: number; kills: number; open: number; tried: number; streak: number }[] = [];
for (let s = 1; s <= runs; s++) {
  const g = new Game(s, process.env.OBST === '1');
  let seed = s * 7919;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  let t = 0;
  while (!g.over && g.lap < 40 && t < 600) {
    decide(g, rnd);
    g.step(1 / 60);
    for (const e of g.events) tally[e.t] = (tally[e.t] ?? 0) + 1;
    g.events.length = 0;
    t += 1 / 60;
  }
  const scoring = g.history.slice(SCORING_FROM);
  rows.push({ laps: g.lap, score: g.score, ghost: g.ghostCoins / Math.max(1, g.coins), kills: g.kills, open: scoring.filter(Boolean).length, tried: scoring.length, streak: g.bestStreak });
}
const avg = (f: (r: (typeof rows)[0]) => number) => rows.reduce((a, r) => a + f(r), 0) / rows.length;
const laps = rows.map((r) => r.laps).sort((a, b) => a - b);
const open = rows.reduce((a, r) => a + r.open, 0);
const tried = rows.reduce((a, r) => a + r.tried, 0);
console.log(`bot=${botName} runs=${runs}`);
console.log(`laps survived: avg ${avg((r) => r.laps).toFixed(1)}  p10 ${laps[Math.floor(runs * 0.1)]}  median ${laps[Math.floor(runs / 2)]}  p90 ${laps[Math.floor(runs * 0.9)]}  max ${laps[runs - 1]}`);
console.log(`score: avg ${avg((r) => r.score).toFixed(0)}   seals opened in scoring laps: ${tried ? ((open / tried) * 100).toFixed(0) : 0}%   best streak avg ${avg((r) => r.streak).toFixed(1)}`);
console.log(`ghosts took ${(avg((r) => r.ghost) * 100).toFixed(0)}% of the coins   foes/run ${avg((r) => r.kills).toFixed(1)}`);
console.log('events per run:', Object.entries(tally).map(([k, v]) => `${k} ${(v / runs).toFixed(1)}`).join('  '));
