import { Rng } from '../../rng';
import { CARDS } from './cards';
import { ENEMIES } from './enemies';
import type { CardInst, CombatEvent, EnemyDef, Intent, Status } from './types';

export const MAX_ENERGY = 3;
export const HAND_SIZE = 5;
export const HAND_CAP = 10;
export const BURN_DMG = 2;
export const HICCUP_EVERY = 3;

export type Mood = 'calm' | 'hiccup';

export interface EnemyState {
  def: EnemyDef;
  hp: number;
  max: number;
  step: number;
  dazzle: number;
  sleep: number;
  burn: number;
  item?: string;
  dead: boolean;
}

/** Damage an intent will deal right now (dazzle halves every hit). */
export function intentDamage(e: EnemyState, it: Intent = currentIntent(e)): number {
  if (it.kind !== 'attack' && it.kind !== 'drain') return 0;
  const per = e.dazzle > 0 ? Math.floor(it.n / 2) : it.n;
  return per * (it.hits ?? 1);
}

export function currentIntent(e: EnemyState): Intent {
  return e.def.pattern[e.step % e.def.pattern.length];
}

/** The pure combat engine: no rendering in here, every call returns the events the scene animates. */
export class Combat {
  hp: number;
  energy = MAX_ENERGY;
  turn = 1;
  hand: CardInst[] = [];
  drawPile: CardInst[] = [];
  discard: CardInst[] = [];
  exhausted: CardInst[] = [];
  enemies: EnemyState[] = [];
  sharp = 0;
  result: 'win' | 'lose' | null = null;
  private nextUid = 100000;

  constructor(
    deck: CardInst[],
    hp: number,
    readonly maxHp: number,
    enemyIds: string[],
    readonly rng: Rng,
    readonly mood: Mood = 'calm',
  ) {
    this.hp = hp;
    this.drawPile = rng.shuffle(deck.map((c) => ({ ...c })));
    this.enemies = enemyIds.map((id) => {
      const def = ENEMIES[id];
      const item = def.boss ? undefined : def.elite || rng.chance(0.75) ? rng.pick(def.swallowed) : undefined;
      return { def, hp: def.hp, max: def.hp, step: 0, dazzle: 0, sleep: 0, burn: 0, item, dead: false };
    });
  }

  alive(): number[] {
    return this.enemies.map((e, i) => (e.dead ? -1 : i)).filter((i) => i >= 0);
  }

  /** True when the enemy phase at the end of this turn is doubled. */
  get hiccupNow(): boolean {
    return this.mood === 'hiccup' && this.turn % HICCUP_EVERY === 0;
  }

  /** Temporary things spat out this fight that were not used. */
  leftovers(): string[] {
    return this.hand.filter((c) => c.temp).map((c) => c.id);
  }

  start(): CombatEvent[] {
    const ev: CombatEvent[] = [{ t: 'turn', n: 1 }];
    this.drawCards(HAND_SIZE, ev);
    return ev;
  }

  private drawCards(n: number, ev: CombatEvent[]): void {
    const got: number[] = [];
    for (let k = 0; k < n; k++) {
      if (!this.drawPile.length) {
        if (!this.discard.length) break;
        this.drawPile = this.rng.shuffle(this.discard);
        this.discard = [];
      }
      const c = this.drawPile.pop()!;
      if (this.hand.length >= HAND_CAP) this.discard.push(c);
      else {
        this.hand.push(c);
        got.push(c.uid);
      }
    }
    if (got.length) ev.push({ t: 'draw', uids: got });
  }

  card(uid: number): CardInst | undefined {
    return this.hand.find((c) => c.uid === uid);
  }

  canPlay(uid: number, target?: number): boolean {
    if (this.result) return false;
    const c = this.card(uid);
    if (!c) return false;
    const def = CARDS[c.id];
    if (def.cost > this.energy) return false;
    if (def.target === 'enemy') {
      if (target === undefined) return false;
      const e = this.enemies[target];
      if (!e || e.dead) return false;
    }
    return true;
  }

  play(uid: number, target?: number): CombatEvent[] {
    const ev: CombatEvent[] = [];
    if (!this.canPlay(uid, target)) return ev;
    const inst = this.card(uid)!;
    const def = CARDS[inst.id];
    this.energy -= def.cost;
    this.hand = this.hand.filter((c) => c.uid !== uid);
    let killed = false;
    let bonusUsed = false;
    const tgt = def.target === 'enemy' ? target! : -1;
    for (const f of def.fight) {
      switch (f.t) {
        case 'dmg': {
          const e = this.enemies[tgt];
          if (e.dead) break;
          let add = this.sharp;
          if (!bonusUsed && inst.bonus) {
            add += inst.bonus;
            bonusUsed = true;
          }
          const hits = f.hits ?? 1;
          for (let h = 0; h < hits && !e.dead; h++) {
            let n = f.n + (h === 0 ? add : 0);
            if (f.ifStatus && this.statusOf(e, f.ifStatus[0]) > 0) n += f.ifStatus[1];
            if (this.hit(tgt, n, ev)) killed = true;
          }
          break;
        }
        case 'dmgAll':
          for (const i of this.alive()) this.hit(i, f.n, ev);
          break;
        case 'splash': {
          this.hit(tgt, f.n, ev);
          for (const j of [tgt - 1, tgt + 1]) if (this.enemies[j] && !this.enemies[j].dead) this.hit(j, f.adj, ev);
          break;
        }
        case 'heal': {
          let n = f.n;
          if (!bonusUsed && inst.bonus) {
            n += inst.bonus;
            bonusUsed = true;
          }
          const got = Math.min(n, this.maxHp - this.hp);
          this.hp += got;
          ev.push({ t: 'heal', n: got });
          break;
        }
        case 'draw':
          this.drawCards(f.n, ev);
          break;
        case 'energy':
          this.energy += f.n;
          ev.push({ t: 'energy', n: f.n });
          break;
        case 'status': {
          const e = this.enemies[tgt];
          if (!e.dead) this.setStatus(tgt, f.s, f.n, ev);
          break;
        }
        case 'statusAll':
          for (const i of this.alive()) this.setStatus(i, f.s, f.n, ev);
          break;
        case 'sharpen':
          this.sharp += f.n;
          ev.push({ t: 'sharpen', n: f.n });
          break;
        case 'fatal':
          if (killed) {
            if (f.do === 'draw') this.drawCards(f.n, ev);
            else if (f.do === 'energy') {
              this.energy += f.n;
              ev.push({ t: 'energy', n: f.n });
            } else {
              const got = Math.min(f.n, this.maxHp - this.hp);
              this.hp += got;
              ev.push({ t: 'heal', n: got });
            }
          }
          break;
      }
    }
    if (!inst.temp) (def.exhaust ? this.exhausted : this.discard).push(inst);
    this.checkWin(ev);
    return ev;
  }

