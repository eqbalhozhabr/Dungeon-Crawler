// Alley Echo: the ring is 3 districts of 12 rows, 3 lanes wide. Position p runs 0..36 and wraps (a lap).
// The seal (where formations are checked) is at p = 0.
export const LANES = 3;
export const DISTRICTS = 3;
export const DROWS = 12;
export const RING = DISTRICTS * DROWS;
/** Samples per row in a recorded path. */
export const BINS = 4;
export const MAX_ECHOES = 3;
export const MAX_HP = 3;
/** Formations shown on the board: the next seal and the three after it. */
export const REACH_LAPS = 4;
/** Laps before this one are warm-up: the seal shows what to do but costs and pays little. */
export const SCORING_FROM = 2;

export type RuneId = 'coin' | 'bandit' | 'spikes' | 'fountain' | 'bare';
export type ItemKind = 'coin' | 'bandit' | 'spike' | 'well';

export interface ItemDef {
  kind: ItemKind;
  /** Rows from the start of the district. */
  off: number;
  /** Length in rows (spikes only). */
  len: number;
  hp: number;
  /** Coins for a pickup or a kill. */
  worth: number;
}

/** One stretch of street: one lane of one district. `state[i]` is what is left of item i this lap (hp, or 1/0 for pickups). */
export interface Tile {
  id: number;
  rune: RuneId;
  variant: number;
  items: ItemDef[];
  state: number[];
}

/** One recorded lap: the lane at every quarter row, and the lane it stood in at the seal. */
export interface Echo {
  id: number;
  path: Uint8Array;
  seat: number;
}

export type GameEvent =
  | { t: 'coin'; who: number; lane: number; row: number; n: number; fromKill: boolean }
  | { t: 'strike'; who: number; lane: number; row: number; kill: boolean }
  | { t: 'hurt'; lane: number }
  | { t: 'heal'; lane: number }
  | { t: 'seal'; lap: number; ok: boolean; scoring: boolean; counts: number[]; mult: number; bonus: number; streak: number; crowd: number }
  | { t: 'lap'; lap: number; speed: number; echoes: number }
  | { t: 'upgrade'; id: number }
  | { t: 'over' };
