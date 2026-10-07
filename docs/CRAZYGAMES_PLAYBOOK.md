# CrazyGames playbook: getting a web game from "done" to "live on CrazyGames"

Self-contained hand-off note. It was written at the end of a real submission (the game **Poop Drop**, Basic Launch, October 2026) so that another Claude session, working on a **different game of the same owner**, can prepare that game for CrazyGames without any extra explanation. Everything the CrazyGames documentation says that matters is summarised here (source: the whole of https://docs.crazygames.com/, read on 2026-10-07, 69 pages), followed by what was actually done, the pitfalls met, and ready-to-use recipes.

If the session has the file `crazygames_docs_text.json` (the full docs as Markdown, 69 pages), use it as the source of truth for details not repeated here. Pages are addressed by `path`, e.g. `requirements/technical/`, `sdk/game/`, `resources/html5/sitelock/`. If it does not, `docs.crazygames.com` may be blocked by the environment's network policy; the owner can add it under Network access > Allowed domains, or attach saved pages.

---

## 0. What the owner wants (decisions already made, do not re-ask)

- Language of the conversation with the owner: **Persian**. Code, docs and store texts: **English**.
- The owner publishes on CrazyGames **under their own name** (personal), not under the company. In the portal build, the author/owner shown everywhere (About panel, menu footer, meta tags, bundle banner, notices, share text) is the personal name, and **no company name and no link to the owner's own website** appears. (Owner's legal/tax side was confirmed OK by the owner; do not raise it again.)
- Start with **Basic Launch** (no SDK, no ads). Full Launch (SDK, ads) comes only after CrazyGames invites the game.
- Keep **one code base, two builds**: the normal build for the owner's own site must never be affected by the portal build (see section 8).
- Never push to the website repo's `main`; the owner merges PRs. (Specific to the owner's website repo; the game repo branch is given per session.)
- Code obfuscation was considered and **cancelled** by the owner. Do not add it.

## 1. The CrazyGames process in one page

Two-stage launch, decided per game by CrazyGames' QA team:

| | Basic Launch | Full Launch |
|---|---|---|
| Needed | **Basic Implementation** only. No CrazyGames-specific integration. SDK optional. | **Full Implementation**: all Basic items plus the SDK integration below. |
| Review | Basic QA review (fast) | Full QA review |
| Audience | Limited audience, 7 to 21 days | Global release |
| Money | **No monetisation**: video ads, banners and IAP are disabled | Revenue share starts |
| Duration rule | Ends after the game has been live >= 7 days AND has >= 500 plays; automatically after 21 days if 500 plays are not reached | - |
| Decision | By average playtime, day-1 retention and conversion, benchmarked against other games | - |

Outcomes at the end of Basic Launch: all metrics at or above benchmark -> invited to implement Full requirements and submit again; some metrics ok -> may be invited to improve and request another Basic period; most below -> cannot proceed (a resubmission must be a new game with significant improvements). Games already published elsewhere and specifically invited, or multiplayer titles needing a bigger audience, may skip Basic.

Basic Launch KPIs (what "good" looks like, from their guide):
- Average play time per session: **10+ minutes** for successful titles.
- **Day-1 retention: 10-15%**.
- **Conversion** = share of players who play at least 1 minute: **80%+**; successful ones load in **< 10 s** and are **< 20 MB**.
- Levers: rewarding core loop, clear goals, gradual new mechanics, fair difficulty; progression/unlocks, daily hooks (login bonuses, daily quests), saved progress, polish; small build, get to gameplay fast.

