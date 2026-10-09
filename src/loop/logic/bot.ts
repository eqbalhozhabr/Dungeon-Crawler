// A simple lane-picking bot: used by the balance sim and as the "attract mode" player on the title screen.
import { rel, type Game } from './game';
import { DISTRICTS, DROWS, LANES, MAX_HP, RING } from './types';

/** Value of standing in `lane` for the next `look` rows (coins, thieves, wells good; spikes bad). */
export function laneValue(g: Game, lane: number, look: number): number {
  let v = 0;
  for (let dd = 0; dd < DISTRICTS; dd++) {
    const tile = g.grid[dd][lane];
    tile.items.forEach((it, i) => {
      const row = dd * DROWS + it.off;
      if (it.kind === 'spike') {
        if (rel(g.p, row) <= it.len + 0.3 || rel(row, g.p) <= look) v -= 10;
        return;
      }
      if (tile.state[i] <= 0) return;
      const ahead = rel(row, g.p);
      if (ahead > look) return;
      // a thief is struck 1 row before you reach it: joining its lane later than that means it hits you
      if (it.kind === 'bandit' && ahead < 1.4 && lane !== g.lane) {
        v -= 10;
        return;
      }
      if (it.kind === 'coin') v += 1;
      else if (it.kind === 'well') v += g.hp < MAX_HP ? 3 : 0.5;
      else v += 1.5;
    });
  }
  return v;
}

/**
 * Lane to run in. `plan` makes the bot also take, for the seal at the end of the lap, a seat that fits every announced
 * demand (the last stretch of each district is open street, so it can change lane freely before the seal).
 */
export function botLane(g: Game, look = 3.4, plan = false): number {
  look += 0.4 * g.speed(); // a lane takes 0.2 s to cross: look further the faster the street goes
  const atSeal = g.formations.seats.length === 0 || (rel(0, g.p) < 3.8 && g.p > RING / 2);
  if (plan && atSeal) {
    const fits = [0, 1, 2].filter((s) => g.formations.fits(s, g.formations.seats.length));
    if (fits.length) return fits.includes(g.want) ? g.want : fits[0];
  }
  let best = g.lane;
  let bv = laneValue(g, g.lane, look) + 0.4;
  for (let l = 0; l < LANES; l++) {
    const v = laneValue(g, l, look);
    if (v > bv) {
      bv = v;
      best = l;
    }
  }
  return best;
}

export const distanceToSeal = (g: Game): number => (RING - g.p) % RING;
