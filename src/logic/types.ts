export type Colour = 0 | 1 | 2 | 3;
export type Kind = 'gem' | 'bug' | 'bone';
export type ToolId = 'pick' | 'zapper' | 'net' | 'shove';

export interface Cell {
  id: number;
  kind: Kind;
  colour: Colour; // ignored for bones
}

export interface Pos {
  r: number;
  c: number;
}

export interface CardInst {
  uid: number;
  tool: ToolId;
}

// Events are emitted by the rules and consumed by the view to animate what happened.
export type GameEvent =
  | { t: 'collect'; id: number; r: number; c: number; colour: Colour }
  | { t: 'kill'; id: number; r: number; c: number; kind: Kind; colour: Colour }
  | { t: 'move'; id: number; r: number; fromC: number; toC: number }
  | { t: 'score'; pts: number; label: string; r: number; c: number }
  | { t: 'advance'; id: number; r: number; fromC: number; toC: number }
  | { t: 'acid'; id: number; r: number; kind: Kind; colour: Colour }
  | { t: 'incoming'; id: number; r: number; kind: Kind; colour: Colour }
  | { t: 'infect'; colour: Colour; level: number }
  | { t: 'lost'; reason: 'sick' | 'digested' };

export interface LevelDef {
  id: string;
  name: string;
  tagline: string;
  digestMax: number;
  quota: number;
  stars: [number, number]; // final score needed for 2 and 3 stars (1 star = escaped)
  maxEnergy: number;
  handSize: number;
  infectionMax: number;
  deck: ToolId[];
  spawn: { pBug: number; pGem: number; pBone: number };
  initialColumns: number;
}
