// Alley Echo rules. No rendering here: the game, the sim and the rule checks all drive this class.
import { Rng } from '../../rng';
import { freshState, HARDER, isBlocked, itemsFor } from './runes';
import {
  BINS,
  DISTRICTS,
  DROWS,
  HEAT_AFTER_GUARDS,
  HEAT_MAX,
  LANES,
  MAX_ECHOES,
  MAX_HP,
  RING,
  type Echo,
  type GameEvent,
  type RuneId,
  type Tile,
} from './types';

const STRIKE_REACH = 1.0; // you swing at anything in your lane this close ahead (automatic)
const HIT_DIST = 0.15; // a living enemy this close hurts you
const GRAB_DIST = 0.3;
const START_DELAY = 1.2;
const INVULN = 1.1;
const TREMOR_EVERY = 3;
/** A district is locked for sliding while you run through it, and in the last rows before you reach it. */
const LOCK_AHEAD = 3;
/** Seconds to shift one lane. Input is buffered (you steer towards `want`), so taps are never lost, but one runner cannot be everywhere. */
const LANE_STEP = 0.2;
const SUBSTEP = 0.2;

/** Rows ahead of `p` (0 = here), wrapping round the ring. */
export const rel = (q: number, p: number): number => (((q - p) % RING) + RING) % RING;

export interface Cell {
  d: number;
  l: number;
}

export class Game {
  readonly rng: Rng;
  grid: (Tile | null)[][] = [];
  hole: Cell = { d: 0, l: 0 };
  p = 0;
  lap = 0;
  time = 0;
  delay = START_DELAY;
  lane = 1;
  /** The lane you are steering towards. */
  want = 1;
  hp = MAX_HP;
  coins = 0;
  ghostCoins = 0;
  kills = 0;
  slides = 0;
  invuln = 0;
  heat = 0;
  over = false;
  echoes: Echo[] = [];
  path = new Uint8Array(RING * BINS).fill(1);
  events: GameEvent[] = [];
  private nextId = 1;
  private laneCool = 0;

  constructor(readonly seed: number) {
    this.rng = new Rng(seed);
    this.build();
  }

