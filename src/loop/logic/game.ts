// Alley Echo rules. No rendering here: the game, the sim and the rule checks all drive this class.
import { Rng } from '../../rng';
import { countSeats, crowd, Formations, meets, REACH, type Demand } from './formation';
import { freshState, HARDER, itemsFor } from './runes';
import {
  BINS,
  DISTRICTS,
  DROWS,
  LANES,
  MAX_ECHOES,
  MAX_HP,
  RING,
  SCORING_FROM,
  type Echo,
  type GameEvent,
  type RuneId,
  type Tile,
} from './types';

const STRIKE_REACH = 1.0; // you swing at anything in your lane this close ahead (automatic)
const HIT_DIST = 0.15; // a living enemy this close hurts you
const GRAB_DIST = 0.3;
const START_DELAY = 2.4; // time to read the first seal before the run starts
const INVULN = 1.1;
const UPGRADE_EVERY = 3;
/** Seconds to shift one lane. Input is buffered (you steer towards `want`), so taps are never lost, but one runner cannot be everywhere. */
const LANE_STEP = 0.2;
const SUBSTEP = 0.2;
/** Multiplier of a lap whose seal stayed shut, and the cap of the streak multiplier. */
const SHUT_MULT = 0.5;
const MAX_MULT = 4;

/** Rows ahead of `p` (0 = here), wrapping round the ring. */
export const rel = (q: number, p: number): number => (((q - p) % RING) + RING) % RING;

export class Game {
  readonly rng: Rng;
  readonly formations: Formations;
  grid: Tile[][] = [];
  p = 0;
  lap = 0;
  time = 0;
  delay = START_DELAY;
  lane = 1;
  /** The lane you are steering towards. */
  want = 1;
  hp = MAX_HP;
  /** Coins picked up (by you or a ghost), before any multiplier. */
  coins = 0;
  /** Score before rounding: coins times the multiplier of the lap, plus seal bonuses. */
  points = 0;
  ghostCoins = 0;
  kills = 0;
  invuln = 0;
  over = false;
  /** Consecutive open seals since the scoring laps began. */
  streak = 0;
  /** Multiplier of the lap in progress (set by its seal). */
  mult = 1;
  sealsOpen = 0;
  sealsShut = 0;
  bestStreak = 0;
  /** Outcome of every seal so far (true = open), warm-up laps included. */
  history: boolean[] = [];
  echoes: Echo[] = [];
  path = new Uint8Array(RING * BINS).fill(1);
  events: GameEvent[] = [];
  private nextId = 1;
  private laneCool = 0;
  private started = false;

  constructor(readonly seed: number) {
    this.rng = new Rng(seed);
    this.formations = new Formations(new Rng(seed ^ 0x9e3779b9));
    this.build();
  }

  // ---------------------------------------------------------------- setup
  private level(): number {
    return Math.floor(this.lap / UPGRADE_EVERY);
  }

  private makeTile(rune: RuneId): Tile {
    const t: Tile = { id: this.nextId++, rune, variant: this.rng.int(3), items: [], state: [] };
    this.refit(t);
    return t;
  }

  private refit(t: Tile): void {
    t.items = itemsFor(t.rune, t.variant, this.level());
    t.state = freshState(t, this.level());
  }

  /** 9 stretches of street: 3 purses, 2 thieves, 2 spikes, a well, an open one; never two spike lanes in one district. */
  private build(): void {
    const runes: RuneId[] = ['coin', 'coin', 'coin', 'bandit', 'bandit', 'spikes', 'spikes', 'fountain', 'bare'];
    for (let tries = 0; tries < 500; tries++) {
      this.rng.shuffle(runes);
      let good = true;
      for (let d = 0; d < DISTRICTS && good; d++) if (runes.slice(d * LANES, d * LANES + LANES).filter((r) => r === 'spikes').length > 1) good = false;
      if (!good) continue;
      this.grid = [];
      for (let d = 0; d < DISTRICTS; d++) this.grid.push(runes.slice(d * LANES, d * LANES + LANES).map((r) => this.makeTile(r)));
      return;
    }
    throw new Error('could not build a starting alley');
  }

  // ---------------------------------------------------------------- queries
  /** Score shown to the player. */
  get score(): number {
    return Math.round(this.points);
  }

