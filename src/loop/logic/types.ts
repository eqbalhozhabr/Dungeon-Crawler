// Alley Echo: the ring is 3 districts of 10 rows, 3 lanes wide. Position p runs 0..30 and wraps (a lap).
export const LANES = 3;
export const DISTRICTS = 3;
export const DROWS = 10;
export const RING = DISTRICTS * DROWS;
/** Samples per row in a recorded path. */
export const BINS = 4;
export const MAX_ECHOES = 3;
export const MAX_HP = 3;

export type RuneId = 'coin' | 'bandit' | 'brute' | 'spikes' | 'fountain';
export const RUNES: RuneId[] = ['coin', 'bandit', 'brute', 'spikes', 'fountain'];
export type ItemKind = 'coin' | 'bandit' | 'brute' | 'spike' | 'well';

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

/** One rune tile = one lane of one district. `state[i]` is what is left of item i this lap (hp, or 1/0 for pickups). */
export interface Tile {
  id: number;
  rune: RuneId;
  variant: number;
  items: ItemDef[];
  state: number[];
}

/** One recorded lap: the lane at every quarter row. */
export interface Echo {
  id: number;
  path: Uint8Array;
}

export type GameEvent =
  | { t: 'coin'; who: number; lane: number; row: number; n: number; fromKill: boolean }
  | { t: 'strike'; who: number; lane: number; row: number; kill: boolean }
  | { t: 'hurt'; lane: number }
  | { t: 'heal'; lane: number }
  | { t: 'lap'; lap: number; speed: number; echoes: number }
  | { t: 'slide' }
  | { t: 'upgrade'; id: number }
  | { t: 'tremor' }
  | { t: 'over' };
