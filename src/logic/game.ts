import { Rng } from '../rng';
import { Spawner } from './spawner';
import { TOOLS, type ToolCtx } from './tools';
import type { CardInst, Cell, Colour, GameEvent, LevelDef, Pos, ToolId } from './types';

export const ROWS = 5;
export const COLS = 8;
export const ESCAPE_BONUS_PER_TICK = 5;

export type Phase = 'play' | 'lost' | 'escaped';

export interface EscapeResult {
  bonus: number;
  final: number;
  stars: number;
}

// Pure rules of one creature ("level"). No rendering in here.
export class GutGame implements ToolCtx {
  readonly rows = ROWS;
  readonly cols = COLS;
  grid: (Cell | null)[][] = [];
  incoming: (Cell | null)[] = [];
  deck: CardInst[] = [];
  hand: CardInst[] = [];
  discard: CardInst[] = [];
  energy: number;
  digest = 0;
  turn = 1;
  score = 0;
  infection: number[] = [0, 0, 0, 0];
  phase: Phase = 'play';
  lossReason: 'sick' | 'digested' | null = null;
  result: EscapeResult | null = null;

  private rng: Rng;
  private spawner: Spawner;
  private nextId = 1;
  private nextUid = 1;

  constructor(
    readonly level: LevelDef,
    readonly seed: number,
  ) {
    this.rng = new Rng(seed);
    this.spawner = new Spawner(this.rng, ROWS, level.spawn);
    this.energy = level.maxEnergy;
    for (let r = 0; r < ROWS; r++) this.grid.push(new Array<Cell | null>(COLS).fill(null));

    // Pre-fill the belly: first spawned column ends up furthest right.
    for (let i = level.initialColumns - 1; i >= 0; i--) {
      this.spawner.nextColumn().forEach((s, r) => {
        this.grid[r][i] = s ? { id: this.nextId++, ...s } : null;
      });
    }
    this.incoming = this.makeIncoming();

    this.deck = this.rng.shuffle(level.deck.map((tool) => ({ uid: this.nextUid++, tool })));
    this.draw();
  }

  at(r: number, c: number): Cell | null {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
    return this.grid[r][c];
  }

  private makeIncoming(): (Cell | null)[] {
    return this.spawner.nextColumn().map((s) => (s ? { id: this.nextId++, ...s } : null));
  }

  private draw(): void {
    while (this.hand.length < this.level.handSize) {
      if (this.deck.length === 0) {
        this.deck = this.rng.shuffle(this.discard);
        this.discard = [];
      }
      const card = this.deck.pop();
      if (!card) break;
      this.hand.push(card);
    }
  }

  cost(handIndex: number): number {
    return TOOLS[this.hand[handIndex].tool].cost;
  }

  canPlay(handIndex: number): boolean {
    return this.phase === 'play' && !!this.hand[handIndex] && this.cost(handIndex) <= this.energy;
  }

  /** Cells a tool would affect at (r,c); empty = invalid. */
  area(tool: ToolId, r: number, c: number): Pos[] {
    return TOOLS[tool].area(this, r, c);
  }

