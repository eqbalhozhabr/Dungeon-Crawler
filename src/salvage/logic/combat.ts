import { Rng } from '../../rng';
import { CARDS } from './cards';
import { ENEMIES } from './enemies';
import { CYST_HEAL, FIXTURE_NEEDS, VALVE_DMG } from './fixtures';
import type { CardDef, CardInst, CombatEvent, EnemyDef, FixtureKind, Intent, Status } from './types';

export const MAX_ENERGY = 3;
export const HAND_SIZE = 5;
export const HAND_CAP = 10;
export const BURN_DMG = 2;
export const HICCUP_EVERY = 3;
/** One hit of at least this much knocks the object out of an enemy's hands. */
export const DISARM_AT = 6;

export type Mood = 'calm' | 'hiccup';

export interface CombatOpts {
  mood?: Mood;
  fixtures?: FixtureKind[];
  /** from this turn on the acid rises and hurts everyone */
  acidFrom?: number;
  /** the enemies act before your first turn */
  ambush?: boolean;
}

export interface EnemyState {
  def: EnemyDef;
  hp: number;
  max: number;
  /** the objects it holds; it plays them in order */
  kit: string[];
  kitIdx: number;
  natStep: number;
  dazzle: number;
  sleep: number;
  burn: number;
  dead: boolean;
  fled: boolean;
  acts: number;
  /** its secretly planned face for the object it holds now */
  planned?: { cardId: string; face: 'fight' | 'tool' };
  /** cards it has taken from your hand (you get them back if it dies) */
  stolen: CardInst[];
}

export interface FixtureState {
  kind: FixtureKind;
  used: boolean;
}

export interface FaceSummary {
  kind: 'dmg' | 'heal' | 'status' | 'steal' | 'none';
  n: number;
  hits: number;
  label: string;
}

/** What the fight face of an object amounts to when an enemy plays it (damage first, then the rest). */
export function faceSummary(def: CardDef, playerDazzled = false): FaceSummary {
  let n = 0;
  let hits = 0;
  let steal = false;
  let heal = 0;
  let label = '';
  for (const f of def.fight) {
    if (f.t === 'dmg' && !hits) {
      n = f.n + (f.ifStatus && f.ifStatus[0] === 'dazzle' && playerDazzled ? f.ifStatus[1] : 0);
      hits = f.hits ?? 1;
    } else if (f.t === 'dmgAll' && !hits) {
      n = f.n;
      hits = 1;
    } else if (f.t === 'heal') heal += f.n;
    else if (f.t === 'grab') steal = true;
    else if (f.t === 'status' || f.t === 'statusAll') label = f.s === 'dazzle' ? 'DAZZLE' : f.s === 'sleep' ? 'TIE' : 'BURN';
  }
  if (hits) return { kind: steal ? 'steal' : 'dmg', n, hits, label };
  if (heal) return { kind: 'heal', n: heal, hits: 0, label };
  if (label) return { kind: 'status', n: 0, hits: 0, label };
  return { kind: 'none', n: 0, hits: 0, label };
}

export interface IntentView {
  sleeping: boolean;
  cardId?: string;
  natural?: Intent;
  /** the enemy may play the tool face and you cannot tell (no peek) */
  ambiguous: boolean;
  /** what it will do, when that is known */
  face: 'fight' | 'tool' | null;
  fixture?: FixtureKind;
  fight?: FaceSummary;
}

