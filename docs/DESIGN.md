# Design notes (prototype v0.1)

## Pitch
You are a tiny miner inside a creature. Each level is a different creature. Gems float down its
digestive belt; so do bugs. You have a few turns' worth of time before it digests you: hit the
score quota, then **escape out the other end**. Stay longer for more points - at your own risk.

Inspired by *ideas* (not names, art or text) from the asymmetric board game "So, You've Been
Eaten" and the double-deck idea of "Shroom and Gloom". Our version is a single-player puzzle
with its own rules, characters and art. (Not legal advice: keep names, art, card layouts and
text original; CrazyGames also rejects clones and confusable names.)

## Core loop (turn)
1. You hold a hand of 4 **tool cards** and have 3 **energy**. Tools cost 1-2 energy.
2. Play tools on the **belt** (5 lanes x 8 columns): collect gems, kill bugs, shove items back.
3. **Squeeze** (end turn): everything slides one column towards the **acid**. A new column
   enters from the creature's mouth (the next column is always shown: no hidden randomness).
   Bugs that reach the acid raise the **infection** of their colour; gems that reach it dissolve.
4. Every squeeze advances **digestion**. Digestion full = *Digested*. Any infection colour at
   3 = *Too sick*.
5. Reach the **quota** and the exit opens. **Escape** any time for a time bonus (5 pts per
   remaining digestion step), or push your luck for 2 and 3 stars.

## Tools (starting deck: 9 cards)
| Tool | Cost | Effect |
|---|---|---|
| Pick x3 | 1 | One cell: collect the gem or smash the bug/bone. |
| Zapper x2 | 1 | Kills a bug and every connected bug of the same colour (a colony). |
| Net x2 | 2 | 2x2 area: collects all gems inside (bigger sets score more). |
| Shove x2 | 1 | Pushes an item back one column (needs an empty cell behind it). |

Scoring: 10 per gem + 5 x (n choose 2) set bonus for n gems in one action; x2 if all gems are the
same colour. Bugs come in colonies (same colour clusters) so Zapper matters.

## Balance (scripts/sim.ts, 2000 seeds each)
Tiny Frog: digest 18, quota 210, stars at 280 / 350.
Greedy bot wins ~94 %, "gems only" bot ~38 % (rushing gems without handling bugs usually gets
you sick), random bot ~11 %. These are bots, not humans: expect to re-tune after playtests.

## Art and sound by code
- 480x270 internal resolution (16:9), integer-scaled (exactly 4x at 1080p). `pixelArt: true`.
- Gems: shaded facet generator (4 cuts: diamond, octagon, round, hexagon - colour-blind friendly).
- Bugs: parametric blob with colour-specific silhouette (antennae / horns / crest / ears), 2 wiggle frames.
- Walls, background, acid, exit: Voronoi + Bayer dithering + sine waves.
- Text: own 5x7 pixel font defined as data. Sound: WebAudio synthesis, no files.
- Animations are tweens (squash, fly-to-score, dissolve, shake). One or two frames per sprite.

## CrazyGames fit (see CRAZYGAMES_PLAYBOOK.md)
Size ~1.5 MB; loads instantly (no assets); mouse + touch + keyboard; landscape; no external
requests; localStorage progress (auto-synced by CrazyGames); English only; PEGI-12 humour.
Not done yet: covers (3) and preview videos (2), store texts, safe-area testing on real devices,
an `AdService` seam for Full Launch ads, SDK `gameplayStart/Stop`.

## Open questions / next steps
- Is the turn loop fun for 10+ minutes? Needs more creatures (each with a rule-bending quirk:
  hiccups, burps, sticky cells...), between-level tool picks, a daily creature, a collection.
- Tutorial: currently hint line + "?" help. Probably needs a guided first turn.
- Title/name must be checked for originality on CrazyGames/itch/Steam before release.
