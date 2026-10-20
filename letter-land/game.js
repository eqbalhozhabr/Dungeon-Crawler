(function () {
  'use strict';
  const LD = window.LetterData, Learn = window.LetterLearn, Spawn = window.LetterSpawn, Chars = window.LetterChars;

  /* ---------- config ---------- */

  const H = 640;              // logical height of the world
  const GROUND = 488;         // y of the ground line
  const GRAV = 2300;
  const JUMP_V = 800;
  const JUMP2_V = 660;
  const GAP_MAX = 108;        // distance between the two characters (their "health")
  const GAP_START = 100;
  const GAP_MIN = 24;         // closer than this = they bump into each other = game over
  const GAP_HIT = 42;
  const HISTORY = 2.2;        // seconds of the leader's path the follower can replay
  const CHARACTERS = { boy: { name: 'آزاد' }, girl: { name: 'رها' } };
  const GROUP_COLORS = ['#ff8f70', '#5fb3e8', '#7bc65a', '#ffb62e', '#b681e0', '#ee7aa6'];

  const $ = (id) => document.getElementById(id);
  const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function mulberry(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  const store = {
    get(k, d) { try { const v = localStorage.getItem('letterland.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('letterland.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };
  const rawStorage = (function () { try { return window.localStorage; } catch (e) { return null; } })();

  /* ---------- sound & speech ---------- */

  const Audio_ = (function () {
    let ctx = null, master = null;
    let on = store.get('sound', true);
    function ac() {
      if (!on) return null;
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination); } catch (e) { ctx = null; return null; }
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    function tone(type, f0, f1, t, dur, vol) {
      const c = ctx; const o = c.createOscillator(); const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
    }
    const play = (fn) => () => { const c = ac(); if (c) fn(c.currentTime); };
    return {
      get on() { return on; },
      toggle() { on = !on; store.set('sound', on); if (on) ac(); else try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } return on; },
      unlock() { ac(); },
      jump: play((t) => tone('sine', 300, 620, t, 0.14, 0.22)),
      jump2: play((t) => tone('sine', 420, 820, t, 0.12, 0.2)),
      coin: play((t) => { tone('square', 988, 988, t, 0.07, 0.1); tone('square', 1318, 1318, t + 0.07, 0.16, 0.1); }),
      good: play((t) => { [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f * 1.003, t + i * 0.08, 0.3, 0.25)); }),
      bad: play((t) => tone('sine', 280, 170, t, 0.28, 0.25)),
      hit: play((t) => { tone('sawtooth', 180, 60, t, 0.25, 0.22); }),
      over: play((t) => { [392, 330, 262].forEach((f, i) => tone('triangle', f, f * 0.98, t + i * 0.16, 0.3, 0.25)); }),
      cheer: play((t) => { [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone('triangle', f, f * 1.003, t + i * 0.07, 0.4, 0.22)); }),
    };
  })();

  let faVoice = null;
  function findVoice() {
    try {
      const vs = window.speechSynthesis.getVoices() || [];
      faVoice = vs.find((v) => /^fa/i.test(v.lang)) || null;
    } catch (e) { faVoice = null; }
  }
  try { if (window.speechSynthesis) { findVoice(); window.speechSynthesis.addEventListener('voiceschanged', findVoice); } } catch (e) { /* ignore */ }
  // speaks only when the device has a Persian voice; an English voice would mispronounce the letters
  function speak(text) {
    if (!Audio_.on || !window.speechSynthesis || !faVoice) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = faVoice; u.lang = faVoice.lang; u.rate = 0.85; u.pitch = 1.1;
      window.speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }

  /* ---------- stage & canvas ---------- */

  const stage = $('stage'), cv = $('cv'), ctx = cv.getContext('2d');
  let W = 360, scale = 1;

  function resize() {
    const r = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(r.width * dpr);
    cv.height = Math.round(r.height * dpr);
    scale = r.height / H;
    W = r.width / scale;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  }

  /* ---------- scenery (drawn from seeded random layouts) ---------- */

  const TW = 900;
  const sr = mulberry(11);
  const GREENS = ['#7fbf4d', '#6aae3d', '#8ccb5a', '#5e9e36'];
  const clouds = Array.from({ length: 4 }, (_, i) => ({ x: i * 225 + sr() * 70, y: 70 + sr() * 120, s: 0.7 + sr() * 0.6 }));
  const trees = [];
  for (let x = 30; x < TW; x += 120 + sr() * 80) trees.push({ x, h: 120 + sr() * 70, r: 44 + sr() * 22, c: sr() < 0.22 ? '#e9c84a' : GREENS[Math.floor(sr() * GREENS.length)] });
  const stones = [];
  for (let row = 0; row < 2; row++) {
    let x = -row * 30;
    while (x < TW) { const w = 46 + sr() * 26; stones.push({ x, row, w, c: ['#b9b4a6', '#a8a496', '#c7c2b3', '#b2ad9d'][Math.floor(sr() * 4)] }); x += w + 3; }
  }
  const bushes = [];
  for (let x = 0; x < TW; x += 38 + sr() * 30) bushes.push({ x, r: 20 + sr() * 14, c: GREENS[Math.floor(sr() * GREENS.length)], flower: sr() < 0.5 ? pick(['#ffffff', '#ffe066', '#ff9ec4']) : null });
  const tufts = [];
  for (let x = 0; x < TW; x += 26 + sr() * 40) tufts.push({ x, y: 14 + sr() * 70, flower: sr() < 0.35 ? pick(['#ffffff', '#ffe066', '#ff9ec4']) : null });

  function tiled(offset, fn) {
    const start = -(((offset % TW) + TW) % TW);
    for (let ox = start; ox < W + 40; ox += TW) fn(ox);
  }

  function drawScenery(dist) {
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, '#bfe7ff');
    sky.addColorStop(1, '#eaf8ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    tiled(dist * 0.06, (ox) => clouds.forEach((c) => {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      const x = ox + c.x, y = c.y;
      ctx.beginPath();
      ctx.arc(x, y, 22 * c.s, 0, 7); ctx.arc(x + 24 * c.s, y - 8 * c.s, 28 * c.s, 0, 7); ctx.arc(x + 52 * c.s, y, 20 * c.s, 0, 7);
      ctx.fill();
    }));

    tiled(dist * 0.2, (ox) => trees.forEach((t) => {
      const x = ox + t.x, base = GROUND - 90;
      ctx.fillStyle = '#9a7650';
      ctx.fillRect(x - 7, base - t.h, 14, t.h);
      ctx.fillStyle = t.c;
      ctx.beginPath();
      ctx.arc(x, base - t.h - 6, t.r, 0, 7); ctx.arc(x - t.r * 0.7, base - t.h + 10, t.r * 0.7, 0, 7); ctx.arc(x + t.r * 0.7, base - t.h + 10, t.r * 0.7, 0, 7);
      ctx.fill();
    }));

    // stone wall
    const wallTop = GROUND - 104;
    ctx.fillStyle = '#8f8b7e';
    ctx.fillRect(0, wallTop, W, 78);
    tiled(dist * 0.5, (ox) => stones.forEach((s) => {
      ctx.fillStyle = s.c;
      const y = wallTop + 2 + s.row * 38;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(ox + s.x, y, s.w, 34, 9); else ctx.rect(ox + s.x, y, s.w, 34);
      ctx.fill();
    }));

    tiled(dist * 0.7, (ox) => bushes.forEach((b) => {
      ctx.fillStyle = b.c;
      ctx.beginPath(); ctx.arc(ox + b.x, GROUND - 30, b.r, 0, 7); ctx.fill();
      if (b.flower) { ctx.fillStyle = b.flower; ctx.beginPath(); ctx.arc(ox + b.x + 5, GROUND - 36 - b.r * 0.3, 3.5, 0, 7); ctx.fill(); }
    }));

    // ground
    const gr = ctx.createLinearGradient(0, GROUND - 30, 0, H);
    gr.addColorStop(0, '#93cc5c');
    gr.addColorStop(1, '#6fae3f');
    ctx.fillStyle = gr;
    ctx.fillRect(0, GROUND - 30, W, H - GROUND + 30);
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ctx.fillRect(0, GROUND - 4, W, 60);
    tiled(dist, (ox) => tufts.forEach((t) => {
      const x = ox + t.x, y = GROUND + 8 + t.y;
      ctx.strokeStyle = '#5e9e36';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x - 7, y - 9); ctx.moveTo(x, y); ctx.lineTo(x, y - 12); ctx.moveTo(x + 5, y); ctx.lineTo(x + 7, y - 9); ctx.stroke();
      if (t.flower) { ctx.fillStyle = t.flower; ctx.beginPath(); ctx.arc(x, y - 14, 4, 0, 7); ctx.fill(); ctx.fillStyle = '#f6b500'; ctx.beginPath(); ctx.arc(x, y - 14, 1.6, 0, 7); ctx.fill(); }
    }));
  }

  /* ---------- things on the road ---------- */

  function rr(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }

  function drawObstacle(e) {
    const x = e.x, y = GROUND;
    ctx.save();
    ctx.fillStyle = 'rgba(40,60,20,.18)';
    ctx.beginPath(); ctx.ellipse(x, y, e.w * 0.6, 7, 0, 0, 7); ctx.fill();
    if (e.kind === 'rock') {
      ctx.fillStyle = '#9b9a97';
      ctx.beginPath(); ctx.moveTo(x - 27, y); ctx.quadraticCurveTo(x - 30, y - 34, x - 6, y - 40); ctx.quadraticCurveTo(x + 26, y - 42, x + 28, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ctx.beginPath(); ctx.ellipse(x - 8, y - 28, 9, 5, -0.5, 0, 7); ctx.fill();
    } else if (e.kind === 'log') {
      ctx.fillStyle = '#9a6a3d'; rr(x - 33, y - 36, 66, 36, 12); ctx.fill();
      ctx.fillStyle = '#c99763'; ctx.beginPath(); ctx.ellipse(x + 26, y - 18, 9, 17, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#9a6a3d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x + 26, y - 18, 4, 9, 0, 0, 7); ctx.stroke();
    } else if (e.kind === 'bush') {
      ctx.fillStyle = '#4f9a30';
      ctx.beginPath(); ctx.arc(x - 18, y - 22, 22, 0, 7); ctx.arc(x + 4, y - 32, 26, 0, 7); ctx.arc(x + 22, y - 20, 21, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff7a8a';
      [[-12, -30], [10, -40], [24, -22], [-2, -18]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.arc(x + dx, y + dy, 3.5, 0, 7); ctx.fill(); });
    } else { // picnic basket with a book, like in the picture
      ctx.fillStyle = '#4aa0dc'; ctx.save(); ctx.translate(x - 4, y - 42); ctx.rotate(-0.12); rr(-14, -14, 30, 34, 3); ctx.fill();
      ctx.fillStyle = '#ffd24d'; ctx.fillRect(-10, -4, 22, 8); ctx.restore();
      ctx.fillStyle = '#c48a4a';
      ctx.beginPath(); ctx.moveTo(x - 28, y - 36); ctx.lineTo(x + 28, y - 36); ctx.lineTo(x + 22, y); ctx.lineTo(x - 22, y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#a06c32'; ctx.lineWidth = 2;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(x + i * 8, y - 36); ctx.lineTo(x + i * 7, y); ctx.stroke(); }
      for (let j = 1; j < 4; j++) { ctx.beginPath(); ctx.moveTo(x - 26 + j, y - j * 9); ctx.lineTo(x + 26 - j, y - j * 9); ctx.stroke(); }
      ctx.strokeStyle = '#a06c32'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y - 36, 24, Math.PI, 0); ctx.stroke();
    }
    ctx.restore();
  }

  function drawCoin(e, t) {
    const y = GROUND - e.h + Math.sin(t * 4 + e.x * 0.02) * 2;
    const sx = Math.max(0.28, Math.abs(Math.cos(t * 3.5 + e.x * 0.03)));
    ctx.save();
    ctx.translate(e.x, y);
    ctx.scale(sx, 1);
    const g = ctx.createRadialGradient(-4, -4, 2, 0, 0, 14);
    g.addColorStop(0, '#fff3b0'); g.addColorStop(0.6, '#ffc83d'); g.addColorStop(1, '#d99a0b');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.fill();
    ctx.strokeStyle = '#c98a05'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.stroke();
    ctx.restore();
  }

  function drawLetter(e, t) {
    const y = GROUND - e.h + Math.sin(t * 2.6 + e.x * 0.01) * 4;
    ctx.save();
    ctx.translate(e.x, y);
    ctx.shadowColor = 'rgba(40,60,20,.3)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#fffaf0';
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, 7); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 5;
    ctx.strokeStyle = GROUP_COLORS[e.color % GROUP_COLORS.length];
    ctx.stroke();
    ctx.fillStyle = '#3b2a22';
    ctx.font = '800 38px Vazirmatn, Tahoma, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(e.ch, 0, 3);
    ctx.restore();
  }

  /* ---------- game state ---------- */

  const learner = Learn.createLearner({ letters: LD.LETTERS, similar: LD.SIMILAR, storage: rawStorage });
  let spawner = Spawn.createSpawner({});
  const colorOf = (ch) => LD.LETTERS.findIndex((l) => l.ch === ch);

  let G = null;          // the run in progress
  let mode = 'menu';     // menu | play | pause | over
  let last = 0;
  let selected = store.get('char', 'boy');

  const leaderX = () => clamp(W * 0.5, 176, 300);

  function newRun(kind) {
    selected = kind;
    store.set('char', kind);
    spawner = Spawn.createSpawner({});
    G = {
      kind, other: kind === 'boy' ? 'girl' : 'boy',
      dist: 0, time: 0, speed: 200, coins: 0, ok: 0, bad: 0,
      y: 0, vy: 0, jumps: 0, hist: [], gap: GAP_START, invuln: 0, hurt: 0, slow: 0, shake: 0,
      entities: [], parts: [], spawnIn: 260, anim: 0, flash: 0,
      overT: 0, learnedNow: new Set(), caught: false, cheer: 0,
    };
    newTarget(true);
    $('coins').textContent = fa(0);
    setMode('play');
  }

  function setMode(m) {
    mode = m;
    $('menu').hidden = m !== 'menu';
    $('pause').hidden = m !== 'pause';
    $('over').hidden = m !== 'over';
    $('hud').hidden = !(m === 'play' || m === 'pause');
  }

  function renderCard() {
    const t = learner.target;
    $('cl').textContent = t.ch;
    $('ce').textContent = t.emoji;
    const w = t.word, i = w.indexOf(t.ch);
    $('cw').innerHTML = i < 0 ? w : `${w.slice(0, i)}<mark>${t.ch}</mark>${w.slice(i + 1)}`;
    $('cd').innerHTML = Array.from({ length: learner.need }, (_, k) => `<i class="${k < learner.progress ? 'on' : ''}"></i>`).join('');
  }

  function newTarget(first) {
    const t = learner.pickTarget();
    renderCard();
    banner(first ? 'بیا حرف «' + t.ch + '» رو پیدا کنیم!' : 'حرف جدید: «' + t.ch + '»', t.word + ' ' + t.emoji);
    speak(`${t.ch}، ${t.word}`);
  }

  function banner(text, small) {
    const b = $('banner');
    b.innerHTML = text + (small ? `<small>${small}</small>` : '');
    if (b.animate && !RM) {
      b.animate([{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'scale(1.06)', offset: 0.15 }, { opacity: 1, transform: 'scale(1)', offset: 0.8 }, { opacity: 0, transform: 'translateY(-10px)' }], { duration: 2000, easing: 'ease-out' });
    } else { b.style.opacity = 1; setTimeout(() => { b.style.opacity = 0; }, 1600); }
  }

  /* ---------- particles ---------- */

  function burst(x, y, n, colors, o) {
    if (RM) return;
    o = o || {};
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = (o.speed || 200) * rand(0.4, 1.1);
      G.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up || 60), life: rand(0.5, 0.9), age: 0, kind: pick(o.kinds || ['star', 'dot']), color: pick(colors), size: rand(4, 8), g: 600, rot: rand(0, 6) });
    }
  }
  function floatText(x, y, text, color) { G.parts.push({ x, y, vx: 0, vy: -70, life: 1.0, age: 0, kind: 'text', text, color: color || '#fff', size: 22, g: 0 }); }

  function drawParts() {
    for (const p of G.parts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - (p.age / p.life) ** 2);
      ctx.translate(p.x, p.y);
      ctx.fillStyle = p.color;
      if (p.kind === 'text') {
        ctx.font = '800 ' + p.size + 'px Vazirmatn, Tahoma, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(60,40,30,.7)'; ctx.strokeText(p.text, 0, 0);
        ctx.fillText(p.text, 0, 0);
      } else if (p.kind === 'star') {
        ctx.rotate(p.rot + p.age * 5);
        ctx.beginPath();
        for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? p.size * 0.45 : p.size; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.fill();
      } else { ctx.beginPath(); ctx.arc(0, 0, p.size * 0.6, 0, 7); ctx.fill(); }
      ctx.restore();
    }
  }

  /* ---------- update ---------- */

  function jump() {
    if (mode !== 'play' || G.caught) return;
    if (G.y <= 0.5 && G.jumps === 0) { G.vy = JUMP_V; G.jumps = 1; Audio_.jump(); burst(leaderX(), GROUND, 5, ['#fff', '#d6efb0'], { kinds: ['dot'], speed: 90, up: 20 }); }
    else if (G.jumps === 1) { G.vy = JUMP2_V; G.jumps = 2; Audio_.jump2(); }
  }

  function circleRect(cx, cy, r, rx0, ry0, rx1, ry1) {
    const nx = clamp(cx, rx0, rx1), ny = clamp(cy, ry0, ry1);
    return (cx - nx) ** 2 + (cy - ny) ** 2 <= r * r;
  }

  function yAt(tNow) { // the leader's height `lag` seconds ago, for the follower
    const hist = G.hist;
    if (!hist.length) return 0;
    for (let i = hist.length - 1; i >= 0; i--) if (hist[i].t <= tNow) return hist[i].y;
    return hist[0].y;
  }

  function collectCoin(e, byLeader) {
    e.dead = true;
    G.coins++;
    Audio_.coin();
    burst(e.x, GROUND - e.h, 4, ['#ffe27a', '#fff'], { kinds: ['star'], speed: 140 });
    $('coins').textContent = fa(G.coins);
  }

  function collectLetter(e, byLeader) {
    const t = learner.target;
    if (e.ch === t.ch) {
      e.dead = true;
      G.ok++;
      G.coins += 10;
      G.gap = Math.min(GAP_MAX, G.gap + 16);
      const res = learner.correct(t.ch);
      Audio_.good();
      burst(e.x, GROUND - e.h, 18, ['#ffd23f', '#ff9aa2', '#8fd6c3', '#fff'], { speed: 260 });
      floatText(e.x, GROUND - e.h - 30, 'آفرین! +۱۰', '#ffe27a');
      $('coins').textContent = fa(G.coins);
      if (res.mastered) {
        G.learnedNow.add(t.ch);
        G.cheer = 1.2;
        Audio_.cheer();
        banner('عالی شد! ' + t.emoji, t.word);
        speak(t.word);
        setTimeout(() => { if (mode === 'play') newTarget(false); }, 1700);
      } else renderCard();
    } else if (byLeader) {
      e.dead = true;
      G.bad++;
      learner.wrong(e.ch);
      Audio_.bad();
      floatText(e.x, GROUND - e.h - 30, 'این «' + e.ch + '» بود', '#ffffff');
      burst(e.x, GROUND - e.h, 6, ['#cfd8dc', '#fff'], { kinds: ['dot'], speed: 120 });
    }
  }

  function hit(e) {
    G.invuln = 1.3; G.hurt = 0.6; G.slow = 0.35; G.shake = 0.3;
    G.gap -= GAP_HIT;
    Audio_.hit();
    burst(leaderX(), GROUND - 40, 10, ['#ffffff', '#ffd9a8'], { kinds: ['dot'], speed: 160 });
    if (G.gap <= GAP_MIN) gameOver();
  }

  function update(dt) {
    G.time += dt;
    if (G.caught) {
      G.overT += dt;
      G.parts.forEach((p) => { p.age += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; });
      G.parts = G.parts.filter((p) => p.age < p.life);
      if (G.overT > 1.1 && mode === 'play') showOver();
      return;
    }
    G.speed = 205 + Math.min(G.time, 100) * 1.5;
    const sp = G.speed * (G.slow > 0 ? 0.55 : 1);
    G.anim += dt * (sp / 210);
    G.dist += sp * dt;
    G.invuln = Math.max(0, G.invuln - dt);
    G.hurt = Math.max(0, G.hurt - dt);
    G.slow = Math.max(0, G.slow - dt);
    G.shake = Math.max(0, G.shake - dt);
    G.cheer = Math.max(0, G.cheer - dt);
    if (G.invuln <= 0 && G.gap < GAP_MAX) G.gap = Math.min(GAP_MAX, G.gap + 5 * dt);

    // leader physics
    G.vy -= GRAV * dt;
    G.y += G.vy * dt;
    if (G.y <= 0) { G.y = 0; G.vy = 0; G.jumps = 0; }
    G.hist.push({ t: G.time, y: G.y });
    while (G.hist.length && G.hist[0].t < G.time - HISTORY) G.hist.shift();
    const lag = G.gap / sp;
    const fy = yAt(G.time - lag);

    // world
    for (const e of G.entities) e.x -= sp * dt;
    G.spawnIn -= sp * dt;
    if (G.spawnIn <= 0) {
      const target = learner.target;
      const pat = spawner.next({ speed: G.speed, dist: G.dist, target: target.ch, distractors: learner.distractors(2) });
      const x0 = W + 80;
      for (const it of pat.items) {
        const e = Object.assign({}, it, { x: x0 + it.dx });
        if (e.t === 'letter') e.color = colorOf(e.ch);
        G.entities.push(e);
      }
      G.spawnIn = pat.len;
    }

    // collisions
    const LX = leaderX(), FX = LX - G.gap;
    const lTop = GROUND - G.y - 104, lBot = GROUND - G.y;
    const fTop = GROUND - fy - 104, fBot = GROUND - fy;
    for (const e of G.entities) {
      if (e.dead) continue;
      if (e.t === 'obs') {
        if (G.invuln <= 0) {
          const x0 = e.x - e.w / 2 + 6, x1 = e.x + e.w / 2 - 6, y0 = GROUND - e.h + 8;
          if (LX + 14 > x0 && LX - 14 < x1 && lBot > y0 && lBot - 70 < GROUND) { hit(e); }
        }
      } else {
        const r = e.t === 'coin' ? 15 : 30, cy = GROUND - e.h;
        if (circleRect(e.x, cy, r, LX - 16, lTop, LX + 16, lBot)) { (e.t === 'coin' ? collectCoin : collectLetter)(e, true); }
        else if (circleRect(e.x, cy, r, FX - 16, fTop, FX + 16, fBot)) {
          if (e.t === 'coin') collectCoin(e, false);
          else if (e.ch === learner.target.ch) collectLetter(e, false);
        }
      }
      if (G.caught) break;
    }
    G.entities = G.entities.filter((e) => !e.dead && e.x > -120);

    G.parts.forEach((p) => { p.age += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; });
    G.parts = G.parts.filter((p) => p.age < p.life);
    G._fy = fy;
  }

  function gameOver() {
    G.caught = true;
    G.overT = 0;
    Audio_.over();
    burst(leaderX() - G.gap / 2, GROUND - 60, 14, ['#ffd23f', '#fff', '#ff9aa2'], { speed: 220 });
  }

  function showOver() {
    const prevBest = store.get('bestDist', 0);
    const dist = Math.floor(G.dist / 10);
    if (dist > prevBest) store.set('bestDist', dist);
    store.set('coinsTotal', store.get('coinsTotal', 0) + G.coins);
    $('rCoins').textContent = fa(G.coins);
    $('rOk').textContent = fa(G.ok);
    $('rDist').textContent = fa(dist) + ' م';
    const l = [...G.learnedNow];
    $('rLearned').textContent = l.length ? 'امروز یاد گرفتی: ' + l.join('  ') : (G.ok ? 'آفرین! به حرف‌ها نزدیک شدی' : 'دفعه‌ی بعد حرف‌ها رو بگیر!');
    $('overTitle').textContent = G.bad > G.ok + 2 ? 'آخ! به هم خوردیم' : 'ای وای! به هم خوردیم';
    buildGrid();
    setMode('over');
  }

  /* ---------- draw ---------- */

  function shadow(x, h, s) {
    ctx.fillStyle = 'rgba(40,60,20,.22)';
    ctx.beginPath(); ctx.ellipse(x, GROUND + 4, 26 * s * (1 - clamp(h / 320, 0, 0.5)), 7 * s, 0, 0, 7); ctx.fill();
  }

  function drawRun() {
    ctx.save();
    if (G.shake > 0 && !RM) ctx.translate(rand(-3, 3), rand(-3, 3));
    drawScenery(G.dist);
    for (const e of G.entities) {
      if (e.t === 'obs') drawObstacle(e);
      else if (e.t === 'coin') drawCoin(e, G.time);
      else drawLetter(e, G.time);
    }
    const LX = leaderX(), FX = LX - G.gap;
    const fy = G._fy || 0;
    const S = 1.0;
    const near = G.gap < 52;
    // follower first (it is behind)
    shadow(FX, fy, S);
    const tumble = G.caught ? Math.min(G.overT, 0.6) / 0.6 : 0;
    Chars.draw(ctx, G.other, { x: FX, footY: GROUND - fy, scale: S, t: G.anim + 0.25, air: fy > 6, hurt: near || G.caught, happy: G.cheer > 0, rot: tumble * -1.2 });
    shadow(LX, G.y, S);
    if (!(G.invuln > 0 && Math.floor(G.time * 14) % 2 === 0)) {
      Chars.draw(ctx, G.kind, { x: LX, footY: GROUND - G.y, scale: S, t: G.anim, air: G.y > 6, hurt: G.hurt > 0 || G.caught, happy: G.cheer > 0, rot: tumble * 1.2 });
    }
    if (near && !G.caught) {
      ctx.save();
      ctx.font = '800 30px Vazirmatn, Tahoma, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff5a5f';
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 5;
      const by = GROUND - 150 - Math.abs(Math.sin(G.time * 10)) * 6;
      ctx.strokeText('!', FX + G.gap / 2, by); ctx.fillText('!', FX + G.gap / 2, by);
      ctx.restore();
    }
    drawParts();
    if (G.hurt > 0) { ctx.fillStyle = `rgba(255,90,90,${G.hurt * 0.25})`; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }

  function drawIdle(t) {
    drawScenery(t * 60);
  }

  function frame(ts) {
    const dt = Math.min(0.033, (ts - last) / 1000 || 0.016);
    last = ts;
    if (mode === 'play') { update(dt); drawRun(); }
    else if (mode === 'pause' || mode === 'over') { if (G) drawRun(); }
    else drawIdle(ts / 1000);
    requestAnimationFrame(frame);
  }

  /* ---------- menu & buttons ---------- */

  function buildGrid() {
    const g = $('grid');
    g.innerHTML = '';
    const learned = new Set(learner.learned());
    const unlocked = new Set(learner.pool().map((l) => l.ch));
    LD.LETTERS.forEach((l) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = l.ch;
      b.className = learned.has(l.ch) ? 'known' : (unlocked.has(l.ch) ? 'new' : '');
      b.addEventListener('click', () => { Audio_.unlock(); speak(`${l.ch}، ${l.word}`); });
      g.appendChild(b);
    });
    $('learnedCount').textContent = fa(learned.size);
  }

  function pauseGame(on) {
    if (on && mode === 'play') setMode('pause');
    else if (!on && mode === 'pause') { last = performance.now(); setMode('play'); }
  }

  document.querySelectorAll('.pick').forEach((b) => b.addEventListener('click', () => { Audio_.unlock(); newRun(b.dataset.kind); }));
  $('name-boy').textContent = CHARACTERS.boy.name;
  $('name-girl').textContent = CHARACTERS.girl.name;
  $('btnAgain').addEventListener('click', () => { Audio_.unlock(); newRun(selected); });
  $('btnMenu').addEventListener('click', () => { setMode('menu'); buildGrid(); });
  $('btnMenu2').addEventListener('click', () => { setMode('menu'); buildGrid(); });
  $('btnResume').addEventListener('click', () => pauseGame(false));
  $('btnPause').addEventListener('click', () => pauseGame(true));
  $('card').addEventListener('click', () => { if (learner.target) speak(`${learner.target.ch}، ${learner.target.word}`); });
  const soundBtn = $('btnSound');
  const paintSound = () => { soundBtn.textContent = Audio_.on ? '🔊' : '🔇'; };
  soundBtn.addEventListener('click', () => { Audio_.toggle(); paintSound(); });
  paintSound();
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(true); });

  // jump: tap anywhere on the stage (not on buttons) or press a key
  stage.addEventListener('pointerdown', (e) => {
    if (mode !== 'play') return;
    if (e.target.closest('button')) return;
    e.preventDefault();
    Audio_.unlock();
    jump();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { e.preventDefault(); if (mode === 'play') jump(); }
    else if (e.key === 'Escape' || e.key === 'p') { pauseGame(mode === 'play'); }
  });
  window.addEventListener('resize', () => { resize(); if (mode === 'menu') previews(); });

  function previews() { Chars.preview($('pv-boy'), 'boy'); Chars.preview($('pv-girl'), 'girl'); Chars.whenReady(() => { Chars.preview($('pv-boy'), 'boy'); Chars.preview($('pv-girl'), 'girl'); }); }

  // test hook
  window.__land = {
    get G() { return G; }, get mode() { return mode; }, learner, jump,
    start: (k) => newRun(k || 'boy'),
    step: (dt, n) => { for (let i = 0; i < (n || 1); i++) update(dt); drawRun(); },
  };

  resize();
  buildGrid();
  previews();
  setMode('menu');
  if (document.fonts && document.fonts.load) document.fonts.load('800 38px Vazirmatn').catch(() => {});
  requestAnimationFrame(frame);
})();
