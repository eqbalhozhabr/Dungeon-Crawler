/*
 * The two book characters, drawn with canvas paths (front facing, like in the book):
 *   boy  : round bald head, slim black body, long thin legs
 *   girl : black bob, black top, long purple dress
 * To use the real illustrations instead, give Chars.sprites.boy / .girl an <img> (transparent PNG, feet at the bottom).
 */
(function (root) {
  'use strict';

  const SKIN = '#f2c8a0', SKIN_SHADE = '#e3ae82';
  const BLACK = '#1f1b21', BLACK_LIGHT = '#3b353e';
  const PURPLE = '#9158bd', PURPLE_DARK = '#7843a3';
  const sprites = { boy: null, girl: null };

  function limb(ctx, x1, y1, x2, y2, w, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function face(ctx, kind, hurt, happy) {
    // eyes
    for (const s of [-1, 1]) {
      ctx.fillStyle = BLACK;
      ctx.beginPath();
      if (hurt) { ctx.ellipse(s * 11, -1, 4.4, 5.8, 0, 0, Math.PI * 2); } else { ctx.ellipse(s * 11, -1, 3.2, 4.4, 0, 0, Math.PI * 2); }
      ctx.fill();
      if (hurt) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * 11 + 1, -3, 1.6, 0, Math.PI * 2); ctx.fill(); }
      // brows
      ctx.strokeStyle = BLACK;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const by = hurt ? -15 : -11;
      ctx.moveTo(s * 16, by + 1);
      ctx.quadraticCurveTo(s * 11, by - 5, s * 6, by - 1);
      ctx.stroke();
      if (kind === 'girl') { // lashes
        ctx.beginPath();
        ctx.moveTo(s * 14, -4); ctx.lineTo(s * 18.5, -7);
        ctx.moveTo(s * 14.5, -1); ctx.lineTo(s * 19.5, -2);
        ctx.stroke();
      }
    }
    // mouth
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (hurt) { ctx.arc(0, 13, 4.5, 0, Math.PI * 2); }
    else if (happy) { ctx.moveTo(-12, 7); ctx.quadraticCurveTo(0, 24, 12, 7); }
    else { ctx.moveTo(-11, 8); ctx.quadraticCurveTo(0, 19, 11, 8); }
    ctx.stroke();
  }

  /*
   * o: { x, footY, scale, t (seconds), air, hurt (bool), happy (bool), rot, alpha }
   */
  function draw(ctx, kind, o) {
    const img = sprites[kind];
    const s = o.scale || 1;
    const run = !o.air && !o.still;
    const ph = (o.t || 0) * 11;
    ctx.save();
    ctx.translate(o.x, o.footY);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(s, s);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;

    if (img && img.complete && img.naturalWidth) {
      const h = 135, w = h * img.naturalWidth / img.naturalHeight;
      const bob = run ? -Math.abs(Math.sin(ph)) * 4 : 0;
      ctx.drawImage(img, -w / 2, -h + bob, w, h);
      ctx.restore();
      return;
    }

    const legL = 40, torsoH = 34, headR = 30;
    const bob = run ? -Math.abs(Math.sin(ph)) * 3.5 : 0;
    const hipY = -legL + bob;
    const shY = hipY - torsoH;
    const headY = shY - headR + 5;
    const swing = run ? Math.sin(ph) : 0;

    // legs
    const legAng = [o.air ? 0.85 : swing * 0.8, o.air ? -0.45 : -swing * 0.8];
    const feet = [];
    legAng.forEach((a, i) => {
      const hx = i ? 6 : -6;
      const fx = hx + Math.sin(a) * legL;
      const fy = hipY + Math.cos(a) * legL - (run ? Math.max(0, Math.sin(ph + (i ? Math.PI : 0))) * 5 : 0);
      feet.push([fx, Math.min(fy, 0)]);
      if (kind === 'boy') limb(ctx, hx, hipY, fx, fy, 8, BLACK);
    });

    // arms (behind torso)
    const armAng = o.air ? [2.5, -2.5] : [swing * 0.9, -swing * 0.9];
    const arms = [-1, 1].map((side, i) => {
      const sx = side * 14, sy = shY + 7;
      const a = armAng[i];
      const ex = sx + side * Math.abs(Math.sin(a)) * 3 + Math.sin(a) * 0;
      return { sx, sy, hx: sx + (o.air ? side * 14 : Math.sin(a) * 12), hy: sy + (o.air ? -22 : Math.cos(a) * 26) , ex };
    });

    if (kind === 'girl') {
      // dress and shoes
      const sway = run ? swing * 4 : 0;
      const grad = ctx.createLinearGradient(0, hipY, 0, -4);
      grad.addColorStop(0, PURPLE);
      grad.addColorStop(1, PURPLE_DARK);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-13, hipY - 6);
      ctx.lineTo(13, hipY - 6);
      ctx.lineTo(27 + sway, -7);
      ctx.quadraticCurveTo(sway * 0.5, 0, -27 + sway, -7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = BLACK;
      feet.forEach(([fx, fy]) => { ctx.beginPath(); ctx.ellipse(fx * 0.55 + (fx < 0 ? -2 : 2), Math.max(fy, -6), 8.5, 5, 0, 0, Math.PI * 2); ctx.fill(); });
    } else {
      ctx.fillStyle = BLACK;
      feet.forEach(([fx, fy]) => { ctx.beginPath(); ctx.ellipse(fx + 1.5, fy, 9, 5, 0, 0, Math.PI * 2); ctx.fill(); });
    }

    // torso
    ctx.fillStyle = BLACK;
    ctx.beginPath();
    const tr = 12;
    ctx.moveTo(-14 + tr, shY);
    ctx.lineTo(14 - tr, shY);
    ctx.quadraticCurveTo(14, shY, 14, shY + tr);
    ctx.lineTo(kind === 'girl' ? 12 : 11, hipY);
    ctx.lineTo(kind === 'girl' ? -12 : -11, hipY);
    ctx.lineTo(-14, shY + tr);
    ctx.quadraticCurveTo(-14, shY, -14 + tr, shY);
    ctx.fill();
    ctx.fillStyle = BLACK_LIGHT;
    ctx.fillRect(-1, shY + 6, 2, hipY - shY - 10);

    // arms
    arms.forEach((a) => {
      limb(ctx, a.sx, a.sy, a.hx, a.hy, 7.5, BLACK);
      ctx.fillStyle = BLACK;
      ctx.beginPath(); ctx.arc(a.hx, a.hy, 5.5, 0, Math.PI * 2); ctx.fill();
    });

    // head
    ctx.save();
    ctx.translate(0, headY);
    ctx.rotate(o.rot ? 0 : (run ? swing * 0.04 : 0));
    if (kind === 'girl') { // back hair of the bob
      ctx.fillStyle = BLACK;
      ctx.beginPath();
      ctx.ellipse(0, 6, headR + 5, headR + 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const g = ctx.createRadialGradient(-8, -10, 4, 0, 0, headR + 2);
    g.addColorStop(0, '#f8d9b6');
    g.addColorStop(1, SKIN_SHADE);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, headR, 0, Math.PI * 2);
    ctx.fill();
    if (kind === 'girl') { // fringe
      ctx.fillStyle = BLACK;
      ctx.beginPath();
      ctx.moveTo(-headR - 4, 4);
      ctx.bezierCurveTo(-headR - 6, -headR - 10, headR + 6, -headR - 10, headR + 4, 4);
      ctx.quadraticCurveTo(headR - 2, -8, headR * 0.35, -15);
      ctx.quadraticCurveTo(-headR * 0.3, -2, -headR * 0.95, -4);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath();
      ctx.ellipse(-12, -16, 7, 4, -0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    face(ctx, kind, !!o.hurt, !!o.happy);
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
    draw(ctx, kind, { x: w / 2, footY: h - 10, scale: Math.min(h / 150, w / 80), still: true, happy: true });
  }

  const api = { draw, preview, sprites };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LetterChars = api;
})(typeof window !== 'undefined' ? window : globalThis);
