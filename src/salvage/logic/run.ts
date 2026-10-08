import { Rng } from '../../rng';
import { CARDS, REWARD_POOL, STARTING_DECK } from './cards';
import type { Mood } from './combat';
import type { CardInst, RoomKind, Tool } from './types';

export const MAX_HP = 40;
export const START_HP = 40;

export interface Room {
  kind: RoomKind;
  enemies?: string[];
  mood?: Mood;
}

/** One belly = one path of 8 steps; most steps give a choice of two rooms. */
export function makeMap(rng: Rng): Room[][] {
  const hic = (): Mood => (rng.chance(0.5) ? 'hiccup' : 'calm');
  const fight = (enemies: string[], mood: Mood = hic()): Room => ({ kind: 'fight', enemies, mood });
  const explorePair = (): Room[] => rng.shuffle([{ kind: 'valve' }, { kind: 'cyst' }] as Room[]);
  return [
    [{ kind: 'corpse' }],
    [fight(['mite', 'tick'], 'calm')],
    explorePair(),
    [rng.chance(0.5) ? fight(['slug', 'mite']) : fight(['leech', 'tick'])],
    [{ kind: 'pool' }, { kind: 'alcove' }],
    [fight(['slug', 'leech', 'tick']), { kind: 'elite', enemies: ['tick', 'warden'], mood: hic() }],
    rng.chance(0.5) ? [{ kind: 'valve' }, { kind: 'alcove' }] : [{ kind: 'cyst' }, { kind: 'pool' }],
    [{ kind: 'boss', enemies: ['tick', 'mama', 'tick'], mood: 'hiccup' }],
  ];
}

export const NEEDS: Partial<Record<RoomKind, Tool[]>> = {
  valve: ['PRY', 'KEY'],
  cyst: ['CUT', 'DIG'],
  alcove: ['LIGHT'],
};

export const BASH_COST = 4;
export const POOL_HEAL = 12;
export const CYST_HEAL = 6;

export class Run {
  deck: CardInst[] = [];
  hp = START_HP;
  maxHp = MAX_HP;
  step = 0;
  map: Room[][];
  won = false;
  lost = false;
  private uid = 1;
  readonly rng: Rng;

  constructor(readonly seed: number) {
    this.rng = new Rng(seed);
    this.map = makeMap(this.rng);
    STARTING_DECK.forEach((id) => this.add(id));
  }

  add(id: string): CardInst {
    const c: CardInst = { uid: this.uid++, id, bonus: 0 };
    this.deck.push(c);
    return c;
  }

  remove(uid: number): void {
    this.deck = this.deck.filter((c) => c.uid !== uid);
  }

  heal(n: number): number {
    const g = Math.min(n, this.maxHp - this.hp);
    this.hp += g;
    return g;
  }

  /** Pick `n` different cards; rarity odds depend on how deep we are. */
  rewardOptions(n: number, opts: { minRarity?: number; extra?: string[]; bias?: number } = {}): string[] {
    const depth = this.step / 7;
    const odds = [0.72 - 0.25 * depth, 0.26 + 0.14 * depth, 0.02 + 0.11 * depth];
    const out: string[] = [];
    const guard = 80;
    for (let g = 0; g < guard && out.length < n; g++) {
      let r = 0;
      const x = this.rng.next();
      if (x > odds[0]) r = x > odds[0] + odds[1] ? 2 : 1;
      if (out.length === 0 && (opts.minRarity ?? 0) > r) r = opts.minRarity!;
      const id = this.rng.pick(REWARD_POOL[r]);
      if (!out.includes(id)) out.push(id);
    }
    return out;
  }

  exploreHand(n = 5): CardInst[] {
    return this.rng.shuffle(this.deck.slice()).slice(0, n);
  }

  fits(room: RoomKind, id: string): boolean {
    const need = NEEDS[room];
    if (!need) return false;
    return CARDS[id].tools.some((t) => need.includes(t));
  }

  /**
   * Open a prop with a card (uid) or by brute force (null: -4 HP, smaller prize).
   * The prize is a "take one" list of cards, and sometimes some healing.
   */
  explore(kind: RoomKind, uid: number | null): { hpLost: number; healed: number; options: string[]; consumed: boolean } {
    if (kind === 'corpse') return { hpLost: 0, healed: 0, options: this.rewardOptions(3, { minRarity: 0 }), consumed: false };
    const card = uid === null ? undefined : this.deck.find((c) => c.uid === uid);
    if (!card || !this.fits(kind, card.id)) {
      this.hp = Math.max(1, this.hp - BASH_COST);
      return { hpLost: BASH_COST, healed: 0, options: this.rewardOptions(2), consumed: false };
    }
    const consumed = !!CARDS[card.id].toolConsumes;
    if (consumed) this.remove(card.uid);
    const healed = kind === 'cyst' ? this.heal(CYST_HEAL) : 0;
    return { hpLost: 0, healed, options: this.rewardOptions(3, { minRarity: kind === 'cyst' ? 0 : 1 }), consumed };
  }

  advance(): void {
    this.step++;
    if (this.step >= this.map.length) this.won = true;
  }
}