  // ---------------------------------------------------------------- setup
  private level(): number {
    return Math.floor(this.lap / TREMOR_EVERY);
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

  private build(): void {
    const runes: RuneId[] = ['coin', 'coin', 'bandit', 'bandit', 'brute', 'spikes', 'spikes', 'fountain'];
    for (let tries = 0; tries < 500; tries++) {
      this.rng.shuffle(runes);
      const hole = this.rng.int(9);
      const cells: (RuneId | null)[] = [];
      let k = 0;
      for (let i = 0; i < 9; i++) cells.push(i === hole ? null : runes[k++]);
      // every district keeps one safe lane at the start (no more than one blocker per district)
      let good = true;
      for (let d = 0; d < DISTRICTS && good; d++) {
        let blocked = 0;
        for (let l = 0; l < LANES; l++) {
          const r = cells[d * LANES + l];
          if (r && isBlocked(r)) blocked++;
        }
        if (blocked > 1) good = false;
      }
      if (!good) continue;
      this.grid = [];
      for (let d = 0; d < DISTRICTS; d++) {
        const row: (Tile | null)[] = [];
        for (let l = 0; l < LANES; l++) {
          const r = cells[d * LANES + l];
          if (r === null) this.hole = { d, l };
          row.push(r === null ? null : this.makeTile(r));
        }
        this.grid.push(row);
      }
      return;
    }
    throw new Error('could not build a starting alley');
  }

  // ---------------------------------------------------------------- queries
  get score(): number {
    return this.coins + this.lap * 5;
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

  isLocked(d: number): boolean {
    const cur = this.district();
    if (d === cur) return true;
    if (d === (cur + 1) % DISTRICTS && DROWS - (this.p % DROWS) < LOCK_AHEAD) return true;
    return false;
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

  /** Cells that would shift if the player taps (d,l), or null when not allowed. The hole ends up at the tapped cell. */
  slideCells(d: number, l: number): Cell[] | null {
    if (this.over || !this.grid[d]?.[l]) return null;
    const h = this.hole;
    const chain: Cell[] = [{ d: h.d, l: h.l }];
    if (d === h.d) {
      const s = Math.sign(l - h.l);
      for (let x = h.l + s; ; x += s) {
        chain.push({ d, l: x });
        if (x === l) break;
      }
    } else if (l === h.l) {
      const s = Math.sign(d - h.d);
      for (let y = h.d + s; ; y += s) {
        chain.push({ d: y, l });
        if (y === d) break;
      }
    } else return null;
    if (chain.some((c) => this.isLocked(c.d))) return null;
    return chain;
  }

  slide(d: number, l: number): boolean {
    const chain = this.slideCells(d, l);
    if (!chain) return false;
    for (let i = 1; i < chain.length; i++) this.grid[chain[i - 1].d][chain[i - 1].l] = this.grid[chain[i].d][chain[i].l];
    const last = chain[chain.length - 1];
    this.grid[last.d][last.l] = null;
    this.hole = { d: last.d, l: last.l };
    this.slides++;
    this.events.push({ t: 'slide' });
    return true;
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
      return;
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
    this.path[Math.floor(this.p * BINS) % (RING * BINS)] = this.lane;
    this.interact(p0, d);
    this.checkSpikes();
    if (this.over) return;
    const d0 = Math.floor(p0 / DROWS);
    if (d0 !== Math.floor(this.p / DROWS)) this.leaveDistrict(d0);
    if (this.over) return;
    if (raw >= RING) this.endLap();
  }

  private interact(p0: number, d: number): void {
    // who: -1 = you, 0.. = ghost index. You go first, so you get the credit when you share a lane.
    for (let who = -1; who < this.echoes.length; who++) {
      const lane = who < 0 ? this.lane : this.echoLane(who);
      for (let dd = 0; dd < DISTRICTS; dd++) {
        const tile = this.grid[dd][lane];
        if (!tile) continue;
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
            // bandit or brute
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
    if (who >= 0) this.ghostCoins += n;
    this.events.push({ t: 'coin', who, lane, row, n, fromKill });
  }

  private checkSpikes(): void {
    if (this.invuln > 0) return;
    for (let dd = 0; dd < DISTRICTS; dd++) {
      const tile = this.grid[dd][this.lane];
      if (!tile || tile.rune !== 'spikes') continue;
      for (const it of tile.items) {
        if (rel(this.p, dd * DROWS + it.off) <= it.len) {
          this.hurt(this.lane);
          return;
        }
      }
    }
  }

  private hurt(lane: number, force = false): void {
    if ((this.invuln > 0 && !force) || this.over) return;
    this.hp--;
    this.invuln = INVULN;
    this.events.push({ t: 'hurt', lane });
    if (this.hp <= 0) {
      this.over = true;
      this.events.push({ t: 'over' });
    }
  }

  private leaveDistrict(dd: number): void {
    let survivors = 0;
    let hadFoes = false;
    for (let l = 0; l < LANES; l++) {
      const t = this.grid[dd][l];
      if (!t) continue;
      let foe = false;
      let alive = false;
      t.items.forEach((it, i) => {
        if (it.kind !== 'bandit' && it.kind !== 'brute') return;
        foe = true;
        if (t.state[i] > 0) alive = true;
      });
      if (foe) hadFoes = true;
      if (alive) survivors++;
      t.state = freshState(t, this.level());
    }
    // foes left alive raise the alert; sweeping a district that had foes calms it
    const before = this.heat;
    if (survivors > 0) this.heat += survivors;
    else if (hadFoes) this.heat = Math.max(0, this.heat - 1);
    if (this.heat !== before) this.events.push({ t: 'heat', heat: this.heat, survivors });
    if (this.heat >= HEAT_MAX) {
      this.heat = HEAT_AFTER_GUARDS;
      this.events.push({ t: 'guards' });
      this.hurt(this.lane, true);
    }
  }

  /** True when a foe tile has no ghost running through its lane at the foe's row (so it will probably survive). */
  uncovered(d: number, l: number): boolean {
    const t = this.grid[d][l];
    if (!t) return false;
    let foes = false;
    for (const it of t.items) {
      if (it.kind !== 'bandit' && it.kind !== 'brute') continue;
      foes = true;
      if (this.ghostsIn(l, d * DROWS + it.off) > 0) return false;
    }
    return foes;
  }

  private endLap(): void {
    this.echoes.push({ id: this.nextId++, path: this.path });
    if (this.echoes.length > MAX_ECHOES) this.echoes.shift();
    this.path = new Uint8Array(RING * BINS).fill(this.lane);
    this.lap++;
    if (this.lap % TREMOR_EVERY === 0) this.tremor();
    this.events.push({ t: 'lap', lap: this.lap, speed: this.speed(), echoes: this.echoes.length });
  }

  /** Every third lap the alley gets worse and one tile shakes loose. */
  private tremor(): void {
    const harder: Tile[] = [];
    const neighbours: Cell[] = [];
    for (let d = 0; d < DISTRICTS; d++)
      for (let l = 0; l < LANES; l++) {
        const t = this.grid[d][l];
        if (t && HARDER[t.rune] && !this.isLocked(d)) harder.push(t);
        if (t && Math.abs(d - this.hole.d) + Math.abs(l - this.hole.l) === 1 && this.slideCells(d, l)) neighbours.push({ d, l });
      }
    if (harder.length) {
      const t = this.rng.pick(harder);
      t.rune = HARDER[t.rune]!;
      this.events.push({ t: 'upgrade', id: t.id });
    }
    for (const row of this.grid) for (const t of row) if (t) this.refit(t);
    if (neighbours.length) {
      const c = this.rng.pick(neighbours);
      this.slide(c.d, c.l);
      this.slides--; // a tremor is not the player's move
      this.events.push({ t: 'tremor' });
    }
  }
}
