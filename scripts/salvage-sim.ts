// Balance bot for "Gullet Salvage": plays whole runs with simple heuristics and prints win rates.
// usage: npx tsx scripts/salvage-sim.ts [runs] [bot]   (bot = greedy | random | lazy)
import { Rng } from '../src/rng';
import { CARDS } from '../src/salvage/logic/cards';
import { Combat } from '../src/salvage/logic/combat';
import { combatOpts, NEEDS, Run, type Room } from '../src/salvage/logic/run';
import type { CardDef } from '../src/salvage/logic/types';

const runs = Number(process.argv[2] ?? 2000);
const bot = process.argv[3] ?? 'greedy';

function cardValue(d: CardDef): number {
  let v = 0;
  for (const f of d.fight) {
    if (f.t === 'dmg') v += f.n * (f.hits ?? 1) + (f.ifStatus ? 1.5 : 0);
    if (f.t === 'dmgAll') v += f.n * 2.2;
    if (f.t === 'heal') v += f.n * 0.8;
    if (f.t === 'draw') v += 2;
    if (f.t === 'energy') v += 3;
    if (f.t === 'status') v += f.s === 'sleep' ? 5 : f.s === 'burn' ? 5 : 3;
    if (f.t === 'statusAll') v += 6;
    if (f.t === 'fatal') v += 2;
    if (f.t === 'sharpen') v += 2.5;
    if (f.t === 'grab') v += 4;
    if (f.t === 'peek') v += 1;
  }
  const tool = d.tools.length ? 1.5 + d.tools.length : 0;
  return (v + tool) / (d.cost + 0.6) + (d.rarity === 2 ? 1 : 0);
}

/** How much damage this enemy is about to deal (worst case when its face is hidden). */
function threatOf(c: Combat, i: number): number {
  const e = c.enemies[i];
  const v = c.describe(i);
  if (v.sleeping) return 1;
  let n = 0;
  if (v.cardId && v.fight) n = v.fight.kind === 'dmg' || v.fight.kind === 'steal' ? v.fight.n * v.fight.hits : 0;
  else if (v.natural) n = v.natural.kind === 'heal' ? 0 : v.natural.n * (v.natural.hits ?? 1);
  if (v.fixture === 'valve') n = Math.max(n, 7);
  return (e.dazzle > 0 ? Math.floor(n / 2) : n) + 1;
}

function scorePlay(c: Combat, uid: number, tgt: number | undefined): number {
  const inst = c.card(uid)!;
  const d = CARDS[inst.id];
  const e = tgt === undefined ? undefined : c.enemies[tgt];
  let s = 0;
  const half = c.pDazzle > 0 ? 0.5 : 1;
  for (const f of d.fight) {
    switch (f.t) {
      case 'dmg': {
        if (!e) break;
        let n = (f.n * (f.hits ?? 1) + c.sharp + inst.bonus) * half;
        if (f.ifStatus && e.dazzle > 0) n += f.ifStatus[1];
        const eff = Math.min(n, e.hp);
        s += eff * 0.9;
        if (n >= e.hp) s += 4 + threatOf(c, tgt!) * 2 + e.kit.length * 3;
        else if ((f.n + c.sharp) * half >= 6 && e.kit.length) s += 2 + threatOf(c, tgt!) * 0.6;
        break;
      }
      case 'dmgAll':
        for (const i of c.alive()) s += Math.min(f.n * half, c.enemies[i].hp) * 0.9 + (f.n * half >= c.enemies[i].hp ? 4 + threatOf(c, i) : 0);
        break;
      case 'heal': {
        const miss = c.maxHp - c.hp;
        s += Math.min(f.n, miss) * (c.hp < c.maxHp * 0.6 ? 1.3 : 0.5);
        break;
      }
      case 'draw': s += 2; break;
      case 'energy': s += 3; break;
      case 'status':
        if (!e) break;
        if (f.s === 'sleep') s += e.sleep ? 0 : threatOf(c, tgt!) * 1.1;
        if (f.s === 'dazzle') s += e.dazzle ? 0 : threatOf(c, tgt!) * 0.5 + 1;
        if (f.s === 'burn') s += 2 * f.n * 0.8;
        break;
      case 'statusAll':
        for (const i of c.alive()) s += c.enemies[i].dazzle ? 0 : threatOf(c, i) * 0.5 + 1;
        break;
      case 'sharpen': s += 2; break;
      case 'fatal': s += 1; break;
      case 'grab': if (e && e.kit.length) s += 3 + threatOf(c, tgt!) * 0.8; break;
      case 'peek': s += 0.5; break;
    }
  }
  return s / (inst.free ? 0.35 : d.cost + 0.35);
}

function scoreTool(c: Combat, uid: number, f: number): number {
  const inst = c.card(uid)!;
  const d = CARDS[inst.id];
  const kind = c.fixtures[f].kind;
  let s = 0;
  const alive = c.alive();
  if (kind === 'valve') for (const i of alive) s += Math.min(7, c.enemies[i].hp) * 0.9 + (c.enemies[i].hp <= 7 ? 4 + threatOf(c, i) : 0);
  else if (kind === 'cyst') s += Math.min(6, c.maxHp - c.hp) * (c.hp < c.maxHp * 0.6 ? 1.3 : 0.7);
  else for (const i of alive) s += c.enemies[i].dazzle ? 0 : threatOf(c, i) * 0.5 + 1;
  // taking the fixture away from the enemies is worth something too
  if (alive.some((i) => c.describe(i).fixture === kind)) s += 3;
  if (d.toolConsumes) s -= 3;
  return s / (inst.free ? 0.35 : d.cost + 0.35);
}

