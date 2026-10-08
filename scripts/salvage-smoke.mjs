// End-to-end smoke test for the salvage prototype: plays whole runs with REAL mouse clicks/drags.
// Needs a debug build: VITE_ENABLE_DEBUG=1 npm run build:salvage   (usage: node scripts/salvage-smoke.mjs [runs] [dir])
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const RUNS = Number(process.argv[2] ?? 2);
const root = path.resolve(process.argv[3] ?? 'dist-salvage');
const shots = process.env.SHOTS ?? 'shots';
fs.mkdirSync(shots, { recursive: true });
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
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const errors = [];
const external = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('request', (r) => { if (!r.url().startsWith(origin) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()); });
await page.goto(origin + '/');
await page.waitForTimeout(2200);
const box = await page.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
const P = (gx, gy) => [box.x + (gx * box.w) / 480, box.y + (gy * box.h) / 270];
const click = async (gx, gy) => { const [x, y] = P(gx, gy); await page.mouse.click(x, y); };
const drag = async (ax, ay, bx, by) => {
  const [x0, y0] = P(ax, ay); const [x1, y1] = P(bx, by);
  await page.mouse.move(x0, y0); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x0 + ((x1 - x0) * i) / 8, y0 + ((y1 - y0) * i) / 8);
  await page.mouse.up();
};
const scene = () => page.evaluate(() => window.__phaser.scene.getScenes(true).map((s) => s.scene.key)[0]);
const log = (...a) => console.log(...a);
let fails = 0;
const must = (c, m) => { if (!c) { fails++; log('FAIL', m); } };

async function overlay() {
  return page.evaluate(() => {
    const s = window.__phaser.scene.getScenes(true)[0];
    const cards = s.children.list.filter((o) => o.depth === 1001 && o.cardId).map((o) => ({ id: o.cardId, x: o.x, y: o.y, sc: o.scaleX }));
    return { open: s.children.list.some((o) => o.depth === 1000), cards };
  });
}
async function clickOverlayCard(i = 0) {
  const o = await overlay();
  const c = o.cards[Math.min(i, o.cards.length - 1)];
  await click(c.x + (66 * c.sc) / 2, c.y + (94 * c.sc) / 2);
}

async function playFight(tag) {
  let rounds = 0;
  let firstDrag = true;
  for (let guard = 0; guard < 400; guard++) {
    await page.waitForTimeout(120);
    const sc = await scene();
    if (sc !== 'SFight') return 'left';
    const st = await page.evaluate(() => {
      const s = window.__phaser.scene.getScene('SFight');
      return {
        busy: s.busy, result: s.cb.result, energy: s.cb.energy,
        overlay: s.children.list.some((o) => o.depth === 1000),
        hand: s.cb.hand.map((c) => ({ uid: c.uid, id: c.id })),
        view: Object.fromEntries([...s.cards.entries()].map(([u, v]) => [u, { x: v.x, y: v.y }])),
        en: s.cb.alive().map((i) => ({ i, x: s.ev[i].x, y: s.ev[i].sprite.y - s.ev[i].sprite.displayHeight / 2, hp: s.cb.enemies[i].hp })),
        cost: Object.fromEntries(s.cb.hand.map((c) => [c.uid, window.__cards ? window.__cards[c.id].cost : 9])),
      };
    });
    if (st.overlay) return 'reward';
    if (st.busy || st.result) continue;
    // choose a card the energy allows (cost looked up from the deck definitions on the page)
    const info = await page.evaluate(() => {
      const s = window.__phaser.scene.getScene('SFight');
      return s.cb.hand.map((c) => { const d = s.constructor.__defs ? 0 : 0; return { uid: c.uid, d }; });
    });
    void info;
    const pick = await page.evaluate(() => {
      const s = window.__phaser.scene.getScene('SFight');
      const playable = s.cb.hand.filter((c) => s.cards.get(c.uid) && s.cb.canPlay(c.uid, s.cb.alive()[0]));
      if (!playable.length) return null;
      const c = playable[Math.floor(Math.random() * playable.length)];
      return { uid: c.uid, needsEnemy: s.cb.canPlay(c.uid) === false };
    });
    if (!pick) {
      await click(400, 220); // END TURN button
      rounds++;
      continue;
    }
    const v = st.view[pick.uid];
    const cx = v.x + 33, cy = Math.max(v.y + 24, 230);
    const target = st.en[Math.floor(Math.random() * st.en.length)];
    if (pick.needsEnemy) {
      if (firstDrag) { firstDrag = false; await drag(cx, cy, target.x, target.y); }
      else { await click(cx, cy); await page.waitForTimeout(60); await click(target.x, target.y); }
    } else {
      await click(cx, cy); await page.waitForTimeout(80);
      const v2 = await page.evaluate((u) => { const s = window.__phaser.scene.getScene('SFight'); const w = s.cards.get(u); return w ? { x: w.x, y: w.y } : null; }, pick.uid);
      if (v2) await click(v2.x + 33, v2.y + 30);
    }
  }
  return 'timeout';
}

