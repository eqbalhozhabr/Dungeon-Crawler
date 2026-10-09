// The camera of the street. The alley is the OUTSIDE of a cylinder (a rolling drum): ahead of you the road drops away
// over the curve, and buildings stand radially, so far ones lean away from you. On top of that goes a fisheye
// lens, so near buildings splay outwards and verticals bow, like the reference picture.
// World units: one lane = 0.8, one ring row = 1. d = rows ahead of the runner, X = sideways, Y = height above the road.
import { SCENE_H, W } from './config';

export const CAM = {
  R: 28, // radius of the drum in rows (smaller = stronger curve, shorter view)
  camZ: 2.0, // camera sits this far behind the runner...
  camY: 3.0, // ...and this high
  pitch: 0.55, // radians the camera looks down
  f: 150, // focal length in pixels
  cx: 90,
  cy: 107, // screen position of the optical axis (puts the runner at about y = 174)
  lens: 0.7, // 1 = ordinary lens, smaller = stronger fisheye (r = f tan(a t) / a)
};

export interface P2 {
  x: number;
  y: number;
}

export function proj(d: number, X: number, Y = 0, ox = 0): P2 {
  const phi = d / CAM.R;
  const rad = CAM.R + Y;
  const vf = rad * Math.sin(phi) + CAM.camZ; // forward of the camera
  const vu = rad * Math.cos(phi) - CAM.R - CAM.camY; // above the camera
  const cp = Math.cos(CAM.pitch);
  const sp = Math.sin(CAM.pitch);
  const depth = vf * cp - vu * sp;
  const up = vf * sp + vu * cp;
  // fisheye: the angle off the optical axis, bent by the lens, so near things splay outwards and verticals bow
  const h = Math.hypot(X, up);
  if (h < 1e-6) return { x: CAM.cx + ox, y: CAM.cy };
  const theta = Math.min(Math.atan2(h, depth), 1.5 / CAM.lens);
  const rho = (CAM.f * Math.tan(CAM.lens * theta)) / CAM.lens;
  return { x: CAM.cx + ox + (rho * X) / h, y: CAM.cy - (rho * up) / h };
}

/** Pixels per world unit sideways (sx) and per unit of height (sy) at a point of the road. */
export function scaleAt(d: number, X: number, ox = 0): { sx: number; sy: number } {
  const a = proj(d, X - 0.5, 0, ox);
  const b = proj(d, X + 0.5, 0, ox);
  const c = proj(d, X, 1, ox);
  const o = proj(d, X, 0, ox);
  return { sx: Math.max(0.5, Math.hypot(b.x - a.x, b.y - a.y)), sy: Math.max(0.5, Math.hypot(c.x - o.x, c.y - o.y)) };
}

/** For every pixel of the street view: which road point (distance d, sideways X) it shows. NaN = not road. */
export interface GroundMap {
  d: Float32Array;
  x: Float32Array;
  /** Distance at which the road drops out of sight (the curve of the drum hides everything beyond). */
  dMax: number;
}

export function buildGroundMap(wx: number, dMin: number, dCap: number): GroundMap {
  const d = new Float32Array(W * SCENE_H).fill(NaN);
  const x = new Float32Array(W * SCENE_H).fill(NaN);
  let dMax = dCap;
  for (let X = -wx; X <= wx + 1e-6; X += 0.008) {
    let minY = Infinity;
    for (let dd = dMin; dd <= dCap; dd += 0.01) {
      const p = proj(dd, X);
      if (dd > 0 && p.y > minY + 0.4) {
        dMax = Math.min(dMax, dd);
        break; // past the horizon of the curve: hidden
      }
      minY = Math.min(minY, p.y);
      const px = Math.round(p.x - 0.5);
      const py = Math.round(p.y - 0.5);
      if (px < 0 || px >= W || py < 0 || py >= SCENE_H) continue;
      d[py * W + px] = dd;
      x[py * W + px] = X;
    }
  }
  // fill the small holes the sampling leaves (left neighbour, then the one below)
  for (let pass = 0; pass < 2; pass++)
    for (let y = SCENE_H - 1; y >= 0; y--) {
      let first = -1;
      let last = -1;
      for (let i = 0; i < W; i++)
        if (!Number.isNaN(d[y * W + i])) {
          if (first < 0) first = i;
          last = i;
        }
      for (let i = first + 1; i < last; i++) {
        const k = y * W + i;
        if (Number.isNaN(d[k])) {
          const src = pass === 0 ? k - 1 : y + 1 < SCENE_H ? k + W : k - 1;
          d[k] = d[src];
          x[k] = x[src];
        }
      }
    }
  return { d, x, dMax };
}
