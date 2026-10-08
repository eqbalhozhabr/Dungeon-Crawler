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
  /** Extra columns of reach until the next squeeze (Lantern). */
  reachBonus = 0;
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
    this.markStuck([]); // slime: some bugs are already sticky on turn 1
  }

  get minCol(): number {
    return Math.max(0, COLS - (this.level.reach + this.reachBonus));
  }

  at(r: number, c: number): Cell | null {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
    return this.grid[r][c];
  }

  private makeIncoming(): (Cell | null)[] {
    return this.spawner.nextColumn().map((s) => (s ? { id: this.nextId++, ...s } : null));
  }

  private draw(): void {
    while (this.hand.length < this.level.handSize) if (!this.drawOne()) break;
  }

  private drawOne(): boolean {
    if (this.deck.length === 0) {
      this.deck = this.rng.shuffle(this.discard);
      this.discard = [];
    }
    const card = this.deck.pop();
    if (!card) return false;
    this.hand.push(card);
    return true;
  }

  /** Turns until the creature's quirk fires (0 = at the next squeeze). */
  quirkIn(): number | null {
    const { quirk, quirkEvery } = this.level;
    if (quirk !== 'hiccup' && quirk !== 'burp') return null;
    const r = this.turn % quirkEvery;
    return r === 0 ? 0 : quirkEvery - r;
  }

  cost(handIndex: number): number {
    return TOOLS[this.hand[handIndex].tool].cost;
  }

  canPlay(handIndex: number): boolean {
    return this.phase === 'play' && !!this.hand[handIndex] && this.cost(handIndex) <= this.energy;
  }

  /** Cells a tool would affect at (r,c); empty = invalid. */
  area(tool: ToolId, r: number, c: number): Pos[] {
    if (TOOLS[tool].self || c < this.minCol) return [];
    return TOOLS[tool].area(this, r, c);
  }

  /** Self-targeted tools: is there anything for them to do right now? */
  canSelf(tool: ToolId): boolean {
    switch (tool) {
      case 'antidote': return this.infection.some((v) => v > 0);
      case 'lantern': return this.reachBonus === 0;
      case 'forage': return this.deck.length + this.discard.length > 0;
      case 'adrenaline': return this.digest + 1 < this.level.digestMax;
      default: return false;
    }
  }

  /** Is there any valid target for this tool anywhere on the board? */
  hasTarget(tool: ToolId): boolean {
    if (TOOLS[tool].self) return this.canSelf(tool);
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) if (this.area(tool, r, c).length) return true;
    return false;
  }

  /** True when the player cannot do anything useful any more this turn. */
  noMovesLeft(): boolean {
    return !this.hand.some((card, i) => !TOOLS[card.tool].utility && this.canPlay(i) && this.hasTarget(card.tool));
  }

  play(handIndex: number, r: number, c: number): GameEvent[] | null {
    if (!this.canPlay(handIndex)) return null;
    const card = this.hand[handIndex];
    const self = !!TOOLS[card.tool].self;
    const cells = this.area(card.tool, r, c);
    if (self ? !this.canSelf(card.tool) : !cells.length) return null;

    const ev: GameEvent[] = [];
    this.energy -= TOOLS[card.tool].cost;
    this.hand.splice(handIndex, 1);
    this.discard.push(card);

    switch (card.tool) {
      case 'pick':
      case 'zapper':
      case 'broom':
      case 'spray':
      case 'dynamite': {
        const gems: { cell: Cell; p: Pos }[] = [];
        for (const p of cells) {
          const cell = this.grid[p.r][p.c];
          if (!cell) continue;
          this.grid[p.r][p.c] = null;
          if (cell.kind === 'gem') gems.push({ cell, p });
          else ev.push({ t: 'kill', id: cell.id, r: p.r, c: p.c, kind: cell.kind, colour: cell.colour });
        }
        this.collect(gems, ev);
        break;
      }
      case 'net':
      case 'magnet': {
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
      case 'glue': {
        const cell = this.grid[r][c]!;
        cell.stuck = 1;
        ev.push({ t: 'stick', id: cell.id, on: true });
        break;
      }
      case 'antidote': {
        let worst = 0;
        for (let k = 1; k < 4; k++) if (this.infection[k] > this.infection[worst]) worst = k;
        const level = --this.infection[worst];
        ev.push({ t: 'heal', colour: worst as Colour, level });
        break;
      }
      case 'lantern':
        this.reachBonus = 2;
        ev.push({ t: 'reach', bonus: 2 });
        break;
      case 'forage': {
        let n = 0;
        for (let k = 0; k < 2; k++) if (this.drawOne()) n++;
        ev.push({ t: 'draw', n });
        break;
      }
      case 'adrenaline':
        this.energy += 2;
        this.digest += 1;
        ev.push({ t: 'rush' });
        break;
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

  // ------------------------------------------------------------------ squeeze
  /** Everything on the belt takes one step towards you. Stuck items stay and jam what is behind them. */
  private shiftOnce(ev: GameEvent[]): void {
    const last = COLS - 1;
    for (let c = last; c >= 0; c--) {
      for (let r = 0; r < ROWS; r++) {
        const cell = this.grid[r][c];
        if (!cell) continue;
        if (cell.stuck) {
          cell.stuck = 0;
          ev.push({ t: 'stick', id: cell.id, on: false });
          continue;
        }
        if (c === last) {
          this.grid[r][c] = null;
          ev.push({ t: 'advance', id: cell.id, r, fromC: c, toC: COLS });
          ev.push({ t: 'acid', id: cell.id, r, kind: cell.kind, colour: cell.colour });
          if (cell.kind === 'bug') {
            const level = ++this.infection[cell.colour];
            ev.push({ t: 'infect', colour: cell.colour as Colour, level });
          }
        } else if (!this.grid[r][c + 1]) {
          this.grid[r][c] = null;
          this.grid[r][c + 1] = cell;
          ev.push({ t: 'advance', id: cell.id, r, fromC: c, toC: c + 1 });
        }
      }
    }
    // the next bite drops in (or is lost when the entrance is jammed)
    for (let r = 0; r < ROWS; r++) {
      const cell = this.incoming[r];
      if (!cell) continue;
      if (!this.grid[r][0]) {
        this.grid[r][0] = cell;
        ev.push({ t: 'advance', id: cell.id, r, fromC: -1, toC: 0 });
      } else ev.push({ t: 'vanish', id: cell.id, r, c: -1 });
    }
    this.incoming = this.makeIncoming();
    this.incoming.forEach((cell, r) => {
      if (cell) ev.push({ t: 'incoming', id: cell.id, r, kind: cell.kind, colour: cell.colour });
    });
  }

  /** Burp: the belt runs backwards for one step (a breather, but gems can be lost). */
  private reverseOnce(ev: GameEvent[]): void {
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const cell = this.grid[r][c];
        if (!cell) continue;
        if (cell.stuck) {
          cell.stuck = 0;
          ev.push({ t: 'stick', id: cell.id, on: false });
          continue;
        }
        if (c === 0) {
          this.grid[r][c] = null;
          ev.push({ t: 'advance', id: cell.id, r, fromC: 0, toC: -1 });
          ev.push({ t: 'vanish', id: cell.id, r, c: -1 });
        } else if (!this.grid[r][c - 1]) {
          this.grid[r][c] = null;
          this.grid[r][c - 1] = cell;
          ev.push({ t: 'advance', id: cell.id, r, fromC: c, toC: c - 1 });
        }
      }
    }
  }

  /** Slime: a few bugs are marked sticky for the coming squeeze (the player can see which). */
  private markStuck(ev: GameEvent[]): void {
    if (this.level.quirk !== 'slime') return;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const cell = this.grid[r][c];
        if (cell && cell.kind === 'bug' && !cell.stuck && this.rng.chance(0.28)) {
          cell.stuck = 1;
          ev.push({ t: 'stick', id: cell.id, on: true });
        }
      }
  }

  /** Rot: sometimes a gem on the belt spoils into a bug of the same colour. */
  private rotOnce(ev: GameEvent[]): void {
    if (this.level.quirk !== 'rot' || !this.rng.chance(0.6)) return;
    const gems: Pos[] = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 1; c < COLS; c++) if (this.grid[r][c]?.kind === 'gem') gems.push({ r, c });
    if (!gems.length) return;
    const p = this.rng.pick(gems);
    const cell = this.grid[p.r][p.c]!;
    cell.kind = 'bug';
    ev.push({ t: 'rot', id: cell.id, r: p.r, c: p.c, colour: cell.colour });
  }

  /** End of turn: the belly contracts and everything moves one step towards you. */
  squeeze(): GameEvent[] {
    if (this.phase !== 'play') return [];
    const ev: GameEvent[] = [];
    const { quirk, quirkEvery } = this.level;
    const quirkTurn = this.turn % quirkEvery === 0;

    if (quirk === 'burp' && quirkTurn) this.reverseOnce(ev);
    else {
      this.shiftOnce(ev);
      if (quirk === 'hiccup' && quirkTurn) this.shiftOnce(ev);
    }
    this.rotOnce(ev);

    // clocks
    this.digest++;
    this.turn++;
    this.reachBonus = 0;
    if (this.infection.some((v) => v >= this.level.infectionMax)) {
      this.phase = 'lost';
      this.lossReason = 'sick';
      ev.push({ t: 'lost', reason: 'sick' });
    } else if (this.digest >= this.level.digestMax) {
      this.phase = 'lost';
      this.lossReason = 'digested';
      ev.push({ t: 'lost', reason: 'digested' });
    }

    // new hand
    this.discard.push(...this.hand);
    this.hand = [];
    this.energy = this.level.maxEnergy;
    if (this.phase === 'play') {
      this.draw();
      this.markStuck(ev);
    }
    return ev;
  }
}