Other facts:
- Updates during Basic Launch go live instantly and are auto-approved (updates that violate the T&C get the game terminated). Updates are usually processed the same working day.
- Acceptance/rejection arrives by **email**. A rejected game can be resubmitted after meaningful improvements.
- Developer portal: https://developer.crazygames.com/ (Submit a game, preview/QA tool, dashboard with players, average playtime, gameplay conversion, retention, revenue; negative ratings come with player feedback; Billing).
- No location restrictions for developers. The developer keeps 100% ownership of the game (developer terms PDF linked from their FAQ).
- Files are hosted and served by CrazyGames on a CDN (no cache-busting needed). Games hosted on the developer's own domain get iframed only if it is an independent domain, and then revenue needs the SDK; hosting the files on CrazyGames is recommended.
- Technical support for SDK integration is offered once a game reaches **50k plays** combined.
- Payouts (Tipalti): monthly, minimum **EUR 100** (carries over below that), roughly the 10th of the following month (NET 60 terms, ~NET 10 in practice); wire, ACH/direct deposit, eCheck, PayPal depending on country. The billing onboarding (Developer Portal > Account > Billing, steps 1-4) must be completed before a game can be submitted; "hold payments" in step 2 lets the owner finish onboarding without payment details. CrazyGames gives no legal/tax advice.
- Rejection reasons listed in their FAQ (step A): bugs or broken mechanics; no English; unoriginal content (clones, asset flips); inappropriate themes; not meeting developer requirements/T&C/ethics; not PEGI-12; content targeted at kids.

## 2. Basic Implementation checklist (what the QA team verifies)

Technical
- Initial download <= **50 MB** (<= **20 MB** to be eligible for the mobile homepage). Without the SDK the **total** file size is used. Total <= 250 MB, **<= 1500 files** (50 MB total without SDK). For externally loaded files they measure time to gameplay (<= 20 s).
- **Relative paths only**, never absolute (Vite: `base: './'`).
- Works in **Chrome and Edge**; games not working well in Safari get disabled there; games get disabled on Chromium OS if they do not run smoothly on a **4 GB RAM** Chromebook.
- **Mouse, keyboard and touch** supported (touch if mobile is offered).
- Desktop should be playable in landscape. **Portrait games are allowed** (especially mobile-friendly), shown with black bars or background art on the sides. The submission form has a supported-orientation setting; the website asks users to rotate when needed, so **do not implement orientation locks or "rotate your phone" overlays** in the portal build.
- Add to `body`: `-webkit-user-select:none; -moz-user-select:none; -ms-user-select:none; user-select:none;` (stops the magnifier / context menu on double-tap and long-press).
- Inside the CrazyGames **mobile app** games are fullscreen and may be cut by notches/rounded corners: keep important UI inside the safe area (`env(safe-area-inset-*)`; with the SDK you can detect the app via `systemInfo.applicationType` = `google_play_store` / `apple_store`).
- **iOS audio**: on iOS the `AudioContext` becomes `interrupted` (call, app switch) and only a user gesture revives it. Add `document.addEventListener('touchend', () => { if (ctx && ctx.state !== 'running') ctx.resume(); })` (Howler: `Howler.ctx`; PlayCanvas: `pc.app.soundManager.context`). Listening for `visibilitychange` alone is not enough.
- The common-fixes snippet from their docs (apply what fits): block page scroll from the wheel (`wheel` + `preventDefault`, passive false), block arrow-key/space scrolling, and `contextmenu` -> `preventDefault`.
- Unity: iOS disabled by default; they manage DPR (iOS and low-memory Android use DPR 1). Not relevant for Phaser/Pixi/Canvas games.

