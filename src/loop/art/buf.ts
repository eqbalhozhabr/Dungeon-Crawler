// A software pixel buffer for Alley Echo: everything is drawn into this array, then put on a canvas that
// the browser scales up with nearest-neighbour. Colours are 0xRRGGBB.
import { GLYPHS } from '../../art/glyphs';
import { NONE, type Px } from '../../art/pixel';

const pack = (c: number): number => 0xff000000 | ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff);
const unpack = (v: number): number => ((v & 0xff) << 16) | (v & 0xff00) | ((v >> 16) & 0xff);

export const mixc = (a: number, b: number, t: number): number => {
  const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
  const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
  const l = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return (r << 16) | (g << 8) | l;
};

export interface SpriteOpts {
  alpha?: number;
  flip?: boolean;
  /** Replace every pixel colour by a mix towards this colour. */
  tint?: number;
  tintAmount?: number;
}

export class PixBuf {
  readonly img: ImageData;
  private readonly d32: Uint32Array;
  /** Everything drawn is clipped to this rectangle. */
  clipY0 = 0;
  clipY1: number;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.img = new ImageData(w, h);
    this.d32 = new Uint32Array(this.img.data.buffer);
    this.clipY1 = h;
  }

  fill(c: number): void {
    this.d32.fill(pack(c));
  }

  set(x: number, y: number, c: number): void {
    x |= 0;
    y |= 0;
    if (x < 0 || x >= this.w || y < this.clipY0 || y >= this.clipY1) return;
    this.d32[y * this.w + x] = pack(c);
  }

  get(x: number, y: number): number {
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return 0;
    return unpack(this.d32[y * this.w + x]);
  }

  blend(x: number, y: number, c: number, a: number): void {
    x |= 0;
    y |= 0;
    if (x < 0 || x >= this.w || y < this.clipY0 || y >= this.clipY1 || a <= 0) return;
    const i = y * this.w + x;
    this.d32[i] = pack(a >= 1 ? c : mixc(unpack(this.d32[i]), c, a));
  }

  rect(x: number, y: number, w: number, h: number, c: number, a = 1): void {
    x = Math.round(x);
    y = Math.round(y);
    w = Math.round(w);
    h = Math.round(h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.blend(x + i, y + j, c, a);
  }

  frame(x: number, y: number, w: number, h: number, c: number, a = 1): void {
    this.rect(x, y, w, 1, c, a);
    this.rect(x, y + h - 1, w, 1, c, a);
    this.rect(x, y + 1, 1, h - 2, c, a);
    this.rect(x + w - 1, y + 1, 1, h - 2, c, a);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: number, a = 1): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.blend(x0, y0, c, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  disc(cx: number, cy: number, r: number, c: number, a = 1): void {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.blend(x, y, c, a);
  }

  ell(cx: number, cy: number, rx: number, ry: number, c: number, a = 1): void {
    if (rx <= 0 || ry <= 0) return;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const dy = (y + 0.5 - cy) / ry;
      if (Math.abs(dy) > 1) continue;
      const hw = rx * Math.sqrt(1 - dy * dy);
      for (let x = Math.ceil(cx - hw - 0.5); x <= Math.floor(cx + hw - 0.5); x++) this.blend(x, y, c, a);
    }
  }

  ring(cx: number, cy: number, r: number, c: number, a = 1): void {
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= r + 0.5 && d >= r - 0.6) this.blend(x, y, c, a);
      }
  }

  /** Fill a convex quad (or any convex polygon) without anti-aliasing. `c` may be a function of the pixel. */
  poly(pts: number[], c: number | ((x: number, y: number) => number), a = 1): void {
    const n = pts.length / 2;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < n; i++) {
      y0 = Math.min(y0, pts[i * 2 + 1]);
      y1 = Math.max(y1, pts[i * 2 + 1]);
    }
    y0 = Math.max(Math.ceil(y0 - 0.5), this.clipY0);
    y1 = Math.min(Math.floor(y1 - 0.5), this.clipY1 - 1);
    for (let y = y0; y <= y1; y++) {
      const yy = y + 0.5;
      let xl = Infinity;
      let xr = -Infinity;
      for (let i = 0; i < n; i++) {
        const ax = pts[i * 2];
        const ay = pts[i * 2 + 1];
        const bx = pts[((i + 1) % n) * 2];
        const by = pts[((i + 1) % n) * 2 + 1];
        if ((ay <= yy && by > yy) || (by <= yy && ay > yy)) {
          const x = ax + ((yy - ay) / (by - ay)) * (bx - ax);
          xl = Math.min(xl, x);
          xr = Math.max(xr, x);
        }
      }
      if (xl > xr) continue;
      for (let x = Math.ceil(xl - 0.5); x <= Math.floor(xr - 0.5); x++) this.blend(x, y, typeof c === 'number' ? c : c(x, y), a);
    }
  }

  // ---------------------------------------------------------------- text
  textWidth(s: string, scale = 1): number {
    return s.length * 6 * scale - scale;
  }

  text(s: string, x: number, y: number, c: number, scale = 1, shadow = -1): number {
    let cx = Math.round(x);
    for (const ch of s.toUpperCase()) {
      const g = GLYPHS[ch] ?? GLYPHS['?'];
      const rows = g.split('/');
      for (let j = 0; j < 7; j++)
        for (let i = 0; i < 5; i++)
          if (rows[j][i] === '#') {
            if (shadow >= 0) this.rect(cx + i * scale + scale, y + j * scale + scale, scale, scale, shadow);
            this.rect(cx + i * scale, y + j * scale, scale, scale, c);
          }
      cx += 6 * scale;
    }
    return cx - Math.round(x);
  }

  textC(s: string, cx: number, y: number, c: number, scale = 1, shadow = -1): void {
    this.text(s, cx - this.textWidth(s, scale) / 2, y, c, scale, shadow);
  }

  // ---------------------------------------------------------------- sprites
  /** Draw a code-made sprite scaled to `hpx` pixels tall, feet centred on (cx, by). Nearest-neighbour. */
  sprite(spr: Px, cx: number, by: number, hpx: number, o: SpriteOpts = {}): void {
    const sc = hpx / spr.h;
    const dw = Math.max(1, Math.round(spr.w * sc));
    const dh = Math.max(1, Math.round(hpx));
    const x0 = Math.round(cx - dw / 2);
    const y0 = Math.round(by - dh);
    const a = o.alpha ?? 1;
    for (let j = 0; j < dh; j++) {
      const sy = Math.min(spr.h - 1, Math.floor(j / sc));
      for (let i = 0; i < dw; i++) {
        let sx = Math.min(spr.w - 1, Math.floor(i / sc));
        if (o.flip) sx = spr.w - 1 - sx;
        let c = spr.d[sy * spr.w + sx];
        if (c === NONE) continue;
        if (o.tint !== undefined) c = mixc(c, o.tint, o.tintAmount ?? 0.6);
        this.blend(x0 + i, y0 + j, c, a);
      }
    }
  }

  toCanvas(ctx: CanvasRenderingContext2D): void {
    ctx.putImageData(this.img, 0, 0);
  }
}
