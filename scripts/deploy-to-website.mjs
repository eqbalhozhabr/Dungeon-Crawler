// Copies the production build into the Lucky Lion website repo as public/<slug>/ (default: guts-and-gems).
// Only that one folder is replaced; nothing else in the website is touched.
// Usage: npx vite build && node scripts/deploy-to-website.mjs <path to luckylion-website> [slug] [distDir] [title]
//   Gullet Salvage: npm run build:salvage && node scripts/deploy-to-website.mjs <site> gullet-salvage dist-salvage "Gullet Salvage"
import fs from 'node:fs';
import path from 'node:path';

const site = path.resolve(process.argv[2] ?? '');
const slug = process.argv[3] ?? 'guts-and-gems';
if (!process.argv[2] || !fs.existsSync(path.join(site, 'astro.config.mjs')) || !fs.existsSync(path.join(site, 'public'))) {
  console.error('Pass the path of the luckylion-website repo (needs astro.config.mjs and public/).');
  process.exit(1);
}
if (!/^[a-z0-9-]+$/.test(slug) || slug === 'case-in-a-nutshell') {
  console.error(`Refusing slug "${slug}".`);
  process.exit(1);
}
const dist = path.resolve(process.argv[4] ?? 'dist');
const title = process.argv[5] ?? 'Guts & Gems';
if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/index.html not found: run "npx vite build" first (without VITE_ENABLE_DEBUG).');
  process.exit(1);
}
const js = fs.readdirSync(path.join(dist, 'assets')).map((f) => fs.readFileSync(path.join(dist, 'assets', f), 'utf8')).join('');
if (js.includes('__gut') || js.includes('__phaser') || js.includes('__sv')) {
  console.error('This build contains debug hooks. Rebuild without VITE_ENABLE_DEBUG=1.');
  process.exit(1);
}

const target = path.join(site, 'public', slug);
fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(dist, target, { recursive: true });

const phaserLicence = fs.readFileSync(path.resolve('node_modules/phaser/LICENSE.md'), 'utf8').trim();
fs.writeFileSync(
  path.join(target, 'THIRD_PARTY_NOTICES.txt'),
  `${title} - third-party notices
${'='.repeat(title.length + 22)}

This game contains the following third-party open-source software. Its licence text is
reproduced below as the licence requires.

--------------------------------------------------------------------------------
Phaser 3.90.0  -  https://phaser.io  -  MIT License
--------------------------------------------------------------------------------

${phaserLicence}
`,
);
const files = fs.readdirSync(target, { recursive: true });
console.log(`Copied to ${target} (${files.length} entries)`);
