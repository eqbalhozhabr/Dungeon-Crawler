/* Shared look & feel for Cat Box: cat drawing, synthesised sound, particles and small animations. */
(function () {
  'use strict';

  const RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const store = {
    get(k, fallback) { try { const v = localStorage.getItem('catbox.' + k); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
    set(k, v) { try { localStorage.setItem('catbox.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };

  /* ---------- cats ---------- */

  // [coat, darker stripe colour]
  const COATS = {
    orange: ['#eea25a', '#c97a2b'],
    gray: ['#aeb4c4', '#7f879c'],
    cream: ['#fbf4e6', '#dccdb0'],
    brown: ['#b88f6e', '#8a6446'],
  };
  // the longer the cat, the fancier it gets
  const ACC_BY_LEN = { 1: [], 2: ['bow'], 3: ['bow', 'collar'], 4: ['hat', 'collar'], 5: ['bigcrown', 'collar'] };
  const NAMES = { 1: 'بچه‌گربه', 2: 'ملوس', 3: 'پشمالو', 4: 'شیطون', 5: 'افسانه‌ای' };

  function catSVG(color, len, axis, happy) {
    const [c1, c2] = COATS[color];
    const long = len > 1;
    const horiz = long && axis === 'h';
    const W = horiz ? len * 100 : 100;
    const H = long && !horiz ? len * 100 : 100;
    const r = long ? 32 : 36;
    const hx = horiz ? W - 50 : 50;
    const hy = 54;
    let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;

    if (long) {
      if (horiz) {
        s += `<path d="M 20 62 C 2 62 2 34 12 26" stroke="${c1}" stroke-width="11" fill="none" stroke-linecap="round"/>`;
        s += `<rect x="10" y="34" width="${hx - 10}" height="52" rx="26" fill="${c1}"/>`;
        for (let x = 34; x < hx - 22; x += 26) {
          s += `<path d="M ${x} 37 q 5 17 0 46" stroke="${c2}" stroke-width="7" opacity=".5" fill="none" stroke-linecap="round"/>`;
        }
      } else {
        s += `<path d="M 50 ${H - 22} C 50 ${H - 2} 88 ${H - 2} 90 ${H - 30}" stroke="${c1}" stroke-width="11" fill="none" stroke-linecap="round"/>`;
        s += `<rect x="24" y="${hy + 6}" width="52" height="${H - hy - 14}" rx="26" fill="${c1}"/>`;
        for (let y = hy + 34; y < H - 26; y += 26) {
          s += `<path d="M 27 ${y} q 23 5 46 0" stroke="${c2}" stroke-width="7" opacity=".5" fill="none" stroke-linecap="round"/>`;
        }
      }
    }

    for (const side of [-1, 1]) {
      const p = (dx, dy) => `${hx + side * r * dx},${hy - r * dy}`;
      s += `<polygon points="${p(0.95, 0.25)} ${p(0.78, 1.2)} ${p(0.18, 0.9)}" fill="${c1}"/>`;
      s += `<polygon points="${p(0.8, 0.4)} ${p(0.7, 0.98)} ${p(0.3, 0.8)}" fill="#f6a6b2"/>`;
    }
    s += `<circle cx="${hx}" cy="${hy}" r="${r}" fill="${c1}"/>`;
    if (color === 'orange' || color === 'brown') {
      for (const dx of [-7, 0, 7]) {
        s += `<path d="M ${hx + dx} ${hy - r * 0.98} l 0 ${dx === 0 ? 11 : 8}" stroke="${c2}" stroke-width="3.5" stroke-linecap="round"/>`;
      }
    }
    s += `<circle cx="${hx - r * 0.62}" cy="${hy + r * 0.28}" r="6" fill="#ff9aa2" opacity=".45"/>`;
    s += `<circle cx="${hx + r * 0.62}" cy="${hy + r * 0.28}" r="6" fill="#ff9aa2" opacity=".45"/>`;
    for (const side of [-1, 1]) {
      const ex = hx + side * r * 0.38;
      if (happy) {
        s += `<path d="M ${ex - r * 0.17} ${hy + r * 0.04} q ${r * 0.17} ${-r * 0.34} ${r * 0.34} 0" stroke="#3b2a2a" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
      } else {
        s += `<ellipse cx="${ex}" cy="${hy - r * 0.05}" rx="${r * 0.11}" ry="${r * 0.16}" fill="#3b2a2a"/>`;
        s += `<circle cx="${ex + 1.2}" cy="${hy - r * 0.12}" r="1.7" fill="#fff"/>`;
      }
      s += `<line x1="${hx + side * r * 0.78}" y1="${hy + r * 0.22}" x2="${hx + side * r * 1.1}" y2="${hy + r * 0.1}" stroke="#3b2a2a" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>`;
      s += `<line x1="${hx + side * r * 0.78}" y1="${hy + r * 0.32}" x2="${hx + side * r * 1.1}" y2="${hy + r * 0.38}" stroke="#3b2a2a" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>`;
    }
    s += `<polygon points="${hx - 4},${hy + r * 0.2} ${hx + 4},${hy + r * 0.2} ${hx},${hy + r * 0.33}" fill="#ff8fa3"/>`;
    s += `<path d="M ${hx} ${hy + r * 0.33} q -5 8 -10 2 M ${hx} ${hy + r * 0.33} q 5 8 10 2" stroke="#3b2a2a" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;

    for (const a of ACC_BY_LEN[Math.min(len, 5)]) {
      if (a === 'bow') {
        const bx = hx + r * 0.62, by = hy - r * 0.78;
        s += `<path d="M ${bx} ${by} l -12 -9 v 18 z M ${bx} ${by} l 12 -9 v 18 z" fill="#ff7aa2"/><circle cx="${bx}" cy="${by}" r="4" fill="#ff5c8a"/>`;
      } else if (a === 'collar') {
        s += `<path d="M ${hx - r * 0.55} ${hy + r * 0.82} Q ${hx} ${hy + r * 1.15} ${hx + r * 0.55} ${hy + r * 0.82}" stroke="#e5484d" stroke-width="6" fill="none" stroke-linecap="round"/>`;
        s += `<circle cx="${hx}" cy="${hy + r * 1.03}" r="5" fill="#ffd23f" stroke="#c99a00" stroke-width="1.5"/>`;
      } else if (a === 'hat') {
        const y0 = hy - r * 0.8;
        s += `<polygon points="${hx - 13},${y0} ${hx + 13},${y0} ${hx},${y0 - 22}" fill="#7c5cff"/><circle cx="${hx}" cy="${y0 - 22}" r="4" fill="#ffd23f"/>`;
      } else if (a === 'bigcrown') {
        const y0 = hy - r * 0.82;
        const pts = [[-13, 0], [-13, -14], [-6.5, -6], [0, -16], [6.5, -6], [13, -14], [13, 0]]
          .map(([dx, dy]) => `${hx + dx * 1.45},${y0 + dy * 1.45}`).join(' ');
        s += `<polygon points="${pts}" fill="#ffd23f" stroke="#c99a00" stroke-width="1.5" stroke-linejoin="round"/>`;
      }
    }
    return s + '</svg>';
  }

  /* ---------- sound (synthesised, no assets) ---------- */

  const Sound = (function () {
    let ctx = null;
    let master = null;
    let enabled = store.get('sound', true);

    function ac() {
      if (!enabled) return null;
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try {
          ctx = new AC();
          master = ctx.createGain();
          master.gain.value = 0.55;
          master.connect(ctx.destination);
        } catch (e) { ctx = null; return null; }
      }
      if (ctx.state === 'suspended') ctx.resume().catch(function () {});
      return ctx;
    }
    function env(g, t, attack, decay, peak) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    }
    function tone(c, type, f0, f1, t, dur, peak) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = c.createGain();
      env(g, t, 0.01, dur, peak);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    const semis = (k) => Math.pow(2, (k * 2) / 12);

    return {
      get enabled() { return enabled; },
      toggle() { enabled = !enabled; store.set('sound', enabled); if (enabled) ac(); return enabled; },
      unlock() { ac(); },
      // bigger cats have deeper voices; every extra step in a combo is higher
      meow(size, k) {
        const c = ac(); if (!c) return;
        const t = c.currentTime;
        const f0 = (760 - size * 52) * semis(k || 0);
        const dur = 0.24 + Math.min(size, 5) * 0.03;
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(f0 * 0.8, t);
        o.frequency.linearRampToValueAtTime(f0 * 1.25, t + dur * 0.35);
        o.frequency.linearRampToValueAtTime(f0 * 0.7, t + dur);
        const f = c.createBiquadFilter();
        f.type = 'bandpass';
        f.Q.value = 3;
        f.frequency.setValueAtTime(900, t);
        f.frequency.linearRampToValueAtTime(1900, t + dur * 0.4);
        f.frequency.linearRampToValueAtTime(1100, t + dur);
        const g = c.createGain();
        env(g, t, 0.03, dur, 0.45);
        o.connect(f); f.connect(g); g.connect(master);
        o.start(t); o.stop(t + dur + 0.1);
      },
      pop(k) {
        const c = ac(); if (!c) return;
        tone(c, 'sine', 520 * semis(k || 0), 980 * semis(k || 0), c.currentTime, 0.09, 0.3);
      },
      tock() {
        const c = ac(); if (!c) return;
        tone(c, 'sine', 240, 150, c.currentTime, 0.07, 0.28);
      },
      tick() {
        const c = ac(); if (!c) return;
        tone(c, 'triangle', 700, 900, c.currentTime, 0.04, 0.12);
      },
      fanfare() {
        const c = ac(); if (!c) return;
        const t = c.currentTime;
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(function (f, i) {
          tone(c, 'triangle', f, f * 1.004, t + i * 0.09, 0.45, 0.28);
        });
        tone(c, 'sine', 2093, 2093, t + 0.45, 0.6, 0.12);
      },
    };
  })();

  function vibrate(pattern) {
    try { if (!RM && Sound.enabled && navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* ignore */ }
  }

  /* ---------- particles and animation helpers ---------- */

  function createFX(o) {
    const { board, piecesEl, canvas, getN } = o;
    const g2 = canvas.getContext('2d');
    let parts = [], raf = 0, lastTs = 0, dpr = 1;

    function px(r, c, len, axis) {
      const b = board.getBoundingClientRect();
      const i = piecesEl.getBoundingClientRect();
      const cs = i.width / getN();
      const w = (axis === 'h' ? len : 1) * cs;
      const h = (axis === 'v' ? len : 1) * cs;
      return { x: i.left - b.left + c * cs + w / 2, y: i.top - b.top + r * cs + h / 2, w, h, cs };
    }

    function sizeCanvas() {
      const b = board.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(b.width * dpr), h = Math.round(b.height * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      g2.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function addParticle(p) {
      parts.push(Object.assign({ age: 0, rot: rand(0, 6), vr: rand(-6, 6), gravity: 600, size: 10, color: '#fff', kind: 'puff' }, p));
      if (!raf) { lastTs = performance.now(); raf = requestAnimationFrame(tick); }
    }

    function burst(x, y, opt) {
      if (RM) return;
      sizeCanvas();
      for (let i = 0; i < opt.count; i++) {
        const a = rand(0, Math.PI * 2);
        const sp = opt.speed * rand(0.4, 1.1);
        addParticle({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opt.up || 0),
          life: opt.life * rand(0.7, 1.3), size: opt.size * rand(0.7, 1.3),
          kind: pick(opt.kinds), color: pick(opt.colors), gravity: opt.gravity === undefined ? 500 : opt.gravity,
        });
      }
    }

    function starPath(c, r) {
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = i * Math.PI / 5 - Math.PI / 2;
        const rr = i % 2 ? r * 0.45 : r;
        c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      c.closePath();
    }
    function heartPath(c, s) {
      c.beginPath();
      c.moveTo(0, s * 0.45);
      c.bezierCurveTo(-s * 1.0, -s * 0.1, -s * 0.5, -s * 0.9, 0, -s * 0.35);
      c.bezierCurveTo(s * 0.5, -s * 0.9, s * 1.0, -s * 0.1, 0, s * 0.45);
      c.closePath();
    }

    function tick(ts) {
      const dt = Math.min(0.033, (ts - lastTs) / 1000 || 0.016);
      lastTs = ts;
      g2.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      parts = parts.filter((p) => p.age < p.life);
      for (const p of parts) {
        p.age += dt;
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        const t = p.age / p.life;
        g2.save();
        g2.globalAlpha = Math.max(0, 1 - t * t);
        g2.translate(p.x, p.y);
        g2.rotate(p.rot);
        g2.fillStyle = p.color;
        if (p.kind === 'star') { starPath(g2, p.size); g2.fill(); }
        else if (p.kind === 'heart') { heartPath(g2, p.size); g2.fill(); }
        else if (p.kind === 'confetti') { g2.fillRect(-p.size * 0.4, -p.size * 0.2, p.size * 0.8, p.size * 0.4); }
        else if (p.kind === 'fish') { g2.font = p.size * 2 + 'px sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText('🐟', 0, 0); }
        else { g2.beginPath(); g2.arc(0, 0, p.size * (0.6 + t * 0.9), 0, Math.PI * 2); g2.fill(); }
        g2.restore();
      }
      raf = parts.length ? requestAnimationFrame(tick) : 0;
    }

    function floatText(x, y, text, cls) {
      const d = document.createElement('div');
      d.className = 'float' + (cls ? ' ' + cls : '');
      d.textContent = text;
      d.style.left = x + 'px';
      d.style.top = y + 'px';
      board.appendChild(d);
      setTimeout(() => d.remove(), 1000);
    }

    function shake(amp, dur) {
      if (RM || amp <= 0 || !board.animate) return;
      const frames = [];
      for (let i = 0; i < 6; i++) {
        const k = 1 - i / 6;
        frames.push({ transform: `translate(${rand(-1, 1) * amp * k}px, ${rand(-1, 1) * amp * k}px)` });
      }
      frames.push({ transform: 'translate(0, 0)' });
      board.animate(frames, { duration: dur, easing: 'linear' });
    }

    // elastic stretch: squashed and thin, overshoots along its length, settles
    function jelly(el, axis, opt) {
      if (RM || !el.animate) return;
      const k = (v) => 1 + (v - 1) * (opt.strong ? 1 : 0.5);
      const sc = (along, across) => (axis === 'v' ? `scale(${across}, ${along})` : `scale(${along}, ${across})`);
      const frames = [
        { transform: sc(k(0.55), k(1.3)), offset: 0 },
        { transform: sc(k(1.25), k(0.82)), offset: 0.35 },
        { transform: sc(k(0.94), k(1.06)), offset: 0.6 },
        { transform: sc(k(1.03), k(0.98)), offset: 0.8 },
        { transform: 'scale(1, 1)', offset: 1 },
      ];
      if (opt.fade) frames.forEach((f, i) => { f.opacity = i === 0 ? 0 : 1; });
      el.animate(frames, { duration: opt.duration || 440, delay: opt.delay || 0, easing: 'ease-out', fill: 'backwards' });
    }

    function bump(el) {
      if (RM || !el || !el.animate) return;
      el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 400, easing: 'ease-out' });
    }

    function clearParticles() { parts = []; }

    return { px, sizeCanvas, addParticle, burst, floatText, shake, jelly, bump, clearParticles };
  }

  window.CatKit = { RM, rand, pick, store, COATS, NAMES, catSVG, Sound, vibrate, createFX };
})();
