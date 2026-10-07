// Tiny pixel-art canvas: all game art is drawn by code with this helper, one pixel at a time.
export const NONE = -1;

export class Px {
  readonly d: Int32Array;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.d = new Int32Array(w * h).fill(NONE);
  }

  set(x: number, y: number, c: number): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d[y * this.w + x] = c;
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return NONE;
    return this.d[y * this.w + x];
  }

  rect(x: number, y: number, w: number, h: number, c: number): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: number): void {
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
      this.set(x0, y0, c);
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

  /** Fill an ellipse; `shade` may return a colour per pixel (g = 0 centre .. 1 edge). */
  ellipse(cx: number, cy: number, rx: number, ry: number, shade: number | ((dx: number, dy: number, g: number) => number)): void {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        const g = dx * dx + dy * dy;
        if (g > 1) continue;
        const c = typeof shade === 'number' ? shade : shade(dx, dy, g);
        if (c !== NONE) this.set(x, y, c);
      }
  }

  /** 1px outline around everything opaque (4-neighbourhood). */
  outline(c: number): void {
    const add: number[] = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y) !== NONE) continue;
        if (this.get(x - 1, y) !== NONE || this.get(x + 1, y) !== NONE || this.get(x, y - 1) !== NONE || this.get(x, y + 1) !== NONE)
          add.push(y * this.w + x);
      }
    for (const i of add) this.d[i] = c;
  }

  /** Stamp an ASCII sprite. '.' is transparent; other characters are looked up in `legend`. */
  ascii(x: number, y: number, rows: string[], legend: Record<string, number>): void {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.' || ch === ' ') continue;
        const c = legend[ch];
        if (c !== undefined) this.set(x + i, y + j, c);
      }
    });
  }

  flipY(): Px {
    const o = new Px(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) o.set(x, this.h - 1 - y, this.get(x, y));
    return o;
  }

  toCanvas(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.w;
    cv.height = this.h;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(this.w, this.h);
    for (let i = 0; i < this.d.length; i++) {
      const c = this.d[i];
      if (c === NONE) continue;
      img.data[i * 4] = (c >> 16) & 255;
      img.data[i * 4 + 1] = (c >> 8) & 255;
      img.data[i * 4 + 2] = c & 255;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }
}

// 4x4 Bayer matrix for ordered dithering (values 0..15)
export const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** Returns true when t (0..1) should pick the "upper" tone at this pixel. */
export function dither(x: number, y: number, t: number): boolean {
  return t * 16 > BAYER4[y & 3][x & 3] + 0.5;
}

export function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