Gameplay and content
- Text and images legible at devicePixelRatio 1 and at these iframe sizes: 907x510, 1216x684, 1077x606, 821x462 (desktop windowed); 1366x768, 1920x1080, 1536x864, 1280x720 (fullscreen); 800x450 (mobile); 1080x607 (tablet).
- Physics consistent across monitor refresh rates (**144/165 Hz**): use frame deltas, never per-frame increments.
- **English** localisation required. If translations exist they must be good, and use `systemInfo.locale` (SDK) with English as fallback.
- Intuitive controls on every device. Prefer layout-independent keys (AZERTY!). Avoid keys with browser behaviour: `Escape` closes fullscreen, `Ctrl/Cmd+W` closes the tab. (Guideline, not a hard rule.)
- Loads fast, no errors or crashes. **Originality**: names, assets and content must be original; avoid generic names ("Chess"), avoid names/iconography confusable with another game.
- **No custom fullscreen button** (CrazyGames provides fullscreen; custom ones interfere with monetisation).
- **No cross-promotion** of external or internal games/platforms. Allowed exceptions: privacy policy / terms; community links (Discord, dev website) on the game menu only, not as the main CTA and not leading to a playable web version; Steam/Epic links on desktop main menu or end of a demo; backlinks to CrazyGames home or category; links to games of the same series. **App-store links are never allowed in the game** (use the store-link fields in the portal form).
- Content must be **PEGI 12** compliant. CrazyGames targets 13+; kids content is not accepted for the main site (there is a separate kids site, with monetisation off).
- Branding of another game portal must not be in the game.

Ads and accounts (Basic)
- **No external ads** of any kind. CrazyGames monetisation is disabled in Basic Launch. If the SDK is integrated anyway, ads still stay disabled and the QA team checks that the game works with ads off: no freezes between levels, **no rewarded-ad button that does nothing**.
- **No external login options** (Facebook, Google, e-mail). If the game saves profile/progress on its own back-end, guests and registered CrazyGames users must both be able to play as guests and every external login must be disabled.
- If the game collects personal data beyond what the SDK events do, show a Terms/Privacy notice to new players (a simple notice, not a blocking popup). A game that collects nothing answers **N/A** to that QA question.
- Progress saving: `localStorage` is backed up and synced across devices **automatically** by their APS system (also IndexedDB for Unity PlayerPrefs). Nothing to implement in Basic. APS is **not allowed for games with in-game purchases**.

Submission metadata
- Name, description, controls text, category, tags (max 5, chosen from their list, admin-managed), orientation, devices, age/PEGI info, store links (optional), and **game covers + preview videos** (section 6).

## 3. Full Implementation (needed only after an invitation)

On top of Basic:
- SDK integrated; `gameplayStart` / `gameplayStop` events (the first `gameplayStart` ends the measured initial download). Optional `loadingStart` / `loadingStop`.
- Players land **directly in gameplay** (max 1 click).
- Ads only through the SDK (section 5), following the ad rules (section 4), and the game must **work with an ad blocker**.
- `muteAudio` setting respected (HTML5, Unity, Cocos, Construct).
- Account integration where the game has accounts: use CrazyGames username/avatar via the `user` module, automatic login for CrazyGames users, `userId` as the identifier; progress via the `data` module (or APS, or own back-end linked through the user token).
- Multiplayer-only requirements (room info, invite links, instant multiplayer flow, `disableChat` setting) apply only to multiplayer games.
- In-game purchases: invite only, via Xsolla; not available inside the CrazyGames app.

## 4. Advertisement rules (Full Launch)

General: only SDK ads; never interrupt gameplay, trigger deceptively, or chain multiple ads; do not show ads before a reasonable amount of gameplay.

Video ads
- Never during active play. Show at logical points (level transition, after death). **Never on a navigational button** (main menu, settings, shop).
- Pause the game and **block the UI** (disable buttons or spinner) from the request until `adFinished` or `adError`.
- Handle unfilled requests: `adError` must let the game continue.
- **Mute only when the ad actually starts** (`adStarted`), not when requested; unmute on finish/error.
- Request midgame ads at any natural break and let the SDK decide: max one midgame per ~3 minutes, protection around game start and rewarded ads; too-early requests are ignored harmlessly. No own cooldown timers needed.
- Best practice: no midgame ad in the first 3-5 minutes / first levels (protects day-1 retention).

