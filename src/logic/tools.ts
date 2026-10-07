import type { Cell, Pos, ToolId } from './types';

export interface ToolCtx {
  rows: number;
  cols: number;
  at(r: number, c: number): Cell | null;
}

export interface ToolDef {
  id: ToolId;
  name: string;
  cost: number;
  hint: string;
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
    area: (ctx, r, c) => (ctx.at(r, c) ? [{ r, c }] : []),
  },
  zapper: {
    id: 'zapper',
    name: 'Zapper',
    cost: 1,
    hint: 'Zapper: kills a whole bug colony.',
    area: (ctx, r, c) => floodBugs(ctx, r, c),
  },
  net: {
    id: 'net',
    name: 'Net',
    cost: 2,
    hint: 'Net: scoops all gems in a 2x2 area.',
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
    area: (ctx, r, c) => (ctx.at(r, c) && c > 0 && !ctx.at(r, c - 1) ? [{ r, c }] : []),
  },
};
