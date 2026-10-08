# Guts & Gems: hand-drawn art brief

Everything in the game is currently drawn by code (placeholders). This list says what to draw by hand
so the game can be upgraded later, one group at a time. Nothing here is needed to finish the gameplay.

## How the art is used (read first)

- The game runs at **480x270** (16:9) and is scaled up by whole numbers. "Native" sizes below are in
  those game pixels. For a **painted / ink look** draw at **4x** the native size (1920x1080 for a full
  screen) and we scale down or keep it high-res; for **pixel art** draw at native size.
  Decide per group; the code can use both, but mixing styles inside one scene looks wrong.
- Light comes from the **top-left**. Dark ink outline colour: `#1a0a14` (1 px native, 4 px at 4x).
  Flat colour bands + one highlight; no soft gradients (ordered dither only in fog/shadows).
- Colour-blind safe: the four colours (ruby / emerald / sapphire / topaz) also differ in **silhouette**:
  gems are diamond / cut-square / round / hexagon; bugs have antennae / horns / crest / round ears.
- Transparent PNG, one file per item, file name = the texture key in the code (column "key").
- Deliver in the order of the groups; **A and B change the look the most**.

## A. Gameplay sprites (every frame of play uses them)

| Item | key | Native size | Frames | Notes |
|---|---|---|---|---|
| Gems (4 colours) | `gem_0..3` | 24x24 | 1 (+1 glint frame) | ruby diamond, emerald cut-square, sapphire round, topaz hexagon |
| Bugs (4 colours) | `bug_0..3_0/1` | 28x26 | 2 wiggle frames each (+ optional hurt frame) | angry faces, different silhouette per colour (see above) |
| Bone | `bone` | 24x24 | 1 | harmless blocker |
| Ground shadow | `shadow` | 24x8 | 1 | soft dark ellipse |
| Danger bubble | `warn` | 13x14 | 1 | black blob with red "!" (bug reaches you next squeeze) |
| Sticky slime marker | `slime` | 14x8 | 1 | green goo under a bug |

## B. The tunnel (first-person plates), one set per creature

The tunnel is currently generated per creature from a 7-colour ramp. If you paint it instead, use the
camera guide `docs/art-guides/first-person-camera-guide.png` (vanishing point (240,65), belt = the
lighter trapezoid, blue boxes = UI, red = keep clear).

| Item | key | Native size | Notes |
|---|---|---|---|
| Tunnel plate x5 creatures, 2 "boil" variants each | `fp_bg_<palette>_0/1` | 480x270 | floor + walls + far end. Lines may wobble a little between the two variants (hand-drawn feel). Palettes: pink (Frog), swamp (Toad), dusk (Hippo), moss (Slug), rust (Mammoth), ramps below |
| Exit door, 3 states | `fp_exit_0..2` | 56x56 | closed / half open / open and glowing; sits at the far end of the tunnel |
| Digestion tide (acid) | `fp_acid_0..3` | 480x66 | rises from the bottom edge; 4 frames loop; foam on top edge |
| Wall rib (optional) | new | 480x270 overlay | arch that glides towards the player at each step |

Creature palettes (dark to light, 7 steps): pink `12050c 21101a 361626 52213a 7a2f4b a84a63 d8788a`,
swamp `08130e 10241b 1b3a2b 2c5a42 468060 6fa884 a0d4a8`, dusk `0a0c1a 141830 222850 353d7a 4e59a0 7882c8 a6aeea`,
moss `14120a 241f10 3a3118 584a20 7c6c2c a6924a d2be78`, rust `160808 2a0e0e 461818 6c2a22 984430 c46c48 e8a070`.

## C. Cards

| Item | key | Native size | Notes |
|---|---|---|---|
| Hand card frame: normal / selected / dimmed | `card_big`, `card_big_sel`, `card_big_dim` | 66x94 | banner on top (name), cost circle top-left, icon window, tag pill, 3-line text box. Text is drawn by code on top of the frame, so keep those areas flat |
| Compact card (flat view) | `card`, `card_sel`, `card_dim` | 62x40 | |
| Tool icons x13 | `ico_pick`, `ico_zapper`, `ico_net`, `ico_shove`, `ico_magnet`, `ico_broom`, `ico_antidote`, `ico_lantern`, `ico_glue`, `ico_spray`, `ico_forage`, `ico_adrenaline`, `ico_dynamite` | 13x13 (drawn big for the reward screen at 2x) | pick = pickaxe, zapper = bolt, net = mesh, shove = arrow, magnet = horseshoe, broom, antidote = bottle, lantern, glue = tube, spray = can, forage = mushroom, adrenaline = heart, dynamite |
| Energy bolt (full / empty) | `bolt_on`, `bolt_off` | 7x10 | |
| Energy orb | `orb` | 38x38 | shows the number of energy left |

## D. Creatures

| Item | key | Native size | Notes |
|---|---|---|---|
| Portraits x5 + lock | `portrait_frog/toad/hippo/slug/mammoth`, `portrait_lock` | 28x28 | used on the map and in the level intro. Frog (gentle), Hiccup Toad (bubble), Burp Hippo, Sticky Slug (drips), Mouldy Mammoth (tusks, moss) |
| Intro illustrations (optional) | new | 120x90 | bigger version of the portrait for the level intro card |
| Hero: idle / cheer / hurt (+ 2 walk frames) | `hero_idle`, `hero_cheer`, `hero_hurt` | 18x24 | tiny miner with a helmet lamp (flat view panel and title) |
| Gloved hand holding the map (optional) | new | 110x110 | like the reference: the map is held in a hand |

## E. UI, title and map

| Item | key | Native size | Notes |
|---|---|---|---|
| Title wordmark "GUTS & GEMS" | new | 400x70 | replaces the pixel text on the title screen |
| Map parchment with the gut winding from the mouth (bottom left) to the exit (top right) | `map_bg` | 480x270 | node positions are fixed in code: (62,178) (142,124) (226,168) (316,114) (400,70), exit (446,36); mouth at (22,206) |
| Map node ring: normal / completed | `map_node`, `map_node_done` | 40x40 | |
| Stars on / off | `star_on`, `star_off` | 11x11 | |
| Infection pips on / off | `pip_on`, `pip_off` | 7x7 | |
| Buttons (optional) | new | 9-slice, 24x24 | currently flat rectangles |

## F. Effects (optional, last)

Hit burst (4-6 frames, 32x32), zap lightning segment, gem glint, floating dust speck (1-2 px),
"HIC!" / "BURP!" word art (frames), acid foam tile, vignette (`fx_vignette`, 480x270) and film grain
(`fx_grain_0..2`, 480x270, mostly transparent).

## G. Store and marketing (CrazyGames, when the game is ready)

Covers 1920x1080, 800x1200, 800x800 (title and key art out of the top-left corner, see
`docs/CRAZYGAMES_PLAYBOOK.md` section 6), logo, optional 15-20 s preview videos (we record those from the game).

## How hand-drawn files get into the game

For now: put the files in `art/<key>.png` in this repo. The code can load a texture from such a file when it
exists and keep the generated one otherwise (to be added when the first files arrive). Keep names exactly as
the "key" column and tell me which group you finished.
