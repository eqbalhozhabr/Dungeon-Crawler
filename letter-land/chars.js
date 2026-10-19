/*
 * The two characters, in the style of the supplied stick-figure drawing:
 *   heads : cut out of the drawing itself (heads.js)
 *   bodies: black strokes drawn with canvas paths so they can run and jump
 *   girl  : the same bell-shaped dress as in the drawing
 */
(function (root) {
  'use strict';

  const INK = '#141414';
  const LINE = 4.6;
  const HEAD_SCALE = 0.34;     // display size of the head sprites
  const NECK_Y = -92;          // neck joint, feet are at y = 0
  const HIP_Y = -46;
  const LEG = 46, ARM = 50;

  const heads = {};
  const art = root.LetterHeads || {};
  Object.keys(art).forEach((k) => {
    const img = new Image();
    img.src = art[k].src;
    heads[k] = { img, ax: art[k].ax, ay: art[k].ay };
  });

  function line(ctx, x1, y1, x2, y2) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  function hand(ctx, x, y, dx, dy) { // black mitten with three fingers, like the drawing
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.ellipse(x + ux * 4, y + uy * 4, 6.5, 7.5, Math.atan2(uy, ux) - Math.PI / 2, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 3;
    for (const a of [-0.55, 0, 0.55]) {
      const c = Math.cos(a), s = Math.sin(a);
      const vx = ux * c - uy * s, vy = ux * s + uy * c;
      line(ctx, x + ux * 6, y + uy * 6, x + ux * 6 + vx * 8, y + uy * 6 + vy * 8);
    }
  }

  function headFor(ctx, kind, hurt) {
    const h = heads[kind];
    const w = h && h.img;
    if (w && w.complete && w.naturalWidth) {
      ctx.drawImage(w, -h.ax * HEAD_SCALE, -h.ay * HEAD_SCALE, w.naturalWidth * HEAD_SCALE, w.naturalHeight * HEAD_SCALE);
      if (hurt) { // swap the smile for a surprised "o"
        const mx = kind === 'boy' ? 9.4 : 15.8, my = kind === 'boy' ? -16.7 : -14.5;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(mx, my, 11, 7.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(mx, my + 1, 4.2, 5, 0, 0, Math.PI * 2); ctx.stroke();
      }
    } else { // before the artwork has decoded
      ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = LINE;
      ctx.beginPath(); ctx.arc(0, -32, 32, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  /*
   * o: { x, footY, scale, t (seconds), air, still, hurt, happy, rot, alpha }
   */
  function draw(ctx, kind, o) {
    const s = o.scale || 1;
    const run = !o.air && !o.still;
    const ph = (o.t || 0) * 11;
    const swing = run ? Math.sin(ph) : 0;
    const bob = run ? -Math.abs(Math.sin(ph)) * 3 : 0;
    const neckY = NECK_Y + bob, hipY = HIP_Y + bob;

    ctx.save();
    ctx.translate(o.x, o.footY);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(s, s);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    ctx.strokeStyle = INK;
    ctx.lineWidth = LINE;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // legs (boy) / shoes (girl)
    const legAng = [o.air ? 0.8 : swing * 0.65, o.air ? -0.35 : -swing * 0.65];
    const feet = legAng.map((a, i) => {
      const side = i ? 1 : -1;
      const lift = run ? Math.max(0, Math.sin(ph + (i ? Math.PI : 0))) * 7 : 0;
      return { x: side * 4 + Math.sin(a) * LEG, y: Math.min(0, hipY + Math.cos(a) * LEG - lift), side };
    });
    if (kind === 'boy') {
      feet.forEach((f) => line(ctx, f.side * 3, hipY, f.x, f.y - 3));
    }

    // torso
    const waist = kind === 'girl' ? -54 + bob : hipY;
    line(ctx, 0, neckY, 0, waist);

    if (kind === 'girl') {
      const sway = run ? swing * 5 : 0;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(0, waist);
      ctx.quadraticCurveTo(-24 + sway * 0.4, waist + 24, -44 + sway, -7);
      ctx.quadraticCurveTo(sway * 0.5, 4, 44 + sway, -7);
      ctx.quadraticCurveTo(24 + sway * 0.4, waist + 24, 0, waist);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 2.6;
      line(ctx, -12 + sway * 0.3, waist + 28, -17 + sway * 0.7, -12);
      line(ctx, 4 + sway * 0.3, waist + 30, 4 + sway * 0.7, -10);
      ctx.lineWidth = LINE;
    }

    // feet
    ctx.fillStyle = INK;
    feet.forEach((f) => {
      ctx.beginPath();
      ctx.ellipse(f.x + f.side * 4, f.y, kind === 'boy' ? 13 : 10, kind === 'boy' ? 6.5 : 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // arms
    [-1, 1].forEach((side) => {
      const sx = 0, sy = neckY + 7;
      let hx, hy;
      if (o.air) { hx = side * 32; hy = sy - 34; }
      else {
        const ang = 0.38 + (side < 0 ? swing : -swing) * 0.55;
        hx = side * Math.sin(ang) * ARM;
        hy = sy + Math.cos(ang) * ARM * (1 - 0.2 * Math.abs(swing));
      }
      ctx.lineWidth = LINE;
      line(ctx, sx, sy, hx, hy);
      hand(ctx, hx, hy, hx - sx, hy - sy);
    });
    ctx.lineWidth = LINE;

    // head
    ctx.save();
    ctx.translate(0, neckY + 2);
    ctx.rotate((run ? swing * 0.05 : 0) + (o.hurt ? -0.18 : 0) + (o.happy ? 0.06 : 0));
    headFor(ctx, kind, !!o.hurt);
    ctx.restore();

    ctx.restore();
  }

  function preview(canvas, kind) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 120, h = canvas.clientHeight || 170;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    draw(ctx, kind, { x: w / 2, footY: h - 12, scale: Math.min((h - 18) / 168, w / 100), still: true });
  }

  function whenReady(fn) {
    const imgs = Object.keys(heads).map((k) => heads[k].img);
    let left = imgs.filter((i) => !i.complete).length;
    if (!left) return fn();
    imgs.forEach((i) => { if (!i.complete) i.addEventListener('load', () => { if (--left === 0) fn(); }); });
  }

  const api = { draw, preview, whenReady, sprites: {} };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LetterChars = api;
})(typeof window !== 'undefined' ? window : globalThis);
