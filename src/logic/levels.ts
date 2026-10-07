import type { LevelDef } from './types';

export const TINY_FROG: LevelDef = {
  id: 'tiny-frog',
  name: 'Tiny Frog',
  tagline: 'A gentle little meal.',
  digestMax: 18,
  quota: 210,
  stars: [280, 350],
  maxEnergy: 3,
  handSize: 4,
  infectionMax: 3,
  deck: ['pick', 'pick', 'pick', 'zapper', 'zapper', 'net', 'net', 'shove', 'shove'],
  spawn: { pBug: 0.4, pGem: 0.28, pBone: 0.05 },
  initialColumns: 5,
};

export const LEVELS: LevelDef[] = [TINY_FROG];