Rewarded ads
- Special opportunities, not an expectation; levels must be completable without them. Not too often (show a timer or hide the button), never chain two to get one reward, do not promote aggressively.
- The request button must **not appear on an active gameplay screen**; keep it in a consistent, easy-to-find place.
- The button must not be misleading: **"continue without watching" has the same size, font and colour**; the skip/close is never hidden or delayed; make clear it is a video ad (video icon); say what the reward is ("Watch ad for +50 gems").
- Provide an **alternative** to watching (e.g. earnable coins).
- On `adFinished`: clearly show the player was rewarded. On `adError`: **do not reward**.
- "Out of lives" rewarded offers must not be shown every time the player dies. **Between two levels: either a midgame ad and restart, or a rewarded "keep playing" - never both.**
- Fill/error codes: `adsDisabledBasicLaunch`, `unfilled`, `adblock`, `adCooldown`, `other`.
- Ad blockers: players must still be able to play normally and never be penalised; extra features may be blocked with an inline notice (no popups, which interfere with fullscreen); a rewarded button must not stay clickable but without effect.

Banners
- Only on useful screens that stay open >= 5 s on average; never during gameplay; must not cover game UI at any size (including mobile); clearly distinguishable from content; max 2 per screen. Sizes: 728x90, 300x250, 320x50, 468x60, 320x100.

## 5. SDK reference (HTML5 v3; use the engine-specific variants in the docs for Unity, Godot, Construct, GameMaker, Cocos)

```html
<!-- in the head of index.html, before game code -->
<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>
```
```js
await window.CrazyGames.SDK.init();          // required; await it (loading screen is a good place)
const SDK = window.CrazyGames.SDK;

// game module
SDK.game.gameplayStart();                    // whenever play starts/resumes (start, resume, revive, next level)
SDK.game.gameplayStop();                     // on every break (menu, level end, pause); NOT on focus loss
SDK.game.loadingStart(); SDK.game.loadingStop();   // optional, loading metrics
SDK.game.happytime();                        // confetti on the site; use rarely (real achievements)
SDK.game.settings;                           // { muteAudio, disableChat }  (local test: ?muteAudio=true, ?disableChat=true)
SDK.game.addSettingsChangeListener(fn); SDK.game.removeSettingsChangeListener(fn);
// muteAudio must win over the in-game audio toggle.

// ad module
SDK.ad.requestAd('midgame' /* or 'rewarded' */, {
  adStarted:  () => { /* pause + mute now */ },
  adFinished: () => { /* resume + unmute; reward here for 'rewarded' */ },
  adError:    (e) => { /* resume; e.code = unfilled | adblock | adCooldown | adsDisabledBasicLaunch | other; no reward */ },
});
const hasAdblock = await SDK.ad.hasAdblock();

// banner module
await SDK.banner.requestBanner({ id: 'banner-container', width: 300, height: 250 }); // container div of that size must exist

// user module
SDK.user.isUserAccountAvailable;             // bool
const user = await SDK.user.getUser();       // null/undefined when logged out -> play as guest
const token = await SDK.user.getUserToken(); // JWT; verify on YOUR server, never decode on the client
await SDK.user.showAuthPrompt();             // login/register popup; never auto-trigger; not as the main CTA
SDK.user.addAuthListener(fn);                // guest logs in while playing -> follow the "logged in" flow
const info = SDK.user.systemInfo;            // countryCode, locale, browser, os, device.type, applicationType

// data module (cloud save; same API as localStorage)
SDK.data.setItem('gold', '100'); SDK.data.getItem('gold'); SDK.data.removeItem('gold'); SDK.data.clear();
```
- Data module: must select the matching **Progress Save** toggle in the submission flow or it is disabled; rely on it fully (guests and logged-in users) rather than on local saves; it preloads all data at `init`.
- Local testing params for the user module: `?user_account_available=false`, `?user_response=user1|user2|logged_out`, `?token_response=user1|user2|expired_token|logged_out`, `?show_auth_prompt_response=user1|user2|user_cancelled`.
- Leaderboards: **invite only**, one per game, weekly seasons (Monday to Monday 09:00 UTC), global/country/friends ranks, trophies. Score submission either from the client with an encryption key (manipulable) or from a server with an API key. There is also a "game challenge" `addScore` method in the older v2 SDK.
- **Sitelock** (optional): if the game checks its host, it must accept every CrazyGames origin, otherwise QA/players get a blank game:
  ```js
  const isCrazyGames = () => location.hostname === 'crazygames.com' || location.hostname.endsWith('.crazygames.com');
  ```
  (game files are served from e.g. `https://<slug>.game-files.crazygames.com/...`). For iframe-hosted games, CSP `frame-ancestors 'self' *.crazygames.com https://app.crazygames.com capacitor://app.crazygames.com;` - the iOS app embeds from `capacitor://app.crazygames.com`, and a bare `*.crazygames.com` allows only `https`, which gives a **white screen in the iOS app**; `frame-ancestors` is checked against every ancestor (also `games.crazygames.com`). Video ads run on `games.crazygames.com`.
