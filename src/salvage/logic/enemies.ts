import type { EnemyDef } from './types';

// Every enemy holds objects (its "kit") and plays them like you do, on either face.
// With empty hands it falls back to its natural attacks.
export const ENEMIES: Record<string, EnemyDef> = {
  mite: {
    id: 'mite', name: 'Gut Mite', hp: 14, art: 'mite', kitCount: 1,
    swallowed: ['knife', 'pan', 'scissors', 'matches', 'rope', 'shovel'],
    natural: [{ kind: 'attack', n: 4 }],
  },
  tick: {
    id: 'tick', name: 'Tick', hp: 9, art: 'tick', kitCount: 1,
    swallowed: ['scissors', 'shovel', 'lockpick', 'oldkey', 'matches'],
    natural: [{ kind: 'attack', n: 3, hits: 2 }],
  },
  slug: {
    id: 'slug', name: 'Acid Slug', hp: 22, art: 'slug', kitCount: 2,
    swallowed: ['boathook', 'cleaver', 'boot', 'beans', 'pan', 'crowbar'],
    natural: [{ kind: 'attack', n: 6 }],
  },
  leech: {
    id: 'leech', name: 'Leech', hp: 20, art: 'leech', kitCount: 2, trait: 'drain',
    swallowed: ['spoon', 'fishhook', 'medkit', 'knife', 'lantern'],
    natural: [{ kind: 'drain', n: 7 }],
  },
  thief: {
    id: 'thief', name: 'Pilfer Mite', hp: 11, art: 'thief', kitCount: 1, trait: 'thief',
    swallowed: ['fishhook'], fixedKit: ['fishhook'],
    natural: [{ kind: 'attack', n: 3 }],
  },
  warden: {
    id: 'warden', name: 'Tapeworm Warden', hp: 62, art: 'warden', kitCount: 3, elite: true,
    swallowed: ['crowbar', 'harpoon', 'pickaxe', 'boot', 'cleaver'],
    natural: [{ kind: 'attack', n: 9 }, { kind: 'attack', n: 5, hits: 2 }],
  },
  mama: {
    id: 'mama', name: 'Mama Leech', hp: 72, art: 'mama', kitCount: 3, boss: true, trait: 'drain',
    swallowed: ['fishhook', 'harpoon', 'boot'], fixedKit: ['fishhook', 'harpoon', 'boot'],
    natural: [{ kind: 'attack', n: 8 }, { kind: 'drain', n: 7 }],
  },
};
