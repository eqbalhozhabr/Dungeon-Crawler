export type Colour = 0 | 1 | 2 | 3;
export type Kind = 'gem' | 'bug' | 'bone';
export type ToolId =
  | 'pick' | 'zapper' | 'net' | 'shove' | 'magnet' | 'broom' | 'antidote'
  | 'lantern' | 'glue' | 'spray' | 'forage' | 'adrenaline' | 'dynamite';

/** What makes a creature different: a rule that bends the belt. */
export type Quirk = 'none' | 'hiccup' | 'burp' | 'slime' | 'rot';

export interface Cell {
  id: number;
  kind: Kind;
  colour: Colour; // ignored for bones
  /** > 0: this item stays where it is during the next squeeze (glue, slime). */
  stuck?: number;
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
  | { t: 'heal'; colour: Colour; level: number }
  | { t: 'stick'; id: number; on: boolean }
  | { t: 'rot'; id: number; r: number; c: number; colour: Colour }
  | { t: 'vanish'; id: number; r: number; c: number }
  | { t: 'reach'; bonus: number }
  | { t: 'rush' }
  | { t: 'draw'; n: number }
  | { t: 'lost'; reason: 'sick' | 'digested' };

export interface LevelDef {
  id: string;
  name: string;
  tagline: string;
  /** The creature's quirk, shown on the map and in the HUD. */
  quirk: Quirk;
  quirkEvery: number;
  quirkText: string;
  /** The creature's belly colours, dark to light (7 steps). */
  palette: number[];
  /** Name of the portrait texture (see src/art/portraits.ts). */
  portrait: string;
  digestMax: number;
  quota: number;
  stars: [number, number]; // final score needed for 2 and 3 stars (1 star = escaped)
  maxEnergy: number;
  handSize: number;
  infectionMax: number;
  /** How many columns nearest the acid the player can touch (the rest is "out of reach"). */
  reach: number;
  deck: ToolId[];
  spawn: { pBug: number; pGem: number; pBone: number };
  initialColumns: number;
}
