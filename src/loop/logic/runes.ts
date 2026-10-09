import { DROWS, type ItemDef, type RuneId, type Tile } from './types';

/** What a rune puts into its lane of its district. `variant` (0..2) nudges the spacing so tiles do not all look the same. */
export function itemsFor(rune: RuneId, variant: number, level: number): ItemDef[] {
  const sh = (variant - 1) * 0.4;
  const at = (kind: ItemDef['kind'], off: number, hp: number, worth: number, len = 0): ItemDef => ({ kind, off: off + sh, len, hp, worth });
  switch (rune) {
    case 'coin':
      return [2, 4, 6, 8].map((o) => at('coin', o, 1, 1));
    case 'bandit':
      return [3.5, 7].map((o) => at('bandit', o, 1, 2));
    case 'brute':
      return [at('brute', 5, 2, 5)];
    case 'spikes': {
      const s = [at('spike', 2.4, 1, 0, 1.6), at('spike', 6.2, 1, 0, 1.6)];
      if (level >= 1) s.push(at('spike', 4.3, 1, 0, 1.4));
      return s;
    }
    case 'fountain':
      return [at('well', 5, 1, 3)];
  }
}

export const isBlocked = (r: RuneId): boolean => r === 'spikes' || r === 'brute';

export function freshState(t: Pick<Tile, 'rune' | 'variant'>, level: number): number[] {
  return itemsFor(t.rune, t.variant, level).map((i) => i.hp);
}

/** Next harder rune (tremors upgrade the alley as laps go by). */
export const HARDER: Partial<Record<RuneId, RuneId>> = { coin: 'bandit', bandit: 'brute' };

export const RUNE_NAMES: Record<RuneId, string> = { coin: 'PURSE', bandit: 'THIEF', brute: 'BRUTE', spikes: 'SPIKES', fountain: 'WELL' };
export const RUNE_HELP: Record<RuneId, string> = {
  coin: 'coins to grab',
  bandit: 'dies to one hit, pays 2',
  brute: 'needs TWO hits at once, pays 5',
  spikes: 'hurts you (ghosts walk through)',
  fountain: 'heals you',
};

export const districtStart = (d: number) => d * DROWS;