- In the QA preview there are toggles (Limit midroll frequency, Include test ads, Skip video and fallback ads, Enable Unity Cache, Instant Multiplayer, Disable Chat, Throw SDK Error, SDK Debug). They only exercise SDK features; irrelevant for a Basic build without SDK.

## 6. Covers and preview videos (mandatory at submission)

Cover images (PNG/JPG; the portal opens a crop dialog for each):
- Landscape **16:9 1920x1080**, Portrait **2:3 800x1200**, Square **1:1 800x800**. They must look consistent as a set.
- Do **not**: draw borders; write anything except the game title ("New", "Play", "Updated"...); add icons or store logos; use copyrighted visuals you have no right to; use blurry or pixelated visuals (for pixel-art games: crisp integer scaling, high resolution, nothing smeared).
- Do: a simple, uncluttered, well-balanced composition; the main character or a big stylised title; the game name on the cover; a stylised font fitting the game. A raw screenshot is discouraged.
- **Keep the title and key elements out of the top-left corner**: the crop dialog shows a red/pink "labels may cover this area" zone. Measured on the three crop dialogs (cover pixels): landscape about **764 x 216**, portrait about **320 x 120**, square about **280 x 240** (top-left). Anything inside can be hidden by platform labels.
- In the crop dialog, an image that already has the exact aspect ratio needs no cropping: the crop box covers the whole image; just press Submit.

Preview video (hover preview):
- **15-20 s** (longer is cut to 20 s), **<= 50 MB**, **no sound**, no fast-forward (they speed it up slightly themselves), static cover as the first frame (seamless hover), no black bars top/bottom, no default mouse cursor, no "Play now"/promo text, no app or social icons.
- Resolutions: **landscape 1080p 16:9** and **portrait 1080p 2:3** (both mandatory).
- A portrait game in a 16:9 video: put the gameplay strip in the centre and fill the sides with a blurred, darkened, enlarged copy of the same footage (ffmpeg recipe in section 9). Show variety (menus, character/unlock choice, real gameplay), not just one screen.

## 7. The submission form, field by field (what was answered for Poop Drop; adapt per game)

Step 1 (details): Name; engine `HTML5`; **progress save**: No (APS handles localStorage) unless the SDK data module is used; mobile supported: yes; multiplayer: no; "SDK mutes audio": no (no SDK).
Step 2 (upload + preview/QA): upload the zip (index.html at the root); the preview/QA tool shows "You are playing this game in a QA environment ...". Play it, scan the **QR code** with a phone to test iOS/Android, read the Log and Warnings tabs, answer:
- No external ads: **Yes**; Does not offer external login options: **Yes**; In-game mention of Terms/Privacy: **N/A** if nothing personal is collected; "Detected SDK functionalities: none" is normal in Basic; tick "I confirm that these results are correct" only after real testing (wrong answers lead to rejection); Continue.
Step 3 (metadata): Category (Arcade for an endless skill game; fall back to Casual), Tags (max 5 from the list, e.g. Bird, Pixel, Funny, Endless, Skill), Description (Markdown-ish editor, **no HTML**, English, no company/website names, no links to other games), Controls (desktop and mobile), store links and download counts **left empty** unless real, marketing URL empty, the 3 covers, the 2 videos, orientation (**Portrait only** for a portrait game), devices (desktop + mobile), age: PEGI 12 or lower, never a kids rating.
Final step: submit; wait for the e-mail.

