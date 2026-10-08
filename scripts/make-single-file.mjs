// Inlines the production build (dist/) into ONE html fragment, handy for sharing a playable copy
// (e.g. as a Claude artifact). Usage: npx vite build && node scripts/make-single-file.mjs <out.html>
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2] ?? 'dist/single.html';
const dist = 'dist';
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const m = html.match(/<script type="module"[^>]*src="\.\/(assets\/[^"]+)"[^>]*><\/script>/);
if (!m) throw new Error('bundle script tag not found in dist/index.html');
const js = fs.readFileSync(path.join(dist, m[1]), 'utf8').replace(/<\/script/gi, '<\\/script');

const page = `<title>Intestine Crawler</title>
<style>
  :root { --bg: #1a0a14; --fg: #f4e3d7; color-scheme: dark; }
  html, body { height: 100%; margin: 0; padding: 0; background: var(--bg); color: var(--fg); overflow: hidden;
    -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; touch-action: none; }
  #game { position: fixed; inset: 0; }
  canvas { display: block; image-rendering: pixelated; image-rendering: crisp-edges; }
</style>
<div id="game"></div>
<script type="module">${js}</script>
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, page);
console.log(`${out}: ${(page.length / 1024).toFixed(0)} KB`);