function fight(run: Run, room: Room): { win: boolean; spat: string[] } {
  const c = new Combat(run.deck, run.hp, run.maxHp, room.enemies!, new Rng(run.rng.int(1e9)), combatOpts(room));
  c.start();
  let guard = 0;
  while (!c.result && guard++ < 60) {
    for (let k = 0; k < 30 && !c.result; k++) {
      let best: { uid: number; tgt?: number; fx?: number; s: number } | null = null;
      for (const inst of c.hand) {
        const d = CARDS[inst.id];
        if (c.costOf(inst) > c.energy) continue;
        if (bot === 'random' && best && Math.random() < 0.5) continue;
        const tgts = d.target === 'enemy' ? c.alive() : [undefined];
        for (const t of tgts) {
          let s = scorePlay(c, inst.uid, t);
          if (bot === 'random') s = Math.random();
          if (s > 0.8 && (!best || s > best.s)) best = { uid: inst.uid, tgt: t, s };
        }
        for (const f of c.toolTargets(inst.uid)) {
          let s = scoreTool(c, inst.uid, f);
          if (bot === 'random') s = Math.random();
          if (s > 0.8 && (!best || s > best.s)) best = { uid: inst.uid, fx: f, s };
        }
      }
      if (!best) break;
      if (best.fx !== undefined) c.playTool(best.uid, best.fx);
      else c.play(best.uid, best.tgt);
    }
    if (!c.result) c.endTurn();
  }
  run.hp = c.hp;
  for (const uid of c.removedFromDeck()) run.remove(uid);
  return { win: c.result === 'win', spat: c.leftovers() };
}

function pickReward(run: Run, options: string[]): string | null {
  if (bot === 'lazy') return null;
  const have = new Map<string, number>();
  run.deck.forEach((d) => have.set(d.id, (have.get(d.id) ?? 0) + 1));
  const toolCover = (t: string) => run.deck.filter((d) => CARDS[d.id].tools.includes(t as never)).length;
  let best: string | null = null;
  let bs = 0;
  for (const id of options) {
    const d = CARDS[id];
    let s = cardValue(d) - (have.get(id) ?? 0) * 1.5;
    for (const t of d.tools) if (toolCover(t) < 2) s += 2;
    if (run.deck.length > 16) s -= 2;
    if (run.hp < run.maxHp * 0.5 && d.fight.some((f) => f.t === 'heal')) s += 2;
    if (s > bs) {
      bs = s;
      best = id;
    }
  }
  return bs > Number(process.env.TH ?? 2.2) ? best : null;
}

let bossHp = 0, bossN = 0;
function playRun(seed: number): { win: boolean; reached: number; hp: number; deck: number } {
  const run = new Run(seed);
  while (!run.won && !run.lost) {
    const opts = run.map[run.step];
    // choose a room: prefer pool when hurt, elite never unless healthy
    let room = opts[0];
    if (opts.length > 1) {
      const hurt = run.hp < run.maxHp * 0.6;
      const score = (k: string) =>
        k === 'pool' ? (hurt ? 5 : 1) : k === 'elite' ? (run.hp > run.maxHp * 0.7 ? 3 : -2) : k === 'fight' ? 1.5 : k === 'cyst' ? (hurt ? 3 : 1.4) : k === 'alcove' ? 1.2 : 1.2;
      room = opts.slice().sort((a, b) => score(b.kind) - score(a.kind))[0];
    }
    if (room.kind === 'boss') { bossHp += run.hp; bossN++; }
    if (room.enemies) {
      const r = fight(run, room);
      if (!r.win) {
        run.lost = true;
        break;
      }
      if (room.kind !== 'boss') {
        const opts2 = run.rewardOptions(3, { minRarity: room.kind === 'elite' ? 1 : 0 });
        const pick = pickReward(run, [...opts2, ...r.spat.slice(0, 2)]);
        if (pick) run.add(pick);
      }
    } else if (room.kind === 'pool') {
      if (run.hp < run.maxHp * 0.75) run.heal(12);
      else {
        // dissolve the weakest card
        const worst = run.deck.slice().sort((a, b) => cardValue(CARDS[a.id]) - cardValue(CARDS[b.id]))[0];
        if (run.deck.length > 9 && bot !== 'lazy') run.remove(worst.uid);
        else run.heal(12);
      }
    } else if (room.kind === 'corpse') {
      const pick = pickReward(run, run.explore('corpse', null).options);
      if (pick) run.add(pick);
    } else {
      const hand = run.exploreHand();
      const need = NEEDS[room.kind] ?? [];
      const fit = hand.find((c) => CARDS[c.id].tools.some((t) => need.includes(t)));
      const bash = !fit && run.hp > run.maxHp * 0.55;
      if (fit || bash) {
        const out = run.explore(room.kind, fit ? fit.uid : null);
        const pick = pickReward(run, out.options);
        if (pick) run.add(pick);
      }
    }
    run.advance();
  }
  return { win: run.won, reached: run.step, hp: run.hp, deck: run.deck.length };
}


let wins = 0;
const reach = new Array(9).fill(0);
let deckSum = 0;
for (let i = 0; i < runs; i++) {
  const r = playRun(1000 + i);
  if (r.win) wins++;
  reach[r.reached]++;
  deckSum += r.deck;
}
console.log(`bot=${bot} runs=${runs} win=${((wins / runs) * 100).toFixed(1)}% avgDeck=${(deckSum / runs).toFixed(1)}`);
console.log('avg HP entering boss:', (bossHp / Math.max(1, bossN)).toFixed(1));
console.log('died at step:', reach.map((n, i) => `${i}:${((n / runs) * 100).toFixed(0)}%`).join(' '));