  speed(): number {
    return Math.min(7.2, 3.4 + 0.26 * this.lap);
  }

  district(p = this.p): number {
    return Math.floor(p / DROWS) % DISTRICTS;
  }

  echoLane(i: number, p = this.p): number {
    return this.echoes[i].path[Math.floor(p * BINS) % (RING * BINS)];
  }

  /** How many ghosts (not you) stand in `lane` at position `p`. */
  ghostsIn(lane: number, p: number): number {
    let n = 0;
    for (let i = 0; i < this.echoes.length; i++) if (this.echoLane(i, p) === lane) n++;
    return n;
  }

  /** Lap whose seal comes next (it is checked when you cross the seal): the seat you are about to take. */
  get nextSeal(): number {
    return this.formations.seats.length;
  }

  /** The demand and the seats already taken for the seal of lap `j` (for the display). */
  sealInfo(j: number): { demand: Demand; ghosts: number[]; live: boolean } {
    const from = Math.max(0, j - REACH + 1);
    const ghosts: number[] = [];
    let live = false;
    for (let k = from; k <= j; k++) {
      if (k < this.formations.seats.length) ghosts.push(this.formations.seats[k]);
      else if (k === this.formations.seats.length) live = true; // the seat you will take at the next seal: your lane right now
    }
    return { demand: this.formations.demands[j], ghosts, live };
  }

  // ---------------------------------------------------------------- input
  setLane(l: number): void {
    if (this.over) return;
    this.want = Math.max(0, Math.min(LANES - 1, l));
    this.shift();
  }

  moveLane(dir: number): void {
    this.setLane(this.want + dir);
  }

  private shift(): void {
    if (this.want === this.lane || this.laneCool > 0) return;
    this.lane += Math.sign(this.want - this.lane);
    this.laneCool = LANE_STEP;
  }

  // ---------------------------------------------------------------- simulation
  step(dt: number): void {
    if (this.over) return;
    this.time += dt;
    this.laneCool = Math.max(0, this.laneCool - dt);
    this.shift();
    this.invuln = Math.max(0, this.invuln - dt);
    if (this.delay > 0) {
      this.delay -= dt;
      if (this.delay > 0) return;
    }
    if (!this.started) {
      this.started = true;
      this.crossSeal();
    }
    let left = this.speed() * dt;
    while (left > 1e-9 && !this.over) {
      const d = Math.min(SUBSTEP, left);
      this.advance(d);
      left -= d;
    }
  }

  private advance(d: number): void {
    const p0 = this.p;
    const raw = p0 + d;
    this.p = raw >= RING ? raw - RING : raw;
    // bin 0 keeps the lane you stood in at the seal, so what a ghost does at the seal is exactly what you did
    const bin = Math.floor(this.p * BINS) % (RING * BINS);
    if (bin !== 0) this.path[bin] = this.lane;
    this.interact(p0, d);
    this.checkSpikes();
    if (this.over) return;
    const d0 = Math.floor(p0 / DROWS);
    if (d0 !== Math.floor(this.p / DROWS)) this.leaveDistrict(d0);
    if (raw >= RING) this.endLap();
  }

  private interact(p0: number, d: number): void {
    // who: -1 = you, 0.. = ghost index. You go first, so you get the credit when you share a lane.
    for (let who = -1; who < this.echoes.length; who++) {
      const lane = who < 0 ? this.lane : this.echoLane(who);
      for (let dd = 0; dd < DISTRICTS; dd++) {
        const tile = this.grid[dd][lane];
        for (let i = 0; i < tile.items.length; i++) {
          const it = tile.items[i];
          if (it.kind === 'spike' || tile.state[i] <= 0) continue;
          const row = dd * DROWS + it.off;
          const a0 = rel(row, p0);
          const crosses = (t: number) => a0 > t && a0 - d <= t;
          if (it.kind === 'coin') {
            if (!crosses(GRAB_DIST)) continue;
            tile.state[i] = 0;
            this.gain(who, lane, row, it.worth, false);
          } else if (it.kind === 'well') {
            if (who >= 0 || !crosses(GRAB_DIST)) continue;
            tile.state[i] = 0;
            if (this.hp < MAX_HP) {
              this.hp++;
              this.events.push({ t: 'heal', lane });
            } else this.gain(who, lane, row, it.worth, false);
          } else {
            // bandit
            if (crosses(STRIKE_REACH)) {
              tile.state[i]--;
              const kill = tile.state[i] <= 0;
              this.events.push({ t: 'strike', who, lane, row, kill });
              if (kill) {
                this.kills++;
                // a kill you took part in is yours, even when a ghost lands the last blow
                this.gain(who >= 0 && this.lane === lane ? -1 : who, lane, row, it.worth, true);
              }
            }
            if (who < 0 && tile.state[i] > 0 && crosses(HIT_DIST)) this.hurt(lane);
          }
        }
      }
    }
  }

