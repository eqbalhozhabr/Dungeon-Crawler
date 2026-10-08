import type { CardDef } from './types';

const c = (d: CardDef): CardDef => d;

export const CARDS: Record<string, CardDef> = {};
const add = (d: CardDef) => {
  CARDS[d.id] = d;
};

// ---------------------------------------------------------------- starting deck
add(c({ id: 'boathook', name: 'Boathook', cost: 1, icon: 'boathook', rarity: 0, target: 'enemy',
  fight: [{ t: 'dmg', n: 5 }], fightText: ['DEAL 5', 'DAMAGE', ''], tools: ['PRY'], toolText: ['PRY OPEN', 'VALVES', ''] }));
add(c({ id: 'knife', name: 'Knife', cost: 1, icon: 'knife', rarity: 0, target: 'enemy',
  fight: [{ t: 'dmg', n: 4 }], fightText: ['DEAL 4', 'DAMAGE', ''], tools: ['CUT'], toolText: ['CUT OPEN', 'CYSTS', ''] }));
add(c({ id: 'lantern', name: 'Lantern', cost: 1, icon: 'lantern', rarity: 0, target: 'enemy',
  fight: [{ t: 'status', s: 'dazzle', n: 1 }, { t: 'draw', n: 1 }], fightText: ['DAZZLE', 'DRAW 1', ''], tools: ['LIGHT'], toolText: ['LIGHTS UP', 'DARK ALCOVES', ''] }));
add(c({ id: 'shovel', name: 'Shovel', cost: 1, icon: 'shovel', rarity: 0, target: 'enemy',
  fight: [{ t: 'dmg', n: 2, hits: 2 }], fightText: ['DEAL 2', 'DAMAGE', 'TWICE'], tools: ['DIG'], toolText: ['DIGS OPEN', 'CYSTS', ''] }));
add(c({ id: 'rope', name: 'Rope', cost: 1, icon: 'rope', rarity: 0, target: 'enemy',
  fight: [{ t: 'status', s: 'sleep', n: 1 }], fightText: ['TIE UP:', 'SKIPS ITS', 'NEXT MOVE'], tools: [], toolText: ['NO USE', 'HERE', ''] }));
add(c({ id: 'oldkey', name: 'Old Key', cost: 0, icon: 'key', rarity: 0, target: 'enemy',
  fight: [{ t: 'dmg', n: 2 }], fightText: ['THROW IT:', 'DEAL 2', ''], tools: ['KEY'], toolText: ['OPENS A', 'VALVE. USED', 'UP FOR GOOD'], toolConsumes: true }));
add(c({ id: 'beans', name: 'Beans', cost: 1, icon: 'beans', rarity: 0, target: 'none', exhaust: true,
  fight: [{ t: 'heal', n: 5 }], fightText: ['HEAL 5', 'USED UP', ''], tools: [], toolText: ['NO USE', 'HERE', ''] }));
add(c({ id: 'boot', name: 'Boot', cost: 2, icon: 'boot', rarity: 0, target: 'enemy',
  fight: [{ t: 'dmg', n: 9 }], fightText: ['KICK:', 'DEAL 9', ''], tools: [], toolText: ['NO USE', 'HERE', ''] }));

export const STARTING_DECK = ['boathook', 'boathook', 'knife', 'knife', 'lantern', 'shovel', 'rope', 'oldkey', 'beans', 'boot'];

// ---------------------------------------------------------------- rewards and swallowed things
add(c({ id: 'pan', name: 'Pan', cost: 1, icon: 'pan', rarity: 0, target: 'enemy',
  fight: [{ t: 'dmg', n: 5 }, { t: 'status', s: 'dazzle', n: 1 }], fightText: ['DEAL 5', 'AND', 'DAZZLE'], tools: [], toolText: ['NO USE', 'HERE', ''] }));
add(c({ id: 'hook', name: 'Fishhook', cost: 1, icon: 'hook', rarity: 0, target: 'enemy',
  fight: [{ t: 'dmg', n: 4 }, { t: 'fatal', do: 'draw', n: 1 }], fightText: ['DEAL 4.', 'IF FATAL,', 'DRAW 1'], tools: ['CUT'], toolText: ['CUT OPEN', 'CYSTS', ''] }));
add(c({ id: 'scissors', name: 'Scissors', cost: 1, icon: 'scissors', rarity: 0, target: 'enemy',
  fight: [{ t: 'dmg', n: 3, hits: 2 }], fightText: ['DEAL 3', 'DAMAGE', 'TWICE'], tools: ['CUT'], toolText: ['CUT OPEN', 'CYSTS', ''] }));
add(c({ id: 'spoon', name: 'Spoon', cost: 1, icon: 'spoon', rarity: 0, target: 'enemy',
  fight: [{ t: 'dmg', n: 3 }, { t: 'fatal', do: 'heal', n: 5 }], fightText: ['DEAL 3.', 'IF FATAL,', 'HEAL 5'], tools: ['DIG'], toolText: ['DIGS OPEN', 'CYSTS', ''] }));
add(c({ id: 'net', name: 'Net', cost: 1, icon: 'net', rarity: 0, target: 'none',
  fight: [{ t: 'statusAll', s: 'dazzle', n: 1 }], fightText: ['DAZZLE', 'ALL', 'ENEMIES'], tools: [], toolText: ['NO USE', 'HERE', ''] }));
