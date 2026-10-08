import type { LevelDef, ToolId } from './types';

export const BASE_DECK: ToolId[] = ['pick', 'pick', 'pick', 'zapper', 'zapper', 'net', 'net', 'shove', 'shove'];

/** Tiny Frog with the player's earned reward cards added to the starting deck. */
export function tinyFrog(extras: ToolId[] = []): LevelDef {
  return {
    id: 'tiny-frog',
    name: 'Tiny Frog',
    tagline: 'A gentle little meal.',
    digestMax: 20,
    quota: 210,
    stars: [280, 350],
    maxEnergy: 3,
    handSize: 4,
    infectionMax: 3,
    reach: 5,
    deck: [...BASE_DECK, ...extras],
    spawn: { pBug: 0.4, pGem: 0.28, pBone: 0.05 },
    initialColumns: 6,
  };
}

export const TINY_FROG: LevelDef = tinyFrog();
export const LEVELS: LevelDef[] = [TINY_FROG];

/** Tools that can be offered as a reward after a level. */
export const REWARD_POOL: ToolId[] = ['magnet', 'broom', 'antidote', 'pick', 'zapper', 'net', 'shove'];
