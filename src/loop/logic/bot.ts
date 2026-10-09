// A simple lane-picking bot: used by the balance sim and as the "attract mode" player on the title screen.
import { rel, type Game } from './game';
import { DISTRICTS, DROWS, LANES, MAX_HP } from './types';

/** Value of standing in `lane` for the next `look` rows. */
export function laneValue(g: Game, lane: number, look: number): number {
  let v = 0;
  for (let dd = 0; dd < DISTRICTS; dd++) {
    const tile = g.grid[dd][lane];
    if (!tile) continue;
    tile.items.forEach((it, i) => {
      const row = dd * DROWS + it.off;
      if (it.kind === 'spike') {
        if (rel(g.p, row) <= it.len + 0.3 || rel(row, g.p) <= look) v -= 10;
        return;
      }
      if (tile.state[i] <= 0) return;
      const ahead = rel(row, g.p);
      if (ahead > look) return;
      if (it.kind === 'coin') v += 1;
      else if (it.kind === 'well') v += g.hp < MAX_HP ? 3 : 0.5;
      else if (it.kind === 'bandit') v += 1.5;
      else {
        // a brute only dies with two hitters in the lane at once: you plus at least one ghost
        const hitters = g.ghostsIn(lane, g.p + ahead) + 1;
        v += hitters >= tile.state[i] ? 2.5 : -10;
      }
    });
  }
  return v;
}

export function botLane(g: Game, look = 3.4): number {
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

/** Now and then slide something that is free to move (for show). */
export function botSlide(g: Game, rnd: () => number): void {
  const cells: { d: number; l: number }[] = [];
  for (let d = 0; d < DISTRICTS; d++) for (let l = 0; l < LANES; l++) if (g.grid[d][l] && g.slideCells(d, l)) cells.push({ d, l });
  if (cells.length) {
    const c = cells[Math.floor(rnd() * cells.length)];
    g.slide(c.d, c.l);
  }
}
