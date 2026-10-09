// Screenshots of Alley Echo (debug build): LOOP_OUT=dist-loop-dbg VITE_ENABLE_DEBUG=1 npm run build:loop
// usage: node scripts/loop-shot.mjs [outdir] [dist]
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const out = process.argv[2] ?? 'shots';
const root = path.resolve(process.argv[3] ?? 'dist-loop-dbg');
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const f = path.join(root, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': mime[path.extname(f)] ?? 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await page.goto(`http://localhost:${server.address().port}/?seed=7`);
await page.waitForTimeout(1500);
const shot = async (name, wait = 300) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${out}/${name}.png` }); };
await shot('1_title', 1200);
await page.evaluate(() => window.__loop.start());
await shot('2_start', 600);
await page.evaluate(() => window.__loop.skip(5));
await shot('3_lap0');
await page.evaluate(() => window.__loop.skip(6));
await shot('4_lap1_ghost');
await page.evaluate(() => window.__loop.skip(26));
await shot('5_lap4');
await page.evaluate(() => window.__loop.pause(true));
await shot('6_pause');
await page.evaluate(() => { window.__loop.pause(false); window.__loop.game.hp = 1; window.__loop.game.lane = 0; });
await page.evaluate(() => window.__loop.skip(80));
await shot('7_over', 1500);
await browser.close();
server.close();
