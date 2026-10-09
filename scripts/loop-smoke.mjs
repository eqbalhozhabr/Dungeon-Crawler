// Plays Alley Echo through real mouse/keyboard events in headless Chromium (needs the debug build:
// LOOP_OUT=dist-loop-dbg VITE_ENABLE_DEBUG=1 npm run build:loop). Reports page errors and external requests.
// usage: node scripts/loop-smoke.mjs [dist]
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const root = path.resolve(process.argv[2] ?? 'dist-loop-dbg');
const server = http.createServer((req, res) => {
  const f = path.join(root, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const origin = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 780 }, hasTouch: false });
let problems = 0;
const bad = (m) => { problems++; console.log('FAIL', m); };
const good = (m) => console.log('ok  ', m);
page.on('pageerror', (e) => bad('page error: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') bad('console error: ' + m.text()); });
page.on('request', (r) => { if (!r.url().startsWith(origin) && !r.url().startsWith('data:')) bad('external request: ' + r.url()); });
await page.goto(`${origin}/?seed=11`);
await page.waitForTimeout(600);

const L = async (x, y) => page.evaluate(([x, y]) => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.left + (x / 180) * r.width, y: r.top + (y / 320) * r.height }; }, [x, y]);
const click = async (x, y) => { const p = await L(x, y); await page.mouse.click(p.x, p.y); };
const state = () => page.evaluate(() => ({ mode: window.__loop.mode, lane: window.__loop.game.lane, lap: window.__loop.game.lap, hp: window.__loop.game.hp, coins: window.__loop.game.coins, slides: window.__loop.game.slides, over: window.__loop.game.over, p: window.__loop.game.p }));

(await state()).mode === 'title' ? good('starts on the title screen') : bad('no title');
await click(90, 160); // PLAY
let s = await state();
s.mode === 'play' ? good('PLAY button starts a run') : bad('PLAY did not start: ' + s.mode);

await page.keyboard.press('ArrowLeft');
s = await state(); s.lane === 0 ? good('ArrowLeft steers left') : bad('lane after ArrowLeft ' + s.lane);
await page.keyboard.press('d'); await page.waitForTimeout(100); await page.keyboard.press('d');
s = await state(); s.lane === 2 ? good('D steers right') : bad('lane after DD ' + s.lane);
await page.waitForTimeout(100);
await click(30, 120); // tap the street, left third
s = await state(); s.lane === 0 ? good('tapping the street picks the lane') : bad('lane after tap ' + s.lane);
await page.waitForTimeout(100);
// drag across the street
const a = await L(20, 120), b = await L(160, 120);
await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 5 }); await page.mouse.up();
s = await state(); s.lane === 2 ? good('dragging steers') : bad('lane after drag ' + s.lane);

// slide a free tile with a click on the grid
await page.evaluate(() => { const g = window.__loop.game; g.p = 5; });
const cell = await page.evaluate(() => { const g = window.__loop.game; for (let d = 0; d < 3; d++) for (let l = 0; l < 3; l++) if (g.grid[d][l] && g.slideCells(d, l)) return { d, l }; return null; });
if (!cell) bad('no movable tile found');
else {
  const before = (await state()).slides;
  await click(9 + cell.l * 54 + 27, 218 + (2 - cell.d) * 29 + 14);
  const after = (await state()).slides;
  after === before + 1 ? good('clicking a movable tile slides it') : bad(`slide count ${before} -> ${after}`);
}

// a long bot-driven run: laps, ghosts, tremors, no errors
await page.evaluate(() => { window.__loop.game.hp = 3; window.__loop.bot(true); });
await page.waitForTimeout(100);
await page.evaluate(() => window.__loop.skip(70));
s = await state();
s.lap >= 7 && !s.over ? good(`70 s with the bot: lap ${s.lap + 1}, coins ${s.coins}`) : bad('bot run ended early ' + JSON.stringify(s));
await page.evaluate(() => window.__loop.bot(false));

// pause and resume
await page.keyboard.press('p');
(await state()).mode === 'pause' ? good('P pauses') : bad('no pause');
await page.keyboard.press('p');
(await state()).mode === 'play' ? good('P resumes') : bad('no resume');

// die on purpose, then play again with the button
await page.evaluate(() => { const g = window.__loop.game; g.hp = 1; });
await page.evaluate(() => { const g = window.__loop.game; for (let d = 0; d < 3; d++) g.grid[d][g.lane] = null; });
await page.evaluate(() => { const g = window.__loop.game; g.hp = 0; });
await page.evaluate(() => window.__loop.skip(0));
// force a hurt: put a brute in your lane right ahead
await page.evaluate(() => { const g = window.__loop.game; g.hp = 1; g.invuln = 0; });
for (let i = 0; i < 40 && (await state()).mode === 'play'; i++) {
  await page.evaluate(() => { const g = window.__loop.game; g.hp = 1; g.invuln = 0; g.grid[g.district()][g.lane] = { id: 9999 + Math.floor(g.p * 10), rune: 'spikes', variant: 1, state: [1, 1], items: [{ kind: 'spike', off: (g.p % 10) + 0.1, len: 1.6, hp: 1, worth: 0 }, { kind: 'spike', off: (g.p % 10) + 2, len: 1.6, hp: 1, worth: 0 }] }; });
  await page.waitForTimeout(150);
}
await page.waitForTimeout(1200);
s = await state();
s.mode === 'over' ? good('dying shows the game over screen') : bad('mode after dying: ' + s.mode);
await click(90, 208 + 10); // AGAIN
await page.waitForTimeout(200);
s = await state();
s.mode === 'play' && !s.over && s.lap === 0 ? good('AGAIN starts a fresh run') : bad('again: ' + JSON.stringify(s));
const saved = await page.evaluate(() => localStorage.getItem('ae_save_v1'));
saved && JSON.parse(saved).runs >= 2 ? good('progress saved: ' + saved) : bad('no save: ' + saved);

await browser.close();
server.close();
console.log(problems ? `\n${problems} problem(s)` : '\nsmoke ok');
process.exit(problems ? 1 : 0);
