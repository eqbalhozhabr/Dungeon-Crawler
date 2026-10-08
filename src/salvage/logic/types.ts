// "Gullet Salvage" (working title): a first-person deckbuilder inside a leviathan's belly.
// Every card is a found object with TWO faces: what it does in a fight and what it does as a tool.
// Monsters carry the same objects and play them too, on either face, and you cannot tell which.

export type Tool = 'PRY' | 'CUT' | 'DIG' | 'KEY' | 'LIGHT';
export type Status = 'dazzle' | 'sleep' | 'burn';
export type FixtureKind = 'valve' | 'cyst' | 'pod';

export type Effect =
  | { t: 'dmg'; n: number; hits?: number; ifStatus?: [Status, number] }
  | { t: 'dmgAll'; n: number }
  | { t: 'heal'; n: number }
  | { t: 'draw'; n: number }
  | { t: 'energy'; n: number }
  | { t: 'status'; s: Status; n: number }
  | { t: 'statusAll'; s: Status; n: number }
  | { t: 'sharpen'; n: number }
  | { t: 'fatal'; do: 'draw' | 'heal' | 'energy'; n: number }
  /** take the enemy's current card into your hand, free this turn */
  | { t: 'grab' }
  /** see which face every enemy will play this turn */
  | { t: 'peek' };

export type Target = 'enemy' | 'none';

export interface CardDef {
  id: string;
  name: string;
  cost: number;
  /** icon key (see art/icons.ts) */
  icon: string;
  rarity: 0 | 1 | 2;
  target: Target;
  fight: Effect[];
  /** Three short lines for the card face, fight side (max 10 characters each). */
  fightText: [string, string, string];
  /** Tool tags: what this object can do to the world (valves, cysts, pods, dark alcoves). */
  tools: Tool[];
  /** Short line for the strip under the card (max 10 characters). */
  toolShort: string;
  /** Three lines for the big inspect view, tool side. */
  toolText: [string, string, string];
  /** The tool use destroys the card for the rest of the run (an old key). */
  toolConsumes?: boolean;
  /** Played in a fight, it is used up for this fight (food, medicine). */
  exhaust?: boolean;
}

export interface CardInst {
  uid: number;
  id: string;
  /** permanent growth: +bonus to the first damage / heal number */
  bonus: number;
  /** spat out or taken from an enemy during this fight: disappears at the end of the fight unless kept as a reward */
  temp?: boolean;
  /** costs 0 this turn (grabbed from an enemy) */
  free?: boolean;
}

export type IntentKind = 'attack' | 'drain' | 'heal' | 'idle';
/** What an enemy does with its bare hands (when it holds no object). */
export interface Intent {
  kind: IntentKind;
  n: number;
  hits?: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  art: string;
  /** objects it may have swallowed: its kit is picked from here */
  swallowed: string[];
  kitCount: number;
  /** fixed kit instead of a random one */
  fixedKit?: string[];
  /** what it does when it holds nothing */
  natural: Intent[];
  trait?: 'drain' | 'thief';
  boss?: boolean;
  elite?: boolean;
}

export type RoomKind = 'corpse' | 'fight' | 'elite' | 'valve' | 'cyst' | 'alcove' | 'pool' | 'boss';
export type FightVariant = 'plain' | 'thief' | 'acid' | 'ambush';

export type CombatEvent =
  | { t: 'draw'; uids: number[] }
  | { t: 'dmg'; i: number; n: number; fatal: boolean }
  | { t: 'hurt'; n: number; from: number }
  | { t: 'heal'; n: number }
  | { t: 'enemyHeal'; i: number; n: number }
  | { t: 'status'; i: number; s: Status }
  | { t: 'pstatus'; s: Status }
  | { t: 'spit'; i: number; uid: number }
  | { t: 'energy'; n: number }
  | { t: 'act'; i: number; cardId?: string; face?: 'fight' | 'tool'; idle?: boolean }
  | { t: 'steal'; uid: number; i: number }
  | { t: 'sharpen'; n: number }
  | { t: 'hiccup' }
  | { t: 'burn'; i: number; n: number }
  | { t: 'pburn'; n: number }
  | { t: 'acid'; n: number }
  | { t: 'disarm'; i: number; uid: number }
  | { t: 'grab'; i: number; uid: number }
  | { t: 'fixture'; f: number; kind: FixtureKind; by: 'you' | 'enemy'; i?: number }
  | { t: 'peek' }
  | { t: 'flee'; i: number; lost: boolean }
  | { t: 'returned'; uids: number[] }
  | { t: 'turn'; n: number }
  | { t: 'win' }
  | { t: 'lose' };
