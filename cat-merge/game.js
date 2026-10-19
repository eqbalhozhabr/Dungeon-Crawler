(function () {
  'use strict';
  const E = window.CatEngine;

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
    stretch: 'دو گربه‌ی هم‌سطح که ترکیب بشن، گربه‌ی جدید «بلندتر» می‌شه و جا می‌گیره. جهت کشیدن تعیین می‌کنه کدوم‌طرف کش بیاد. گربه‌ای که کل یک ردیف رو پر کنه افسانه‌ای می‌شه و ردیف آزاد می‌شه.',
    fish: 'گربه‌ها رو به سمت ماهی 🐟 ببر تا بخورن و یه خونه بلندتر بشن. ترکیب هم‌سطح‌ها گربه رو ارتقا می‌ده. گربه‌ی هم‌اندازه‌ی کل ردیف = افسانه‌ای!',
  };

  const lookOf = (modeId, level) => LOOKS[modeId][level - 1];

  function catSVG(look, len, axis) {
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
    if (LOOKS_TABBY(look)) {
      for (const dx of [-7, 0, 7]) {
        s += `<path d="M ${hx + dx} ${hy - r * 0.98} l 0 ${dx === 0 ? 11 : 8}" stroke="${c2}" stroke-width="3.5" stroke-linecap="round"/>`;
      }
    }
    // face
    s += `<circle cx="${hx - r * 0.62}" cy="${hy + r * 0.28}" r="6" fill="#ff9aa2" opacity=".45"/>`;
    s += `<circle cx="${hx + r * 0.62}" cy="${hy + r * 0.28}" r="6" fill="#ff9aa2" opacity=".45"/>`;
    for (const side of [-1, 1]) {
      const ex = hx + side * r * 0.38;
      s += `<ellipse cx="${ex}" cy="${hy - r * 0.05}" rx="${r * 0.11}" ry="${r * 0.16}" fill="#3b2a2a"/>`;
      s += `<circle cx="${ex + 1.2}" cy="${hy - r * 0.12}" r="1.7" fill="#fff"/>`;
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
  const LOOKS_TABBY = (look) => look % 2 === 1 || look >= 9;

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

  /* ---------- DOM ---------- */

  const $ = (id) => document.getElementById(id);
  const board = $('board'), cellsEl = $('cells'), piecesEl = $('pieces');
  const els = new Map(); // piece id -> element

  let modeId = store.get('mode', 'stretch');
  if (!E.MODES[modeId]) modeId = 'stretch';
  let state, history = [];
  let best = 0;
  let discovered = 1;

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
        el.innerHTML = p.kind === 'fish' ? fishSVG() : catSVG(lookOf(state.modeId, p.level), p.len, p.axis);
        el.dataset.sig = sig;
      }
      placeEl(el, p, n);
      const retrigger = (cls) => { el.classList.remove('spawn', 'pop', 'grow'); void el.offsetWidth; el.classList.add(cls); };
      if (fx.spawned && fx.spawned.has(p.id)) retrigger('spawn');
      else if (fx.merged && fx.merged.has(p.id)) retrigger('pop');
      else if (fx.grown && fx.grown.has(p.id)) retrigger('grow');
    }
    for (const [id, el] of els) {
      if (live.has(id)) continue;
      els.delete(id);
      el.classList.add('gone');
      setTimeout(() => el.remove(), 260);
    }
    $('score').textContent = state.score;
    $('legends').textContent = state.legends;
    if (state.score > best) { best = state.score; store.set('best.' + modeId, best); }
    $('best').textContent = best;
    $('undo').disabled = history.length === 0;
    $('over').hidden = !state.over;
    $('final-score').textContent = state.score;
  }

  function buildCells() {
    cellsEl.innerHTML = '';
    for (let i = 0; i < state.n * state.n; i++) {
      const c = document.createElement('div');
      c.className = 'cell';
      cellsEl.appendChild(c);
    }
  }

  let toastTimer;
  function toast(text) {
    const t = $('toast');
    t.textContent = text;
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1500);
  }

  function legendFx(ev) {
    const n = state.n;
    const el = document.createElement('div');
    el.className = 'legend-fx';
    el.innerHTML = catSVG(lookOf(state.modeId, ev.level), ev.len, ev.axis);
    placeEl(el, ev, n);
    piecesEl.appendChild(el);
    setTimeout(() => el.remove(), 1400);
    toast('🌟 گربه‌ی افسانه‌ای! ردیف آزاد شد');
  }

  /* ---------- game flow ---------- */

  function newGame() {
    history = [];
    els.forEach((el) => el.remove());
    els.clear();
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
    const res = E.move(state, dir);
    if (!res.moved) return;
    history.push(state);
    if (history.length > 30) history.shift();
    state = res.state;
    const fx = { spawned: new Set(), merged: new Set(), grown: new Set() };
    let seenNow = discovered;
    for (const ev of res.events) {
      if (ev.type === 'spawn') fx.spawned.add(ev.id);
      if (ev.type === 'merge') { fx.merged.add(ev.id); seenNow = Math.max(seenNow, ev.level); }
      if (ev.type === 'eat') fx.grown.add(ev.id);
    }
    render(fx);
    for (const ev of res.events) if (ev.type === 'legend') { legendFx(ev); seenNow = Math.max(seenNow, ev.level); }
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

  $('restart').addEventListener('click', newGame);
  $('again').addEventListener('click', newGame);
  $('undo').addEventListener('click', undo);

  // test hook for automated checks
  window.__cat = { play: (d) => play(d), get state() { return state; } };

  newGame();
})();
