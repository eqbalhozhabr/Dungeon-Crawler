// Formations: what the seal at the start of every lap asks for. At the moment you cross the seal, every runner on the
// ring (you and up to three ghosts of your last laps) stands in some lane, and the number of runners per lane has to match.
// A demand says, per lane, how many runners may stand there. The demand for every lap is made in advance from a hidden
// "intended" path and shown 4 laps ahead, so the player can plan which lane to leave behind as a ghost.
import { LANES } from './types';
import type { Rng } from '../../rng';

/** "Any number" upper bound. */
export const ANY = 9;

export interface Need {
  lo: number;
  hi: number;
}
export type Demand = Need[];

export const exactly = (k: number): Need => ({ lo: k, hi: k });
export const FREE: Need = { lo: 0, hi: ANY };

export function countSeats(seats: readonly number[]): number[] {
  const c = new Array<number>(LANES).fill(0);
  for (const s of seats) c[s]++;
  return c;
}

export function meets(d: Demand, c: readonly number[]): boolean {
  return d.every((n, i) => c[i] >= n.lo && c[i] <= n.hi);
}

/** How many runners stand at the seal at crossing number `lap` (you plus the ghosts you will have by then). */
export const crowd = (lap: number, maxGhosts = 3): number => Math.min(lap, maxGhosts) + 1;

/**
 * Demand made from what the intended seats really give. `reveal` lanes (1..3) are asked exactly; the rest are left open
 * ("*"), or, when `soft` is set and the lane really has runners, relaxed to "at least one". With all lanes exact the seat
 * you must take is obvious from the ghosts you have; with fewer it is not, and you have to plan.
 */
export function makeDemand(real: readonly number[], rng: Rng, reveal: number, soft = 0): Demand {
  const order = rng.shuffle([0, 1, 2]);
  const shown = new Set(order.slice(0, Math.max(1, Math.min(LANES, reveal))));
  return real.map((k, i) => {
    if (shown.has(i)) return exactly(k);
    if (k >= 1 && rng.chance(soft)) return { lo: 1, hi: ANY };
    return { ...FREE };
  });
}

export function describeNeed(n: Need): string {
  if (n.lo === n.hi) return n.lo === 0 ? 'X' : String(n.lo);
  if (n.lo === 0 && n.hi >= ANY) return '*';
  return `${n.lo}+`;
}

/** Ghosts live this many laps, so a seat you leave behind is part of the next 4 formations (including this one). */
export const REACH = 4;

/** How many lanes of a demand are asked exactly, by the lap it is for: first laps are obvious, later ones leave room to plan. */
export function revealFor(j: number, rng: Rng): number {
  if (j < 2) return 3;
  if (j === 2) return 2;
  return rng.chance(0.75) ? 1 : 2;
}

/**
 * The book of formations: demand D_j is for the seal at the start of lap j. Seat s_j is the lane you stand in when you cross
 * it; you leave it behind as a ghost for the next 3 laps, so it counts in D_j .. D_(j+3). Demands are announced 4 laps ahead.
 * Each new demand is made from a completion of the seats not yet taken that satisfies every demand already announced,
 * so a player who always takes a seat that fits all announced demands can never be cornered.
 */
export class Formations {
  /** Seats taken so far (s_0..). */
  readonly seats: number[] = [];
  readonly demands: Demand[] = [];

  constructor(private readonly rng: Rng) {
    const first = Array.from({ length: REACH }, () => rng.int(LANES));
    for (let j = 0; j < REACH; j++) this.demands.push(makeDemand(countSeats(first.slice(Math.max(0, j - REACH + 1), j + 1)), rng, revealFor(j, rng), 0.3));
  }

  /** Runners standing at the seal of lap j given `seats` (committed ones plus guesses). */
  private window(all: readonly number[], j: number): number[] {
    return all.slice(Math.max(0, j - REACH + 1), j + 1);
  }

  /** Number of announced demands (from lap `from`) a full assignment of seats satisfies. */
  private score(all: readonly number[], from: number): number {
    let ok = 0;
    for (let j = from; j < this.demands.length; j++) if (meets(this.demands[j], countSeats(this.window(all, j)))) ok++;
    return ok;
  }

  /** Can the seat for lap `j` be `seat` so that all announced demands (this lap's and the next ones) can still be met? */
  fits(seat: number, j = this.seats.length): boolean {
    return this.completions(seat, j).length > 0;
  }

  /** All ways to fill the seats after `seat` (laps j+1..j+3) that satisfy every announced demand from lap j on. */
  completions(seat: number, j: number): number[][] {
    const out: number[][] = [];
    const base = [...this.seats.slice(0, j), seat];
    const last = this.demands.length;
    for (let a = 0; a < LANES; a++)
      for (let b = 0; b < LANES; b++)
        for (let c = 0; c < LANES; c++) {
          const all = [...base, a, b, c];
          if (this.score(all, j) === last - j) out.push([a, b, c]);
        }
    return out;
  }

  /** Take the seat for the lap that is starting (you stood in lane `seat` at the seal) and announce one more demand. */
  take(seat: number): void {
    const j = this.seats.length;
    this.seats.push(seat);
    // choose the future seats so that as many announced demands as possible hold (all of them if you kept to the plan)
    const base = [...this.seats];
    let best: number[][] = [];
    let bs = -1;
    for (let a = 0; a < LANES; a++)
      for (let b = 0; b < LANES; b++)
        for (let c = 0; c < LANES; c++) {
          const s = this.score([...base, a, b, c], j + 1);
          if (s > bs) {
            bs = s;
            best = [];
          }
          if (s === bs) best.push([a, b, c]);
        }
    const pick = this.rng.pick(best);
    const all = [...base, ...pick, this.rng.int(LANES)];
    const next = this.demands.length;
    this.demands.push(makeDemand(countSeats(this.window(all, next)), this.rng, revealFor(next, this.rng), 0.3));
  }
}