for (let r = 0; r < RUNS; r++) {
  await page.evaluate(() => window.__phaser.scene.getScenes(true).forEach((s) => s.scene.start('STitle')));
  await page.waitForTimeout(500);
  await click(240, 238); // START RUN
  await page.waitForTimeout(600);
  must((await scene()) === 'SMap', 'map after start');
  for (let step = 0; step < 12; step++) {
    const sc = await scene();
    if (sc === 'SEnd') break;
    await page.waitForTimeout(500);
    if (sc === 'SMap') {
      const info = await page.evaluate(() => { const r = window.__sv.run; return { step: r.step, n: r.map[r.step].length, total: r.map.length }; });
      const x = 36 + info.step * ((480 - 72) / (info.total - 1));
      const y = 128 + (info.n === 1 ? 0 : (Math.floor(Math.random() * info.n) - 0.5) * 70);
      await click(x, y);
      await page.waitForTimeout(900);
    }
    const s2 = await scene();
    log(`run ${r} step ${step} scene ${s2}`);
    if (s2 === 'SFight') {
      const res = await playFight();
      await page.waitForTimeout(500);
      const o = await overlay();
      if (o.open) {
        if (r === 0 && step === 0) await page.screenshot({ path: `${shots}/smoke_reward.png` });
        await clickOverlayCard(Math.floor(Math.random() * 3));
        await page.waitForTimeout(900);
      } else log('  fight ended without reward overlay:', res, await scene());
    } else if (s2 === 'SExplore') {
      const kind = await page.evaluate(() => window.__sv.room.kind);
      if (kind === 'corpse') {
        await click(240, 220); await page.waitForTimeout(500);
      } else {
        const fit = await page.evaluate(() => {
          const s = window.__phaser.scene.getScene('SExplore');
          const f = s.hand.find((c) => window.__sv.run.fits(s.kind, c.id));
          if (!f) return null;
          const v = s.views.get(f.uid);
          return { x: v.x + 33, y: v.y + 30, uid: f.uid };
        });
        if (fit) {
          await click(fit.x, fit.y); await page.waitForTimeout(300);
          const v2 = await page.evaluate((u) => { const s = window.__phaser.scene.getScene('SExplore'); const w = s.views.get(u); return { x: w.x + 33, y: w.y + 30 }; }, fit.uid);
          await click(v2.x, v2.y);
        } else await click(442, 232); // BASH IT
      }
      await page.waitForTimeout(1500);
      const o = await overlay();
      if (o.open) {
        if (r === 0 && kind !== 'corpse') await page.screenshot({ path: `${shots}/smoke_explore_reward.png` });
        await clickOverlayCard(0); await page.waitForTimeout(900);
      } else { log('  explore without overlay', kind); await page.screenshot({ path: `${shots}/smoke_noverlay.png` }); }
    } else if (s2 === 'SPool') {
      await click(88, 215); // REST
      await page.waitForTimeout(1500);
    }
  }
  const end = await scene();
  const res = await page.evaluate(() => ({ won: window.__sv.run.won, lost: window.__sv.run.lost, step: window.__sv.run.step, hp: window.__sv.run.hp, deck: window.__sv.run.deck.length }));
  log(`run ${r} ended in ${end}:`, JSON.stringify(res));
  if (end === 'SEnd') await page.screenshot({ path: `${shots}/smoke_end_${r}.png` });
  must(end === 'SEnd', 'run reaches the end screen');
}
// winning path: boss with 1 HP enemies, finished with real clicks
await page.evaluate(() => window.__phaser.scene.getScenes(true).forEach((s) => s.scene.start('STitle')));
await page.waitForTimeout(500);
await click(240, 238);
await page.waitForTimeout(600);
await page.evaluate(() => { const sv = window.__sv; sv.run.step = 7; sv.room = sv.run.map[7][0]; sv.run.hp = 30; window.__phaser.scene.getScenes(true).forEach((s) => s.scene.stop()); });
await page.waitForTimeout(200);
await page.evaluate(() => { window.__phaser.scene.start('SFight'); });
await page.waitForTimeout(1200);
await page.evaluate(() => { const s = window.__phaser.scene.getScene('SFight'); s.cb.enemies.forEach((e) => { e.hp = 1; }); s.ev.forEach((v) => { v.shown = 1; }); });
const w = await playFight();
await page.waitForTimeout(2500);
log('boss fight ->', w, await scene());
must((await scene()) === 'SEnd' && (await page.evaluate(() => window.__sv.run.won)), 'boss win leads to the win screen');
await page.screenshot({ path: `${shots}/smoke_win.png` });
log('page errors:', errors.length ? errors : 'none', '| external requests:', external.length ? external : 'none');
await browser.close();
server.close();
process.exit(fails || errors.length ? 1 : 0);
