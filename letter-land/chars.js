/*
 * The two characters, played from the supplied run cycle (runcycle.js):
 * a 20-frame loop at 24 fps per character, facing right, cut out of the green-screen video.
 * The video has no jump or hit pose, so a mid-stride frame is held while in the air.
 */
(function (root) {
  'use strict';

  const art = root.LetterRun || {};
  const FPS = art.fps || 24;
  const HEIGHT = 140; // drawn height in world pixels
  const sheets = {};
  Object.keys(art).forEach((k) => {
    if (k === 'fps') return;
    const img = new Image();
    img.src = art[k].src;
    sheets[k] = Object.assign({ img }, art[k]);
  });

  /*
   * o: { x, footY, scale, t (seconds of running), air, still, hurt, happy, rot, alpha }
   * x is the centre of the character, footY the ground line.
   */
  function draw(ctx, kind, o) {
    const sh = sheets[kind];
    if (!sh || !sh.img.complete || !sh.img.naturalWidth) return;
    const s = o.scale || 1;
    const k = (HEIGHT / sh.fh) * s;
    let frame;
    if (o.still) frame = sh.idle;
    else if (o.air) frame = sh.air;
    else frame = Math.floor((o.t || 0) * FPS) % sh.n;
    frame = ((frame % sh.n) + sh.n) % sh.n;
    const w = sh.fw * k, h = sh.fh * k;

    ctx.save();
    ctx.translate(o.x, o.footY);
    if (o.rot) { ctx.translate(0, -h / 2); ctx.rotate(o.rot); ctx.translate(0, h / 2); }
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    if (o.hurt) ctx.translate(Math.sin(Date.now() / 25) * 2, 0);
    // a little squash when the character lands or is hurt, a little stretch in the air
    const sy = o.hurt ? 0.93 : (o.air ? 1.03 : 1);
    ctx.scale(1, sy);
    ctx.drawImage(sh.img, frame * sh.fw, 0, sh.fw, sh.fh, -w / 2, -h, w, h);
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
    draw(ctx, kind, { x: w / 2, footY: h - 8, scale: (h - 16) / HEIGHT, still: true });
  }

  function whenReady(fn) {
    const imgs = Object.keys(sheets).map((k) => sheets[k].img);
    let left = imgs.filter((i) => !i.complete).length;
    if (!left) return fn();
    imgs.forEach((i) => { if (!i.complete) i.addEventListener('load', () => { if (--left === 0) fn(); }); });
  }

  const api = { draw, preview, whenReady };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LetterChars = api;
})(typeof window !== 'undefined' ? window : globalThis);
