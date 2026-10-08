# Gullet Salvage — design document (prototype v0.1)

Working title. A first-person deckbuilder set inside the belly of a leviathan. Pixel art drawn by code, 480×270, mouse and touch.
Status: playable prototype (one belly, 8 steps, 6 enemy types, 27 cards). Everything below is what the prototype does today, plus what we would add next.

## 1. Pitch

You are a salvage diver. A leviathan swallowed you whole. Its belly is full of things it swallowed before you: tools, kitchenware, boots, bells, diving gear. You are small, you have a lantern, and you have to find the way out the other end.

**Every object is a card with two faces.**

- *Fight face*: what it does in a brawl (hit, dazzle, heal, draw...).
- *Tool face*: what it does to the world (pry a valve, cut a cyst, light a dark alcove, unlock with a key).

A boathook hits for 5 *and* pries valves. A knife cuts cysts. A lantern dazzles enemies *and* lights alcoves. A rope is a great fight card and useless at a valve. Your deck has to survive fights *and* open the belly's rooms, and you only see five cards of it at a time.

## 2. Pillars

1. **Everything is a thing you found.** No spells, no classes: cards are objects. Names and pictures explain the card before the text does.
2. **One deck, two jobs.** The tension is never "attack or defend" (there is no block). It is "fight card or tool card" and "what do I keep in my thin deck".
3. **Kill to loot.** Enemies swallowed things. A kill spits an item into your hand, usable this very turn. If you do not use it, you may keep it as a reward choice.
4. **Readable and fast.** Intents are always visible. A fight is 3–5 turns. A run is about 15 minutes. Rewards are "take only one".
5. **The belly has moods.** A hiccupy belly doubles the enemy phase every 3rd turn. It is shown from turn 1 and changes how you play (sleep the big hitter on the hiccup turn).

## 3. How it differs from Shroom and Gloom (our reference)

| | Shroom and Gloom | Gullet Salvage |
|---|---|---|
| Decks | Two big decks (Explore, Combat) | **One deck, two faces per card** |
| Exploration | Wander, camps, locks | Rooms are **props**; your hand of 5 is your toolbox |
| Setting | Fantasy village heroes | Inside a monster's gut, salvage diver |
| Enemy loot | Roasted food card on fatal | **Anything it swallowed**, random per enemy, also a reward option |
| Mood | Gloom (darkness) | **Belly moods** (hiccup now; burp, cramp, tide later) |
| Healing | Food | Beans/sandwiches, cyst and acid pool |
| Progress | Cards grow forever | Cards grow **+1 at the pool**; thin deck by dissolving |
| Look | 3D-ish diorama | Code-drawn pixel tunnel, inked cel shading |

We borrow the *feel* (first person, row of enemies with intents, hand tucked at the bottom, "take only one", cards used on world objects). We do not borrow names, art, card lists or the two-deck structure.

## 4. The run

One belly = 8 steps. Most steps offer a choice of two rooms.

| Step | Rooms |
|---|---|
| 1 | Fallen diver (free loot) |
| 2 | Fight: Gut Mite + Tick (calm belly) |
| 3 | Valve **or** Cyst |
| 4 | Fight: Acid Slug + Mite, or Leech + Tick |
| 5 | Acid pool **or** Dark alcove |
| 6 | Fight (Slug, Leech, Tick) **or** Elite (Tapeworm Warden + Tick) |
| 7 | Valve/Alcove, or Cyst/Pool |
| 8 | Boss: Mama Leech + 2 Ticks (hiccupy) |

Start: 40 HP, 10 cards. No gold, no shop. Death ends the run; a win spits you out.

### Room types

- **Fight** — see §5. Reward: take one of 3 cards (+ up to 2 unused spat-out items). Elite: first option is at least uncommon.
- **Fallen diver** — free loot, take one of 3.
- **Valve** (needs PRY or KEY) — prize: take one of 3, at least one uncommon.
- **Cyst** (needs CUT or DIG) — heals 6, take one of 3.
- **Alcove** (needs LIGHT) — take one of 3, at least one uncommon (rares appear more here).
- **Bash** — no tool in your hand of 5? Smash it for 4 HP and take one of only 2 commons. Never a dead end, but costly.
- **Acid pool** — pick one: **Rest** (+12 HP), **Grow** (a card gets +1 forever to its first damage/heal number), **Dissolve** (remove a card; min deck 6).

The explore hand is 5 random cards of your deck: a deck with two tools per type is reliable, a deck of pure attackers gets bashed.

## 5. Combat rules

- 3 energy per turn, draw 5, no carry-over. Discard pile reshuffles when the draw pile is empty. Hand cap 10.
- Enemies stand in a row (1–3) and show their next action (intent): sword + number, fang (drain: damage, enemy heals half), plus (heal self), hand (steal a card), zzz.
- **Status**: *Dazzle* (its next attack deals half), *Sleep* (skips its next action), *Burn* (2 damage at the start of each enemy phase for N turns).
- **Fatal**: some cards have an "if fatal" bonus (draw, heal, +1 energy). **Kill = loot**: a killed enemy that swallowed something spits it into your hand as a green temp card. It stays in hand until used; unused at the end of the fight, it becomes a bonus reward option.
- **Hiccup** (some fights): every 3rd turn the enemy phase happens twice.
- **Boss**: Mama Leech *steals* a card from your hand for the rest of the fight.
- No block. Damage you take is damage you take: tempo (sleep, dazzle, kill first) is your defence.

### Controls

