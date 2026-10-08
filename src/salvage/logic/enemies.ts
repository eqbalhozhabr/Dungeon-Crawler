import type { EnemyDef } from './types';

export const ENEMIES: Record<string, EnemyDef> = {
  mite: {
    id: 'mite', name: 'Gut Mite', hp: 11, art: 'mite', size: 1.4,
    pattern: [{ kind: 'attack', n: 5 }, { kind: 'attack', n: 5 }, { kind: 'attack', n: 8 }],
    swallowed: ['bandage', 'spoon', 'matches', 'hook', 'pan', 'scissors'],
  },
  tick: {
    id: 'tick', name: 'Tick', hp: 7, art: 'tick', size: 1.1,
    pattern: [{ kind: 'attack', n: 3, hits: 2 }, { kind: 'attack', n: 3, hits: 2 }, { kind: 'attack', n: 5, hits: 2 }],
    swallowed: ['matches', 'lockpick', 'whetstone', 'bandage', 'net'],
  },
  slug: {
    id: 'slug', name: 'Acid Slug', hp: 16, art: 'slug', size: 1.7,
    pattern: [{ kind: 'attack', n: 8 }, { kind: 'attack', n: 8 }, { kind: 'attack', n: 12 }],
    swallowed: ['beans', 'sandwich', 'cleaver', 'net', 'flask', 'bandage'],
  },
  leech: {
    id: 'leech', name: 'Leech', hp: 16, art: 'leech', size: 1.7,
    pattern: [{ kind: 'drain', n: 7 }, { kind: 'attack', n: 5 }, { kind: 'drain', n: 8 }],
    swallowed: ['medkit', 'flask', 'harpoon', 'sandwich', 'crowbar'],
  },
  warden: {
    id: 'warden', name: 'Tapeworm Warden', hp: 46, art: 'warden', size: 2.2, elite: true,
    pattern: [{ kind: 'attack', n: 9 }, { kind: 'attack', n: 5, hits: 2 }, { kind: 'heal', n: 6 }, { kind: 'attack', n: 12 }],
    swallowed: ['anchor', 'harpoon', 'pickaxe', 'medkit', 'bell'],
  },
  mama: {
    id: 'mama', name: 'Mama Leech', hp: 64, art: 'mama', size: 4.2, boss: true,
    pattern: [{ kind: 'attack', n: 9 }, { kind: 'steal', n: 1 }, { kind: 'attack', n: 6, hits: 2 }, { kind: 'drain', n: 9 }],
    swallowed: ['anchor'],
  },
};