  private statusOf(e: EnemyState, s: Status): number {
    return s === 'dazzle' ? e.dazzle : s === 'sleep' ? e.sleep : e.burn;
  }

  private setStatus(i: number, s: Status, n: number, ev: CombatEvent[]): void {
    const e = this.enemies[i];
    if (s === 'dazzle') e.dazzle = Math.max(e.dazzle, n);
    else if (s === 'sleep') e.sleep = Math.max(e.sleep, n);
    else e.burn = Math.max(e.burn, n);
    ev.push({ t: 'status', i, s });
  }

  /** Returns true when this hit killed the enemy. */
  private hit(i: number, n: number, ev: CombatEvent[]): boolean {
    const e = this.enemies[i];
    if (e.dead) return false;
    const dealt = Math.min(n, e.hp);
    e.hp -= dealt;
    const dead = e.hp <= 0;
    ev.push({ t: 'dmg', i, n: dealt, fatal: dead });
    if (dead) this.kill(i, ev);
    return dead;
  }

  private kill(i: number, ev: CombatEvent[]): void {
    const e = this.enemies[i];
    e.dead = true;
    if (e.item) {
      const inst: CardInst = { uid: this.nextUid++, id: e.item, bonus: 0, temp: true };
      e.item = undefined;
      if (this.hand.length < HAND_CAP) {
        this.hand.push(inst);
        ev.push({ t: 'spit', i, uid: inst.uid });
      }
    }
  }

  private checkWin(ev: CombatEvent[]): void {
    if (!this.result && this.enemies.every((e) => e.dead)) {
      this.result = 'win';
      ev.push({ t: 'win' });
    }
  }

  endTurn(): CombatEvent[] {
    const ev: CombatEvent[] = [];
    if (this.result) return ev;
    // the hand goes to the discard pile; things the enemies spat out are kept until used
    const keep: CardInst[] = [];
    for (const c of this.hand) (c.temp ? keep : this.discard).push(c);
    this.hand = keep;
    this.sharp = 0;
    const rounds = this.hiccupNow ? 2 : 1;
    if (rounds === 2) ev.push({ t: 'hiccup' });
    for (let r = 0; r < rounds && !this.result; r++) this.enemyPhase(ev);
    if (this.result) return ev;
    this.turn++;
    this.energy = MAX_ENERGY;
    ev.push({ t: 'turn', n: this.turn });
    this.drawCards(HAND_SIZE, ev);
    return ev;
  }

  private enemyPhase(ev: CombatEvent[]): void {
    for (const i of this.alive()) {
      const e = this.enemies[i];
      if (e.burn > 0) {
        e.burn--;
        this.hit(i, BURN_DMG, ev);
        ev.push({ t: 'burn', i, n: BURN_DMG });
      }
    }
    this.checkWin(ev);
    if (this.result) return;
    for (const i of this.alive()) {
      const e = this.enemies[i];
      if (e.sleep > 0) {
        e.sleep--;
        e.step++;
        ev.push({ t: 'act', i, intent: { kind: 'idle', n: 0 } });
        continue;
      }
      const it = currentIntent(e);
      ev.push({ t: 'act', i, intent: it });
      if (it.kind === 'attack' || it.kind === 'drain') {
        const per = e.dazzle > 0 ? Math.floor(it.n / 2) : it.n;
        for (let h = 0; h < (it.hits ?? 1); h++) {
          this.hp -= per;
          ev.push({ t: 'hurt', n: per, from: i });
          if (it.kind === 'drain') {
            const g = Math.min(Math.floor(per / 2), e.max - e.hp);
            e.hp += g;
            if (g) ev.push({ t: 'enemyHeal', i, n: g });
          }
        }
        if (e.dazzle > 0) e.dazzle--;
      } else if (it.kind === 'heal') {
        const g = Math.min(it.n, e.max - e.hp);
        e.hp += g;
        ev.push({ t: 'enemyHeal', i, n: g });
      } else if (it.kind === 'steal') {
        const pool = this.hand.filter((c) => !c.temp);
        const c = pool.length ? this.rng.pick(pool) : undefined;
        if (c) {
          this.hand = this.hand.filter((x) => x !== c);
          this.exhausted.push(c);
          ev.push({ t: 'steal', uid: c.uid, i });
        }
      }
      e.step++;
      if (this.hp <= 0) {
        this.hp = 0;
        this.result = 'lose';
        ev.push({ t: 'lose' });
        return;
      }
    }
  }
}