  private gain(who: number, lane: number, row: number, n: number, fromKill: boolean): void {
    this.coins += n;
    this.points += n * this.mult;
    if (who >= 0) this.ghostCoins += n;
    this.events.push({ t: 'coin', who, lane, row, n, fromKill });
  }

  private checkSpikes(): void {
    if (this.invuln > 0) return;
    for (let dd = 0; dd < DISTRICTS; dd++) {
      const tile = this.grid[dd][this.lane];
      if (tile.rune !== 'spikes') continue;
      for (const it of tile.items) {
        if (rel(this.p, dd * DROWS + it.off) <= it.len) {
          this.hurt(this.lane);
          return;
        }
      }
    }
  }

  private hurt(lane: number): void {
    if (this.invuln > 0 || this.over) return;
    this.hp--;
    this.invuln = INVULN;
    this.events.push({ t: 'hurt', lane });
    if (this.hp <= 0) {
      this.over = true;
      this.events.push({ t: 'over' });
    }
  }

  private leaveDistrict(dd: number): void {
    for (const t of this.grid[dd]) t.state = freshState(t, this.level());
  }

  private endLap(): void {
    this.echoes.push({ id: this.nextId++, path: this.path, seat: this.formations.seats[this.lap] });
    if (this.echoes.length > MAX_ECHOES) this.echoes.shift();
    this.lap++;
    if (this.lap % UPGRADE_EVERY === 0) this.upgrade();
    this.crossSeal();
    this.events.push({ t: 'lap', lap: this.lap, speed: this.speed(), echoes: this.echoes.length });
  }

  /**
   * The seal at the start of a lap: you and your ghosts stand in some lanes. Does that match the demand? An open seal in a
   * scoring lap extends the streak (bigger multiplier on this lap's coins, plus a bonus); a shut one halves this lap's coins.
   */
  private crossSeal(): void {
    const j = this.lap;
    const seat = this.lane;
    this.path = new Uint8Array(RING * BINS).fill(seat);
    this.formations.take(seat);
    const seats = this.formations.seats.slice(Math.max(0, j - REACH + 1), j + 1);
    const counts = countSeats(seats);
    const ok = meets(this.formations.demands[j], counts);
    const scoring = j >= SCORING_FROM;
    let bonus = 0;
    if (ok) this.sealsOpen++;
    else this.sealsShut++;
    this.history.push(ok);
    if (!scoring) {
      this.mult = 1;
      if (ok) bonus = 5;
    } else if (ok) {
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.mult = Math.min(MAX_MULT, 1 + 0.5 * this.streak);
      bonus = 10 + 5 * Math.min(this.streak, 10);
    } else {
      this.streak = 0;
      this.mult = SHUT_MULT;
    }
    this.points += bonus;
    this.events.push({ t: 'seal', lap: j, ok, scoring, counts, mult: this.mult, bonus, streak: this.streak, crowd: crowd(j) });
  }

  /** Every few laps one stretch of street turns worse (never two spike lanes in a district). */
  private upgrade(): void {
    const pool: Tile[] = [];
    for (let d = 0; d < DISTRICTS; d++) {
      const spikes = this.grid[d].filter((t) => t.rune === 'spikes').length;
      for (const t of this.grid[d]) {
        const next = HARDER[t.rune];
        if (next && !(next === 'spikes' && spikes >= 2)) pool.push(t);
      }
    }
    if (pool.length) {
      const t = this.rng.pick(pool);
      t.rune = HARDER[t.rune]!;
      this.events.push({ t: 'upgrade', id: t.id });
    }
    for (const row of this.grid) for (const t of row) this.refit(t);
  }
}
