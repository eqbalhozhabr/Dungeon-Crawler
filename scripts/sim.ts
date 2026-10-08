// Balance simulation: runs many seeded games with simple bots and prints win rates.
// Usage: npm run sim -- [games] [level|all] [extraTool ...]   e.g.  npm run sim -- 1500 all   |   npm run sim -- 1500 2 broom dynamite
import { GutGame, COLS, ROWS } from '../src/logic/game';
import { CREATURES, makeLevel } from '../src/logic/levels';
import { TOOLS } from '../src/logic/tools';
import type { ToolId } from '../src/logic/types';
import { Rng } from '../src/rng';

type Bot = 'greedy' | 'random' | 'gemsOnly' | 'greedyStay';

function bestAction(g: GutGame, bot: Bot, rng: Rng): { i: number; r: number; c: number } | null {
  let best: { i: number; r: number; c: number; v: number } | null = null;
  for (let i = 0; i < g.hand.length; i++) {
    if (!g.canPlay(i)) continue;
    const tool = g.hand[i].tool;
    const def = TOOLS[tool];
    if (def.self) {
      if (!g.canSelf(tool)) continue;
      const worst = Math.max(...g.infection);
      let v = 0;
      if (tool === 'antidote') v = bot === 'random' ? rng.next() : bot === 'gemsOnly' ? 0 : worst >= 2 ? 30 / def.cost : worst >= 1 ? 3 / def.cost : 0;
      else if (tool === 'forage') v = bot === 'random' ? rng.next() : 0.2; // free cards: always worth it
      else if (tool === 'lantern') v = bot === 'random' ? rng.next() : g.energy >= 2 ? 0.1 : 0;
      if (v > 0 && (!best || v > best.v)) best = { i, r: 0, c: 0, v };
      continue;
    }
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const area = g.area(tool, r, c);
        if (!area.length) continue;
        let v = 0;
        if (bot === 'random') v = rng.next();
        else {
          let gems = 0;
          const colours = new Set<number>();
          for (const p of area) {
            const cell = g.at(p.r, p.c);
            if (!cell) continue;
            if (cell.kind === 'gem' && tool !== 'shove' && tool !== 'glue') {
              gems++;
              colours.add(cell.colour);
            } else if (cell.kind === 'bug' && tool !== 'shove' && tool !== 'glue' && bot !== 'gemsOnly') {
              v += 6 + p.c * 2.2 + (g.infection[cell.colour] >= 1 ? 8 : 0) + (g.infection[cell.colour] >= 2 ? 16 : 0);
            } else if (cell.kind === 'bug' && (tool === 'shove' || tool === 'glue') && bot !== 'gemsOnly' && p.c >= 6) {
              v += tool === 'glue' ? 4 : 6;
            } else if (cell.kind === 'gem' && tool === 'shove' && p.c >= 6) {
              v += 4;
            }
          }
          if (gems) {
            let pts = 10 * gems + (5 * gems * (gems - 1)) / 2;
            if (gems >= 2 && colours.size === 1) pts *= 2;
            v += pts * 0.6 + (area.reduce((s, p) => s + p.c, 0) / area.length) * 0.5;
          }
          v /= def.cost;
        }
        if (v > 0 && (!best || v > best.v)) best = { i, r, c, v };
      }
  }
  return best;
}

function runGame(seed: number, bot: Bot, level: number, extras: ToolId[]) {
  const g = new GutGame(makeLevel(level, extras), seed);
  const rng = new Rng(seed ^ 0x9e3779b9);
  let guard = 0;
  while (g.phase === 'play' && guard++ < 200) {
    for (let k = 0; k < 8; k++) {
      const a = bestAction(g, bot, rng);
      if (!a) break;
      g.play(a.i, a.r, a.c);
    }
    if (g.canEscape()) {
      const left = g.level.digestMax - g.digest;
      if (bot !== 'greedyStay' || left <= 3 || g.score >= g.level.stars[1]) break;
    }
    g.squeeze();
  }
  if (g.canEscape()) g.escape();
  return g;
}

const N = Number(process.argv[2] ?? 2000);
const levelArg = process.argv[3] ?? '0';
const levels = levelArg === 'all' ? CREATURES.map((_, i) => i) : [Number(levelArg) || 0];
const extras = process.argv.slice(4) as ToolId[];
for (const level of levels) {
  console.log(`\n== ${CREATURES[level].name}   deck extras: ${extras.length ? extras.join(', ') : '(none)'}   games: ${N}`);
  for (const bot of ['greedy', 'gemsOnly', 'random'] as Bot[]) {
    let win = 0, sick = 0, digested = 0;
    const stars = [0, 0, 0, 0];
    let finalSum = 0, turnSum = 0;
    for (let s = 1; s <= N; s++) {
      const g = runGame(s, bot, level, extras);
      if (g.phase === 'escaped') {
        win++;
        stars[g.result!.stars]++;
        finalSum += g.result!.final;
        turnSum += g.turn;
      } else if (g.lossReason === 'sick') sick++;
      else digested++;
    }
    const pct = (x: number) => ((100 * x) / N).toFixed(1).padStart(5) + '%';
    console.log(
      `${bot.padEnd(9)} win ${pct(win)} (1★ ${pct(stars[1])} 2★ ${pct(stars[2])} 3★ ${pct(stars[3])})  sick ${pct(sick)}  digested ${pct(digested)}  avgTurn ${win ? (turnSum / win).toFixed(1) : '-'}`,
    );
  }
}