## 8. How to build the portal version of an existing game (pattern used in Poop Drop)

Goal: the owner's own release (website, app stores) and the portal release must never mix. Use one code base and a **build-time target**.

1. `src/target.ts`: `export const TARGET = __TARGET__; export const IS_PORTAL = TARGET !== 'web';` with `__TARGET__` injected by the bundler from `VITE_TARGET` (default `web`). Also a separate output folder per target (`dist` vs `dist-crazygames`) so one build cannot overwrite the other. Scripts: `build:crazygames` = `VITE_TARGET=crazygames npm run build`; `package:crazygames` builds then zips `dist-crazygames/` with `index.html` **at the zip root** into `releases/crazygames/<game>-crazygames-v<version>-<commit>.zip`.
2. In portal builds (`IS_PORTAL`): no network calls to the owner's servers at all (API helper returns an offline reply), no sign-in / ranking / account UI, no world counters or share links, no host lock (the portal hosts the game; a lock must allow `*.crazygames.com` and the app origins), no outside links (the About panel shows only the owner's name, year and "All rights reserved"), no rotate overlay and no orientation lock, no ads, no tester shortcuts/debug hooks, no analytics, no cookie/consent banner (nothing is collected).
3. **Owner name per target**: a single `OWNER` constant (`IS_PORTAL ? '<personal name>' : '<company>'`) used by the About panel, menu footer, notices, share text, and the HTML `<meta author/copyright>` + header comment (a build plugin replaces an `%OWNER%` placeholder; the same plugin rewrites the third-party-notices file for the portal) and the bundle banner.
4. **Safety net in the packager**: before zipping, fail if `index.html` or any bundled JS contains the website domain or the company name (regex), and print the file list and size. This caught a leak through a host-lock notice string once.
5. Portal-required additions that were made (also fine for the normal build): `user-select:none` on html/body; safe-area padding on the UI layer; iOS audio `touchend` revive; a `wheel` guard on the canvas; frame-delta based movement (`dt = min(delta, 50)/1000`); `base: './'`.
6. Things that are allowed to stay: local progress (localStorage / IndexedDB) - their APS backs it up; an in-game pause button; sound toggle; English UI.
7. Keep the other build green: after touching shared code run **both** builds and the type check (`tsc --noEmit`).
8. Document the target table in the repo (`docs/PORTALS.md` in Poop Drop): what differs, the requirement checklist and its status, open points.

Testing recipe (headless Chromium via Playwright; no phone needed for the first pass):
- Serve `dist-crazygames/` on localhost, open at each required iframe size (see section 2) and assert: canvas fits, no page errors, **zero requests to any other origin**.
- Check the bundle for the forbidden strings; check size and file count of the zip.
- Then use the portal's own preview/QA tool and a real phone via its QR code.

## 9. Recipes for covers and videos (reusable; Phaser-style games)

Covers made inside the running game so the art is exactly the game's own (crisp, no re-drawing):
1. Make a debug build that exposes the game instance (Poop Drop: `VITE_ENABLE_DEBUG=1 VITE_TARGET=crazygames vite build --outDir <tmp> --emptyOutDir`, then open `/?debug`; `window.game`).
2. In Playwright, set the viewport to the cover size (1920x1080, 800x1200, 800x800), call `game.scale.setGameSize(W/4, H/4)` so the canvas is an **exact 4x integer scale** (nearest neighbour = crisp), stop the running scenes, hide the DOM overlays, and add a small scene object (`game.scene.add('cover', {create(){...}}, true)`) that places the game's own textures (hero character scaled x2-x3, props, a falling "action" moment) and the game's own pixel-text class for the title (get its constructor from an existing text object).
3. Screenshot. Keep the title out of the top-left label zone (section 6). Typical structure: landscape = title on the left half, scene on the right half; portrait/square = title on a dark panel at the top (or top-right), hero below.
Poop Drop's scripts: `scripts/media/make-covers.mjs` and `scripts/media/record-preview.mjs` (they depend on that game's scene/texture names; copy the idea, not the names).

