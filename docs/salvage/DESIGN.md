# Gullet Salvage — design document (prototype v0.2)

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

## 2b. What changed in v0.2

1. **Both faces are visible.** Every card shows its tool tags on the picture (PRY, CUT, LIGHT...) and a tool strip at the bottom, even tucked in the hand. Select a card and press FLIP (or right-click, or tap an enemy with no card selected) to see both faces big.
2. **Monsters carry cards and play them.** Each enemy holds 1–3 objects (its *kit*, shown as small icons under its name) and plays the next one every turn, like you do. The icon above its head is the object it will play. With empty hands it fights with its natural attacks.
3. **Hidden face.** If an object has a tool tag that matches an unused fixture in the room, the monster may play the **tool side** instead of the fight side, and you see only `?`. If no matching fixture is left, there is nothing to guess: the number is shown. So using or denying the valve is a real decision, and the **Lantern's PEEK** reveals every face for the turn.
4. **Fixtures.** Fights contain a Valve (PRY/KEY: acid floods the other side for 7), a Cyst (CUT/DIG: heals whoever opens it by 6) or a Glow Pod (LIGHT: dazzles the other side). Each can be used once, by either side. You use one by tapping a card, then the glowing fixture.
5. **Disarm and Grab (both on trial).**
   - *Disarm*: any single card hit of 6+ that does not kill knocks the object out of the monster's hands. It lands in your hand as a green card.
   - *Grab* (Fishhook): after its 3 damage you take the object it is about to play, free this turn.
   - Either way the monster fights bare-handed with its natural (weaker) attacks. When a monster dies, everything it still holds lands in your hand.
6. **Four kinds of fight.** Plain, **Thief** (a Pilfer Mite steals a card from your hand and runs away after 2 turns; if it escapes, the card is gone from your deck for good, if you kill it you get the card back), **Rising acid** (from turn 3 everyone, including the monsters, takes 1, 2, 3... acid damage per turn), **Ambush** (the enemies act first).
7. **You walk through the belly.** After a room there is no map screen: the camera walks forward through the tunnel (the tunnel is shifted a fraction of a cell per frame), the next room grows out of the dark, and a fork is two real tunnel mouths you tap. The map is a thin progress strip at the top. Sometimes a snack drifts by: tap it for +3 HP.
8. **20 cards** (down from 27) to test the core loop before adding more.
9. **Art style switch** on the title screen: COLOUR or 1930S (see §9).

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
| 4 | Choice of two different fight types (plain / thief / rising acid / ambush) |
| 5 | Acid pool **or** Dark alcove |
| 6 | Fight (Slug, Leech, Tick; random type) **or** Elite (Tapeworm Warden + Tick) |
| 7 | Valve/Alcove, or Cyst/Pool |
| 8 | Boss: Mama Leech + 2 Ticks (hiccupy) |

Start: 40 HP, 10 cards. No gold, no shop. Death ends the run; a win spits you out.

### Room types

- **Fight** — see §5; has one fixture (the boss has two) and one of four variants. Reward: take one of 3 cards (+ up to 2 unused objects taken from enemies). Elite: first option is at least uncommon.
- **Fallen diver** — free loot, take one of 3.
- **Valve** (needs PRY or KEY) — prize: take one of 3, at least one uncommon.
- **Cyst** (needs CUT or DIG) — heals 6, take one of 3.
- **Alcove** (needs LIGHT) — take one of 3, at least one uncommon (rares appear more here).
- **Bash** — no tool in your hand of 5? Smash it for 4 HP and take one of only 2 commons. Never a dead end, but costly.
- **Acid pool** — pick one: **Rest** (+12 HP), **Grow** (a card gets +1 forever to its first damage/heal number), **Dissolve** (remove a card; min deck 6).

The explore hand is 5 random cards of your deck: a deck with two tools per type is reliable, a deck of pure attackers gets bashed.

## 5. Combat rules

