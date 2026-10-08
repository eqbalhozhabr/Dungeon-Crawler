// Screenshots of the salvage prototype scenes (debug build): VITE_ENABLE_DEBUG=1 npm run build:salvage
// usage: node scripts/salvage-shot.mjs [outdir] [dist]
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const out = process.argv[2] ?? 'shots';
const root = path.resolve(process.argv[3] ?? 'dist-salvage');
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const f = path.join(root, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': mime[path.extname(f)] ?? 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await page.goto(`http://localhost:${server.address().port}/`);
await page.waitForTimeout(2500);
const shot = async (name) => { await page.waitForTimeout(1500); await page.screenshot({ path: `${out}/${name}.png` }); };
await shot('1_title');
const go = (scene, step, room) => page.evaluate(([scene, step, room]) => {
  const g = window.__phaser; const sv = window.__sv;
  if (!sv.run) g.scene.getScene('STitle').scene.start('SMap');
  return null;
}, [scene, step, room]);
await page.evaluate(() => { window.__phaser.scene.getScene('STitle').begin(); });
await shot('2_map');
const start = async (step, pick = 0) => {
  await page.evaluate(() => window.__phaser.scene.getScenes(true).forEach((s) => s.scene.stop()));
  await page.waitForTimeout(150);
  await page.evaluate(([step, pick]) => {
    const sv = window.__sv; sv.run.step = step; sv.room = sv.run.map[step][pick];
    const sc = sv.room.enemies ? 'SFight' : sv.room.kind === 'pool' ? 'SPool' : 'SExplore';
    window.__phaser.scene.start(sc);
  }, [step, pick]);
};
await start(1); await shot('3_fight1');
await start(3); await shot('4_fight2');
await start(5, 1); await shot('5_elite');
await start(7); await shot('6_boss');
await start(2, 0); await shot('7_explore_a');
await start(2, 1); await shot('8_explore_b');
await start(4, 1); await shot('9_alcove');
await start(4, 0); await shot('10_pool');
await start(0); await shot('11_corpse');
await browser.close();
server.close();