add(c({ id: 'matches', name: 'Matches', cost: 0, icon: 'matches', rarity: 0, target: 'enemy', exhaust: true,
  fight: [{ t: 'status', s: 'burn', n: 4 }], fightText: ['BURN FOR', '4 TURNS', 'USED UP'], tools: ['LIGHT'], toolText: ['LIGHTS UP', 'DARK ALCOVES', ''] }));
add(c({ id: 'cleaver', name: 'Cleaver', cost: 1, icon: 'cleaver', rarity: 0, target: 'enemy',
  fight: [{ t: 'dmg', n: 5, ifStatus: ['dazzle', 4] }], fightText: ['DEAL 5.', '+4 IF', 'DAZZLED'], tools: ['CUT'], toolText: ['CUT OPEN', 'CYSTS', ''] }));
add(c({ id: 'bandage', name: 'Bandage', cost: 0, icon: 'bandage', rarity: 0, target: 'none', exhaust: true,
  fight: [{ t: 'heal', n: 4 }], fightText: ['HEAL 4', 'USED UP', ''], tools: [], toolText: ['NO USE', 'HERE', ''] }));

add(c({ id: 'crowbar', name: 'Crowbar', cost: 1, icon: 'crowbar', rarity: 1, target: 'enemy',
  fight: [{ t: 'dmg', n: 8 }], fightText: ['DEAL 8', 'DAMAGE', ''], tools: ['PRY'], toolText: ['PRY OPEN', 'VALVES', ''] }));
add(c({ id: 'lockpick', name: 'Lockpick', cost: 0, icon: 'lockpick', rarity: 1, target: 'enemy',
  fight: [{ t: 'dmg', n: 2 }], fightText: ['DEAL 2', 'DAMAGE', ''], tools: ['KEY'], toolText: ['OPENS A', 'VALVE. KEPT', 'FOR NEXT TIME'] }));
add(c({ id: 'pickaxe', name: 'Pickaxe', cost: 1, icon: 'pickaxe', rarity: 1, target: 'enemy',
  fight: [{ t: 'dmg', n: 7 }], fightText: ['DEAL 7', 'DAMAGE', ''], tools: ['DIG', 'PRY'], toolText: ['DIGS OR', 'PRIES OPEN', 'ANYTHING'] }));
add(c({ id: 'flare', name: 'Flare', cost: 1, icon: 'flare', rarity: 1, target: 'none',
  fight: [{ t: 'dmgAll', n: 4 }], fightText: ['DEAL 4 TO', 'ALL', 'ENEMIES'], tools: ['LIGHT'], toolText: ['LIGHTS UP', 'DARK ALCOVES', ''] }));
add(c({ id: 'harpoon', name: 'Harpoon', cost: 2, icon: 'harpoon', rarity: 1, target: 'enemy',
  fight: [{ t: 'dmg', n: 12 }, { t: 'fatal', do: 'energy', n: 1 }], fightText: ['DEAL 12.', 'IF FATAL,', '+1 ENERGY'], tools: ['PRY'], toolText: ['PRY OPEN', 'VALVES', ''] }));
add(c({ id: 'flask', name: 'Acid Flask', cost: 1, icon: 'flask', rarity: 1, target: 'enemy', exhaust: true,
  fight: [{ t: 'splash', n: 8, adj: 4 }], fightText: ['DEAL 8,', '4 TO THE', 'NEIGHBOURS'], tools: [], toolText: ['NO USE', 'HERE', ''] }));
add(c({ id: 'medkit', name: 'Medkit', cost: 2, icon: 'medkit', rarity: 1, target: 'none', exhaust: true,
  fight: [{ t: 'heal', n: 12 }], fightText: ['HEAL 12', 'USED UP', ''], tools: [], toolText: ['NO USE', 'HERE', ''] }));
add(c({ id: 'sandwich', name: 'Sandwich', cost: 1, icon: 'sandwich', rarity: 1, target: 'none', exhaust: true,
  fight: [{ t: 'heal', n: 7 }, { t: 'draw', n: 1 }], fightText: ['HEAL 7', 'DRAW 1', 'USED UP'], tools: [], toolText: ['NO USE', 'HERE', ''] }));
add(c({ id: 'whetstone', name: 'Whetstone', cost: 0, icon: 'whetstone', rarity: 1, target: 'none', exhaust: true,
  fight: [{ t: 'sharpen', n: 3 }], fightText: ['ATTACKS', '+3 DAMAGE', 'THIS TURN'], tools: [], toolText: ['NO USE', 'HERE', ''] }));

add(c({ id: 'anchor', name: 'Anchor', cost: 3, icon: 'anchor', rarity: 2, target: 'enemy', exhaust: true,
  fight: [{ t: 'dmg', n: 22 }], fightText: ['DEAL 22', 'USED UP', ''], tools: ['PRY'], toolText: ['PRY OPEN', 'VALVES', ''] }));
add(c({ id: 'bell', name: 'Dive Bell', cost: 1, icon: 'bell', rarity: 2, target: 'none',
  fight: [{ t: 'energy', n: 2 }, { t: 'draw', n: 1 }], fightText: ['+2 ENERGY', 'DRAW 1', ''], tools: ['LIGHT'], toolText: ['LIGHTS UP', 'DARK ALCOVES', ''] }));

export const REWARD_POOL: string[][] = [[], [], []];
Object.values(CARDS).forEach((d) => {
  if (!STARTING_DECK.includes(d.id)) REWARD_POOL[d.rarity].push(d.id);
});
