// Builds the CrazyGames portal target and zips it (index.html at the zip root).
// Checks the CrazyGames Basic Launch size limits and relative paths. See docs/CRAZYGAMES_PLAYBOOK.md.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const target = 'crazygames';
const out = `dist-${target}`;
const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
let commit = 'nogit';
try { commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* no commits yet */ }

execSync('npx tsc --noEmit', { stdio: 'inherit' });
execSync('npx vite build', { stdio: 'inherit', env: { ...process.env, VITE_TARGET: target } });

const files = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p); else files.push(p);
  }
})(out);

const total = files.reduce((s, f) => s + fs.statSync(f).size, 0);
const problems = [];
if (!fs.existsSync(path.join(out, 'index.html'))) problems.push('index.html is not at the build root');
const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
if (/(src|href)=["']\//.test(html)) problems.push('index.html uses absolute paths');
if (/https?:\/\/(?!www\.w3\.org)/.test(html)) problems.push('index.html references an external URL');
if (total > 20 * 1024 * 1024) problems.push(`total size ${(total / 1048576).toFixed(1)} MB is above 20 MB (mobile homepage limit)`);
if (files.length > 1500) problems.push('more than 1500 files');
// debug hooks must not ship in a portal build
for (const f of files.filter((f) => f.endsWith('.js'))) {
  if (fs.readFileSync(f, 'utf8').includes('__gut')) problems.push(`${f} contains a debug hook`);
}

console.log(`\n${files.length} files, ${(total / 1024).toFixed(0)} KB total`);
files.forEach((f) => console.log(`  ${f}  ${(fs.statSync(f).size / 1024).toFixed(0)} KB`));
if (problems.length) {
  console.error('\nPROBLEMS:\n - ' + problems.join('\n - '));
  process.exit(1);
}

fs.mkdirSync('releases/crazygames', { recursive: true });
const zip = path.resolve(`releases/crazygames/down-the-hatch-crazygames-v${version}-${commit}.zip`);
if (fs.existsSync(zip)) fs.rmSync(zip);
execSync(`zip -r -q "${zip}" .`, { cwd: out, stdio: 'inherit' });
console.log(`\nZip: ${zip} (${(fs.statSync(zip).size / 1024).toFixed(0)} KB)`);