export function currentCard(e: EnemyState): string | undefined {
  return e.kit.length ? e.kit[e.kitIdx % e.kit.length] : undefined;
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
  fixtures: FixtureState[] = [];
  sharp = 0;
  peeked = false;
  pDazzle = 0;
  pBurn = 0;
  tied = 0;
  result: 'win' | 'lose' | null = null;
  /** cards of your deck that were used up (an old key) or carried off by a thief */
  consumed: number[] = [];
  lost: number[] = [];
  readonly mood: Mood;
  private opts: CombatOpts;
  private nextUid = 100000;

  constructor(
    deck: CardInst[],
    hp: number,
    readonly maxHp: number,
    enemyIds: string[],
    readonly rng: Rng,
    opts: CombatOpts = {},
  ) {
    this.opts = opts;
    this.mood = opts.mood ?? 'calm';
    this.hp = hp;
    this.drawPile = rng.shuffle(deck.map((c) => ({ ...c })));
    this.fixtures = (opts.fixtures ?? []).map((kind) => ({ kind, used: false }));
    this.enemies = enemyIds.map((id) => {
      const def = ENEMIES[id];
      const kit = def.fixedKit ? def.fixedKit.slice() : rng.shuffle(def.swallowed.slice()).slice(0, def.kitCount);
      return { def, hp: def.hp, max: def.hp, kit, kitIdx: 0, natStep: 0, dazzle: 0, sleep: 0, burn: 0, dead: false, fled: false, acts: 0, stolen: [] };
    });
  }

  alive(): number[] {
    return this.enemies.map((e, i) => (e.dead ? -1 : i)).filter((i) => i >= 0);
  }

  get hiccupNow(): boolean {
    return this.mood === 'hiccup' && this.turn % HICCUP_EVERY === 0;
  }

  get acidNow(): number {
    return this.opts.acidFrom && this.turn >= this.opts.acidFrom ? 1 + (this.turn - this.opts.acidFrom) : 0;
  }

  get ambush(): boolean {
    return !!this.opts.ambush;
  }

  /** Temporary things spat out this fight that were not used. */
  leftovers(): string[] {
    return this.hand.filter((c) => c.temp).map((c) => c.id);
  }

  removedFromDeck(): number[] {
    return [...this.consumed, ...this.lost];
  }

  costOf(c: CardInst): number {
    return c.free ? 0 : CARDS[c.id].cost;
  }

  // ------------------------------------------------------------------ enemy plans
  private fixtureFor(def: CardDef): number {
    return this.fixtures.findIndex((f) => !f.used && def.tools.some((t) => FIXTURE_NEEDS[f.kind].includes(t)));
  }

  private planAll(): void {
    for (const i of this.alive()) {
      const e = this.enemies[i];
      const card = currentCard(e);
      if (!card) {
        e.planned = undefined;
        continue;
      }
      if (e.planned && e.planned.cardId === card) continue;
      const possible = this.fixtureFor(CARDS[card]) >= 0;
      e.planned = { cardId: card, face: possible && this.rng.chance(0.5) ? 'tool' : 'fight' };
    }
  }

  describe(i: number): IntentView {
    const e = this.enemies[i];
    if (e.sleep > 0) return { sleeping: true, ambiguous: false, face: null };
    const card = currentCard(e);
    if (!card) return { sleeping: false, natural: e.def.natural[e.natStep % e.def.natural.length], ambiguous: false, face: 'fight' };
    const def = CARDS[card];
    const fx = this.fixtureFor(def);
    const possible = fx >= 0;
    const actual: 'fight' | 'tool' = possible && e.planned && e.planned.cardId === card ? e.planned.face : 'fight';
    const ambiguous = possible && !this.peeked;
    return {
      sleeping: false,
      cardId: card,
      ambiguous,
      face: ambiguous ? null : actual,
      fixture: possible ? this.fixtures[fx].kind : undefined,
      fight: faceSummary(def, this.pDazzle > 0),
    };
  }

  // ------------------------------------------------------------------ turn flow
  start(): CombatEvent[] {
    const ev: CombatEvent[] = [{ t: 'turn', n: 1 }];
    this.planAll();
    if (this.opts.ambush) {
      this.enemyPhase(ev);
      if (this.result) return ev;
      this.planAll();
    }
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
    if (this.costOf(c) > this.energy) return false;
    if (def.target === 'enemy') {
      if (target === undefined) return false;
      const e = this.enemies[target];
      if (!e || e.dead) return false;
    }
    return true;
  }

  /** Can this object's tool face work on fixture f right now? */
  canTool(uid: number, f: number): boolean {
    if (this.result) return false;
    const c = this.card(uid);
    const fx = this.fixtures[f];
    if (!c || !fx || fx.used) return false;
    if (this.costOf(c) > this.energy) return false;
    return CARDS[c.id].tools.some((t) => FIXTURE_NEEDS[fx.kind].includes(t));
  }

  /** Fixtures this card could work on (for highlighting). */
  toolTargets(uid: number): number[] {
    return this.fixtures.map((_, f) => f).filter((f) => this.canTool(uid, f));
  }

  playTool(uid: number, f: number): CombatEvent[] {
    const ev: CombatEvent[] = [];
    if (!this.canTool(uid, f)) return ev;
    const inst = this.card(uid)!;
    const def = CARDS[inst.id];
    this.energy -= this.costOf(inst);
    this.hand = this.hand.filter((c) => c.uid !== uid);
    this.useFixture(f, 'you', undefined, ev);
    if (def.toolConsumes) {
      if (!inst.temp) this.consumed.push(inst.uid);
    } else if (!inst.temp) (def.exhaust ? this.exhausted : this.discard).push(inst);
    this.checkWin(ev);
    return ev;
  }

  private useFixture(f: number, by: 'you' | 'enemy', i: number | undefined, ev: CombatEvent[]): void {
    const fx = this.fixtures[f];
    fx.used = true;
    ev.push({ t: 'fixture', f, kind: fx.kind, by, i });
    if (fx.kind === 'valve') {
      if (by === 'you') for (const k of this.alive()) this.hit(k, VALVE_DMG, ev, false);
      else this.hurtPlayer(VALVE_DMG, i ?? 0, ev);
    } else if (fx.kind === 'cyst') {
      if (by === 'you') this.healPlayer(CYST_HEAL, ev);
      else {
        const e = this.enemies[i ?? 0];
        const g = Math.min(CYST_HEAL, e.max - e.hp);
        e.hp += g;
        ev.push({ t: 'enemyHeal', i: i ?? 0, n: g });
      }
    } else if (by === 'you') for (const k of this.alive()) this.setStatus(k, 'dazzle', 1, ev);
    else this.setPlayerStatus('dazzle', ev);
    this.planAll();
  }

  play(uid: number, target?: number): CombatEvent[] {
    const ev: CombatEvent[] = [];
    if (!this.canPlay(uid, target)) return ev;
    const inst = this.card(uid)!;
    const def = CARDS[inst.id];
    this.energy -= this.costOf(inst);
    this.hand = this.hand.filter((c) => c.uid !== uid);
    let killed = false;
    let bonusUsed = false;
    let dealt = false;
    const tgt = def.target === 'enemy' ? target! : -1;
    const wasDazzled = this.pDazzle > 0;
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
            if (wasDazzled) n = Math.floor(n / 2);
            dealt = true;
            if (this.hit(tgt, n, ev, true)) killed = true;
          }
          break;
        }
        case 'dmgAll':
          for (const i of this.alive()) this.hit(i, wasDazzled ? Math.floor(f.n / 2) : f.n, ev, false);
          dealt = true;
          break;
        case 'heal': {
          let n = f.n;
          if (!bonusUsed && inst.bonus) {
            n += inst.bonus;
            bonusUsed = true;
          }
          this.healPlayer(n, ev);
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
            } else this.healPlayer(f.n, ev);
          }
          break;
        case 'grab':
          if (!this.enemies[tgt].dead) this.takeCard(tgt, 'grab', ev);
          break;
        case 'peek':
          this.peeked = true;
          ev.push({ t: 'peek' });
          break;
      }
    }
    if (dealt && wasDazzled) this.pDazzle = 0;
    if (!inst.temp) (def.exhaust ? this.exhausted : this.discard).push(inst);
    this.planAll();
    this.checkWin(ev);
    return ev;
  }

  private healPlayer(n: number, ev: CombatEvent[]): void {
    const got = Math.min(n, this.maxHp - this.hp);
    this.hp += got;
    ev.push({ t: 'heal', n: got });
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

  private setPlayerStatus(s: Status, ev: CombatEvent[], n = 1): void {
    if (s === 'dazzle') this.pDazzle = Math.max(this.pDazzle, 1);
    else if (s === 'sleep') this.tied = 1;
    else this.pBurn = Math.max(this.pBurn, n);
    ev.push({ t: 'pstatus', s });
  }

  /** Returns true when this hit killed the enemy. `byCard`: a big hit can knock its object loose. */
  private hit(i: number, n: number, ev: CombatEvent[], byCard: boolean): boolean {
    const e = this.enemies[i];
    if (e.dead) return false;
    const dealt = Math.min(n, e.hp);
    e.hp -= dealt;
    const dead = e.hp <= 0;
    ev.push({ t: 'dmg', i, n: dealt, fatal: dead });
    if (dead) this.kill(i, ev);
    else if (byCard && n >= DISARM_AT && e.kit.length) this.takeCard(i, 'disarm', ev);
    return dead;
  }

  /** Take the object an enemy is about to play out of its hands (disarm) or into yours for free (grab). */
  private takeCard(i: number, how: 'disarm' | 'grab', ev: CombatEvent[]): void {
    const e = this.enemies[i];
    const id = currentCard(e);
    if (!id) return;
    e.kit.splice(e.kitIdx % e.kit.length, 1);
    e.planned = undefined;
    const inst: CardInst = { uid: this.nextUid++, id, bonus: 0, temp: true, free: how === 'grab' };
    if (this.hand.length < HAND_CAP) {
      this.hand.push(inst);
      ev.push({ t: how, i, uid: inst.uid });
    }
  }

  private kill(i: number, ev: CombatEvent[]): void {
    const e = this.enemies[i];
    e.dead = true;
    for (const id of e.kit) {
      const inst: CardInst = { uid: this.nextUid++, id, bonus: 0, temp: true };
      if (this.hand.length < HAND_CAP) {
        this.hand.push(inst);
        ev.push({ t: 'spit', i, uid: inst.uid });
      }
    }
    e.kit = [];
    if (e.stolen.length) {
      const back = e.stolen.slice(0, Math.max(0, HAND_CAP - this.hand.length));
      this.hand.push(...back);
      ev.push({ t: 'returned', uids: back.map((c) => c.uid) });
      e.stolen = [];
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
    // the enemies act while the cards you did not play are still in your hand (so they can be stolen)
    const rounds = this.hiccupNow ? 2 : 1;
    if (rounds === 2) ev.push({ t: 'hiccup' });
    for (let r = 0; r < rounds && !this.result; r++) {
      this.enemyPhase(ev);
      if (r === 0 && rounds === 2) this.planAll();
    }
    this.sharp = 0;
    this.peeked = false;
    // then the hand goes to the discard pile; objects taken from enemies stay until used
    const keep: CardInst[] = [];
    for (const c of this.hand) {
      if (c.temp) {
        c.free = false;
        keep.push(c);
      } else this.discard.push(c);
    }
    this.hand = keep;
    if (this.result) return ev;
    const acid = this.acidNow;
    if (acid) {
      ev.push({ t: 'acid', n: acid });
      this.hp -= acid;
      ev.push({ t: 'hurt', n: acid, from: -1 });
      for (const i of this.alive()) this.hit(i, acid, ev, false);
      if (this.hp <= 0) return this.lose(ev);
      this.checkWin(ev);
      if (this.result) return ev;
    }
    this.turn++;
    this.energy = Math.max(1, MAX_ENERGY - this.tied);
    this.tied = 0;
    ev.push({ t: 'turn', n: this.turn });
    if (this.pBurn > 0) {
      this.pBurn--;
      this.hp -= BURN_DMG;
      ev.push({ t: 'pburn', n: BURN_DMG });
      if (this.hp <= 0) return this.lose(ev);
    }
    this.drawCards(HAND_SIZE, ev);
    this.planAll();
    return ev;
  }

  private lose(ev: CombatEvent[]): CombatEvent[] {
    this.hp = 0;
    this.result = 'lose';
    ev.push({ t: 'lose' });
    return ev;
  }

  // ------------------------------------------------------------------ enemy turn
  private hurtPlayer(n: number, from: number, ev: CombatEvent[]): void {
    this.hp -= n;
    ev.push({ t: 'hurt', n, from });
    const e = this.enemies[from];
    if (e && e.def.trait === 'drain' && n > 0) {
      const g = Math.min(Math.floor(n / 2), e.max - e.hp);
      if (g > 0) {
        e.hp += g;
        ev.push({ t: 'enemyHeal', i: from, n: g });
      }
    }
  }

  private enemyPhase(ev: CombatEvent[]): void {
    for (const i of this.alive()) {
      const e = this.enemies[i];
      if (e.burn > 0) {
        e.burn--;
        this.hit(i, BURN_DMG, ev, false);
        ev.push({ t: 'burn', i, n: BURN_DMG });
      }
    }
    this.checkWin(ev);
    if (this.result) return;
    for (const i of this.alive()) {
      this.enemyAct(i, ev);
      if (this.hp <= 0) {
        this.lose(ev);
        return;
      }
    }
  }

  private enemyAct(i: number, ev: CombatEvent[]): void {
    const e = this.enemies[i];
    if (e.dead) return;
    // a thief steals on its first move and is gone on its second
    if (e.def.trait === 'thief' && e.acts >= 1) {
      this.flee(i, ev);
      return;
    }
    if (e.sleep > 0) {
      e.sleep--;
      ev.push({ t: 'act', i, idle: true });
      return;
    }
    const id = currentCard(e);
    if (id) {
      const def = CARDS[id];
      const fx = this.fixtureFor(def);
      const face: 'fight' | 'tool' = fx >= 0 && e.planned && e.planned.cardId === id && e.planned.face === 'tool' ? 'tool' : 'fight';
      ev.push({ t: 'act', i, cardId: id, face });
      if (face === 'tool') this.useFixture(fx, 'enemy', i, ev);
      else this.enemyFight(i, def, ev);
      if (def.exhaust) e.kit.splice(e.kitIdx % e.kit.length, 1);
      else e.kitIdx++;
      e.planned = undefined;
    } else {
      const it = e.def.natural[e.natStep % e.def.natural.length];
      ev.push({ t: 'act', i });
      this.enemyNatural(i, it, ev);
      e.natStep++;
    }
    e.acts++;
  }

  private enemyFight(i: number, def: CardDef, ev: CombatEvent[]): void {
    const e = this.enemies[i];
    let struck = false;
    for (const f of def.fight) {
      if (f.t === 'dmg' || f.t === 'dmgAll') {
        let n = f.n;
        if (f.t === 'dmg' && f.ifStatus && f.ifStatus[0] === 'dazzle' && this.pDazzle > 0) n += f.ifStatus[1];
        if (e.dazzle > 0) n = Math.floor(n / 2);
        const hits = f.t === 'dmg' ? f.hits ?? 1 : 1;
        for (let h = 0; h < hits; h++) this.hurtPlayer(n, i, ev);
        struck = true;
      } else if (f.t === 'heal') {
        const g = Math.min(f.n, e.max - e.hp);
        e.hp += g;
        ev.push({ t: 'enemyHeal', i, n: g });
      } else if (f.t === 'status' || f.t === 'statusAll') this.setPlayerStatus(f.s, ev, f.n);
      else if (f.t === 'grab') this.enemySteal(i, ev);
    }
    if (struck && e.dazzle > 0) e.dazzle--;
  }

  private enemyNatural(i: number, it: Intent, ev: CombatEvent[]): void {
    const e = this.enemies[i];
    if (it.kind === 'attack' || it.kind === 'drain') {
      const per = e.dazzle > 0 ? Math.floor(it.n / 2) : it.n;
      for (let h = 0; h < (it.hits ?? 1); h++) this.hurtPlayer(per, i, ev);
      if (e.dazzle > 0) e.dazzle--;
    } else if (it.kind === 'heal') {
      const g = Math.min(it.n, e.max - e.hp);
      e.hp += g;
      ev.push({ t: 'enemyHeal', i, n: g });
    }
  }

  private enemySteal(i: number, ev: CombatEvent[]): void {
    const pool = this.hand.filter((c) => !c.temp);
    if (!pool.length) return;
    const c = this.rng.pick(pool);
    this.hand = this.hand.filter((x) => x !== c);
    this.enemies[i].stolen.push(c);
    ev.push({ t: 'steal', uid: c.uid, i });
  }

  private flee(i: number, ev: CombatEvent[]): void {
    const e = this.enemies[i];
    e.dead = true;
    e.fled = true;
    const lost = e.stolen.length > 0;
    for (const c of e.stolen) this.lost.push(c.uid);
    e.stolen = [];
    ev.push({ t: 'flee', i, lost });
    this.checkWin(ev);
  }
}
