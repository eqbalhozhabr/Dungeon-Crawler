(function () {
  'use strict';
  const LD = window.LetterData, WD = window.LetterWords, WP = window.LetterWordPlay, Spawn = window.LetterSpawn, Chars = window.LetterChars;

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
  const WORD_PAUSE = 2.3;     // seconds the finished word stays on screen
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
      step: play((t) => tone('triangle', 660, 880, t, 0.16, 0.22)),
      bad: play((t) => tone('sine', 250, 190, t, 0.2, 0.18)),
      hit: play((t) => { tone('sawtooth', 180, 60, t, 0.25, 0.22); }),
      over: play((t) => { [392, 330, 262].forEach((f, i) => tone('triangle', f, f * 0.98, t + i * 0.16, 0.3, 0.25)); }),
      cheer: play((t) => { [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone('triangle', f, f * 1.003, t + i * 0.07, 0.4, 0.22)); }),
      level: play((t) => { [392, 523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f * 1.003, t + i * 0.09, 0.45, 0.26)); }),
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
  // speaks only when the device has a Persian voice; an English voice would mispronounce the word
  function speak(text) {
    if (!Audio_.on || !window.speechSynthesis || !faVoice) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text).replace(/‌/g, ' '));
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

  /* ---------- scenery ---------- */

  const TW = 900; // every layer repeats every 900 px
  const sr = mulberry(11);
  const rr = (x, y, w, h, r) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); };
  const circle = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
  const FLOWERS = ['#ffffff', '#ffe066', '#ff9ec4'];
  const GREENS = ['#7fbf4d', '#6aae3d', '#8ccb5a', '#5e9e36'];

  // random layouts, made once
  const L = {
    clouds: Array.from({ length: 4 }, (_, i) => ({ x: i * 225 + sr() * 70, y: 70 + sr() * 120, s: 0.7 + sr() * 0.6 })),
    trees: [], stones: [], bushes: [], tufts: [],
    hills: Array.from({ length: 5 }, (_, i) => ({ x: i * 190 + sr() * 40, w: 150 + sr() * 90, h: 70 + sr() * 50, c: ['#c9d77a', '#b8cc66', '#d6df8a'][i % 3] })),
    mountains: [{ x: 120, w: 330, h: 250, big: true }, { x: 420, w: 220, h: 150 }, { x: 640, w: 260, h: 190 }, { x: 830, w: 200, h: 120 }],
    pines: [], palms: [], skyline: [], posts: [], stars: [], crystals: [], orbs: [],
  };
  for (let x = 30; x < TW; x += 120 + sr() * 80) L.trees.push({ x, h: 120 + sr() * 70, r: 44 + sr() * 22, c: sr() < 0.22 ? '#e9c84a' : GREENS[Math.floor(sr() * GREENS.length)] });
  for (let row = 0; row < 2; row++) {
    let x = -row * 30;
    while (x < TW) { const w = 46 + sr() * 26; L.stones.push({ x, row, w, c: ['#b9b4a6', '#a8a496', '#c7c2b3', '#b2ad9d'][Math.floor(sr() * 4)] }); x += w + 3; }
  }
  for (let x = 0; x < TW; x += 38 + sr() * 30) L.bushes.push({ x, r: 20 + sr() * 14, c: GREENS[Math.floor(sr() * GREENS.length)], flower: sr() < 0.5 ? pick(FLOWERS) : null });
  for (let x = 0; x < TW; x += 26 + sr() * 40) L.tufts.push({ x, y: 14 + sr() * 70, flower: sr() < 0.35 ? pick(FLOWERS) : null });
  for (let x = 20; x < TW; x += 70 + sr() * 50) L.pines.push({ x, h: 80 + sr() * 50 });
  for (let x = 60; x < TW; x += 250 + sr() * 90) L.palms.push({ x, h: 120 + sr() * 40, lean: sr() * 30 - 15 });
  for (let x = 0; x < TW; x += 46 + sr() * 36) L.skyline.push({ x, w: 40 + sr() * 34, h: 70 + sr() * 150 });
  for (let x = 40; x < TW; x += 200 + sr() * 60) L.posts.push({ x });
  for (let i = 0; i < 70; i++) L.stars.push({ x: sr() * TW, y: sr() * 330, r: 0.8 + sr() * 1.6, p: sr() * 6 });
  for (let x = 10; x < TW; x += 90 + sr() * 70) L.crystals.push({ x, h: 90 + sr() * 100, c: sr() < 0.5 ? 'rgba(120,230,255,.55)' : 'rgba(255,150,220,.55)' });
  for (let i = 0; i < 6; i++) L.orbs.push({ x: i * 160 + sr() * 60, y: 90 + sr() * 200, r: 26 + sr() * 40, c: ['rgba(255,220,120,.35)', 'rgba(150,230,255,.3)', 'rgba(255,160,230,.3)'][i % 3] });

  function tiled(offset, fn) {
    const start = -(((offset % TW) + TW) % TW);
    for (let ox = start; ox < W + 40; ox += TW) fn(ox);
  }
  function skyFill(top, bottom) {
    const g = ctx.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function clouds(dist, color) {
    tiled(dist * 0.06, (ox) => L.clouds.forEach((c) => {
      ctx.fillStyle = color;
      const x = ox + c.x, y = c.y;
      ctx.beginPath();
      ctx.arc(x, y, 22 * c.s, 0, 7); ctx.arc(x + 24 * c.s, y - 8 * c.s, 28 * c.s, 0, 7); ctx.arc(x + 52 * c.s, y, 20 * c.s, 0, 7);
      ctx.fill();
    }));
  }
  function groundFill(top, bottom, path) {
    const g = ctx.createLinearGradient(0, GROUND - 30, 0, H);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    ctx.fillStyle = g; ctx.fillRect(0, GROUND - 30, W, H - GROUND + 30);
    if (path) { ctx.fillStyle = path; ctx.fillRect(0, GROUND - 4, W, 60); }
  }
  function grassTufts(dist, color, flowerChance) {
    tiled(dist, (ox) => L.tufts.forEach((t) => {
      const x = ox + t.x, y = GROUND + 8 + t.y;
      ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x - 7, y - 9); ctx.moveTo(x, y); ctx.lineTo(x, y - 12); ctx.moveTo(x + 5, y); ctx.lineTo(x + 7, y - 9); ctx.stroke();
      if (t.flower && flowerChance) { ctx.fillStyle = t.flower; circle(x, y - 14, 4); ctx.fillStyle = '#f6b500'; circle(x, y - 14, 1.6); }
    }));
  }

  // each scenery: how the sky, the far and near layers and the ground look, and which obstacles it has
  const THEMES = {
    garden: {
      kinds: ['rock', 'log', 'bush', 'basket'], rock: '#9b9a97',
      draw(dist) {
        skyFill('#bfe7ff', '#eaf8ff');
        clouds(dist, 'rgba(255,255,255,.85)');
        tiled(dist * 0.2, (ox) => L.trees.forEach((t) => {
          const x = ox + t.x, base = GROUND - 90;
          ctx.fillStyle = '#9a7650'; ctx.fillRect(x - 7, base - t.h, 14, t.h);
          ctx.fillStyle = t.c;
          ctx.beginPath(); ctx.arc(x, base - t.h - 6, t.r, 0, 7); ctx.arc(x - t.r * 0.7, base - t.h + 10, t.r * 0.7, 0, 7); ctx.arc(x + t.r * 0.7, base - t.h + 10, t.r * 0.7, 0, 7); ctx.fill();
        }));
        const wallTop = GROUND - 104;
        ctx.fillStyle = '#8f8b7e'; ctx.fillRect(0, wallTop, W, 78);
        tiled(dist * 0.5, (ox) => L.stones.forEach((s) => { ctx.fillStyle = s.c; rr(ox + s.x, wallTop + 2 + s.row * 38, s.w, 34, 9); ctx.fill(); }));
        tiled(dist * 0.7, (ox) => L.bushes.forEach((b) => {
          ctx.fillStyle = b.c; circle(ox + b.x, GROUND - 30, b.r);
          if (b.flower) { ctx.fillStyle = b.flower; circle(ox + b.x + 5, GROUND - 36 - b.r * 0.3, 3.5); }
        }));
        groundFill('#93cc5c', '#6fae3f', 'rgba(255,255,255,.22)');
        grassTufts(dist, '#5e9e36', true);
      },
    },
    farm: {
      kinds: ['hay', 'crate', 'bucket', 'log'], rock: '#a39a86',
      draw(dist) {
        skyFill('#ffe6b0', '#fff7de');
        ctx.fillStyle = '#ffd766'; circle(W * 0.8, 110, 46); ctx.fillStyle = 'rgba(255,215,102,.35)'; circle(W * 0.8, 110, 66);
        clouds(dist, 'rgba(255,255,255,.8)');
        tiled(dist * 0.12, (ox) => L.hills.forEach((h) => { ctx.fillStyle = h.c; ctx.beginPath(); ctx.ellipse(ox + h.x, GROUND - 70, h.w, h.h, 0, Math.PI, 2 * Math.PI); ctx.fill(); }));
        // windmill
        tiled(dist * 0.18, (ox) => {
          const x = ox + 520, base = GROUND - 100;
          ctx.fillStyle = '#d9c7a4'; ctx.beginPath(); ctx.moveTo(x - 26, base); ctx.lineTo(x - 16, base - 90); ctx.lineTo(x + 16, base - 90); ctx.lineTo(x + 26, base); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#b5523b'; ctx.beginPath(); ctx.moveTo(x - 22, base - 88); ctx.lineTo(x, base - 120); ctx.lineTo(x + 22, base - 88); ctx.closePath(); ctx.fill();
          ctx.save(); ctx.translate(x, base - 96); ctx.rotate(dist * 0.004);
          ctx.fillStyle = '#f1e7d0';
          for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.fillRect(-4, -62, 8, 58); ctx.fillStyle = '#fffaf0'; ctx.fillRect(-14, -60, 12, 40); ctx.fillStyle = '#f1e7d0'; }
          ctx.restore();
        });
        // wheat field and fence
        ctx.fillStyle = '#d9bf4f'; ctx.fillRect(0, GROUND - 60, W, 40);
        tiled(dist * 0.5, (ox) => { for (let x = 0; x < TW; x += 14) { ctx.strokeStyle = '#c9a63a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ox + x, GROUND - 22); ctx.lineTo(ox + x + 3, GROUND - 60 - ((x * 7) % 9)); ctx.stroke(); } });
        tiled(dist * 0.7, (ox) => {
          ctx.fillStyle = '#a47a4a'; ctx.fillRect(ox, GROUND - 58, TW, 7); ctx.fillRect(ox, GROUND - 40, TW, 7);
          for (let x = 0; x < TW; x += 60) { ctx.fillStyle = '#8f6a3c'; ctx.fillRect(ox + x, GROUND - 70, 9, 52); }
        });
        groundFill('#b9d46a', '#8fb546', 'rgba(255,255,255,.2)');
        grassTufts(dist, '#7a9c36', false);
        tiled(dist, (ox) => L.tufts.forEach((t) => { if (t.flower) { ctx.fillStyle = '#ffb62e'; circle(ox + t.x, GROUND + 6 + t.y, 4); ctx.fillStyle = '#7a4a1c'; circle(ox + t.x, GROUND + 6 + t.y, 1.8); } }));
      },
    },
    beach: {
      kinds: ['sandcastle', 'crab', 'driftwood', 'rock'], rock: '#b6aea0',
      draw(dist) {
        skyFill('#9edcff', '#e8f9ff');
        ctx.fillStyle = '#fff3b0'; circle(W * 0.2, 100, 40); ctx.fillStyle = 'rgba(255,243,176,.4)'; circle(W * 0.2, 100, 60);
        clouds(dist, 'rgba(255,255,255,.9)');
        const sea = ctx.createLinearGradient(0, GROUND - 170, 0, GROUND - 96);
        sea.addColorStop(0, '#53b8ee'); sea.addColorStop(1, '#9ad9f5');
        ctx.fillStyle = sea; ctx.fillRect(0, GROUND - 170, W, 74);
        tiled(dist * 0.25, (ox) => { for (let x = 0; x < TW; x += 70) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ox + x, GROUND - 130 + (x % 3) * 10, 12, Math.PI, 2 * Math.PI); ctx.stroke(); } });
        tiled(dist * 0.15, (ox) => { // a little sailing boat
          const x = ox + 600, y = GROUND - 150;
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x, y - 46); ctx.lineTo(x + 24, y); ctx.lineTo(x, y); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#e65a4f'; ctx.beginPath(); ctx.moveTo(x - 20, y + 2); ctx.lineTo(x + 28, y + 2); ctx.lineTo(x + 20, y + 14); ctx.lineTo(x - 12, y + 14); ctx.closePath(); ctx.fill();
        });
        ctx.fillStyle = '#f1dba0'; ctx.fillRect(0, GROUND - 96, W, 70);
        tiled(dist * 0.55, (ox) => L.palms.forEach((p) => { // palm trees
          const x = ox + p.x, base = GROUND - 30;
          ctx.strokeStyle = '#9a6b3c'; ctx.lineWidth = 9; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x + p.lean * 0.4, base - p.h * 0.5, x + p.lean, base - p.h); ctx.stroke();
          ctx.fillStyle = '#4fa34a';
          for (let i = 0; i < 6; i++) { ctx.save(); ctx.translate(x + p.lean, base - p.h); ctx.rotate(-1.4 + i * 0.56); ctx.beginPath(); ctx.ellipse(34, 0, 36, 9, 0, 0, 7); ctx.fill(); ctx.restore(); }
        }));
        groundFill('#f4dfa6', '#e2c27a', 'rgba(255,255,255,.25)');
        tiled(dist, (ox) => L.tufts.forEach((t) => {
          const x = ox + t.x, y = GROUND + 8 + t.y;
          ctx.fillStyle = t.flower ? '#f7a8b8' : '#d9b56a'; circle(x, y, t.flower ? 4 : 2.5);
          if (t.flower) { ctx.fillStyle = '#fff'; circle(x - 1, y - 1, 1.5); }
        }));
      },
    },
    snow: {
      kinds: ['icecube', 'snowpile', 'pine', 'rock'], rock: '#aeb7c4',
      draw(dist) {
        skyFill('#b9d3f0', '#eef5ff');
        tiled(dist * 0.1, (ox) => L.mountains.forEach((m) => {
          ctx.fillStyle = m.big ? '#7d8fb3' : '#92a3c4';
          ctx.beginPath(); ctx.moveTo(ox + m.x - m.w / 2, GROUND - 90); ctx.lineTo(ox + m.x + (m.big ? 0 : 10), GROUND - 90 - m.h); ctx.lineTo(ox + m.x + m.w / 2, GROUND - 90); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ffffff';
          const capH = m.h * 0.28;
          ctx.beginPath(); ctx.moveTo(ox + m.x + (m.big ? 0 : 10), GROUND - 90 - m.h); ctx.lineTo(ox + m.x + (m.big ? 0 : 10) - m.w * 0.12, GROUND - 90 - m.h + capH); ctx.lineTo(ox + m.x + (m.big ? 0 : 10) + m.w * 0.12, GROUND - 90 - m.h + capH); ctx.closePath(); ctx.fill();
        }));
        tiled(dist * 0.45, (ox) => L.pines.forEach((p) => {
          const x = ox + p.x, base = GROUND - 30;
          ctx.fillStyle = '#6b4f3a'; ctx.fillRect(x - 4, base - 14, 8, 14);
          for (let i = 0; i < 3; i++) {
            const y = base - 14 - i * (p.h * 0.28), w = 34 - i * 7;
            ctx.fillStyle = '#3f8a5a'; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x, y - p.h * 0.38); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x - w * 0.5, y - p.h * 0.17); ctx.lineTo(x, y - p.h * 0.38); ctx.lineTo(x + w * 0.5, y - p.h * 0.17); ctx.closePath(); ctx.fill();
          }
        }));
        groundFill('#f4f8ff', '#cfe0f5', 'rgba(255,255,255,.5)');
        tiled(dist, (ox) => L.tufts.forEach((t) => {
          const x = ox + t.x, y = GROUND + 8 + t.y;
          ctx.strokeStyle = t.flower ? '#fff' : 'rgba(150,180,220,.8)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 6); ctx.stroke();
        }));
        // snow falling
        if (!RM) {
          ctx.fillStyle = 'rgba(255,255,255,.9)';
          for (let i = 0; i < 40; i++) { const t = (G ? G.time : 0) * 40 + i * 53; circle(((i * 97 + t * 0.4) % (W + 20)), ((t * 1.3 + i * 71) % (GROUND - 20)), 1.8 + (i % 3) * 0.6); }
        }
      },
    },
    city: {
      kinds: ['cone', 'barrel', 'bench', 'crate'], rock: '#7b8299', rim: true,
      draw(dist) {
        skyFill('#171c4a', '#5b4b9c');
        tiled(0, (ox) => L.stars.forEach((s) => { ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin((G ? G.time : 0) * 2 + s.p)})`; circle(ox + s.x, s.y, s.r); }));
        ctx.fillStyle = '#fff6c9'; circle(W * 0.78, 100, 34); ctx.fillStyle = 'rgba(255,246,201,.25)'; circle(W * 0.78, 100, 56);
        tiled(dist * 0.18, (ox) => L.skyline.forEach((b) => {
          ctx.fillStyle = '#2b2f6b'; ctx.fillRect(ox + b.x, GROUND - 100 - b.h, b.w, b.h + 70);
          ctx.fillStyle = '#ffd86a';
          for (let y = GROUND - 90 - b.h; y < GROUND - 60; y += 22) for (let x = ox + b.x + 6; x < ox + b.x + b.w - 8; x += 14) if (((x * 7 + y * 3) | 0) % 5 > 1) ctx.fillRect(x, y, 6, 9);
        }));
        tiled(dist * 0.55, (ox) => L.posts.forEach((p) => {
          const x = ox + p.x;
          ctx.fillStyle = '#1d2250'; ctx.fillRect(x - 3, GROUND - 130, 6, 104);
          ctx.fillStyle = 'rgba(255,226,140,.28)'; circle(x, GROUND - 134, 34);
          ctx.fillStyle = '#ffe28c'; circle(x, GROUND - 134, 9);
        }));
        groundFill('#46507a', '#2a3057', 'rgba(255,255,255,.06)');
        ctx.fillStyle = '#9aa3c8'; ctx.fillRect(0, GROUND - 6, W, 5);
        tiled(dist, (ox) => { for (let x = 0; x < TW; x += 90) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(ox + x, GROUND + 70, 46, 6); } });
      },
    },
    magic: {
      kinds: ['mushroom', 'crystal', 'gift', 'rock'], rock: '#8a76b4', rim: true,
      draw(dist) {
        skyFill('#4a2f84', '#f092c4');
        tiled(dist * 0.08, (ox) => L.orbs.forEach((o) => { ctx.fillStyle = o.c; circle(ox + o.x, o.y, o.r); }));
        tiled(0, (ox) => L.stars.forEach((s) => { ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.5 * Math.sin((G ? G.time : 0) * 2.4 + s.p)})`; circle(ox + s.x, s.y * 0.8, s.r); }));
        tiled(dist * 0.25, (ox) => L.crystals.forEach((c) => {
          ctx.fillStyle = c.c;
          ctx.beginPath(); ctx.moveTo(ox + c.x - 16, GROUND - 90); ctx.lineTo(ox + c.x, GROUND - 90 - c.h); ctx.lineTo(ox + c.x + 16, GROUND - 90); ctx.closePath(); ctx.fill();
        }));
        tiled(dist * 0.55, (ox) => L.bushes.forEach((b, i) => {
          const x = ox + b.x;
          ctx.fillStyle = '#e8d9ff'; ctx.fillRect(x - 3, GROUND - 56, 6, 26);
          ctx.fillStyle = i % 2 ? '#ff7fb8' : '#7fd8ff'; ctx.beginPath(); ctx.ellipse(x, GROUND - 56, 18, 12, 0, Math.PI, 2 * Math.PI); ctx.fill();
          ctx.fillStyle = '#fff'; circle(x - 6, GROUND - 62, 2.2); circle(x + 6, GROUND - 60, 2.2);
        }));
        groundFill('#7a5fc2', '#4e3a93', 'rgba(255,255,255,.1)');
        tiled(dist, (ox) => L.tufts.forEach((t, i) => {
          const x = ox + t.x, y = GROUND + 8 + t.y;
          ctx.fillStyle = i % 2 ? '#ffe9a8' : '#bff0ff'; ctx.beginPath();
          for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, r = k % 2 ? 2 : 5; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
          ctx.closePath(); ctx.fill();
        }));
      },
    },
  };

  /* ---------- things on the road ---------- */

  const OBS = {
    rock(x, y, t) {
      ctx.fillStyle = t.rock;
      ctx.beginPath(); ctx.moveTo(x - 27, y); ctx.quadraticCurveTo(x - 30, y - 34, x - 6, y - 40); ctx.quadraticCurveTo(x + 26, y - 42, x + 28, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.ellipse(x - 8, y - 28, 9, 5, -0.5, 0, 7); ctx.fill();
    },
    log(x, y) {
      ctx.fillStyle = '#9a6a3d'; rr(x - 33, y - 36, 66, 36, 12); ctx.fill();
      ctx.fillStyle = '#c99763'; ctx.beginPath(); ctx.ellipse(x + 26, y - 18, 9, 17, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#9a6a3d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x + 26, y - 18, 4, 9, 0, 0, 7); ctx.stroke();
    },
    bush(x, y) {
      ctx.fillStyle = '#4f9a30';
      ctx.beginPath(); ctx.arc(x - 18, y - 22, 22, 0, 7); ctx.arc(x + 4, y - 32, 26, 0, 7); ctx.arc(x + 22, y - 20, 21, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff7a8a';
      [[-12, -30], [10, -40], [24, -22], [-2, -18]].forEach(([dx, dy]) => circle(x + dx, y + dy, 3.5));
    },
    basket(x, y) { // the picnic basket with a book, like in the book's picture
      ctx.fillStyle = '#4aa0dc'; ctx.save(); ctx.translate(x - 4, y - 42); ctx.rotate(-0.12); rr(-14, -14, 30, 34, 3); ctx.fill();
      ctx.fillStyle = '#ffd24d'; ctx.fillRect(-10, -4, 22, 8); ctx.restore();
      ctx.fillStyle = '#c48a4a';
      ctx.beginPath(); ctx.moveTo(x - 28, y - 36); ctx.lineTo(x + 28, y - 36); ctx.lineTo(x + 22, y); ctx.lineTo(x - 22, y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#a06c32'; ctx.lineWidth = 2;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(x + i * 8, y - 36); ctx.lineTo(x + i * 7, y); ctx.stroke(); }
      for (let j = 1; j < 4; j++) { ctx.beginPath(); ctx.moveTo(x - 26 + j, y - j * 9); ctx.lineTo(x + 26 - j, y - j * 9); ctx.stroke(); }
      ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y - 36, 24, Math.PI, 0); ctx.stroke();
    },
    hay(x, y) {
      ctx.fillStyle = '#e4bd4c'; rr(x - 28, y - 50, 56, 50, 10); ctx.fill();
      ctx.strokeStyle = '#b88f26'; ctx.lineWidth = 2;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(x + i * 8, y - 48); ctx.lineTo(x + i * 8 + 3, y - 4); ctx.stroke(); }
      ctx.fillStyle = '#a86a3a'; ctx.fillRect(x - 28, y - 34, 56, 5); ctx.fillRect(x - 28, y - 16, 56, 5);
    },
    crate(x, y) {
      ctx.fillStyle = '#b98550'; rr(x - 26, y - 48, 52, 48, 4); ctx.fill();
      ctx.strokeStyle = '#8a5d30'; ctx.lineWidth = 4; rr(x - 24, y - 46, 48, 44, 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 24, y - 46); ctx.lineTo(x + 24, y - 2); ctx.moveTo(x + 24, y - 46); ctx.lineTo(x - 24, y - 2); ctx.stroke();
    },
    bucket(x, y) {
      ctx.strokeStyle = '#6b7b8c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - 44, 18, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = '#4a90d9'; ctx.beginPath(); ctx.moveTo(x - 22, y - 44); ctx.lineTo(x + 22, y - 44); ctx.lineTo(x + 16, y); ctx.lineTo(x - 16, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(x - 14, y - 40, 6, 34);
    },
    crab(x, y) {
      ctx.strokeStyle = '#d6453a'; ctx.lineWidth = 3;
      for (let i = -2; i <= 2; i += 2) { ctx.beginPath(); ctx.moveTo(x + i * 8, y - 12); ctx.lineTo(x + i * 12, y - 1); ctx.stroke(); }
      ctx.fillStyle = '#e8584a'; ctx.beginPath(); ctx.ellipse(x, y - 15, 22, 14, 0, 0, 7); ctx.fill();
      circle(x - 22, y - 28, 8); circle(x + 22, y - 28, 8);
      ctx.fillStyle = '#fff'; circle(x - 7, y - 28, 4); circle(x + 7, y - 28, 4);
      ctx.fillStyle = '#222'; circle(x - 7, y - 28, 2); circle(x + 7, y - 28, 2);
    },
    sandcastle(x, y) {
      ctx.fillStyle = '#e0bf7a'; ctx.fillRect(x - 28, y - 30, 56, 30);
      [-22, 0, 22].forEach((dx) => { ctx.fillRect(x + dx - 9, y - 50, 18, 24); });
      ctx.fillStyle = '#c9a45e'; [-22, 0, 22].forEach((dx) => { for (let i = -1; i <= 1; i += 2) ctx.fillRect(x + dx + i * 5 - 2, y - 56, 4, 6); });
      ctx.fillStyle = '#b07a3a'; ctx.fillRect(x - 1, y - 74, 2, 20);
      ctx.fillStyle = '#e8584a'; ctx.beginPath(); ctx.moveTo(x + 1, y - 74); ctx.lineTo(x + 14, y - 69); ctx.lineTo(x + 1, y - 64); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a07a40'; rr(x - 7, y - 16, 14, 16, 7); ctx.fill();
    },
    driftwood(x, y) {
      ctx.fillStyle = '#a9927a'; rr(x - 35, y - 26, 70, 26, 13); ctx.fill();
      ctx.fillStyle = '#8c7660'; ctx.beginPath(); ctx.ellipse(x - 12, y - 14, 5, 3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#c9b49b'; ctx.fillRect(x - 26, y - 22, 40, 3);
    },
    icecube(x, y) {
      ctx.fillStyle = 'rgba(160,215,255,.95)'; rr(x - 25, y - 46, 50, 46, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; rr(x - 22, y - 43, 44, 40, 6); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x - 15, y - 38, 6, 22);
    },
    snowpile(x, y) {
      ctx.fillStyle = '#c5d6ec'; ctx.beginPath(); ctx.ellipse(x + 4, y - 4, 32, 10, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x - 31, y); ctx.quadraticCurveTo(x - 24, y - 44, x + 2, y - 42); ctx.quadraticCurveTo(x + 28, y - 40, x + 31, y); ctx.closePath(); ctx.fill();
    },
    pine(x, y) {
      ctx.fillStyle = '#6b4f3a'; ctx.fillRect(x - 4, y - 12, 8, 12);
      for (let i = 0; i < 3; i++) {
        const yy = y - 10 - i * 15, w = 24 - i * 5;
        ctx.fillStyle = '#3f8a5a'; ctx.beginPath(); ctx.moveTo(x - w, yy); ctx.lineTo(x, yy - 26); ctx.lineTo(x + w, yy); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x - w * 0.55, yy - 11); ctx.lineTo(x, yy - 26); ctx.lineTo(x + w * 0.55, yy - 11); ctx.closePath(); ctx.fill();
      }
    },
    cone(x, y) {
      ctx.fillStyle = '#2b2f55'; rr(x - 20, y - 6, 40, 6, 2); ctx.fill();
      ctx.fillStyle = '#ff8a2b'; ctx.beginPath(); ctx.moveTo(x - 16, y - 6); ctx.lineTo(x, y - 52); ctx.lineTo(x + 16, y - 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x - 9, y - 26); ctx.lineTo(x + 9, y - 26); ctx.lineTo(x + 6, y - 36); ctx.lineTo(x - 6, y - 36); ctx.closePath(); ctx.fill();
    },
    barrel(x, y) {
      ctx.fillStyle = '#c0453b'; rr(x - 23, y - 52, 46, 52, 10); ctx.fill();
      ctx.fillStyle = '#e0e0e8'; ctx.fillRect(x - 23, y - 38, 46, 6); ctx.fillRect(x - 23, y - 18, 46, 6);
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x - 16, y - 48, 5, 44);
    },
    bench(x, y) {
      ctx.fillStyle = '#8a5d30'; ctx.fillRect(x - 33, y - 44, 66, 8); ctx.fillRect(x - 33, y - 30, 66, 8);
      ctx.fillStyle = '#5a3d1e'; ctx.fillRect(x - 30, y - 24, 7, 24); ctx.fillRect(x + 23, y - 24, 7, 24); ctx.fillRect(x - 30, y - 44, 7, 20); ctx.fillRect(x + 23, y - 44, 7, 20);
    },
    mushroom(x, y) {
      ctx.fillStyle = '#f3e8d8'; rr(x - 9, y - 30, 18, 30, 6); ctx.fill();
      ctx.fillStyle = '#e24a8a'; ctx.beginPath(); ctx.ellipse(x, y - 30, 26, 22, 0, Math.PI, 2 * Math.PI); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; circle(x - 10, y - 40, 4); circle(x + 8, y - 44, 4.5); circle(x + 14, y - 34, 3);
    },
    crystal(x, y) {
      ctx.fillStyle = '#7fe6ff'; ctx.beginPath(); ctx.moveTo(x - 20, y); ctx.lineTo(x - 12, y - 36); ctx.lineTo(x, y - 56); ctx.lineTo(x + 12, y - 36); ctx.lineTo(x + 20, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.moveTo(x - 8, y - 4); ctx.lineTo(x - 5, y - 34); ctx.lineTo(x, y - 50); ctx.lineTo(x - 2, y - 12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff9ee0'; ctx.beginPath(); ctx.moveTo(x + 8, y); ctx.lineTo(x + 14, y - 22); ctx.lineTo(x + 22, y); ctx.closePath(); ctx.fill();
    },
    gift(x, y) {
      ctx.fillStyle = '#ff6f9c'; rr(x - 25, y - 40, 50, 40, 5); ctx.fill();
      ctx.fillStyle = '#ffe28c'; ctx.fillRect(x - 4, y - 40, 8, 40); ctx.fillRect(x - 25, y - 24, 50, 7);
      ctx.beginPath(); ctx.ellipse(x - 8, y - 46, 9, 6, -0.4, 0, 7); ctx.ellipse(x + 8, y - 46, 9, 6, 0.4, 0, 7); ctx.fill();
    },
  };

  function drawObstacle(e, theme) {
    ctx.save();
    ctx.fillStyle = 'rgba(30,40,30,.18)';
    ctx.beginPath(); ctx.ellipse(e.x, GROUND, e.w * 0.6, 7, 0, 0, 7); ctx.fill();
    (OBS[e.kind] || OBS.rock)(e.x, GROUND, theme);
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
    circle(0, 0, 13);
    ctx.strokeStyle = '#c98a05'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.stroke();
    ctx.restore();
  }

  function drawLetter(e, t) {
    const y = GROUND - e.h + Math.sin(t * 2.6 + e.x * 0.01) * 4;
    ctx.save();
    ctx.translate(e.x, y);
    ctx.shadowColor = 'rgba(40,60,20,.3)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#fffaf0';
    circle(0, 0, 30);
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

  let spawner = Spawn.createSpawner({});
  const letterIndex = (ch) => LD.LETTERS.findIndex((l) => l.ch === ch);
  let session = WP.createSession({ data: WD, level: 1 });

  let G = null;          // the run in progress
  let mode = 'menu';     // menu | play | pause | over
  let last = 0;
  let selected = store.get('char', 'boy');
  let startLevel = store.get('level', 1);
  const lettersOk = store.get('lettersOk', {});

  const leaderX = () => clamp(W * 0.5, 176, 300);
  const themeOf = () => THEMES[session.extra().theme];

  function newRun(kind, level) {
    selected = kind;
    store.set('char', kind);
    startLevel = level || startLevel;
    store.set('level', startLevel);
    spawner = Spawn.createSpawner({});
    session = WP.createSession({ data: WD, level: startLevel });
    G = {
      kind, other: kind === 'boy' ? 'girl' : 'boy',
      dist: 0, time: 0, speed: 200, speedMul: session.info().speed, coins: 0, ok: 0, bad: 0,
      y: 0, vy: 0, jumps: 0, hist: [], gap: GAP_START, invuln: 0, hurt: 0, slow: 0, shake: 0,
      entities: [], parts: [], spawnIn: 260, anim: 0, overT: 0, caught: false, cheer: 0,
      theme: themeOf(), trans: null, wordPause: 0, doneWords: [], gateSeq: 0, cardShake: 0,
    };
    $('coins').textContent = fa(0);
    setMode('play');
    renderCard('play');
    announceWord(true);
  }

  function setMode(m) {
    mode = m;
    $('menu').hidden = m !== 'menu';
    $('pause').hidden = m !== 'pause';
    $('over').hidden = m !== 'over';
    $('hud').hidden = !(m === 'play' || m === 'pause');
  }

  /* ---------- the word card ---------- */

  function slotSize(n) {
    const card = Math.min(stage.clientWidth - 32, 440);
    return clamp(Math.floor((card - 44 - 28 - (n - 1) * 5) / n), 24, 46);
  }

  // state: 'play' shows the empty slots filling up, 'done' shows the finished, connected word
  function renderCard(state) {
    const w = session.word, info = session.info(), helps = info.helps;
    $('lvlNum').textContent = 'مرحله ' + fa(session.level);
    $('lvlName').textContent = info.name;
    $('rdots').innerHTML = Array.from({ length: session.extra().words }, (_, i) => `<i class="${i < session.doneInRound ? 'on' : ''}"></i>`).join('');
    const we = $('we');
    we.hidden = !helps.image;
    we.textContent = helps.image ? (w.emoji || '❓') : '';
    const slots = $('slots');
    if (state === 'done') {
      const notes = WP.joinNotes(w);
      const inner = Array.from(w.display).map((c, i, arr) => {
        if (c === WP.ZWNJ) return c;
        const idx = arr.slice(0, i).filter((x) => x !== WP.ZWNJ).length;
        return idx < w.letters.length - 1 && WP.isNonJoiner(c) ? `<b class="nj">${c}</b>` : c;
      }).join('');
      slots.innerHTML = `<span class="conn">${inner}</span>`;
      $('wh').textContent = notes.length ? '«' + notes.join('» و «') + '» به حرف بعدی نمی‌چسبن' : 'همه‌ی حرف‌ها به هم چسبیدن!';
      return;
    }
    const n = w.letters.length, ss = slotSize(n);
    slots.style.setProperty('--ss', ss + 'px');
    slots.innerHTML = w.letters.map((ch, i) => {
      const filled = i < session.slot;
      const ghost = !filled && helps.ghost;
      return `<i class="slot${filled ? ' on' : ''}${i === session.slot ? ' cur' : ''}${ghost ? ' ghost' : ''}">${filled || ghost ? ch : ''}</i>`;
    }).join('');
    $('wh').textContent = helps.hint ? w.hint : '';
  }

  function announceWord(first) {
    const w = session.word, info = session.info();
    if (first) banner('مرحله ' + fa(session.level) + ': ' + info.name, 'بیا کلمه رو بسازیم!');
    if (info.helps.audio) speak(w.display);
  }

  function banner(text, small) {
    const b = $('banner');
    b.innerHTML = text + (small ? `<small>${small}</small>` : '');
    if (b.animate && !RM) {
      b.animate([{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'scale(1.06)', offset: 0.15 }, { opacity: 1, transform: 'scale(1)', offset: 0.8 }, { opacity: 0, transform: 'translateY(-10px)' }], { duration: 2000, easing: 'ease-out' });
    } else { b.style.opacity = 1; setTimeout(() => { b.style.opacity = 0; }, 1600); }
  }

  function shakeCard() {
    const c = $('card');
    if (c.animate && !RM) c.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }], { duration: 260 });
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

  function yAt(tNow) { // the leader's height a moment ago, for the follower
    const hist = G.hist;
    if (!hist.length) return 0;
    for (let i = hist.length - 1; i >= 0; i--) if (hist[i].t <= tNow) return hist[i].y;
    return hist[0].y;
  }

  function collectCoin(e) {
    e.dead = true;
    G.coins++;
    Audio_.coin();
    burst(e.x, GROUND - e.h, 4, ['#ffe27a', '#fff'], { kinds: ['star'], speed: 140 });
    $('coins').textContent = fa(G.coins);
  }

  function collectLetter(e, byLeader) {
    if (G.wordPause > 0) return;
    if (e.ch === session.needed()) {
      const res = session.pick(e.ch);
      G.ok++;
      G.coins += 10;
      G.gap = Math.min(GAP_MAX, G.gap + 16);
      lettersOk[e.ch] = (lettersOk[e.ch] || 0) + 1;
      store.set('lettersOk', lettersOk);
      // the other letters of this gate disappear
      G.entities.forEach((x) => { if (x.t === 'letter' && x.gate === e.gate) { x.dead = true; if (x !== e) burst(x.x, GROUND - x.h, 5, ['#fff', '#cfd8dc'], { kinds: ['dot'], speed: 90 }); } });
      burst(e.x, GROUND - e.h, 16, ['#ffd23f', '#ff9aa2', '#8fd6c3', '#fff'], { speed: 260 });
      $('coins').textContent = fa(G.coins);
      if (res.wordDone) wordDone(e);
      else { Audio_.good(); floatText(e.x, GROUND - e.h - 30, 'آفرین! +۱۰', '#ffe27a'); renderCard('play'); }
    } else if (byLeader) {
      e.dead = true;
      G.bad++;
      Audio_.bad();
      shakeCard();
      floatText(e.x, GROUND - e.h - 30, 'نه، این «' + e.ch + '» بود', '#ffffff');
      burst(e.x, GROUND - e.h, 6, ['#cfd8dc', '#fff'], { kinds: ['dot'], speed: 120 });
    }
  }

  function wordDone(e) {
    const w = session.word;
    G.doneWords.push(w.display);
    G.cheer = 1.4;
    G.wordPause = WORD_PAUSE;
    Audio_.cheer();
    renderCard('done');
    banner('آفرین! ' + w.emoji, w.display);
    speak(w.display);
    burst(leaderX(), GROUND - 80, 24, ['#ffd23f', '#ff9aa2', '#8fd6c3', '#fff'], { speed: 300 });
  }

  function afterWord() {
    const r = session.advance();
    if (r === 'level') levelUp();
    renderCard('play');
    announceWord(false);
  }

  function levelUp() {
    const info = session.info();
    Audio_.level();
    store.set('bestLevel', Math.max(store.get('bestLevel', 1), session.level));
    G.trans = { t: 0, to: themeOf() };
    banner('مرحله ' + fa(session.level) + ': ' + info.name, 'سریع‌تر و سخت‌تر!');
  }

  function hit() {
    G.invuln = 1.3; G.hurt = 0.6; G.slow = 0.35; G.shake = 0.3;
    G.gap -= GAP_HIT;
    Audio_.hit();
    burst(leaderX(), GROUND - 40, 10, ['#ffffff', '#ffd9a8'], { kinds: ['dot'], speed: 160 });
    if (G.gap <= GAP_MIN) gameOver();
  }

  function update(dt) {
    G.time += dt;
    if (G.trans) { // scenery change: the screen fades out, the scenery switches, the screen fades in
      G.trans.t += dt / 1.1;
      if (G.trans.t >= 0.5 && G.theme !== G.trans.to) G.theme = G.trans.to;
      if (G.trans.t >= 1) G.trans = null;
    }
    if (G.caught) {
      G.overT += dt;
      G.parts.forEach((p) => { p.age += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; });
      G.parts = G.parts.filter((p) => p.age < p.life);
      if (G.overT > 1.1 && mode === 'play') showOver();
      return;
    }
    if (G.wordPause > 0) { G.wordPause -= dt; if (G.wordPause <= 0) afterWord(); }
    G.speedMul += (session.info().speed - G.speedMul) * Math.min(1, dt * 1.5);
    G.speed = (200 + Math.min(G.time, 80) * 1.2) * G.speedMul;
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
      const extra = session.extra();
      const noGate = G.wordPause > 0 || G.entities.some((e) => e.t === 'letter' && !e.dead);
      const pat = spawner.next({ speed: G.speed, dist: G.dist, letters: session.gateLetters(), kinds: THEMES[extra.theme].kinds, gateEvery: extra.gateEvery, noGate });
      const x0 = W + 80;
      if (pat.kind === 'gate') G.gateSeq++;
      for (const it of pat.items) {
        const e = Object.assign({}, it, { x: x0 + it.dx });
        if (e.t === 'letter') { e.color = letterIndex(e.ch); e.gate = G.gateSeq; }
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
          if (LX + 14 > x0 && LX - 14 < x1 && lBot > y0 && lBot - 70 < GROUND) hit();
        }
      } else {
        const r = e.t === 'coin' ? 15 : 30, cy = GROUND - e.h;
        if (circleRect(e.x, cy, r, LX - 16, lTop, LX + 16, lBot)) { if (e.t === 'coin') collectCoin(e); else collectLetter(e, true); }
        else if (circleRect(e.x, cy, r, FX - 16, fTop, FX + 16, fBot)) {
          if (e.t === 'coin') collectCoin(e);
          else if (e.ch === session.needed()) collectLetter(e, false);
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
    startLevel = session.level; // "again" starts where this run got to
    store.set('level', startLevel);
    $('rCoins').textContent = fa(G.coins);
    $('rOk').textContent = fa(G.doneWords.length);
    $('rDist').textContent = fa(dist) + ' م';
    $('rLearned').textContent = G.doneWords.length ? 'کلمه‌هایی که ساختی: ' + G.doneWords.join('  ·  ') : 'دفعه‌ی بعد حرف‌ها رو بگیر!';
    $('overTitle').textContent = 'ای وای! به هم خوردیم';
    buildGrid();
    buildLevels();
    setMode('over');
  }

  /* ---------- draw ---------- */

  function shadow(x, h, s) {
    ctx.fillStyle = 'rgba(30,40,30,.22)';
    ctx.beginPath(); ctx.ellipse(x, GROUND + 4, 26 * s * (1 - clamp(h / 320, 0, 0.5)), 7 * s, 0, 0, 7); ctx.fill();
  }

  function drawRun() {
    ctx.save();
    if (G.shake > 0 && !RM) ctx.translate(rand(-3, 3), rand(-3, 3));
    const theme = G.theme;
    theme.draw(G.dist);
    for (const e of G.entities) {
      if (e.t === 'obs') drawObstacle(e, theme);
      else if (e.t === 'coin') drawCoin(e, G.time);
      else drawLetter(e, G.time);
    }
    const LX = leaderX(), FX = LX - G.gap;
    const fy = G._fy || 0;
    const S = 1.0;
    const near = G.gap < 52;
    const tumble = G.caught ? Math.min(G.overT, 0.6) / 0.6 : 0;
    if (theme.rim) { ctx.shadowColor = 'rgba(255,255,255,.9)'; ctx.shadowBlur = 8; }
    shadow(FX, fy, S);
    Chars.draw(ctx, G.other, { x: FX, footY: GROUND - fy, scale: S, t: G.anim + 0.25, air: fy > 6, hurt: near || G.caught, happy: G.cheer > 0, rot: tumble * -1.2 });
    shadow(LX, G.y, S);
    if (!(G.invuln > 0 && Math.floor(G.time * 14) % 2 === 0)) {
      Chars.draw(ctx, G.kind, { x: LX, footY: GROUND - G.y, scale: S, t: G.anim, air: G.y > 6, hurt: G.hurt > 0 || G.caught, happy: G.cheer > 0, rot: tumble * 1.2 });
    }
    ctx.shadowColor = 'transparent';
    if (near && !G.caught) {
      ctx.save();
      ctx.font = '800 30px Vazirmatn, Tahoma, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff5a5f';
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 5;
      const by = GROUND - 170 - Math.abs(Math.sin(G.time * 10)) * 6;
      ctx.strokeText('!', FX + G.gap / 2, by); ctx.fillText('!', FX + G.gap / 2, by);
      ctx.restore();
    }
    drawParts();
    if (G.hurt > 0) { ctx.fillStyle = `rgba(255,90,90,${G.hurt * 0.25})`; ctx.fillRect(0, 0, W, H); }
    if (G.trans) { const a = G.trans.t < 0.5 ? G.trans.t * 2 : (1 - G.trans.t) * 2; ctx.fillStyle = `rgba(255,255,255,${clamp(a, 0, 1)})`; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }

  function frame(ts) {
    const dt = Math.min(0.033, (ts - last) / 1000 || 0.016);
    last = ts;
    if (mode === 'play') { update(dt); drawRun(); }
    else if (mode === 'pause' || mode === 'over') { if (G && G.entities) drawRun(); }
    else THEMES.garden.draw(ts / 60);
    requestAnimationFrame(frame);
  }

  /* ---------- menu & buttons ---------- */

  function buildGrid() {
    const g = $('grid');
    g.innerHTML = '';
    let known = 0;
    LD.LETTERS.forEach((l) => {
      const n = lettersOk[l.ch] || 0;
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = l.ch;
      b.className = n >= 3 ? 'known' : (n > 0 ? 'new' : '');
      if (n >= 3) known++;
      b.addEventListener('click', () => { Audio_.unlock(); speak(`${l.ch}، ${l.word}`); });
      g.appendChild(b);
    });
    $('learnedCount').textContent = fa(known);
  }

  function buildLevels() {
    const box = $('levels');
    box.innerHTML = '';
    const infos = WD.levels.concat([WP.SPECIAL]);
    infos.forEach((l) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lv' + (l.level === startLevel ? ' on' : '') + (l.level === 6 ? ' special' : '');
      b.setAttribute('aria-pressed', String(l.level === startLevel));
      b.innerHTML = `<b>${l.level === 6 ? '★' : fa(l.level)}</b><span>${l.level === 6 ? 'ویژه' : l.name}</span>`;
      b.addEventListener('click', () => { startLevel = l.level; store.set('level', startLevel); buildLevels(); });
      box.appendChild(b);
    });
  }

  function pauseGame(on) {
    if (on && mode === 'play') setMode('pause');
    else if (!on && mode === 'pause') { last = performance.now(); setMode('play'); }
  }

  document.querySelectorAll('.pick').forEach((b) => b.addEventListener('click', () => { Audio_.unlock(); newRun(b.dataset.kind, startLevel); }));
  $('name-boy').textContent = CHARACTERS.boy.name;
  $('name-girl').textContent = CHARACTERS.girl.name;
  $('btnAgain').addEventListener('click', () => { Audio_.unlock(); newRun(selected, startLevel); });
  $('btnMenu').addEventListener('click', () => { setMode('menu'); buildGrid(); buildLevels(); });
  $('btnMenu2').addEventListener('click', () => { setMode('menu'); buildGrid(); buildLevels(); });
  $('btnResume').addEventListener('click', () => pauseGame(false));
  $('btnPause').addEventListener('click', () => pauseGame(true));
  $('card').addEventListener('click', () => { if (session.info().helps.audio) speak(session.word.display); });
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
  window.addEventListener('resize', () => { resize(); previews(); if (mode === 'play' || mode === 'pause') renderCard(G && G.wordPause > 0 ? 'done' : 'play'); });

  function previews() { const P = window.LetterPicks || {}; ['boy', 'girl'].forEach((k) => { if (P[k]) $('pv-' + k).src = P[k].src; }); }

  // test hook
  window.__land = {
    get G() { return G; }, get mode() { return mode; }, get session() { return session; }, jump,
    start: (k, level) => newRun(k || 'boy', level || 1),
    step: (dt, n) => { for (let i = 0; i < (n || 1); i++) update(dt); drawRun(); },
    solve: () => collectLetter({ t: 'letter', ch: session.needed(), x: leaderX(), h: 50, gate: -1 }, true),
  };

  resize();
  buildGrid();
  buildLevels();
  previews();
  setMode('menu');
  if (document.fonts && document.fonts.load) document.fonts.load('800 38px Vazirmatn').catch(() => {});
  requestAnimationFrame(frame);
})();