Videos recorded **deterministically** (smooth 30 fps, independent of the machine speed):
1. `page.addInitScript`: replace `requestAnimationFrame` with a queue, `performance.now` with a controlled clock, and make `Math.random` seeded; expose `window.__step(ms)` which advances the clock and runs the queued callbacks.
2. Load the game, then loop: apply bot input -> `__step(1000/30)` -> `page.screenshot()` to numbered PNGs (viewport 1080x1920 = exact 4x of a 270x480 game).
3. A simple **bot** plays (it reads the scene's target list, picks the next matching target, moves by dispatching `keydown`/`keyup` events on `window`, drops when aligned; hold a key for >= 1 frame because a keydown+keyup in the same tick is lost by Phaser's JustDown). Unrecorded **warm-up** seconds first so the recorded part starts in lively gameplay. Optionally record a menu/character-picker intro by calling the scene APIs directly (set the stored best score high so every character is unlocked).
4. Encode with ffmpeg (no audio, H.264, yuv420p, faststart):
```bash
# landscape 1920x1080 from 1080x1920 frames: blurred copy as background, sharp strip centred; 0.5 s cover still first
ffmpeg -y -framerate 30 -i frames/f%05d.png -vf "split[a][b];[a]scale=1920:3413,crop=1920:1080,boxblur=30:3,eq=brightness=-0.15[bg];[b]scale=-2:1080:flags=lanczos[fg];[bg][fg]overlay=(W-w)/2:0,format=yuv420p" -an -c:v libx264 -crf 18 -r 30 land_game.mp4
ffmpeg -y -loop 1 -t 0.5 -framerate 30 -i cover_landscape.png -vf "scale=1920:1080,format=yuv420p" -an -c:v libx264 -crf 18 -r 30 land_cover.mp4
printf "file 'land_cover.mp4'\nfile 'land_game.mp4'\n" > l.txt && ffmpeg -y -f concat -safe 0 -i l.txt -c copy -movflags +faststart preview-landscape-1920x1080.mp4
# portrait 1080x1620 (2:3)
ffmpeg -y -framerate 30 -i frames/f%05d.png -vf "split[a][b];[a]scale=1080:1920,crop=1080:1620,boxblur=30:3,eq=brightness=-0.15[bg];[b]scale=-2:1620:flags=lanczos[fg];[bg][fg]overlay=(W-w)/2:0,format=yuv420p" -an -c:v libx264 -crf 18 -r 30 -movflags +faststart preview-portrait-1080x1620.mp4
```
   Result for Poop Drop: ~19 s, 6 MB (landscape) and ~18 s, 8 MB (portrait). Do not commit the videos (large); commit the scripts.
Playwright notes for this environment: Chromium is at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; require Playwright with `createRequire('/opt/node22/lib/node_modules/')`; `ffmpeg` is installed; do not run `playwright install`.

## 10. Pre-submission checklist (copy and tick)

- [ ] Portal build exists, separate output folder, zip has `index.html` at the root, relative paths only.
- [ ] Zip size and file count: total <= 50 MB (ideally < 20 MB), <= 1500 files.
- [ ] No ads, no external login, no analytics, no server calls to own back-end, no outside links, no store links, no cross-promotion, no custom fullscreen button.
- [ ] Owner name correct everywhere; company name/website absent (packager check green).
- [ ] English UI; PEGI-12-safe content; original name and art.
- [ ] Desktop (mouse + keyboard) and mobile (touch) controls work; legible at 800x450, 907x510, 1280x720, 1920x1080 and on a phone.
- [ ] Movement uses frame deltas (144 Hz safe); audio revives after iOS interruption; wheel/keys do not scroll the page; `user-select:none`; safe-area padding.
- [ ] No rotate-phone overlay / orientation lock in the portal build; orientation chosen in the form.
- [ ] Rewarded/ad buttons: none exist in a no-SDK build.
- [ ] Covers 1920x1080, 800x1200, 800x800 (title out of the top-left zone, crisp, no extra text) and two preview videos 1080p (16:9 and 2:3), no sound, 15-20 s, <= 50 MB.
- [ ] Description (no HTML), controls text, category, <= 5 tags, store links empty unless real.
- [ ] Preview/QA tool played on desktop and on a phone via QR; Log/Warnings tabs clean; QA questions answered truthfully.
- [ ] Billing onboarding completed in the Developer Portal (or "hold payments").

