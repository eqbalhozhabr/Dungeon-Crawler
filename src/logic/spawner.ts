import { Rng } from '../rng';
import type { Colour, Kind, LevelDef } from './types';

export interface Spawn {
  kind: Kind;
  colour: Colour;
}

// The creature's "menu": produces the next column of food. Bugs come in colonies:
// each lane keeps a colony colour for a few columns, so same-colour clusters form.
export class Spawner {
  private laneColour: Colour[];
  private laneLeft: number[];

  constructor(
    private rng: Rng,
    private rows: number,
    private spawn: LevelDef['spawn'],
  ) {
    this.laneColour = [];
    this.laneLeft = [];
    for (let r = 0; r < rows; r++) {
      this.laneColour.push(rng.int(4) as Colour);
      this.laneLeft.push(1 + rng.int(3));
    }
  }

  nextColumn(): (Spawn | null)[] {
    const col: (Spawn | null)[] = [];
    for (let r = 0; r < this.rows; r++) {
      if (--this.laneLeft[r] <= 0) {
        this.laneColour[r] = this.rng.int(4) as Colour;
        this.laneLeft[r] = 1 + this.rng.int(3);
      }
      const roll = this.rng.next();
      const { pBug, pGem, pBone } = this.spawn;
      if (roll < pBug) {
        const colour = this.rng.chance(0.75) ? this.laneColour[r] : (this.rng.int(4) as Colour);
        col.push({ kind: 'bug', colour });
      } else if (roll < pBug + pGem) {
        col.push({ kind: 'gem', colour: this.rng.int(4) as Colour });
      } else if (roll < pBug + pGem + pBone) {
        col.push({ kind: 'bone', colour: 0 });
      } else {
        col.push(null);
      }
    }
    // never send a completely empty column
    if (!col.some((c) => c !== null)) {
      const r = this.rng.int(this.rows);
      col[r] = { kind: 'gem', colour: this.rng.int(4) as Colour };
    }
    return col;
  }
}
