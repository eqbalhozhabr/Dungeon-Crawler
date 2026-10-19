(function () {
  'use strict';
  const E = window.CatEngine;
  const RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // timeline of one swipe (ms): pieces slide, a short hit-stop, then the merge pops
  const SLIDE = 120;
  const HIT = RM ? 0 : 40;
  const MERGE_AT = SLIDE + HIT;

  /* ---------- look & feel ---------- */

  const NAMES = ['بچه‌گربه', 'پشمالو', 'ملوس', 'شیطون', 'تنبل', 'ناز', 'شاهزاده', 'اشراف‌زاده', 'پادشاه', 'امپراتور', 'افسانه‌ای'];
  // [coat, darker stripe colour]
  const COATS = [
    ['#f6cf94', '#d9a75d'], ['#eea25a', '#c97a2b'], ['#d7d7de', '#a6a6b3'], ['#9aa5b8', '#6f7b92'],
    ['#fbf4e6', '#dccdb0'], ['#b88f6e', '#8a6446'], ['#eab5cf', '#c986a9'], ['#b9a4e6', '#8f78c9'],
    ['#8fd6c3', '#5fb39d'], ['#ffd56b', '#e0aa2d'], ['#ffc2a0', '#ff8f70'],
  ];
  const ACCESSORIES = [
    [], ['bow'], ['collar'], ['bow', 'collar'], ['hat'], ['hat', 'collar'],
    ['crown'], ['crown', 'collar'], ['crown', 'bow'], ['crown', 'bow', 'collar'], ['bigcrown', 'collar'],
  ];
  // which look each level of a mode uses
  const LOOKS = {
    classic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    stretch: [0, 1, 2, 4, 6, 10],
    fish: [0, 1, 2, 3, 4, 5, 6, 8, 10],
  };
  const MODE_LABELS = { classic: 'کلاسیک', stretch: 'کش‌اومدن', fish: 'ماهی‌خور' };
  const RULES = {
    classic: 'گربه‌های هم‌سطح رو بکش روی هم تا گربه‌ی بعدی بسازن. همون ۲۰۴۸، فقط با گربه!',
    stretch: 'دو گربه‌ی هم‌سطح که ترکیب بشن، گربه‌ی جدید «بلندتر» می‌شه و جا می‌گیره. جهت کشیدن تعیین می‌کنه کدوم‌طرف کش بیاد. گربه‌ای که کل یک ردیف رو پر کنه افسانه‌ای می‌شه، ردیف آزاد می‌شه و ۵ حرکت امتیاز ترکیب‌ها دو برابره.',
    fish: 'گربه‌ها رو به سمت ماهی 🐟 ببر تا بخورن و یه خونه بلندتر بشن. ترکیب هم‌سطح‌ها گربه رو ارتقا می‌ده. گربه‌ی هم‌اندازه‌ی کل ردیف = افسانه‌ای!',
  };

  const lookOf = (modeId, level) => LOOKS[modeId][level - 1];
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function catSVG(look, len, axis, happy) {
    const [c1, c2] = COATS[look];
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

    // ears
    for (const side of [-1, 1]) {
      const p = (dx, dy) => `${hx + side * r * dx},${hy - r * dy}`;
      s += `<polygon points="${p(0.95, 0.25)} ${p(0.78, 1.2)} ${p(0.18, 0.9)}" fill="${c1}"/>`;
      s += `<polygon points="${p(0.8, 0.4)} ${p(0.7, 0.98)} ${p(0.3, 0.8)}" fill="#f6a6b2"/>`;
    }
    // head
    s += `<circle cx="${hx}" cy="${hy}" r="${r}" fill="${c1}"/>`;
    if (look % 2 === 1 || look >= 9) {
      for (const dx of [-7, 0, 7]) {
        s += `<path d="M ${hx + dx} ${hy - r * 0.98} l 0 ${dx === 0 ? 11 : 8}" stroke="${c2}" stroke-width="3.5" stroke-linecap="round"/>`;
      }
    }
    // face
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

    // accessories
    for (const a of ACCESSORIES[look]) {
      if (a === 'bow') {
        const bx = hx + r * 0.62, by = hy - r * 0.78;
        s += `<path d="M ${bx} ${by} l -12 -9 v 18 z M ${bx} ${by} l 12 -9 v 18 z" fill="#ff7aa2"/><circle cx="${bx}" cy="${by}" r="4" fill="#ff5c8a"/>`;
      } else if (a === 'collar') {
        s += `<path d="M ${hx - r * 0.55} ${hy + r * 0.82} Q ${hx} ${hy + r * 1.15} ${hx + r * 0.55} ${hy + r * 0.82}" stroke="#e5484d" stroke-width="6" fill="none" stroke-linecap="round"/>`;
        s += `<circle cx="${hx}" cy="${hy + r * 1.03}" r="5" fill="#ffd23f" stroke="#c99a00" stroke-width="1.5"/>`;
      } else if (a === 'hat') {
        const y0 = hy - r * 0.8;
        s += `<polygon points="${hx - 13},${y0} ${hx + 13},${y0} ${hx},${y0 - 22}" fill="#7c5cff"/><circle cx="${hx}" cy="${y0 - 22}" r="4" fill="#ffd23f"/>`;
      } else if (a === 'crown' || a === 'bigcrown') {
        const y0 = hy - r * 0.82;
        const k = a === 'bigcrown' ? 1.45 : 1;
        const pts = [[-13, 0], [-13, -14], [-6.5, -6], [0, -16], [6.5, -6], [13, -14], [13, 0]]
          .map(([dx, dy]) => `${hx + dx * k},${y0 + dy * k}`).join(' ');
        s += `<polygon points="${pts}" fill="#ffd23f" stroke="#c99a00" stroke-width="1.5" stroke-linejoin="round"/>`;
      }
    }
    return s + '</svg>';
  }

  function fishSVG() {
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
      '<polygon points="66,52 92,32 92,72" fill="#4fa9d6"/>' +
      '<ellipse cx="46" cy="52" rx="30" ry="19" fill="#66c2e8"/>' +
      '<path d="M 40 36 q 10 -12 20 0 z" fill="#4fa9d6"/>' +
      '<path d="M 56 38 q 6 14 0 28" stroke="#4fa9d6" stroke-width="4" fill="none" stroke-linecap="round"/>' +
      '<circle cx="30" cy="47" r="4.5" fill="#fff"/><circle cx="29" cy="47" r="2.3" fill="#2a3b4d"/>' +
      '</svg>';
  }

  /* ---------- storage ---------- */

  const store = {
    get(k, fallback) { try { const v = localStorage.getItem('catmerge.' + k); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
    set(k, v) { try { localStorage.setItem('catmerge.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };

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
      // bigger cats have deeper voices; every extra merge in one swipe is a step higher
      meow(level, k) {
        const c = ac(); if (!c) return;
        const t = c.currentTime;
        const f0 = (780 - level * 34) * semis(k);
        const dur = 0.26 + Math.min(level, 8) * 0.02;
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
        tone(c, 'sine', 520 * semis(k), 980 * semis(k), c.currentTime, 0.09, 0.3);
      },
      munch() {
        const c = ac(); if (!c) return;
        const t = c.currentTime;
        tone(c, 'square', 300, 160, t, 0.06, 0.12);
        tone(c, 'square', 280, 150, t + 0.08, 0.06, 0.12);
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

  /* ---------- DOM ---------- */

  const $ = (id) => document.getElementById(id);
  const board = $('board'), cellsEl = $('cells'), piecesEl = $('pieces');
  const canvas = $('fx'), g2 = canvas.getContext('2d');
  const els = new Map(); // piece id -> element

  let modeId = store.get('mode', 'stretch');
  if (!E.MODES[modeId]) modeId = 'stretch';
  let state, history = [];
  let best = 0;
  let discovered = 1;
  let token = 0; // bumps on every new game so late effects from the old one are dropped

  /* ---------- effects ---------- */

  // geometry of a bar in board pixels
  function px(r, c, len, axis) {
    const b = board.getBoundingClientRect();
    const i = piecesEl.getBoundingClientRect();
    const cs = i.width / state.n;
    const w = (axis === 'h' ? len : 1) * cs;
    const h = (axis === 'v' ? len : 1) * cs;
    return { x: i.left - b.left + c * cs + w / 2, y: i.top - b.top + r * cs + h / 2, w, h, cs };
  }

  let parts = [], raf = 0, lastTs = 0, dpr = 1;

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

  function burst(x, y, o) {
    if (RM) return;
    sizeCanvas();
    for (let i = 0; i < o.count; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = o.speed * rand(0.4, 1.1);
      addParticle({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up || 0),
        life: o.life * rand(0.7, 1.3), size: o.size * rand(0.7, 1.3),
        kind: pick(o.kinds), color: pick(o.colors), gravity: o.gravity === undefined ? 500 : o.gravity,
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
  function jelly(el, axis, o) {
    if (RM || !el.animate) return;
    const k = (v) => 1 + (v - 1) * (o.strong ? 1 : 0.5);
    const sc = (along, across) => (axis === 'v' ? `scale(${across}, ${along})` : `scale(${along}, ${across})`);
    const frames = [
      { transform: sc(k(0.55), k(1.3)), offset: 0 },
      { transform: sc(k(1.25), k(0.82)), offset: 0.35 },
      { transform: sc(k(0.94), k(1.06)), offset: 0.6 },
      { transform: sc(k(1.03), k(0.98)), offset: 0.8 },
      { transform: 'scale(1, 1)', offset: 1 },
    ];
    if (o.fade) frames.forEach((f, i) => { f.opacity = i === 0 ? 0 : 1; });
    el.animate(frames, { duration: o.duration || 440, delay: o.delay || 0, easing: 'ease-out', fill: 'backwards' });
  }

  function bump(el) {
    if (RM || !el.animate) return;
    el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 400, easing: 'ease-out' });
  }

  function svgFor(p, happy) {
    return p.kind === 'fish' ? fishSVG() : catSVG(lookOf(state.modeId, p.level), p.len, p.axis, happy);
  }

  function mergeFx(ev, k) {
    const look = lookOf(state.modeId, ev.level);
    const pos = px(ev.r, ev.c, ev.len, ev.axis);
    const coat = COATS[look][0];
    burst(pos.x, pos.y, {
      count: 8 + ev.level * 2, speed: 150 + ev.level * 14, life: 0.55, size: 6 + ev.level * 0.4, gravity: 350,
      kinds: ['puff', 'puff', 'star', 'heart'], colors: [coat, '#ffffff', '#ffd23f', '#ff9aa2'],
    });
    floatText(pos.x, pos.y, '+' + ev.gain);
    if (k >= 1) floatText(pos.x, pos.y - pos.cs * 0.5, '×' + (k + 1), 'combo');
    Sound.meow(ev.level, k);
    Sound.pop(k);
    vibrate(12 + k * 8);
    shake(1.2 + ev.level * 0.55, 170);

    const el = els.get(ev.id);
    if (el) {
      const p = state.pieces.find((x) => x.id === ev.id);
      if (p) {
        el.innerHTML = svgFor(p, true);
        el.dataset.happy = '1';
        setTimeout(() => {
          if (el.dataset.happy !== '1') return;
          el.dataset.happy = '';
          const q = state.pieces.find((x) => x.id === ev.id);
          if (q && els.get(ev.id) === el) el.innerHTML = svgFor(q, false);
        }, 800);
      }
    }
  }

  function eatFx(ev) {
    const pos = px(ev.fish.r, ev.fish.c, 1, 'h');
    burst(pos.x, pos.y, {
      count: 7, speed: 120, life: 0.5, size: 5, gravity: 300,
      kinds: ['heart', 'puff'], colors: ['#66c2e8', '#ff9aa2', '#ffffff'],
    });
    floatText(pos.x, pos.y, '+' + ev.gain);
    Sound.munch();
    vibrate(8);
  }

  function legendSequence(ev) {
    const n = state.n;
    const look = lookOf(state.modeId, ev.level);
    const pos = px(ev.r, ev.c, ev.len, ev.axis);
    Sound.fanfare();
    vibrate([30, 40, 30, 40, 90]);

    const dim = $('dim');
    dim.classList.add('on');
    setTimeout(() => dim.classList.remove('on'), 1100);

    // the whole row flashes gold
    const band = document.createElement('div');
    band.className = 'lane-flash';
    placeEl(band, ev, n);
    piecesEl.appendChild(band);
    if (band.animate && !RM) {
      band.animate([{ opacity: 0 }, { opacity: 0.95, offset: 0.2 }, { opacity: 0 }], { duration: 900 }).onfinish = () => band.remove();
    } else setTimeout(() => band.remove(), 600);

    // the cat stretches over the full row, head poking out past the edge
    const el = document.createElement('div');
    el.className = 'legend-fx';
    el.innerHTML = catSVG(look, ev.len, ev.axis, true);
    placeEl(el, ev, n);
    el.style.transformOrigin = ev.axis === 'h' ? 'left center' : 'center bottom';
    piecesEl.appendChild(el);

    const sc = (along, across) => (ev.axis === 'v' ? `scale(${across}, ${along})` : `scale(${along}, ${across})`);
    const items = $('collection').querySelectorAll('.coll-item');
    const target = items[ev.level - 1] || items[items.length - 1];

    function exit() {
      const a = el.getBoundingClientRect();
      const t = target ? target.getBoundingClientRect() : a;
      const dx = t.left + t.width / 2 - (a.left + a.width / 2);
      const dy = t.top + t.height / 2 - (a.top + a.height / 2);
      el.style.transformOrigin = 'center';
      const done = () => { el.remove(); if (target) bump(target); };
      if (RM || !el.animate) { done(); return; }
      el.animate([
        { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 },
        { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 40}px) rotate(180deg) scale(.55)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) rotate(360deg) scale(.12)`, opacity: 0 },
      ], { duration: 650, easing: 'ease-in', fill: 'forwards' }).onfinish = done;
    }

    if (RM || !el.animate) {
      setTimeout(exit, 900);
    } else {
      el.animate([
        { transform: sc(0.7, 0.9), opacity: 0, offset: 0 },
        { transform: sc(1.12, 0.94), opacity: 1, offset: 0.2 },
        { transform: sc(1, 1), opacity: 1, offset: 0.4 },
        { transform: sc(1, 1), opacity: 1, offset: 1 },
      ], { duration: 1100, easing: 'ease-out' }).onfinish = exit;
    }

    burst(pos.x, pos.y, {
      count: 36, speed: 380, life: 1.1, size: 9, gravity: 500, up: 80,
      kinds: ['star', 'star', 'heart', 'confetti'], colors: ['#ffd23f', '#fff4b0', '#ff9aa2', '#ffffff', '#8fd6c3'],
    });
    // fish rain across the board
    if (!RM) {
      const b = board.getBoundingClientRect();
      for (let i = 0; i < 14; i++) {
        setTimeout(() => {
          sizeCanvas();
          addParticle({ x: rand(10, b.width - 10), y: -12, vx: rand(-20, 20), vy: rand(60, 160), gravity: 420, life: 1.5, size: 11, kind: 'fish' });
        }, i * 50);
      }
    }

    const banner = $('banner');
    banner.innerHTML = '<b>گربه‌ی افسانه‌ای!</b><span>ردیف آزاد شد · ۵ حرکت امتیاز ×۲</span>';
    if (banner.animate && !RM) {
      banner.animate([
        { opacity: 0, transform: 'scale(.5)' },
        { opacity: 1, transform: 'scale(1.12)', offset: 0.2 },
        { opacity: 1, transform: 'scale(1)', offset: 0.75 },
        { opacity: 0, transform: 'translateY(-14px) scale(1)' },
      ], { duration: 1700, easing: 'ease-out' });
    } else {
      banner.style.opacity = 1;
      setTimeout(() => { banner.style.opacity = 0; }, 1500);
    }
    floatText(pos.x, pos.y + pos.cs * 0.9, '+500', 'combo');
    shake(7, 420);
    bump($('legends'));
  }

  /* ---------- rendering ---------- */

  function placeEl(el, p, n) {
    el.style.left = (p.c / n) * 100 + '%';
    el.style.top = (p.r / n) * 100 + '%';
    el.style.width = ((p.axis === 'h' ? p.len : 1) / n) * 100 + '%';
    el.style.height = ((p.axis === 'v' ? p.len : 1) / n) * 100 + '%';
  }

  function render(fx) {
    fx = fx || {};
    const n = state.n;
    board.style.setProperty('--n', n);
    const live = new Set();
    for (const p of state.pieces) {
      live.add(p.id);
      let el = els.get(p.id);
      const isNew = !el;
      if (isNew) {
        el = document.createElement('div');
        el.className = 'piece';
        piecesEl.appendChild(el);
        els.set(p.id, el);
        placeEl(el, p, n);
      }
      const sig = `${p.kind}|${p.level}|${p.len}|${p.axis}`;
      if (el.dataset.sig !== sig) {
        el.innerHTML = svgFor(p, false);
        el.dataset.sig = sig;
        el.dataset.happy = '';
      }
      placeEl(el, p, n);
      el.style.zIndex = '';
      el.classList.toggle('almost', p.kind === 'cat' && state.modeId !== 'classic' && p.len === n - 1);
      if (fx.spawned && fx.spawned.has(p.id)) {
        el.classList.remove('spawn'); void el.offsetWidth; el.classList.add('spawn');
      } else if (fx.merged && fx.merged.has(p.id)) {
        jelly(el, p.axis, { delay: MERGE_AT, fade: true, strong: true });
      } else if (fx.grown && fx.grown.has(p.id)) {
        jelly(el, p.axis, { delay: SLIDE, strong: false });
      }
    }
    for (const [id, el] of els) {
      if (live.has(id)) continue;
      els.delete(id);
      const gp = fx.ghosts && fx.ghosts.get(id);
      if (gp && el.animate && !RM) {
        // a merging cat slides next to its partner, squashes, then vanishes under the new cat
        placeEl(el, gp, n);
        el.style.zIndex = '3';
        const sq = gp.axis === 'v' ? 'scale(.9, 1.1)' : 'scale(1.1, .9)';
        el.animate([{ transform: 'scale(1)' }, { transform: sq }], { duration: 80, delay: SLIDE - 40, fill: 'forwards', easing: 'ease-in' });
        setTimeout(() => {
          el.animate([{ transform: sq, opacity: 1 }, { transform: 'scale(.55)', opacity: 0 }], { duration: 90, fill: 'forwards' }).onfinish = () => el.remove();
        }, MERGE_AT - 10);
      } else if (gp) {
        placeEl(el, gp, n);
        setTimeout(() => el.remove(), MERGE_AT);
      } else {
        el.classList.add('gone');
        setTimeout(() => el.remove(), 260);
      }
    }

    // one-short-of-a-full-row hint
    piecesEl.querySelectorAll('.lane').forEach((l) => l.remove());
    for (const p of state.pieces) {
      if (p.kind !== 'cat' || state.modeId === 'classic' || p.len !== n - 1) continue;
      const lane = document.createElement('div');
      lane.className = 'lane';
      placeEl(lane, p.axis === 'h' ? { r: p.r, c: 0, len: n, axis: 'h' } : { r: 0, c: p.c, len: n, axis: 'v' }, n);
      piecesEl.insertBefore(lane, piecesEl.firstChild);
    }

    $('score').textContent = state.score;
    $('legends').textContent = state.legends;
    if (state.score > best) { best = state.score; store.set('best.' + modeId, best); }
    $('best').textContent = best;
    $('undo').disabled = history.length === 0;
    $('over').hidden = !state.over;
    $('final-score').textContent = state.score;
    $('boost').hidden = !(state.boost > 0);
    $('boost-n').textContent = state.boost || 0;
  }

  function buildModeButtons() {
    const nav = $('modes');
    nav.innerHTML = '';
    for (const id of Object.keys(E.MODES)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = MODE_LABELS[id];
      b.setAttribute('aria-pressed', String(id === modeId));
      b.addEventListener('click', () => { modeId = id; store.set('mode', id); newGame(); });
      nav.appendChild(b);
    }
  }

  function buildCollection() {
    const box = $('collection');
    box.innerHTML = '';
    const mode = E.MODES[modeId];
    for (let lv = 1; lv <= mode.maxLevel; lv++) {
      const look = lookOf(modeId, lv);
      const item = document.createElement('div');
      item.className = 'coll-item' + (lv <= discovered ? '' : ' locked');
      item.innerHTML = catSVG(look, 1, 'h') + `<span>${NAMES[look]}</span>`;
      box.appendChild(item);
    }
  }

  function buildCells() {
    cellsEl.innerHTML = '';
    for (let i = 0; i < state.n * state.n; i++) {
      const c = document.createElement('div');
      c.className = 'cell';
      cellsEl.appendChild(c);
    }
  }

  /* ---------- game flow ---------- */

  function newGame() {
    token++;
    history = [];
    els.forEach((el) => el.remove());
    els.clear();
    piecesEl.querySelectorAll('.lane, .legend-fx, .lane-flash').forEach((x) => x.remove());
    board.querySelectorAll('.float').forEach((x) => x.remove());
    $('dim').classList.remove('on');
    parts = [];
    state = E.createGame(modeId);
    best = store.get('best.' + modeId, 0);
    discovered = store.get('seen.' + modeId, 1);
    buildModeButtons();
    $('rules').textContent = RULES[modeId];
    buildCells();
    buildCollection();
    render({ spawned: new Set(state.pieces.map((p) => p.id)) });
  }

  function play(dir) {
    if (state.over) return;
    Sound.unlock();
    const res = E.move(state, dir);
    if (!res.moved) return;
    history.push(state);
    if (history.length > 30) history.shift();
    state = res.state;

    const fx = { spawned: new Set(), merged: new Set(), grown: new Set(), ghosts: new Map() };
    const merges = [], eats = [], legends = [];
    let seenNow = discovered;
    for (const ev of res.events) {
      if (ev.type === 'spawn') fx.spawned.add(ev.id);
      if (ev.type === 'merge') {
        fx.merged.add(ev.id);
        fx.ghosts.set(ev.a.id, ev.a);
        fx.ghosts.set(ev.b.id, ev.b);
        merges.push(ev);
        seenNow = Math.max(seenNow, ev.level);
      }
      if (ev.type === 'eat') {
        fx.grown.add(ev.id);
        fx.ghosts.set(ev.fish.id, ev.fish);
        eats.push(ev);
      }
      if (ev.type === 'legend') { legends.push(ev); seenNow = Math.max(seenNow, ev.level); }
    }
    render(fx);

    const tok = token;
    merges.forEach((ev, k) => setTimeout(() => { if (tok === token) mergeFx(ev, k); }, MERGE_AT));
    eats.forEach((ev) => setTimeout(() => { if (tok === token) eatFx(ev); }, SLIDE));
    legends.forEach((ev, i) => setTimeout(() => { if (tok === token) legendSequence(ev); }, MERGE_AT + 160 + i * 300));

    if (seenNow > discovered) {
      discovered = seenNow;
      store.set('seen.' + modeId, discovered);
      buildCollection();
    }
  }

  function undo() {
    if (!history.length) return;
    state = history.pop();
    render();
  }

  /* ---------- input ---------- */

  const KEYS = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    a: 'left', d: 'right', w: 'up', s: 'down',
  };
  window.addEventListener('keydown', (e) => {
    const dir = KEYS[e.key] || KEYS[e.key.toLowerCase()];
    if (!dir) return;
    e.preventDefault();
    play(dir);
  });

  let start = null;
  board.addEventListener('pointerdown', (e) => { start = { x: e.clientX, y: e.clientY }; });
  window.addEventListener('pointerup', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    play(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  window.addEventListener('pointercancel', () => { start = null; });
  window.addEventListener('resize', sizeCanvas);

  $('restart').addEventListener('click', newGame);
  $('again').addEventListener('click', newGame);
  $('undo').addEventListener('click', undo);
  const soundBtn = $('sound');
  const paintSound = () => { soundBtn.textContent = Sound.enabled ? '🔊' : '🔇'; };
  soundBtn.addEventListener('click', () => { Sound.toggle(); paintSound(); });
  paintSound();

  // test hook for automated checks
  window.__cat = {
    play: (d) => play(d),
    load: (s) => { token++; state = s; history = []; els.forEach((el) => el.remove()); els.clear(); buildCells(); render({ spawned: new Set(s.pieces.map((p) => p.id)) }); },
    get state() { return state; },
  };

  newGame();
})();
