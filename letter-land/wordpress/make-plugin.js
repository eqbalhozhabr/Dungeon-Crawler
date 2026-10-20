// node letter-land/wordpress/make-plugin.js  ->  letter-land/dist/sarzamin-e-harfha-wp.zip  (a WordPress plugin)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
execFileSync('node', [path.join(root, 'build.js')], { stdio: 'inherit' });

const stage = fs.mkdtempSync(path.join(require('os').tmpdir(), 'sarzamin-'));
const plugin = path.join(stage, 'sarzamin-e-harfha');
fs.mkdirSync(path.join(plugin, 'game'), { recursive: true });
fs.copyFileSync(path.join(__dirname, 'sarzamin-e-harfha.php'), path.join(plugin, 'sarzamin-e-harfha.php'));
fs.copyFileSync(path.join(__dirname, 'readme.txt'), path.join(plugin, 'readme.txt'));
fs.copyFileSync(path.join(root, 'dist', 'index.html'), path.join(plugin, 'game', 'index.html'));

const zip = path.join(root, 'dist', 'sarzamin-e-harfha-wp.zip');
if (fs.existsSync(zip)) fs.unlinkSync(zip);
execFileSync('zip', ['-qr', zip, 'sarzamin-e-harfha'], { cwd: stage });
console.log(zip, Math.round(fs.statSync(zip).size / 1024) + ' KB');
