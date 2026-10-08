import type { Cell, Pos, ToolId } from './types';

export interface ToolCtx {
  rows: number;
  cols: number;
  /** Leftmost column the player can reach (columns further from the acid are out of reach). */
  minCol: number;
  at(r: number, c: number): Cell | null;
}

export interface ToolDef {
  id: ToolId;
  name: string;
  cost: number;
  hint: string;
  /** Two short lines for the reward screen. */
  blurb: [string, string];
  /** Self-targeted tools need no board target (played straight from the hand). */
  self?: boolean;
  /** Cells affected when the player targets (r,c); empty array = invalid target. */
  area(ctx: ToolCtx, r: number, c: number): Pos[];
}

function floodBugs(ctx: ToolCtx, r: number, c: number): Pos[] {
  const start = ctx.at(r, c);
  if (!start || start.kind !== 'bug') return [];
  const out: Pos[] = [];
  const seen = new Set<number>();
  const stack: Pos[] = [{ r, c }];
  while (stack.length) {
    const p = stack.pop()!;
    const key = p.r * 100 + p.c;
    if (seen.has(key)) continue;
    seen.add(key);
    const cell = ctx.at(p.r, p.c);
    if (!cell || cell.kind !== 'bug' || cell.colour !== start.colour) continue;
    out.push(p);
    stack.push({ r: p.r + 1, c: p.c }, { r: p.r - 1, c: p.c }, { r: p.r, c: p.c + 1 }, { r: p.r, c: p.c - 1 });
  }
  return out;
}

export function netAnchor(ctx: ToolCtx, r: number, c: number): Pos {
  return { r: Math.min(r, ctx.rows - 2), c: Math.min(c, ctx.cols - 2) };
}

export const TOOLS: Record<ToolId, ToolDef> = {
  pick: {
    id: 'pick',
    name: 'Pick',
    cost: 1,
    hint: 'Pick: grab one gem or smash one bug.',
    blurb: ['GRAB A GEM OR', 'SMASH A BUG'],
    area: (ctx, r, c) => (ctx.at(r, c) ? [{ r, c }] : []),
  },
  zapper: {
    id: 'zapper',
    name: 'Zapper',
    cost: 1,
    hint: 'Zapper: kills a whole bug colony.',
    blurb: ['KILLS A WHOLE', 'BUG COLONY'],
    area: (ctx, r, c) => floodBugs(ctx, r, c),
  },
  net: {
    id: 'net',
    name: 'Net',
    cost: 2,
    hint: 'Net: scoops all gems in a 2x2 area.',
    blurb: ['SCOOPS ALL GEMS', 'IN A 2X2 AREA'],
    area: (ctx, r, c) => {
      const a = netAnchor(ctx, r, c);
      const cells: Pos[] = [];
      for (let dr = 0; dr < 2; dr++) for (let dc = 0; dc < 2; dc++) cells.push({ r: a.r + dr, c: a.c + dc });
      return cells.some((p) => ctx.at(p.r, p.c)?.kind === 'gem') ? cells : [];
    },
  },
  shove: {
    id: 'shove',
    name: 'Shove',
    cost: 1,
    hint: 'Shove: push an item back one step.',
    blurb: ['PUSHES AN ITEM', 'BACK ONE STEP'],
    area: (ctx, r, c) => (ctx.at(r, c) && c > 0 && !ctx.at(r, c - 1) ? [{ r, c }] : []),
  },
  magnet: {
    id: 'magnet',
    name: 'Magnet',
    cost: 2,
    hint: 'Magnet: pulls 3 gems of one colour.',
    blurb: ['PULLS 3 GEMS OF', 'THE SAME COLOUR'],
    area: (ctx, r, c) => {
      const t = ctx.at(r, c);
      if (!t || t.kind !== 'gem') return [];
      const others: Pos[] = [];
      for (let rr = 0; rr < ctx.rows; rr++)
        for (let cc = ctx.minCol; cc < ctx.cols; cc++) {
          const cell = ctx.at(rr, cc);
          if (cell && cell.kind === 'gem' && cell.colour === t.colour && !(rr === r && cc === c)) others.push({ r: rr, c: cc });
        }
      others.sort((a, b) => b.c - a.c || a.r - b.r); // closest to the acid first
      return [{ r, c }, ...others.slice(0, 2)];
    },
  },
  broom: {
    id: 'broom',
    name: 'Broom',
    cost: 2,
    hint: 'Broom: sweeps a whole lane clean.',
    blurb: ['SWEEPS A WHOLE', 'LANE CLEAN'],
    area: (ctx, r) => {
      const out: Pos[] = [];
      for (let c = ctx.minCol; c < ctx.cols; c++) if (ctx.at(r, c)) out.push({ r, c });
      return out;
    },
  },
  antidote: {
    id: 'antidote',
    name: 'Antidote',
    cost: 2,
    hint: 'Antidote: cures one infection pip.',
    blurb: ['CURES ONE PIP OF', 'YOUR WORST INFECTION'],
    self: true,
    area: () => [],
  },
};
