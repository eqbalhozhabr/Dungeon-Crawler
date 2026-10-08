# Guts & Gems: design notes (prototype v0.4)

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

## What is new in v0.3 / v0.4
- **You walk forward.** Ribs on the walls and lines on the floor glide towards the camera at every
  squeeze (and back at a burp), dust drifts past, the exit door is at the far end of the tunnel, and the
  acid became the **digestion tide** that rises from the bottom edge as the clock runs out. Rules are
  unchanged: things "reaching you" is the old "reaching the acid".
- **Look**: inked, cel-shaded tunnel (thick dark membranes, flat colour bands, light only where the lamp
  reaches), pixel-dither vignette, drifting dust, animated film grain, two "boil" frames of the tunnel
  swapped 4 times a second. Each creature has its own colour palette.
- **Hand of cards**: large cards (banner, cost circle, icon window, tag, 3-line text). Only the top
  part shows at rest; hover / select raises it. Never in the bottom 20 px (iPhone home-indicator zone).
- **Journey map** (parchment, a gut from mouth to exit): five creatures, each unlocked by escaping the previous one.
  - Tiny Frog: no quirk.
  - Hiccup Toad: every 4th squeeze steps twice. A counter warns you.
  - Burp Hippo: every 5th squeeze the belt runs backwards (a breather, but gems are lost at the far end).
  - Sticky Slug: some bugs are slimy for the next squeeze: they stay and jam the belt behind them.
  - Mouldy Mammoth: gems on the belt can rot into bugs.
- **Six new cards** (13 tools in total): Lantern (reach +2 this turn), Glue (a bug stays put for one
  squeeze), Spray (kills every bug of one colour), Forage (free: draw 2), Rush (free: +2 energy, digestion +1),
  Blast (3x3 area, costs 3). Rewards offer new cards more often than the basic ones.
- Balance (greedy bot, 1500 seeds, base deck): Frog 93 %, Toad 78 %, Hippo 82 %, Slug 82 %, Mammoth 75 %.
  Run `npm run sim -- 1500 all` and `npm run sim -- 1000 4 dynamite spray glue` to see reward effects.

## What is new in v0.2
- **First-person view** (default; key `V` or the V button switches to the flat view, the run is kept).
  The belt is drawn in real perspective: items travel *towards you* and the acid pool is at your feet,
  so "near = big = urgent". One camera model (`FP` + `fpProject()` in `src/config.ts`) is shared by the
  tunnel texture, the sprites and mouse picking. The tunnel (walls, floor grid, far-end mouth, acid
  frames) is ray-cast per pixel at boot in `src/art/fp.ts` (no image files).
- **Reach**: only the nearest 5 columns can be targeted (`level.reach`). Items further away are dimmed
  and wait behind a dashed gold line. Adds tactics (Shove pushes an item out of reach) and keeps tiny
  far-away targets out of play. Both views show it.
- **Hand tucked away** in the first-person view: only the top of each card peeks in from the bottom
  edge; hover / tap raises it. UI is reduced to an energy orb, the infection list and two buttons.
- **Danger markers**: a bug that reaches the acid at the next squeeze gets a "!" (pulsing when it would
  make you too sick). Red full-screen flash on infection, white burst on kills.
- **Rewards**: after an escape, choose 1 of 3 tool cards (or "No thanks"). The card joins the starting
  deck of every later run (saved in localStorage; "Reset deck" on the title screen).
  New tools: **Magnet** (2, pulls 3 gems of one colour), **Broom** (2, sweeps a lane in reach),
  **Antidote** (2, cures one infection pip, played straight from the hand).
- Balance after the changes (bots, 2000 seeds): greedy 93 % win, gems-only 10 %, random 12 %.
  `npm run sim -- 1500 magnet` shows how a reward card shifts it (Magnet is the strongest).

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
Tiny Frog: digest 20, quota 210, stars at 280 / 350, reach 5.
Greedy bot wins ~93 %, "gems only" bot ~10 % (rushing gems without handling bugs gets you sick),
random bot ~12 %. These are bots, not humans: expect to re-tune after playtests.

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

## Ideas from the Shroom and Gloom footage (not built yet)
Interactable glow outlines, a parchment map held in a gloved hand (here: an anatomy map
mouth > throat > stomach > intestine), a colour grade per area, a "gift from below" chest with
perks, rooms that use a second small deck on world objects (valve, cyst), intro/outro shots.

## Open questions / next steps
- Is the turn loop fun for 10+ minutes? Needs more creatures (each with a rule-bending quirk:
  hiccups, burps, sticky cells...), between-level tool picks, a daily creature, a collection.
- Tutorial: currently hint line + "?" help. Probably needs a guided first turn.
- Title/name must be checked for originality on CrazyGames/itch/Steam before release.