- 3 energy per turn, draw 5, no carry-over. Discard pile reshuffles when the draw pile is empty. Hand cap 10.
- Enemies stand in a row (1–3). The icon above each shows the object it will play next (`?` when it could play either face), and the small icons under its name are everything it still holds.
- **Status**: *Dazzle* (the target's next attack deals half), *Sleep* (enemy skips its next move; on you: tied, −1 energy next turn), *Burn* (2 damage at the start of each round for N turns).
- **Disarm**, **Grab**, **hidden face** and **fixtures**: see §2b.
- **Fatal**: some cards have an "if fatal" bonus (draw, heal, +1 energy). **Kill = loot**: everything a killed enemy still held lands in your hand as green temp cards, usable at once. Unused at the end of the fight, they become bonus reward options.
- **Hiccup** (some fights): every 3rd turn the enemy phase happens twice.
- No block. Tempo (sleep, dazzle, disarm, kill first) is your defence.

### Controls

Tap/click a card (it rises), then tap an enemy, or the glowing fixture for its tool side; or drag the card onto the target (dotted aim line). Non-targeted cards: tap twice or drag upward. FLIP shows both faces of the selected card; tapping an enemy with no card selected shows what it holds. Space = end turn.

## 6. Cards (20)

Cost, fight face, tool face. Tools: PRY, CUT, DIG, KEY, LIGHT. Monsters play these same cards.

**Starter deck (10 cards, 8 kinds)**: Boathook ×2 (1c, 5 dmg · PRY), Knife ×2 (1c, 4 dmg · CUT), Lantern (1c, dazzle, draw 1, PEEK · LIGHT), Shovel (1c, 2×2 dmg · DIG), Rope (1c, sleep · —), Old Key (0c, throw 2 · KEY, used up when it opens something), Beans (1c, heal 5, exhaust · —), Boot (2c, 9 dmg · —).

**Common**: Pan (5 + dazzle), Scissors (3×2 · CUT), **Fishhook** (3 + GRAB the enemy's object, free · CUT), Spoon (3, if fatal heal 5 · DIG), Matches (0c, burn 4 turns, exhaust · LIGHT), Cleaver (5, +4 if dazzled · CUT).

**Uncommon**: Crowbar (8 · PRY), Lockpick (0c, 2 · KEY, kept), Flare (4 to all · LIGHT), Medkit (2c, heal 12, exhaust).

**Rare**: Pickaxe (7 · DIG+PRY), Harpoon (2c, 12, if fatal +1 energy · PRY).

How a monster plays a card: damage hits you (halved if the monster is dazzled), heal heals it, dazzle makes your next attack deal half, rope ties you (−1 energy next turn), matches burn you 2 per turn, fishhook steals a card from your hand (you get it back when it dies), lantern/draw/energy do nothing for it.

Design intent: every tool tag costs something in the fight face (Lockpick hits for 2, Old Key is used up), so "is this a fighter or a key?" is real, and since monsters hold the same objects, the objects you take from them are the ones that were just used against you.

## 7. Enemies

Every enemy has an HP value, a kit of 1–3 objects and natural attacks for when it is bare-handed.

| Enemy | HP | Kit (random from) | Natural | Notes |
|---|---|---|---|---|
| Gut Mite | 14 | 1 of knife, pan, scissors, matches, rope, shovel | 4 | the baseline |
| Tick | 9 | 1 of scissors, shovel, lockpick, old key, matches | 3×2 | dies to any single card |
| Acid Slug | 22 | 2 of boathook, cleaver, boot, beans, pan, crowbar | 6 | slow big hitter |
| Leech | 22 | 2 of spoon, fishhook, medkit, knife, lantern | drain 7 | heals half of what it deals |
| Pilfer Mite | 11 | fishhook | 3 | steals a card, leaves after 2 turns |
| Tapeworm Warden (elite) | 62 | 3 of crowbar, harpoon, pickaxe, boot, cleaver | 9, 5×2 | |
| Mama Leech (boss) | 72 | fishhook, harpoon, boot | 8, drain 7 | hiccupy belly, 2 fixtures |

## 8. Balance (bot results)

`npm run sim:salvage` plays 1500 runs per bot (`greedy`, `lazy`, `random`). The bots know the fixtures and use tool faces, but they do not try to out-guess hidden faces or farm disarms, so a human should do better.

| Bot | Win rate |
|---|---|
| Greedy (sensible plays, drafts cards, rests/dissolves at pools) | ~53% |
| Lazy (sensible plays, never takes a reward) | ~33% |
| Random plays | 0% |

Drafting is worth ~20 points. Most deaths are at the boss (~40%). To tune after human playtests.

## 9. Art and sound (all by code)

- Tunnel: ray-cast per pixel (shared with Guts & Gems), inked cel shading, two "boil" frames for rooms, 8 shifted frames for walking. Pink belly, rust belly for the boss.
- 40 icons drawn from rectangles, lines and ellipses in `src/salvage/art/icons.ts`. Enemy and prop sprites in `src/salvage/art/sprites.ts`.
- Sound: WebAudio synth (shared). Needs: hiccup, spit, key, pry, cut.
- **1930S style switch** (title screen, saved): the same code-drawn art is redrawn with double-thick outlines, pie-cut eyes and white-gloved noodle legs, bobbing in jerky steps, outlines that boil at 6 fps; the whole camera goes through a grey-sepia colour-matrix filter; a film layer adds 12 fps flicker, scratches and dust. It is a convincing *shell*. A real rubber-hose look needs hand-drawn, frame-by-frame characters (squash and stretch, secondary motion), which is what the hand-drawn PNG override is for.
- **Hand-drawn upgrade path**: every icon and sprite has a texture key (`ic_boathook`, `en_mite`, `en_mite_v`, `prop_valve`...). A loader that overrides keys with PNGs from `art/` is the plan.

## 10. CrazyGames fit

Short runs, instant restart, no text walls, mouse + touch, no ads/external calls, English only, PEGI-12 (cartoon creature violence, no blood). Bundle is ~1.5 MB (Phaser). Original names and art. Must still do: progress save per run is not needed (roguelike), but the "deepest step" is saved in `localStorage`.

## 11. Roadmap

1. **Playtest** v0.2 with the user (disarm vs grab, hidden faces, fixtures, walking).
2. Balance pass (§8).
3. If the loop is fun: content (15+ more cards, more enemies, new fixtures and fight types), the three more belly moods (burp = enemies swap places, cramp = hand size −1, tide = cards get shuffled), a second belly with a new palette.
4. Meta: unlocks between runs (new starting kits: "Cook", "Fisher", "Miner"), daily seed.
5. "Food Chain": a belly inside a belly (we are swallowed again by something bigger).
6. Hand-drawn art swap, sound pass, CrazyGames Basic Launch package.

## 12. Open questions for the user

1. Name: *Gullet Salvage*? alternatives: Belly Salvage, Swallowed & Sorted, Gut Check.
2. One two-faced deck (this prototype) or two decks like the reference?
3. Healing sources: beans/sandwiches, cysts, pool — enough, or add a campfire?
4. Run length: 8 steps (≈15 min) good for CrazyGames, or shorter (6)?
5. How loud should the hiccup mood be (it is the main mood now)?
