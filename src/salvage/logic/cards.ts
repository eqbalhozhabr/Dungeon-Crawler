import type { CardDef } from './types';

// 20 objects. Rarity 0 = starter/common, 1 = uncommon, 2 = rare. Each one has a fight face and a tool face.
export const CARDS: Record<string, CardDef> = {};
const add = (d: CardDef) => {
  CARDS[d.id] = d;
};
const none = ['NO TOOL', 'USE', 'HERE'] as [string, string, string];

// ---------------------------------------------------------------- starting objects (8 kinds, 10 cards)
add({ id: 'boathook', name: 'Boathook', cost: 1, icon: 'boathook', rarity: 0, target: 'enemy',
  fight: [{ t: 'dmg', n: 5 }], fightText: ['DEAL 5', 'DAMAGE', ''], tools: ['PRY'], toolShort: 'VALVES', toolText: ['PRIES OPEN', 'VALVES', ''] });
add({ id: 'knife', name: 'Knife', cost: 1, icon: 'knife', rarity: 0, target: 'enemy',
  fight: [{ t: 'dmg', n: 4 }], fightText: ['DEAL 4', 'DAMAGE', ''], tools: ['CUT'], toolShort: 'CYSTS', toolText: ['CUTS OPEN', 'CYSTS', ''] });
add({ id: 'lantern', name: 'Lantern', cost: 1, icon: 'lantern', rarity: 0, target: 'enemy',
  fight: [{ t: 'status', s: 'dazzle', n: 1 }, { t: 'draw', n: 1 }, { t: 'peek' }], fightText: ['DAZZLE,', 'DRAW 1,', 'PEEK'], tools: ['LIGHT'], toolShort: 'PODS', toolText: ['LIGHTS UP', 'POD, ALCOVE', ''] });
add({ id: 'shovel', name: 'Shovel', cost: 1, icon: 'shovel', rarity: 0, target: 'enemy',
  fight: [{ t: 'dmg', n: 2, hits: 2 }], fightText: ['DEAL 2', 'DAMAGE', 'TWICE'], tools: ['DIG'], toolShort: 'CYSTS', toolText: ['DIGS OPEN', 'CYSTS', ''] });
add({ id: 'rope', name: 'Rope', cost: 1, icon: 'rope', rarity: 0, target: 'enemy',
  fight: [{ t: 'status', s: 'sleep', n: 1 }], fightText: ['TIE UP:', 'SKIPS ITS', 'NEXT MOVE'], tools: [], toolShort: 'NO TOOL', toolText: none });
add({ id: 'oldkey', name: 'Old Key', cost: 0, icon: 'key', rarity: 0, target: 'enemy',
  fight: [{ t: 'dmg', n: 2 }], fightText: ['THROW IT:', 'DEAL 2', ''], tools: ['KEY'], toolShort: 'VALVES 1X', toolText: ['OPENS A', 'VALVE. USED', 'UP FOR GOOD'], toolConsumes: true });
add({ id: 'beans', name: 'Beans', cost: 1, icon: 'beans', rarity: 0, target: 'none', exhaust: true,
  fight: [{ t: 'heal', n: 5 }], fightText: ['HEAL 5', 'USED UP', ''], tools: [], toolShort: 'NO TOOL', toolText: none });
add({ id: 'boot', name: 'Boot', cost: 2, icon: 'boot', rarity: 0, target: 'enemy',
  fight: [{ t: 'dmg', n: 9 }], fightText: ['KICK:', 'DEAL 9', ''], tools: [], toolShort: 'NO TOOL', toolText: none });

export const STARTING_DECK = ['boathook', 'boathook', 'knife', 'knife', 'lantern', 'shovel', 'rope', 'oldkey', 'beans', 'boot'];

// ---------------------------------------------------------------- found objects (12 kinds)
add({ id: 'pan', name: 'Pan', cost: 1, icon: 'pan', rarity: 0, target: 'enemy',
  fight: [{ t: 'dmg', n: 5 }, { t: 'status', s: 'dazzle', n: 1 }], fightText: ['DEAL 5', 'AND', 'DAZZLE'], tools: [], toolShort: 'NO TOOL', toolText: none });
add({ id: 'scissors', name: 'Scissors', cost: 1, icon: 'scissors', rarity: 0, target: 'enemy',
  fight: [{ t: 'dmg', n: 3, hits: 2 }], fightText: ['DEAL 3', 'DAMAGE', 'TWICE'], tools: ['CUT'], toolShort: 'CYSTS', toolText: ['CUTS OPEN', 'CYSTS', ''] });
