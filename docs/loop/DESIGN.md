# Alley Echo: design document (prototype v0.2)

Working title (check it is free on CrazyGames / itch / Steam before release). Portrait 9:16, mouse + keyboard + touch, 180x320 pixel art drawn by code, about 50 KB of JavaScript, no image or audio files.
Status: playable prototype. Everything below is what the prototype does today, plus the open questions.

## 1. Pitch

An endless runner on a **ring**: a sunset bazaar alley that loops back on itself. You run on the **outside** of the drum, seen through a fisheye lens, so the road falls away over the curve towards the sunset and the buildings splay and lean.

Every lap you run is **recorded and becomes a ghost** that repeats it on the next laps (3 at a time). At the start of every lap there is a **seal**: three plates on the road, one per lane, say how many runners must stand in each lane at that moment. The runners are you and your ghosts. Match the plates and the lap pays more; miss and it pays half.

The lane you stand in at the seal stays behind as a ghost for the next three laps, so it takes part in the next four formations. That is the puzzle: **what do you leave behind for your next selves?**

## 2. Pillars

1. **One input.** Steering is a lane choice (tap/drag anywhere, or A D). No attack button, no menus.
2. **The past is the puzzle.** Ghosts are your previous laps. Where you stood at the seal decides what the next four seals can ask of you.
3. **Plan, then run.** Dodging and collecting is the action layer; choosing the seat is the planning layer. The board at the bottom shows the next four seals.
4. **Sound comes from play.** No music track. See section 7.
5. **Readable at speed.** Plates on the road, a board with the same plates below, blue ghosts, red you, a streak bar.

## 3. The rules (all numbers live in `src/loop/logic`)

**The ring.** 36 rows = 3 districts of 12 rows, 3 lanes. You run at a constant speed that grows with each lap: `3.4 + 0.26 x lap` rows per second, capped at 7.2 (a lap takes 10.6 s, later 5 s). The first lap starts after a 2.4 s breath so you can read the first seal.

**Steering.** You steer towards a wanted lane; crossing one lane takes 0.2 s. Taps are buffered, never dropped.

**Auto-strike.** You hit whatever is in your lane when it is 1 row ahead. No attack button.

**The street.** 9 stretches of street (3 districts x 3 lanes): 3 purses (4 coins), 2 thieves (1 hit, pay 2), 2 spike strips (cost a heart), a well (heals, or pays 3 when you are healthy) and one open lane. Everything lies in rows 3 to 8 of a district; the rest is open street, so there is room to change lane before and after the seal. No district has two spike lanes. Every third lap one stretch turns worse (open -> purse -> thief -> spikes) and spikes get longer.

**Ghosts.** At the end of a lap your path is stored. Next lap it is a ghost running beside you, hitting and grabbing exactly like you did. Max 3; the oldest dissolves. Ghosts are never hurt. When you share a lane with a ghost you get the credit.

**The seal (at row 0).** When you cross it, every runner stands in a lane: your lane right now, and the lane each ghost stood in at its own seal (its "seat"). The count per lane must fit the demand:

| Plate | Meaning |
|---|---|
| `2` | exactly 2 runners in this lane |
| `X` | nobody in this lane |
| `1+` | at least 1 |
| `*` | any number |

At lap 1 you are alone (1 runner), lap 2 has 2 runners, lap 3 has 3, from lap 4 on 4 runners (you + 3 ghosts) share 3 lanes.

**Announced ahead.** The demand of every seal is known 4 laps ahead (the board). The seat you take at seal N is part of the formations of seals N, N+1, N+2 and N+3, which is exactly what the board shows. Each new demand is generated from a completion of the seats not yet taken that satisfies everything already announced, so **a player who always takes a seat that fits every announced demand can never be cornered** (rule-checked: 0 failures in 3300 seals). A player who only looks at the next demand fails about 20% of the time.

**Scoring.** Laps 1 and 2 are warm-up (open = +5, shut = nothing). From lap 3: an open seal extends the streak, sets the multiplier of that lap to `1 + 0.5 x streak` (max x4) and pays a bonus of `10 + 5 x streak`; a shut seal resets the streak and halves that lap's coins. Every coin (yours or a ghost's) is worth its value times the lap's multiplier. A wrong seat also haunts you: it stays as a ghost for three more laps, so mistakes echo.

**Hearts.** 3 hearts, 1.1 s of invulnerability after a hit. Spikes and thieves that reach you cost a heart. Best score is saved in localStorage.

## 4. Screens and controls

- **Street (top).** Plates are drawn on the road ahead of the seal: gold number = needed there, red X = keep empty, blue rings = ghost seats already there. They turn green when the formation is currently met.
- **Board (bottom).** The next four seals as columns: plates, and below them the seats already taken (blue = ghost, red = you now, stacked). `?n` = n runners still to be placed. A green frame means it is met right now. The red dot also appears in the later columns: that is the ghost you would leave.
- Tap or drag anywhere to choose the lane (the screen is split in thirds). Keyboard: A / D or arrows, 1 2 3. P / Space pauses, M mutes, Enter starts.
- The title screen is an attract mode: a bot (that plans) runs the alley behind the logo.
- First-run hints (once each, saved): the seal under you, steering, coins/spikes, ghosts, the board, scoring.

