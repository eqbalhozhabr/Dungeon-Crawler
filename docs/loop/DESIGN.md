# Alley Echo: design document (prototype v0.1)

Working title (check it is free on CrazyGames / itch / Steam before release). Portrait 9:16, mouse + keyboard + touch, 180x320 pixel art drawn by code, about 45 KB of JavaScript, no image or audio files.
Status: playable prototype. Everything below is what the prototype does today, plus the open questions.

## 1. Pitch

An endless runner whose track is a **ring**: a sunset bazaar alley that loops back on itself. You run on the **outside** of the drum, seen through a fisheye lens, so the road falls away over the curve towards the sunset and the buildings splay and lean like in the reference picture. Every lap you run is **recorded and becomes a ghost** that repeats it on the next laps. A **3x3 rune grid under the street is the map of the alley** (3 districts x 3 lanes): slide the runes like a sliding puzzle to rebuild the street ahead of you, live, around your ghosts.

The question the whole game asks: **what do you leave behind for your next self?**

## 2. Pillars

1. **One input to run, one to build.** Steering is a lane choice (tap / drag / A D). Building is slide-puzzle taps on the grid. Both thumbs, no menus.
2. **The past is a tool.** Ghosts are your previous laps (3 at a time, oldest dissolves). They are immune, they hit and grab like you do, and a brute needs two hits at once, so you have to run with them.
3. **The map is the level.** Every rune tile is literally one lane of one district: its pictogram is what is in the street, its colour is the floor colour. Moving a tile moves that stretch of street.
4. **Sound comes from play.** No music track. See section 7.
5. **Readable at speed.** Items, floor colours, ghost routes (blue on the road and on the map), a "!" on foes no ghost will meet, locks on tiles you cannot touch.

## 3. The rules (all numbers live in `src/loop/logic`)

**The ring.** 30 rows = 3 districts of 10 rows, 3 lanes. You run at a constant speed that grows with each lap: `3.4 + 0.26 x lap` rows per second, capped at 7.2 (a lap takes 8.8 s, later about 4.2 s). Lap 1 starts after a 1.2 s breath.

**Steering.** You steer towards a wanted lane; crossing one lane takes 0.2 s. Taps are buffered, never dropped, but one runner cannot be everywhere: two foes in different lanes at the same row need a ghost.

**Auto-strike.** You hit whatever is in your lane when it is 1 row ahead. No attack button. What you choose is where to stand.

**Runes (tiles).** Each tile fills its lane of its district:

| Rune | In the street | Notes |
|---|---|---|
| Purse | 4 coins | 1 coin each |
| Thief | 2 thieves | 1 hit, pays 2 |
| Brute | 1 brute | 2 hits **at once** (you + a ghost, or two ghosts), pays 5. A living foe that reaches you costs a heart |
| Spikes | 2 spike strips (3 from lap 3) | Cost a heart. Ghosts walk through |
| Well | 1 well | Heals a heart, or pays 3 coins when you are healthy |

Everything respawns when you leave its district. A start layout has 8 runes + 1 gap, and never two blockers (spikes/brute) in one district.

**Ghosts.** At the end of a lap your lane at every quarter row is stored. Next lap that path is a ghost running beside you, doing what you did: hitting, grabbing. Max 3; the oldest is dropped. Ghosts are never hurt. When you share a lane with a ghost you get the credit.

**Sliding.** Tap a tile in line with the gap: the tile (or the whole chain up to it) slides in. A district is **locked** while you run through it and in its last 3 rows before you reach it (padlock on the tile). The tiles that can move glow.

**Alert.** Each foe tile that still has a live foe when you leave its district raises the alert by 1; sweeping a district that had foes lowers it by 1. At 7 the guards arrive: you lose a heart and the alert drops to 3. This is what makes the grid matter: foes left in a lane nobody runs will cost you.

**Tremor (every 3rd lap).** One Purse turns into a Thief or a Thief into a Brute, spikes get denser, and one tile near the gap slides on its own.

**Hearts and score.** 3 hearts, 1.1 s of invulnerability after a hit. Score = coins + 5 per lap. Best score and run count are saved in localStorage.

**The view.** The road is the outside of a cylinder (radius `CAM.R` rows). Ahead of you it drops away, and the curve hides everything past about 12 rows; buildings stand radially, so far ones lean away. A fisheye lens (`CAM.lens`, 1 = none) then bends everything: near buildings splay outwards, verticals bow. Walls are drawn as grids of small projected quads so the bending shows. Tuning: `CAM` in `src/loop/camera.ts` (curve, camera height/pitch, focal length, lens).

## 4. Screens and controls