add({ id: 'fishhook', name: 'Fishhook', cost: 1, icon: 'hook', rarity: 0, target: 'enemy',
  fight: [{ t: 'dmg', n: 3 }, { t: 'grab' }], fightText: ['DEAL 3.', 'GRAB ITS', 'CARD: FREE'], tools: ['CUT'], toolShort: 'CYSTS', toolText: ['CUTS OPEN', 'CYSTS', ''] });
add({ id: 'spoon', name: 'Spoon', cost: 1, icon: 'spoon', rarity: 0, target: 'enemy',
  fight: [{ t: 'dmg', n: 3 }, { t: 'fatal', do: 'heal', n: 5 }], fightText: ['DEAL 3.', 'IF FATAL,', 'HEAL 5'], tools: ['DIG'], toolShort: 'CYSTS', toolText: ['DIGS OPEN', 'CYSTS', ''] });
add({ id: 'matches', name: 'Matches', cost: 0, icon: 'matches', rarity: 0, target: 'enemy', exhaust: true,
  fight: [{ t: 'status', s: 'burn', n: 4 }], fightText: ['BURN FOR', '4 TURNS', 'USED UP'], tools: ['LIGHT'], toolShort: 'PODS', toolText: ['LIGHTS UP', 'POD, ALCOVE', ''] });
add({ id: 'cleaver', name: 'Cleaver', cost: 1, icon: 'cleaver', rarity: 0, target: 'enemy',
  fight: [{ t: 'dmg', n: 5, ifStatus: ['dazzle', 4] }], fightText: ['DEAL 5.', '+4 IF', 'DAZZLED'], tools: ['CUT'], toolShort: 'CYSTS', toolText: ['CUTS OPEN', 'CYSTS', ''] });

add({ id: 'crowbar', name: 'Crowbar', cost: 1, icon: 'crowbar', rarity: 1, target: 'enemy',
  fight: [{ t: 'dmg', n: 8 }], fightText: ['DEAL 8', 'DAMAGE', ''], tools: ['PRY'], toolShort: 'VALVES', toolText: ['PRIES OPEN', 'VALVES', ''] });
add({ id: 'lockpick', name: 'Lockpick', cost: 0, icon: 'lockpick', rarity: 1, target: 'enemy',
  fight: [{ t: 'dmg', n: 2 }], fightText: ['DEAL 2', 'DAMAGE', ''], tools: ['KEY'], toolShort: 'VALVES', toolText: ['OPENS A', 'VALVE. KEPT', 'FOR NEXT TIME'] });
add({ id: 'flare', name: 'Flare', cost: 1, icon: 'flare', rarity: 1, target: 'none',
  fight: [{ t: 'dmgAll', n: 4 }], fightText: ['DEAL 4 TO', 'ALL', 'ENEMIES'], tools: ['LIGHT'], toolShort: 'PODS', toolText: ['LIGHTS UP', 'POD, ALCOVE', ''] });
add({ id: 'medkit', name: 'Medkit', cost: 2, icon: 'medkit', rarity: 1, target: 'none', exhaust: true,
  fight: [{ t: 'heal', n: 12 }], fightText: ['HEAL 12', 'USED UP', ''], tools: [], toolShort: 'NO TOOL', toolText: none });

add({ id: 'pickaxe', name: 'Pickaxe', cost: 1, icon: 'pickaxe', rarity: 2, target: 'enemy',
  fight: [{ t: 'dmg', n: 7 }], fightText: ['DEAL 7', 'DAMAGE', ''], tools: ['DIG', 'PRY'], toolShort: 'ANYTHING', toolText: ['DIGS OR', 'PRIES OPEN', 'ANYTHING'] });
add({ id: 'harpoon', name: 'Harpoon', cost: 2, icon: 'harpoon', rarity: 2, target: 'enemy',
  fight: [{ t: 'dmg', n: 12 }, { t: 'fatal', do: 'energy', n: 1 }], fightText: ['DEAL 12.', 'IF FATAL,', '+1 ENERGY'], tools: ['PRY'], toolShort: 'VALVES', toolText: ['PRIES OPEN', 'VALVES', ''] });

export const REWARD_POOL: string[][] = [[], [], []];
Object.values(CARDS).forEach((d) => {
  if (!STARTING_DECK.includes(d.id)) REWARD_POOL[d.rarity].push(d.id);
});