## 5. Why this should fit CrazyGames

- Portrait, thumbs only, understandable in seconds (stand where the plate says), with a depth that appears in lap 4+ (plan three laps ahead).
- Run length 1 to 4 minutes; best score and best streak give a reason to retry.
- Not yet in (candidates): daily alley (shared seed), unlocks (ghost voices, runes, districts), a second seal, assist mode, leaderboard.
- Size and load: about 50 KB of script, instant start. Portal rules (no SDK ads in Basic Launch, no outside links, no orientation lock) are respected.

## 6. Balance notes (`npm run sim:loop`)

`scripts/loop-sim.ts` plays whole runs with bots (seeded):

- `dodger` steers for coins and away from spikes and ignores the seal: opens about 7% of seals, average score ~330.
- `planner` does the same and also takes a seat that fits all announced demands: opens 100% of scoring seals (streak over 35 in 40 laps) and scores about 11x the dodger. Both survive 40 laps: a bot with perfect reactions is not threatened by the alley, so run pressure is still to be tuned with human players.
- Formation difficulty (`scripts/` quick sim, `Formations`): of the seats that satisfy this lap's demand, a random pick opens ~74% of the laps' seals, a two-step look-ahead ~94%, full planning 100%.

Tuning knobs: speed ramp, lane-step time (0.2 s), how many lanes a demand asks exactly (`revealFor`, 1 of 3 in 75% of the later laps), `soft` (chance to relax to "at least"), shut multiplier (0.5), streak step (0.5), max multiplier (4), ghost count (3), upgrade period (3 laps).

## 7. Music from play

All sounds are synthesised in `src/loop/audio.ts` (WebAudio). The score is not a track but a result of play:

- **Pulse:** one soft tick per ring row, so the tempo is your speed (and rises every lap); a low thump every 5 rows and a heavier one every 10.
- **Notes:** coins, kills and every lane change play a note of a D phrygian-dominant (Hijaz-like) scale. The degree comes from lane and position on the ring.
- **Ghosts are voices:** each ghost replays your lane changes with its own timbre (glass bell, marimba, reed). The more laps you have run, the more layers play, and they are literally your previous laps.
- **The seal is a chord:** an open seal rings the occupied lanes together (a bell per lane); a shut one is a low dissonant thud.
- **Drone** under the run; a bell on every lap; a low rumble when the alley turns worse; a stone scrape is unused for now.

## 8. Code map

| Path | What |
|---|---|
| `src/loop/logic/` | Pure rules: `game.ts` (ring, ghosts, seal, scoring), `formation.ts` (demands, the book of seats), `runes.ts` (street stretches), `bot.ts` (sim and attract mode) |
| `src/loop/camera.ts` | The camera: outside-of-a-drum geometry, fisheye lens, ground map (all the look is tuned in `CAM`) |
| `src/loop/scene.ts` | The street: per-pixel ground, buildings (grids of projected quads), seal plates, sprites, effects |
| `src/loop/panel.ts` | The seal board, HUD, banners, hints |
| `src/loop/art/` | `buf.ts` software pixel buffer (polygons, text, sprites), `sprites.ts` ASCII sprites |
| `src/loop/audio.ts` | Synth and the event-driven music |
| `src/loop/main.ts` | Canvas, input, screens, glue |
| `scripts/loop-*.{ts,mjs}` | Sim, rule checks, browser smoke test, screenshots |

Run: `npm run dev:loop`, `npm run build:loop`, `npm run test:loop`, `npm run sim:loop -- 300 planner 2.5`.
Smoke test: `LOOP_OUT=dist-loop-dbg VITE_ENABLE_DEBUG=1 npm run build:loop && node scripts/loop-smoke.mjs`.
One-file playable copy: `npm run build:loop && node scripts/make-single-file.mjs out.html dist-loop "Alley Echo" scripts/loop-single.tpl.html`.

## 9. Open questions for the next playtest

1. Is the board readable while running? (Four columns, plates plus seats; red dot = you, blue = ghosts.)
2. Is the extra step from "stand where the plate says" (laps 1-3) to "plan the seat" (lap 4+) learnable? Candidates: an assist that marks the seats that fit, slower first laps.
3. Does a shut seal (half pay) feel like the right price? Alternatives: a heart, or ending the streak only.
4. Does the run have enough pressure? A perfect bot survives 40 laps; speed is capped at 7.2 and the alley turns worse every 3 laps. Candidates: faster cap, thieves that move, a second seal at row 18 from lap 7.
5. Does the seat/hazard interplay (the lane you must stand in may have spikes right after the seal) feel fair?
