// Balance bots for "Alley Echo": play whole runs with simple lane heuristics and print survival and score.
// usage: npx tsx scripts/loop-sim.ts [runs] [bot]   (bot = dodger | sloppy | lazy)
import { botLane } from '../src/loop/logic/bot';
import { Game } from '../src/loop/logic/game';
import { LANES } from '../src/loop/logic/types';

const runs = Number(process.argv[2] ?? 300);
const botName = process.argv[3] ?? 'dodger';
const LOOK = Number(process.argv[4] ?? 3.4); // how far ahead the bot looks (rows): smaller = slower reactions

function decide(g: Game, rnd: () => number): void {
  if (botName === 'lazy') return;
  const err = botName === 'sloppy' ? 0.01 : 0;
  if (rnd() < err) g.setLane(Math.floor(rnd() * LANES));
  else g.setLane(botLane(g, LOOK));
}

const rows: { laps: number; score: number; ghost: number; kills: number }[] = [];
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
    g.step(1 / 60);
    g.events.length = 0;
    t += 1 / 60;
  }
  rows.push({ laps: g.lap, score: g.score, ghost: g.ghostCoins / Math.max(1, g.coins), kills: g.kills });
}
const avg = (f: (r: (typeof rows)[0]) => number) => rows.reduce((a, r) => a + f(r), 0) / rows.length;
const laps = rows.map((r) => r.laps).sort((a, b) => a - b);
console.log(`bot=${botName} runs=${runs}`);
console.log(`laps survived: avg ${avg((r) => r.laps).toFixed(1)}  p10 ${laps[Math.floor(runs * 0.1)]}  median ${laps[Math.floor(runs / 2)]}  p90 ${laps[Math.floor(runs * 0.9)]}  max ${laps[runs - 1]}`);
console.log(`score: avg ${avg((r) => r.score).toFixed(0)}   share of coins taken by ghosts: ${(avg((r) => r.ghost) * 100).toFixed(0)}%   kills/run ${avg((r) => r.kills).toFixed(1)}`);
