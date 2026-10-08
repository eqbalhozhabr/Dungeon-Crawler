// "Gullet Salvage" (working title): a first-person deckbuilder inside a leviathan's belly.
// Every card is a found object with TWO faces: what it does in a fight and what it does as a tool in a room.

export type Tool = 'PRY' | 'CUT' | 'DIG' | 'KEY' | 'LIGHT';
export type Status = 'dazzle' | 'sleep' | 'burn';

export type Effect =
  | { t: 'dmg'; n: number; hits?: number; ifStatus?: [Status, number] }
  | { t: 'dmgAll'; n: number }
  | { t: 'splash'; n: number; adj: number }
  | { t: 'heal'; n: number }
  | { t: 'draw'; n: number }
  | { t: 'energy'; n: number }
  | { t: 'status'; s: Status; n: number }
  | { t: 'statusAll'; s: Status; n: number }
  | { t: 'sharpen'; n: number }
  | { t: 'fatal'; do: 'draw' | 'heal' | 'energy'; n: number };

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
  /** Tool tags: what this object can do to the world (valves, cysts, dark alcoves). */
  tools: Tool[];
  toolText: [string, string, string];
  /** The tool use destroys the card for the rest of the run (an old key). */
  toolConsumes?: boolean;
  /** Played in a fight, it is used up for this fight (food, medicine, anchors). */
  exhaust?: boolean;
}

export interface CardInst {
  uid: number;
  id: string;
  /** permanent growth: +bonus to the first damage / heal number */
  bonus: number;
  /** spat out by an enemy during this fight: disappears at the end of the fight unless kept as a reward */
  temp?: boolean;
}

export type IntentKind = 'attack' | 'drain' | 'heal' | 'steal' | 'idle';
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
  /** world width of the sprite in belt units */
  size: number;
  pattern: Intent[];
  /** what it may have swallowed (card ids), picked at random per enemy */
  swallowed: string[];
  boss?: boolean;
  elite?: boolean;
}

export type RoomKind = 'corpse' | 'fight' | 'elite' | 'valve' | 'cyst' | 'alcove' | 'pool' | 'boss';

export interface MapStep {
  options: { kind: RoomKind; enemies?: string[] }[];
}

export type CombatEvent =
  | { t: 'draw'; uids: number[] }
  | { t: 'dmg'; i: number; n: number; fatal: boolean }
  | { t: 'hurt'; n: number; from: number }
  | { t: 'heal'; n: number }
  | { t: 'enemyHeal'; i: number; n: number }
  | { t: 'status'; i: number; s: Status }
  | { t: 'spit'; i: number; uid: number }
  | { t: 'energy'; n: number }
  | { t: 'act'; i: number; intent: Intent }
  | { t: 'steal'; uid: number; i: number }
  | { t: 'sharpen'; n: number }
  | { t: 'hiccup' }
  | { t: 'burn'; i: number; n: number }
  | { t: 'turn'; n: number }
  | { t: 'win' }
  | { t: 'lose' };