Tap/click a card (it rises), then tap an enemy; or drag the card onto the enemy (dotted aim line). Non-targeted cards: tap twice or drag upward. With one enemy left, tapping the raised card twice is enough. Space = end turn.

## 6. Cards (27)

Cost, fight face, tool face. Tools: PRY, CUT, DIG, KEY, LIGHT.

**Starter deck (10)**: Boathook ×2 (1c, 5 dmg · PRY), Knife ×2 (1c, 4 dmg · CUT), Lantern (1c, dazzle + draw 1 · LIGHT), Shovel (1c, 2×2 dmg · DIG), Rope (1c, sleep · —), Old Key (0c, throw 2 · KEY, used up when it opens something), Beans (1c, heal 5, exhaust · —), Boot (2c, 9 dmg · —).

**Common**: Pan (5 dmg + dazzle), Fishhook (4, if fatal draw · CUT), Scissors (3×2 · CUT), Spoon (3, if fatal heal 5 · DIG), Net (dazzle all), Matches (0c, burn 4 turns, exhaust · LIGHT), Cleaver (5, +4 if dazzled · CUT), Bandage (0c, heal 4, exhaust).

**Uncommon**: Crowbar (8 · PRY), Lockpick (2 · KEY, not used up), Pickaxe (7 · DIG+PRY), Flare (4 to all · LIGHT), Harpoon (2c, 12, if fatal +1 energy · PRY), Acid Flask (8, 4 to neighbours, exhaust), Medkit (2c, heal 12, exhaust), Sandwich (heal 7 + draw, exhaust), Whetstone (0c, attacks +3 this turn, exhaust).

**Rare**: Anchor (3c, 22, exhaust · PRY), Dive Bell (+2 energy, draw 1 · LIGHT).

Design intent: every common is a small, readable job; every tool tag costs something in the fight face (Lockpick hits for 1, Old Key is used up) so the choice "is this a fighter or a key?" is real.

## 7. Enemies (prototype)

| Enemy | HP | Pattern | Notes |
|---|---|---|---|
| Gut Mite | 11 | 5, 5, 8 | the baseline |
| Tick | 7 | 3×2, 3×2, 5×2 | multi-hit, dies to any single card |
| Acid Slug | 16 | 8, 8, 12 | slow big hitter: sleep target |
| Leech | 16 | drain 7, 5, drain 8 | heals from you: kill first |
| Tapeworm Warden (elite) | 46 | 9, 5×2, heal 6, 12 | always swallowed something rare-ish |
| Mama Leech (boss) | 64 | 9, steal, 6×2, drain 9 | hiccupy belly |

Each non-boss enemy has a ~75% chance to carry an item from its own "swallowed" list (the Leech tends to have medicine and harpoons; Ticks have matches and lockpicks).

## 8. Balance (bot results)

`npm run sim:salvage` plays 1500 runs per bot (`greedy`, `lazy`, `random`).

| Bot | Win rate |
|---|---|
| Greedy (sensible plays, drafts cards, rests/dissolves at pools) | ~59% |
| Lazy (sensible plays, never takes a reward) | ~30% |
| Random plays | 0% |

So drafting is worth ~30 points of win rate: the deck matters. First tuning pass made rewards clearly stronger than the starter cards and enemies a bit tougher. Almost all deaths are at the boss (40%), mid-run attrition is still low. To tune after human playtests.

## 9. Art and sound (all by code)

- Tunnel: ray-cast per pixel (shared with Guts & Gems), inked cel shading, two "boil" frames, vignette and grain overlays. Pink belly, rust belly for the boss.
- 34 item/node/intent icons drawn from rectangles, lines and ellipses in `src/salvage/art/icons.ts`. Enemy and prop sprites in `src/salvage/art/sprites.ts`.
- UI: own 5×7 bitmap font, chunky buttons, cards built from rectangles.
- Sound: WebAudio synth (shared). Needs: hiccup, spit, key, pry, cut.
- **Hand-drawn upgrade path**: every icon and sprite has a texture key (`ic_boathook`, `en_mite`, `prop_valve`...). A loader that overrides keys with PNGs from `art/` is the plan, so illustrations can be dropped in one by one without code changes.

## 10. CrazyGames fit

Short runs, instant restart, no text walls, mouse + touch, no ads/external calls, English only, PEGI-12 (cartoon creature violence, no blood). Bundle is ~1.5 MB (Phaser). Original names and art. Must still do: progress save per run is not needed (roguelike), but the "deepest step" is saved in `localStorage`.

## 11. Roadmap

1. **Playtest** this prototype with the user; answer the open questions below.
2. Balance pass (§8) and a fix for the draft meaning too little.
3. Content: 15 more cards, 5 more enemies, the three more belly moods (burp = enemies swap places, cramp = hand size −1, tide = cards get shuffled), a second belly with a new palette.
4. Meta: unlocks between runs (new starting kits: "Cook", "Fisher", "Miner"), daily seed.
5. "Food Chain": a belly inside a belly (we are swallowed again by something bigger).
6. Hand-drawn art swap, sound pass, CrazyGames Basic Launch package.

## 12. Open questions for the user

1. Name: *Gullet Salvage*? alternatives: Belly Salvage, Swallowed & Sorted, Gut Check.
2. One two-faced deck (this prototype) or two decks like the reference?
3. Healing sources: beans/sandwiches, cysts, pool — enough, or add a campfire?
4. Run length: 8 steps (≈15 min) good for CrazyGames, or shorter (6)?
5. How loud should the hiccup mood be (it is the main mood now)?
