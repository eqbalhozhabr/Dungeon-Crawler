import type { ItemDef, RuneId, Tile } from './types';

/**
 * What a rune puts into its lane of its district. Everything lives in rows 3..8 of the 12: the rest of every district is
 * open street, so there is room to change lane (the seal sits in the open stretch at the start of a lap).
 * `variant` (0..2) nudges the spacing so tiles do not all look the same; `level` makes spikes longer as laps go by.
 */
export function itemsFor(rune: RuneId, variant: number, level: number): ItemDef[] {
  const sh = (variant - 1) * 0.3;
  const at = (kind: ItemDef['kind'], off: number, hp: number, worth: number, len = 0): ItemDef => ({ kind, off: off + sh, len, hp, worth });
  switch (rune) {
    case 'coin':
      return [3.0, 4.6, 6.2, 7.8].map((o) => at('coin', o, 1, 1));
    case 'bandit':
      return [3.6, 7.0].map((o) => at('bandit', o, 1, 2));
    case 'spikes': {
      const len = 1.4 + 0.15 * Math.min(level, 3);
      return [at('spike', 3.0, 1, 0, len), at('spike', 6.0, 1, 0, len)];
    }
    case 'fountain':
      return [at('well', 5.5, 1, 3)];
    case 'bare':
      return [];
  }
}

export function freshState(t: Pick<Tile, 'rune' | 'variant'>, level: number): number[] {
  return itemsFor(t.rune, t.variant, level).map((i) => i.hp);
}

/** Next harder rune (every few laps the alley gets worse). */
export const HARDER: Partial<Record<RuneId, RuneId>> = { bare: 'coin', coin: 'bandit', bandit: 'spikes' };

export const RUNE_NAMES: Record<RuneId, string> = { coin: 'PURSE', bandit: 'THIEF', spikes: 'SPIKES', fountain: 'WELL', bare: 'OPEN' };
