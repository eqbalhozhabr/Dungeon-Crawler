// End-to-end smoke test (headless Chromium): plays a whole game with real mouse clicks.
// Needs a debug build: VITE_ENABLE_DEBUG=1 npx vite build   (usage: node scripts/smoke.mjs [seed] [dir] [WxH])
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const seed = process.argv[2] ?? '5';
const dir = process.argv[3] ?? 'dist';
const [VW, VH] = (process.argv[4] ?? '1920x1080').split('x').map(Number);
const shots = process.env.SHOTS ?? 'shots';
fs.mkdirSync(shots, { recursive: true });

const root = path.resolve(dir);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const f = path.join(root, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': mime[path.extname(f)] ?? 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const origin = `http://localhost:${server.address().port}`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: VW, height: VH } });
const errors = [];
const external = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('request', (r) => { if (!r.url().startsWith(origin) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()); });
await page.goto(`${origin}/?seed=${seed}`);
await page.waitForTimeout(800);
const box0 = await page.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
await page.mouse.click(box0.x + (240 * box0.w) / 480, box0.y + (205 * box0.h) / 270); // click PLAY
await page.waitForTimeout(1800);

const box = await page.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
const px = (gx, gy) => [box.x + (gx * box.w) / 480, box.y + (gy * box.h) / 270];
const cellPos = (r, c) => px(40 + c * 32 + 16, 38 + r * 32 + 16);

// choose an action inside the page (simple greedy-ish policy over the real game state)
const MODE = process.env.MODE ?? 'greedy';
const chooseAction = () => page.evaluate((MODE) => {
  const s = window.__gut.scene, g = s.g;
  if (g.phase !== 'play') return { type: 'end' };
  if (MODE === 'idle') return { type: 'squeeze' };
  if (g.canEscape() && (g.digest >= 12 || g.score >= g.level.stars[0])) return { type: 'escape' };
  let best = null;
  g.hand.forEach((card, i) => {
    if (!g.canPlay(i)) return;
    const cost = { pick: 1, zapper: 1, net: 2, shove: 1 }[card.tool];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) {
      const area = g.area(card.tool, r, c);
      if (!area.length) continue;
      let v = 0;
      for (const p of area) {
        const cell = g.at(p.r, p.c);
        if (!cell) continue;
        if (card.tool === 'shove') { v += (cell.kind === 'bug' && p.c >= 6) ? 5 : 0; continue; }
        if (cell.kind === 'gem') v += 12; else if (cell.kind === 'bug') v += 4 + p.c * 2; else v += 0.1;
      }
      v /= cost;
      if (v > 0 && (!best || v > best.v)) best = { v, i, r, c };
    }
  });
  return best ? { type: 'play', ...best } : { type: 'squeeze' };
}, MODE);

let step = 0, shotsTaken = 0;
while (step++ < 260) {
  const a = await chooseAction();
  if (a.type === 'end') break;
  if (a.type === 'escape') { await page.mouse.click(...px(438, 247)); await page.waitForTimeout(500); await page.screenshot({ path: `${shots}/escape_anim.png` }); await page.waitForTimeout(3600); break; }
  if (a.type === 'squeeze') {
    if (shotsTaken === 1) { await page.mouse.click(...px(358, 247)); await page.waitForTimeout(180); await page.screenshot({ path: `${shots}/squeeze_anim.png` }); shotsTaken++; }
    else await page.mouse.click(...px(358, 247)); // SQUEEZE button
    await page.waitForTimeout(1500);
    continue;
  }
  const [cx, cy] = px(48 + a.i * 66 + 31, 248);
  await page.mouse.click(cx, cy); // real click on the card
  await page.waitForTimeout(120);
  const [x, y] = cellPos(a.r, a.c);
  await page.mouse.move(x, y);
  await page.waitForTimeout(120);
  if (shotsTaken === 0) { await page.screenshot({ path: `${shots}/preview.png` }); shotsTaken++; }
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(900);
}
await page.waitForTimeout(800);
const state = await page.evaluate(() => { const g = window.__gut.scene.g; return { phase: g.phase, lost: g.lossReason, score: g.score, turn: g.turn, digest: g.digest, infection: g.infection, result: g.result }; });
await page.screenshot({ path: `${shots}/end.png` });
console.log(JSON.stringify(state));
console.log('page errors:', errors.length ? errors : 'none');
console.log('external requests:', external.length ? external : 'none');
await browser.close();
server.close();