- **Street (top).** Tap or drag anywhere on it to choose the lane. Keyboard: A / D or arrows, 1 2 3.
- **Grid (bottom).** Tap / click a tile to slide it (hover or tap shows its name). The gold playhead is where you are on the ring; red line = your current lap; blue lines = ghost routes.
- P / Space pauses, M mutes, Enter starts. The game pauses when the tab loses focus.
- The title screen is an attract mode: a bot runs the alley behind the logo.
- First-run hints (once each, saved): steering, coins/spikes, alert, ghost, sliding, brutes.

## 5. Why this should fit CrazyGames

- Portrait, one-handed or two-thumb, understandable in seconds; a run is 1 to 4 minutes, so "one more try" is cheap.
- Retention levers already in: best score, a rule that rewards getting better at reading the map, and a layout that changes every run (seeded; `?seed=123` replays one).
- Not yet in (candidates): daily alley (shared seed, a short leaderboard-free goal), unlocking new runes / ghost voices / districts, a gentle run-to-run goal ("beat your best lap"), cosmetic ghosts.
- Size and load: 45 KB of script, instant start. Portal rules (no SDK ads in Basic Launch, no outside links, no orientation lock) are respected; the portal build flag is the same one as the other games (`src/target.ts`).

## 6. Balance notes (`npm run sim:loop`)

`scripts/loop-sim.ts` plays whole runs with bots (seeded). The `dodger` bot only steers (never slides): median about 8-12 laps, a long tail where the starting layout is kind. A bot that stays in the middle lane dies in a lap or two. The alert and tremor numbers were tuned so that the steering-only bot loses hearts to the guards a few times per run, so sliding has something to fix. A human with the grid should beat the bot; that is the thing to playtest first.

Tuning knobs: speed ramp, lane-step time (0.2 s), alert size (7) and its drop (3), tremor period (3), foe tile contents, start layout.

## 7. Music from play

All sounds are synthesised in `src/loop/audio.ts` (WebAudio). The score is not a track but a result of play:

- **Pulse:** one soft tick per ring row, so the tempo is your speed (and rises every lap); a low thump every 5 rows and a heavier one at each district gate.
- **Notes:** coins, kills and every lane change play a note of a D phrygian-dominant (Hijaz-like) scale. The degree comes from the lane and position on the ring, so the same stretch of street always rings the same.
- **Ghosts are voices:** each ghost replays your lane changes with its own timbre (glass bell, marimba, reed). The more laps you have run, the more layers play, and they are literally your previous laps.
- **Drone** under the run; a bell chord on every lap; a low rumble for tremors and guards; a stone scrape when a tile slides.
- Because pickups only sound for who got them, a good sweep (everything collected by someone) sounds fuller than a messy one.

## 8. Code map

| Path | What |
|---|---|
| `src/loop/logic/` | Pure rules: `game.ts` (ring, ghosts, alert, sliding), `runes.ts` (tile contents), `bot.ts` (sim and attract mode) |
| `src/loop/camera.ts` | The camera: outside-of-a-drum geometry, fisheye lens, ground map (all the look is tuned in `CAM`) |
| `src/loop/scene.ts` | The street: per-pixel ground, buildings (grids of projected quads so edges bend), sprites, effects |
| `src/loop/panel.ts` | Rune grid, HUD, banners, hints |
| `src/loop/art/` | `buf.ts` software pixel buffer (polygons, text, sprites), `sprites.ts` ASCII sprites |
| `src/loop/audio.ts` | Synth and the event-driven music |
| `src/loop/main.ts` | Canvas, input, screens, glue |
| `scripts/loop-*.{ts,mjs}` | Sim, rule checks, browser smoke test, screenshots |

Run: `npm run dev:loop`, `npm run build:loop`, `npm run test:loop`, `npm run sim:loop -- 300 dodger 2.5`.
Smoke test: `LOOP_OUT=dist-loop-dbg VITE_ENABLE_DEBUG=1 npm run build:loop && node scripts/loop-smoke.mjs`.
One-file playable copy: `npm run build:loop && node scripts/make-single-file.mjs out.html dist-loop "Alley Echo" scripts/loop-single.tpl.html`.

## 9. Open questions for the next playtest

1. Does "run + build" at once feel good, or is it too much? (Option: an easy mode where the street slows while you touch the grid.)
2. Is the ghost mechanic clear in lap 2 without reading? (Ghost routes are shown in blue on the road and on the map.)
3. Is the alert the right pressure, or does it feel unfair on lap 1 (no ghosts yet)?
4. Do 3 ghosts and 3 districts give enough puzzle, or do they solve too quickly? Candidates: 4 districts, a "reroll" rune, ghost editing.
5. What is the long-term hook for the portal: daily alley, unlocks, or score chase?