## 11. After Basic Launch: Full Launch plan

1. Read the invitation e-mail and the dashboard numbers (playtime, conversion, retention).
2. Add the SDK script and `await SDK.init()` on the loading screen; wrap ads behind a provider interface (Poop Drop has `src/ads.ts` with an `AdService`; add a `CrazyGamesProvider` that maps `requestAd('midgame'|'rewarded')` to the service's interstitial/rewarded calls and respects the rules in section 4).
3. Call `gameplayStart` when a run starts or resumes (and after revive/unpause), `gameplayStop` when a run ends, the game is paused, or a menu opens. Land new players directly in gameplay (<= 1 click).
4. Respect `settings.muteAudio` (overrides the in-game mute) and mute only while an ad really plays.
5. Progress: either switch saves to `SDK.data` (then pick the Progress Save toggle) or keep `localStorage` + APS (not allowed if there are purchases). Remove or hide any own login/ranking; use CrazyGames username/avatar if the game shows names.
6. Test with the preview tool toggles (test ads, skip ads, SDK error, ad blocker) and fix freezes; submit the new version for the Full QA review.

## 12. Lessons from the first submission (avoid repeating)

- The docs site was blocked by the sandbox egress policy; saved single pages contained only the intro page (the sidebar pages are separate URLs). The fix that worked: a JSON export of all pages (69 pages) attached to the chat.
- An absolute or company-named string can leak into a bundle through unexpected places (a host-lock notice). Guard it in the packager, not by memory.
- Do not assume the QA error banner means a bug: "You are playing this game in a QA environment" is the normal preview message.
- The top-left "labels" zone in the cover crop dialog is real; re-check covers against it before upload.
- Portrait games are fine, but make the 16:9 video with a blurred background, not black bars.
- When the browser tests run in this sandbox, always check that the external-request count is zero for the portal build.
- Write the answers to the QA questions from facts of the build, not from the form's default; wrong answers are a rejection reason.

## 13. Where things are in the Poop Drop repo (a worked example; branch `claude/pensive-brahmagupta-er6ng4`)

- `src/target.ts`, `src/identity.ts` (OWNER), `vite.config.ts` (target, outDir, owner plugin, defines), `index.html` (`%OWNER%`, user-select, safe-area, rotate overlay removed at runtime for portals), `src/game.ts` (portal skips orientation logic, wheel guard, touchend audio revive), `src/audio.ts` (`revive()`), `src/account.ts` (offline when portal), `src/hostLock.ts` (off for portals), `scripts/package-portal.mjs`, `scripts/media/*`, `docs/PORTALS.md`, `releases/crazygames/` (zip + covers).
- Owner-facing artefacts produced: the upload zip, 3 covers, 2 preview videos, form texts (description, controls, tags).

## 14. Prompt to give the other session

> Read `docs/CRAZYGAMES_PLAYBOOK.md` (attached) fully. Prepare this game for CrazyGames Basic Launch exactly as described: add a build-time portal target, strip server calls/login/ads/outside links in that build, put the owner's personal name everywhere (no company, no website), apply the technical requirements, test at the listed iframe sizes with zero external requests, make the zip, the 3 covers (title out of the top-left zone) and the 2 preview videos, and write the form texts. Keep the normal build unchanged and green. Report in Persian; commit and push to the branch you are given; never push to another branch.