  /** Is there any valid target for this tool anywhere on the board? */
  hasTarget(tool: ToolId): boolean {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) if (this.area(tool, r, c).length) return true;
    return false;
  }

  /** True when the player cannot do anything useful any more this turn. */
  noMovesLeft(): boolean {
    return !this.hand.some((card, i) => this.canPlay(i) && this.hasTarget(card.tool));
  }

  play(handIndex: number, r: number, c: number): GameEvent[] | null {
    if (!this.canPlay(handIndex)) return null;
    const card = this.hand[handIndex];
    const cells = this.area(card.tool, r, c);
    if (!cells.length) return null;

    const ev: GameEvent[] = [];
    this.energy -= TOOLS[card.tool].cost;
    this.hand.splice(handIndex, 1);
    this.discard.push(card);

    switch (card.tool) {
      case 'pick':
      case 'zapper': {
        const gems: { cell: Cell; p: Pos }[] = [];
        for (const p of cells) {
          const cell = this.grid[p.r][p.c]!;
          this.grid[p.r][p.c] = null;
          if (cell.kind === 'gem') gems.push({ cell, p });
          else ev.push({ t: 'kill', id: cell.id, r: p.r, c: p.c, kind: cell.kind, colour: cell.colour });
        }
        this.collect(gems, ev);
        break;
      }
      case 'net': {
        const gems: { cell: Cell; p: Pos }[] = [];
        for (const p of cells) {
          const cell = this.grid[p.r][p.c];
          if (cell && cell.kind === 'gem') {
            this.grid[p.r][p.c] = null;
            gems.push({ cell, p });
          }
        }
        this.collect(gems, ev);
        break;
      }
      case 'shove': {
        const cell = this.grid[r][c]!;
        this.grid[r][c] = null;
        this.grid[r][c - 1] = cell;
        ev.push({ t: 'move', id: cell.id, r, fromC: c, toC: c - 1 });
        break;
      }
    }
    return ev;
  }

  private collect(gems: { cell: Cell; p: Pos }[], ev: GameEvent[]): void {
    if (!gems.length) return;
    const n = gems.length;
    for (const { cell, p } of gems) ev.push({ t: 'collect', id: cell.id, r: p.r, c: p.c, colour: cell.colour });
    let pts = 10 * n + (5 * n * (n - 1)) / 2;
    let label = n >= 2 ? `${n} GEMS` : '';
    if (n >= 2 && gems.every((g) => g.cell.colour === gems[0].cell.colour)) {
      pts *= 2;
      label = 'SET X2!';
    }
    this.score += pts;
    const mid = gems[Math.floor(n / 2)].p;
    ev.push({ t: 'score', pts, label, r: mid.r, c: mid.c });
  }

  canEscape(): boolean {
    return this.phase === 'play' && this.score >= this.level.quota;
  }

  escape(): EscapeResult | null {
    if (!this.canEscape()) return null;
    const bonus = (this.level.digestMax - this.digest) * ESCAPE_BONUS_PER_TICK;
    const final = this.score + bonus;
    const [two, three] = this.level.stars;
    const stars = final >= three ? 3 : final >= two ? 2 : 1;
    this.phase = 'escaped';
    this.result = { bonus, final, stars };
    return this.result;
  }

  /** End of turn: the belly contracts and everything moves one step towards the acid. */
  squeeze(): GameEvent[] {
    if (this.phase !== 'play') return [];
    const ev: GameEvent[] = [];
    const lastCol = COLS - 1;

    // 1. whatever reaches the acid
    for (let r = 0; r < ROWS; r++) {
      const cell = this.grid[r][lastCol];
      if (!cell) continue;
      this.grid[r][lastCol] = null;
      ev.push({ t: 'advance', id: cell.id, r, fromC: lastCol, toC: COLS });
      ev.push({ t: 'acid', id: cell.id, r, kind: cell.kind, colour: cell.colour });
      if (cell.kind === 'bug') {
        const level = ++this.infection[cell.colour];
        ev.push({ t: 'infect', colour: cell.colour as Colour, level });
      }
    }
    // 2. shift the rest
    for (let c = lastCol - 1; c >= 0; c--) {
      for (let r = 0; r < ROWS; r++) {
        const cell = this.grid[r][c];
        if (!cell) continue;
        this.grid[r][c + 1] = cell;
        this.grid[r][c] = null;
        ev.push({ t: 'advance', id: cell.id, r, fromC: c, toC: c + 1 });
      }
    }
    // 3. the preview column drops in, a new one is shown
    for (let r = 0; r < ROWS; r++) {
      const cell = this.incoming[r];
      if (!cell) continue;
      this.grid[r][0] = cell;
      ev.push({ t: 'advance', id: cell.id, r, fromC: -1, toC: 0 });
    }
    this.incoming = this.makeIncoming();
    this.incoming.forEach((cell, r) => {
      if (cell) ev.push({ t: 'incoming', id: cell.id, r, kind: cell.kind, colour: cell.colour });
    });

    // 4. clocks
    this.digest++;
    this.turn++;
    if (this.infection.some((v) => v >= this.level.infectionMax)) {
      this.phase = 'lost';
      this.lossReason = 'sick';
      ev.push({ t: 'lost', reason: 'sick' });
    } else if (this.digest >= this.level.digestMax) {
      this.phase = 'lost';
      this.lossReason = 'digested';
      ev.push({ t: 'lost', reason: 'digested' });
    }

    // 5. new hand
    this.discard.push(...this.hand);
    this.hand = [];
    this.energy = this.level.maxEnergy;
    if (this.phase === 'play') this.draw();
    return ev;
  }
}
