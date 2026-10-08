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
  /** Utility cards do not count as "a move left" when deciding whether the turn is over. */
  utility?: boolean;
  /** Tiny tag shown on the card face. */
  tag: string;
  /** Three short lines for the card face (10 characters each at most). */
  face: [string, string, string];
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
    tag: 'GRAB',
    face: ['GRAB GEM','OR SMASH','A BUG'],
    hint: 'Pick: grab one gem or smash one bug.',
    blurb: ['GRAB A GEM OR', 'SMASH A BUG'],
    area: (ctx, r, c) => (ctx.at(r, c) ? [{ r, c }] : []),
  },
  zapper: {
    id: 'zapper',
    name: 'Zapper',
    cost: 1,
    tag: 'KILL',
    face: ['ZAP A BUG','AND ITS','COLONY'],
    hint: 'Zapper: kills a whole bug colony.',
    blurb: ['KILLS A WHOLE', 'BUG COLONY'],
    area: (ctx, r, c) => floodBugs(ctx, r, c),
  },
  net: {
    id: 'net',
    name: 'Net',
    cost: 2,
    tag: 'AREA',
    face: ['SCOOP ALL','GEMS IN','A 2X2'],
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
    tag: 'PUSH',
    face: ['PUSH ONE','ITEM BACK','A STEP'],
    hint: 'Shove: push an item back one step.',
    blurb: ['PUSHES AN ITEM', 'BACK ONE STEP'],
    area: (ctx, r, c) => (ctx.at(r, c) && c > 0 && !ctx.at(r, c - 1) ? [{ r, c }] : []),
  },
  magnet: {
    id: 'magnet',
    name: 'Magnet',
    cost: 2,
    tag: 'GRAB',
    face: ['PULL 3','GEMS OF','1 COLOUR'],
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
    tag: 'SWEEP',
    face: ['SWEEP A','WHOLE','LANE'],
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
    name: 'Cure',
    cost: 2,
    tag: 'SELF',
    face: ['CURE ONE','INFECTION','PIP'],
    hint: 'Cure: removes one infection pip.',
    blurb: ['CURES ONE PIP OF', 'YOUR WORST INFECTION'],
    self: true,
    area: () => [],
  },
  lantern: {
    id: 'lantern',
    name: 'Lantern',
    cost: 1,
    hint: 'Lantern: +2 reach until you squeeze.',
    blurb: ['REACH 2 COLUMNS', 'FURTHER THIS TURN'],
    tag: 'SELF',
    face: ['REACH +2','COLUMNS','THIS TURN'],
    self: true,
    utility: true,
    area: () => [],
  },
  glue: {
    id: 'glue',
    name: 'Glue',
    cost: 1,
    hint: 'Glue: a bug stays put at the next squeeze.',
    blurb: ['A BUG STAYS PUT', 'AT THE NEXT SQUEEZE'],
    tag: 'STICK',
    face: ['A BUG','STAYS PUT','1 SQUEEZE'],
    area: (ctx, r, c) => {
      const t = ctx.at(r, c);
      return t && t.kind === 'bug' && !t.stuck ? [{ r, c }] : [];
    },
  },
  spray: {
    id: 'spray',
    name: 'Spray',
    cost: 2,
    hint: 'Spray: kills every bug of one colour.',
    blurb: ['KILLS EVERY BUG', 'OF ONE COLOUR'],
    tag: 'KILL',
    face: ['KILL ALL','BUGS OF','1 COLOUR'],
    area: (ctx, r, c) => {
      const t = ctx.at(r, c);
      if (!t || t.kind !== 'bug') return [];
      const out: Pos[] = [];
      for (let rr = 0; rr < ctx.rows; rr++)
        for (let cc = ctx.minCol; cc < ctx.cols; cc++) {
          const cell = ctx.at(rr, cc);
          if (cell && cell.kind === 'bug' && cell.colour === t.colour) out.push({ r: rr, c: cc });
        }
      return out;
    },
  },
  forage: {
    id: 'forage',
    name: 'Forage',
    cost: 0,
    hint: 'Forage: draw 2 cards. Free.',
    blurb: ['DRAW 2 CARDS', 'IT COSTS NOTHING'],
    tag: 'SELF',
    face: ['DRAW','2 MORE','CARDS'],
    self: true,
    utility: true,
    area: () => [],
  },
  adrenaline: {
    id: 'adrenaline',
    name: 'Rush',
    cost: 0,
    hint: 'Rush: +2 energy now, but digestion +1.',
    blurb: ['+2 ENERGY NOW', 'DIGESTION +1 STEP'],
    tag: 'SELF',
    face: ['+2 ENERGY','DIGESTION','+1 STEP'],
    self: true,
    utility: true,
    area: () => [],
  },
  dynamite: {
    id: 'dynamite',
    name: 'Blast',
    cost: 3,
    hint: 'Blast: clears a 3x3 area (costs 3).',
    blurb: ['BLASTS A 3X3 AREA:', 'GEMS TAKEN, BUGS DEAD'],
    tag: 'AREA',
    face: ['BLAST A','3X3 AREA','CLEAN'],
    area: (ctx, r, c) => {
      const out: Pos[] = [];
      let any = false;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || rr >= ctx.rows || cc < 0 || cc >= ctx.cols) continue;
          out.push({ r: rr, c: cc });
          if (ctx.at(rr, cc)) any = true;
        }
      return any ? out : [];
    },
  },
};
