// Renders guide images for the hand-drawn art (perspective grid, safe areas) into docs/art-guides/.
// Usage: npx tsx scripts/make-art-guides.ts
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { FP, H, W, fpDist, fpProject } from '../src/config';
import { castRay } from '../src/art/fp';
import { Px } from '../src/art/pixel';

fs.mkdirSync('docs/art-guides', { recursive: true });

function save(px: Px, name: string, scale: number): void {
  const out = Buffer.alloc(px.w * px.h * 3);
  for (let i = 0; i < px.d.length; i++) {
    const c = px.d[i] < 0 ? 0x101010 : px.d[i];
    out[i * 3] = (c >> 16) & 255; out[i * 3 + 1] = (c >> 8) & 255; out[i * 3 + 2] = c & 255;
  }
  const ppm = `docs/art-guides/${name}.ppm`;
  fs.writeFileSync(ppm, Buffer.concat([Buffer.from(`P6 ${px.w} ${px.h} 255\n`), out]));
  execSync(`ffmpeg -v error -y -i ${ppm} -vf scale=${px.w * scale}:${px.h * scale}:flags=neighbor docs/art-guides/${name}.png`);
  fs.rmSync(ppm);
}

// ---- first-person camera plate (480x270): floor / walls / ceiling shaded flat, plus the grid the game uses
const px = new Px(W, H);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const { d, surf, X } = castRay(x, y);
    let c = surf === 'floor' ? 0x3a3a46 : surf === 'ceil' ? 0x2a2a34 : 0x32323e;
    if (d > FP.dEnd) c = 0x1c1c24;
    if (surf === 'floor' && Math.abs(X) <= 2.5 * FP.lane && d >= 2.5 && d <= 11.5) c = 0x4a4a5a; // the belt
    px.set(x, y, c);
  }
const line = (x0: number, y0: number, x1: number, y1: number, c: number) => px.line(x0, y0, x1, y1, c);
// lane boundaries (6 lines) and cell boundaries (every column)
for (let k = 0; k <= 5; k++) {
  const a = fpProject((k - 2.5) * FP.lane, 0, fpDist(-0.5)), b = fpProject((k - 2.5) * FP.lane, 0, fpDist(7.5));
  line(a.x, a.y, b.x, b.y, 0x8a8aa8);
}
for (let c = -1; c <= 8; c++) {
  const a = fpProject(-2.5 * FP.lane, 0, fpDist(c) + 0.5), b = fpProject(2.5 * FP.lane, 0, fpDist(c) + 0.5);
  line(a.x, a.y, b.x, b.y, c === 2 ? 0xd9a93a : 0x8a8aa8); // gold = the end of the player's reach
}
// vanishing point, horizon, exit door circle
line(0, FP.yh, W - 1, FP.yh, 0x3a8a5a);
line(FP.cx, 0, FP.cx, H - 1, 0x3a8a5a);
const door = fpProject(0, 1.0, FP.dEnd);
for (let a = 0; a < 360; a += 3) px.set(door.x + Math.cos((a * Math.PI) / 180) * 27, door.y + Math.sin((a * Math.PI) / 180) * 27, 0xff6a6a);
// UI zones (rectangles): top HUD, hint line, hand, buttons
const rect = (x0: number, y0: number, x1: number, y1: number, c: number) => {
  line(x0, y0, x1, y0, c); line(x1, y0, x1, y1, c); line(x1, y1, x0, y1, c); line(x0, y1, x0, y0, c);
};
rect(0, 0, 479, 24, 0x6a9aff); // HUD bars
rect(8, 41, 472, 55, 0x6a9aff); // hint line
rect(52, 208, 390, 269, 0xffb06a); // hand of cards (top 62px visible)
rect(396, 194, 476, 262, 0xffb06a); // buttons
rect(0, 250, 479, 269, 0xff4a4a); // bottom 20px: iPhone home-indicator zone, keep taps out of here
save(px, 'first-person-camera-guide', 2);
console.log('wrote docs/art-guides/first-person-camera-guide.png');
