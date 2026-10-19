(function () {
  'use strict';
  const E = window.CatBox;
  const K = window.CatKit;
  const { RM, Sound, catSVG, store, COATS, rand } = K;

  const MODE_LABELS = { calm: 'آرام', hard: 'چالشی' };
  const RULES = {
    calm: 'گربه‌ها رو از پایین بکش توی جعبه (با لمس یه گربه می‌چرخه). هم‌رنگ‌هایی که سرشون به هم برسه به هم جوش می‌خورن و درازتر می‌شن. ردیف یا ستون پر = گربه‌هاش می‌رن. اگه یه گربه‌ی هم‌رنگ کل ردیف رو بگیره، افسانه‌ای می‌شه: جایزه‌ی بزرگ و ۳ حرکت امتیاز دو برابر!',
    hard: 'مثل حالت آرام، ولی فقط ۲ رنگ و ردیف پر از رنگ‌های مخلوط پاک نمی‌شه. فقط گربه‌ی افسانه‌ای (هم‌رنگ و کل ردیف) جا باز می‌کنه. سخته، آزمایشیه!',
  };

  const DROP_MS = 110; // the dropped cat settles, then fuses
  const FUSE_MS = 420; // length of the stretch animation

  /* ---------- state & DOM ---------- */

  const $ = (id) => document.getElementById(id);
  const board = $('board'), cellsEl = $('cells'), piecesEl = $('pieces'), trayEl = $('tray');
  const els = new Map(); // piece id -> element
  const holds = new Set(); // ids whose element is kept until an animation finishes

  let modeId = store.get('mode', 'calm');
  if (!E.MODES[modeId]) modeId = 'calm';
  let state, history = [];
  let best = 0;
  let token = 0; // bumps on every new game so late effects from the old one are dropped
  let drag = null;
  let overTimer = 0;

  const FX = K.createFX({ board, piecesEl, canvas: $('fx'), getN: () => state.n });

  const cellSize = () => piecesEl.getBoundingClientRect().width / state.n;

  function placeEl(el, p, n) {
    el.style.left = (p.c / n) * 100 + '%';
    el.style.top = (p.r / n) * 100 + '%';
    el.style.width = ((p.axis === 'h' ? p.len : 1) / n) * 100 + '%';
    el.style.height = ((p.axis === 'v' ? p.len : 1) / n) * 100 + '%';
  }

  // create or update the element of a cat (also works for cats that only exist for a moment)
  function ensureEl(p) {
    const n = state.n;
    let el = els.get(p.id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'piece';
      piecesEl.appendChild(el);
      els.set(p.id, el);
    }
    const sig = `${p.color}|${p.len}|${p.axis}`;
    if (el.dataset.sig !== sig) {
      el.innerHTML = catSVG(p.color, p.len, p.axis, false);
      el.dataset.sig = sig;
      el.dataset.happy = '';
    }
    placeEl(el, p, n);
    return el;
  }

  function dropEl(id) {
    const el = els.get(id);
    els.delete(id);
    holds.delete(id);
    if (el) el.remove();
  }

  /* ---------- rendering ---------- */

  function render() {
    const n = state.n;
    board.style.setProperty('--n', n);
    const live = new Set();
    for (const p of state.pieces) {
      live.add(p.id);
      const el = ensureEl(p);
      el.classList.toggle('almost', p.len === n - 1);
    }
    for (const [id, el] of els) {
      if (live.has(id) || holds.has(id)) continue;
      els.delete(id);
      el.classList.add('gone');
      setTimeout(() => el.remove(), 220);
    }

    // one cell short of a legend: dashed lane
    piecesEl.querySelectorAll('.lane:not(.solid)').forEach((l) => l.remove());
    for (const p of state.pieces) {
      if (p.len !== n - 1) continue;
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
    $('boost').hidden = !(state.boost > 0);
    $('boost-n').textContent = state.boost || 0;
    $('final-score').textContent = state.score;
  }

  function showOver(show, delay) {
    clearTimeout(overTimer);
    if (!show) { $('over').hidden = true; return; }
    overTimer = setTimeout(() => { $('over').hidden = false; }, delay || 0);
  }

  function buildCells() {
    cellsEl.innerHTML = '';
    for (let i = 0; i < state.n * state.n; i++) {
      const c = document.createElement('div');
      c.className = 'cell';
      cellsEl.appendChild(c);
    }
  }

  function buildTray(popIn) {
    trayEl.innerHTML = '';
    // a 3-long cat has to fit inside its slot
    const slotW = (trayEl.clientWidth - 16 - 16) / 3;
    const T = Math.max(26, Math.min(48, Math.floor((slotW - 6) / 3)));
    state.tray.forEach((t, i) => {
      const slot = document.createElement('div');
      slot.className = 'slot';
      if (t) {
        const pe = document.createElement('div');
        pe.className = 'tray-piece' + (popIn ? ' pop' : '');
        pe.dataset.i = i;
        pe.style.width = (t.axis === 'h' ? t.len : 1) * T + 'px';
        pe.style.height = (t.axis === 'v' ? t.len : 1) * T + 'px';
        pe.innerHTML = catSVG(t.color, t.len, t.axis, false);
        slot.appendChild(pe);
      }
      trayEl.appendChild(slot);
    });
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

  function resetVisuals() {
    els.forEach((el) => el.remove());
    els.clear();
    holds.clear();
    piecesEl.querySelectorAll('.lane, .legend-fx, .lane-flash, .ghost').forEach((x) => x.remove());
    board.querySelectorAll('.float').forEach((x) => x.remove());
    $('dim').classList.remove('on');
    FX.clearParticles();
  }

  /* ---------- effects ---------- */

  function setHappy(id, ms) {
    const el = els.get(id);
    if (!el || !el.dataset.sig) return;
    const [color, len, axis] = el.dataset.sig.split('|');
    el.innerHTML = catSVG(color, +len, axis, true);
    el.dataset.happy = '1';
    setTimeout(() => {
      if (el.dataset.happy !== '1') return;
      el.dataset.happy = '';
      el.innerHTML = catSVG(color, +len, axis, false);
    }, ms);
  }

  function flashLine(l) {
    const n = state.n;
    const band = document.createElement('div');
    band.className = 'lane-flash';
    placeEl(band, l.axis === 'h' ? { r: l.index, c: 0, len: n, axis: 'h' } : { r: 0, c: l.index, len: n, axis: 'v' }, n);
    piecesEl.appendChild(band);
    if (band.animate && !RM) {
      band.animate([{ opacity: 0 }, { opacity: l.kind === 'legend' ? 0.95 : 0.7, offset: 0.2 }, { opacity: 0 }], { duration: 800 }).onfinish = () => band.remove();
    } else setTimeout(() => band.remove(), 500);
  }

  function clearSequence(ev, score) {
    const n = state.n;
    ev.lines.forEach(flashLine);
    const others = ev.cats.filter((c) => !c.legend);
    const legends = ev.cats.filter((c) => c.legend);

    others.forEach((c, k) => {
      const el = els.get(c.id);
      const pos = FX.px(c.r, c.c, c.len, c.axis);
      FX.burst(pos.x, pos.y, {
        count: 6 + c.len * 3, speed: 150, life: 0.6, size: 6, gravity: 300, up: 60,
        kinds: ['puff', 'star', 'heart'], colors: [COATS[c.color][0], '#ffffff', '#ffd23f'],
      });
      setTimeout(() => Sound.meow(c.len, k), k * 70);
      const done = () => dropEl(c.id);
      if (el && el.animate && !RM) {
        el.animate([
          { transform: 'scale(1)', opacity: 1 },
          { transform: 'scale(1.15)', opacity: 1, offset: 0.25 },
          { transform: 'translateY(-35%) scale(.3)', opacity: 0 },
        ], { duration: 520, easing: 'ease-in', fill: 'forwards' }).onfinish = done;
      } else setTimeout(done, 200);
    });
    if (others.length) {
      Sound.pop(Math.min(ev.streak - 1, 6));
      FX.shake(1.5 + Math.min(ev.lines.length, 3) * 1.6, 200);
      K.vibrate(15);
    }
    legends.forEach((c, i) => setTimeout(() => legendSequence(c), 160 + i * 300));

    if (score) {
      const first = ev.lines[0];
      const pos = first.axis === 'h' ? FX.px(first.index, 0, n, 'h') : FX.px(0, first.index, n, 'v');
      FX.floatText(pos.x, pos.y, '+' + score.gain);
      if (ev.streak >= 2) FX.floatText(pos.x, pos.y - pos.cs * 0.7, 'کمبو ×' + ev.streak, 'combo');
    }
  }

  function legendSequence(c) {
    const n = state.n;
    const pos = FX.px(c.r, c.c, c.len, c.axis);
    Sound.fanfare();
    K.vibrate([30, 40, 30, 40, 90]);
    dropEl(c.id);

    const dim = $('dim');
    dim.classList.add('on');
    setTimeout(() => dim.classList.remove('on'), 1100);

    const el = document.createElement('div');
    el.className = 'legend-fx';
    el.innerHTML = catSVG(c.color, c.len, c.axis, true);
    placeEl(el, c, n);
    el.style.transformOrigin = c.axis === 'h' ? 'left center' : 'center bottom';
    piecesEl.appendChild(el);

    const sc = (along, across) => (c.axis === 'v' ? `scale(${across}, ${along})` : `scale(${along}, ${across})`);
    const target = $('legends');
    function exit() {
      const a = el.getBoundingClientRect();
      const t = target.getBoundingClientRect();
      const dx = t.left + t.width / 2 - (a.left + a.width / 2);
      const dy = t.top + t.height / 2 - (a.top + a.height / 2);
      el.style.transformOrigin = 'center';
      const done = () => { el.remove(); FX.bump(target); };
      if (RM || !el.animate) { done(); return; }
      el.animate([
        { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 },
        { transform: `translate(${dx * 0.45}px, ${dy * 0.45 + 30}px) rotate(180deg) scale(.55)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) rotate(360deg) scale(.1)`, opacity: 0 },
      ], { duration: 650, easing: 'ease-in', fill: 'forwards' }).onfinish = done;
    }
    if (RM || !el.animate) setTimeout(exit, 900);
    else {
      el.animate([
        { transform: sc(0.7, 0.9), opacity: 0, offset: 0 },
        { transform: sc(1.12, 0.94), opacity: 1, offset: 0.2 },
        { transform: sc(1, 1), opacity: 1, offset: 0.4 },
        { transform: sc(1, 1), opacity: 1, offset: 1 },
      ], { duration: 1100, easing: 'ease-out' }).onfinish = exit;
    }

    flashLine({ axis: c.axis, index: c.axis === 'h' ? c.r : c.c, kind: 'legend' });
    FX.burst(pos.x, pos.y, {
      count: 36, speed: 380, life: 1.1, size: 9, gravity: 500, up: 80,
      kinds: ['star', 'star', 'heart', 'confetti'], colors: ['#ffd23f', '#fff4b0', '#ff9aa2', '#ffffff', '#8fd6c3'],
    });
    if (!RM) {
      const b = board.getBoundingClientRect();
      for (let i = 0; i < 14; i++) {
        setTimeout(() => {
          FX.sizeCanvas();
          FX.addParticle({ x: rand(10, b.width - 10), y: -12, vx: rand(-20, 20), vy: rand(60, 160), gravity: 420, life: 1.5, size: 11, kind: 'fish' });
        }, i * 50);
      }
    }
    const banner = $('banner');
    banner.innerHTML = '<b>گربه‌ی افسانه‌ای!</b><span>جعبه جا باز کرد · ۳ حرکت امتیاز ×۲</span>';
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
    FX.shake(7, 420);
  }

  /* ---------- a turn ---------- */

  function commit(i, r, c) {
    const res = E.place(state, i, r, c);
    if (!res.ok) return false;
    Sound.unlock();
    history.push(state);
    if (history.length > 30) history.shift();
    state = res.state;
    const tok = token;
    const find = (type) => res.events.find((e) => e.type === type);
    const placeEv = find('place'), fuseEv = find('fuse'), clearEv = find('clear');
    const scoreEv = find('score'), refill = find('refill');

    // 1. the cat lands
    const pel = ensureEl(placeEv);
    if (pel.animate && !RM) pel.animate([{ transform: 'scale(1.15)' }, { transform: 'scale(.94)', offset: 0.6 }, { transform: 'scale(1)' }], { duration: 200, easing: 'ease-out' });
    Sound.tock();
    K.vibrate(6);

    // 2. same-coloured neighbours fuse: the old cats vanish under one stretching cat
    let clearAt = DROP_MS + 40;
    if (fuseEv) {
      clearAt = DROP_MS + FUSE_MS;
      fuseEv.parts.forEach((pt) => holds.add(pt.id));
      const fel = ensureEl(fuseEv);
      K.vibrate(10);
      FX.jelly(fel, fuseEv.axis, { delay: DROP_MS, fade: true, strong: true, duration: FUSE_MS });
      setTimeout(() => {
        if (tok !== token) return;
        fuseEv.parts.forEach((pt) => {
          const el = els.get(pt.id);
          holds.delete(pt.id);
          if (!el) return;
          els.delete(pt.id);
          if (el.animate && !RM) el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 60, fill: 'forwards' }).onfinish = () => el.remove();
          else el.remove();
        });
        const k = fuseEv.parts.length;
        for (let j = 0; j < k - 1; j++) {
          const b = fuseEv.axis === 'h' ? fuseEv.parts[j].c + fuseEv.parts[j].len : fuseEv.parts[j].r + fuseEv.parts[j].len;
          const pos = fuseEv.axis === 'h' ? FX.px(fuseEv.r, b - 0.5, 1, 'h') : FX.px(b - 0.5, fuseEv.c, 1, 'v');
          FX.burst(pos.x, pos.y, { count: 8, speed: 130, life: 0.5, size: 5, gravity: 200, kinds: ['star', 'puff'], colors: ['#ffd23f', '#ffffff', COATS[fuseEv.color][0]] });
        }
        Sound.meow(fuseEv.len, 0);
        Sound.pop(fuseEv.len - 1);
        FX.shake(1 + fuseEv.len * 0.6, 160);
        setHappy(fuseEv.id, 900);
      }, DROP_MS);
    }

    // 3. full lines clear: whole cats leave
    if (clearEv) {
      clearEv.cats.forEach((cat) => { holds.add(cat.id); if (!els.get(cat.id)) ensureEl(cat); });
      setTimeout(() => { if (tok === token) clearSequence(clearEv, scoreEv); }, clearAt);
    }

    render();
    buildTray(!!refill);
    showOver(state.over, clearEv ? clearAt + 1300 : 600);
    return true;
  }

  function newGame() {
    token++;
    history = [];
    resetVisuals();
    state = E.createGame(modeId);
    best = store.get('best.' + modeId, 0);
    buildModeButtons();
    $('rules').textContent = RULES[modeId];
    showOver(false);
    buildCells();
    render();
    buildTray(true);
  }

  function undo() {
    if (!history.length) return;
    token++;
    state = history.pop();
    resetVisuals();
    render();
    buildTray(false);
    showOver(state.over, 0);
  }

  /* ---------- dragging ---------- */

  function findAnchor(piece, cx, cy) {
    const inner = piecesEl.getBoundingClientRect();
    const cs = inner.width / state.n;
    const w = (piece.axis === 'h' ? piece.len : 1) * cs;
    const h = (piece.axis === 'v' ? piece.len : 1) * cs;
    if (cx < inner.left - cs * 0.6 || cx > inner.right + cs * 0.6 || cy < inner.top - cs * 0.6 || cy > inner.bottom + cs * 0.6) return null;
    const fr = (cy - h / 2 - inner.top) / cs;
    const fc = (cx - w / 2 - inner.left) / cs;
    const r0 = Math.round(fr), c0 = Math.round(fc);
    let best = null, bd = Infinity;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = r0 + dr, c = c0 + dc;
        if (!E.canPlace(state, piece, r, c)) continue;
        const d = (r - fr) * (r - fr) + (c - fc) * (c - fc);
        if (d < bd) { bd = d; best = { r, c, valid: true }; }
      }
    }
    if (best && bd <= 1.6) return best;
    return { r: Math.max(0, Math.min(state.n - 1, r0)), c: Math.max(0, Math.min(state.n - 1, c0)), valid: false };
  }

  function clearHints() {
    piecesEl.querySelectorAll('.fuse-hint').forEach((e) => e.classList.remove('fuse-hint'));
    piecesEl.querySelectorAll('.lane.solid').forEach((e) => e.remove());
  }

  function startDrag() {
    const t = state.tray[drag.i];
    const cs = cellSize();
    drag.t = t;
    drag.cs = cs;
    drag.w = (t.axis === 'h' ? t.len : 1) * cs;
    drag.h = (t.axis === 'v' ? t.len : 1) * cs;
    const f = document.createElement('div');
    f.className = 'drag';
    f.style.width = drag.w + 'px';
    f.style.height = drag.h + 'px';
    f.innerHTML = catSVG(t.color, t.len, t.axis, false);
    document.body.appendChild(f);
    drag.floater = f;
    drag.pe.classList.add('dragging');
    drag.active = true;
    Sound.tick();
  }

  function moveDrag(x, y) {
    const lift = drag.touch ? drag.cs * 0.9 + 14 : 8;
    const cx = x, cy = y - lift;
    drag.floater.style.left = cx - drag.w / 2 + 'px';
    drag.floater.style.top = cy - drag.h / 2 + 'px';
    const a = findAnchor(drag.t, cx, cy);
    const key = a ? `${a.r},${a.c},${a.valid}` : 'none';
    if (key === drag.key) return;
    drag.key = key;
    drag.anchor = a;
    clearHints();
    if (!a) { if (drag.ghost) { drag.ghost.remove(); drag.ghost = null; } return; }
    if (!drag.ghost) {
      const g = document.createElement('div');
      g.className = 'ghost';
      g.innerHTML = catSVG(drag.t.color, drag.t.len, drag.t.axis, false);
      piecesEl.appendChild(g);
      drag.ghost = g;
    }
    placeEl(drag.ghost, { r: a.r, c: a.c, len: drag.t.len, axis: drag.t.axis }, state.n);
    drag.ghost.classList.toggle('bad', !a.valid);
    if (a.valid) {
      const pv = E.preview(state, drag.i, a.r, a.c);
      pv.fuseIds.forEach((id) => { const el = els.get(id); if (el) el.classList.add('fuse-hint'); });
      pv.lines.forEach((l) => {
        const lane = document.createElement('div');
        lane.className = 'lane solid';
        placeEl(lane, l.axis === 'h' ? { r: l.index, c: 0, len: state.n, axis: 'h' } : { r: 0, c: l.index, len: state.n, axis: 'v' }, state.n);
        piecesEl.insertBefore(lane, piecesEl.firstChild);
      });
      Sound.tick();
    }
  }

  function endDrag(d) {
    if (d.floater) d.floater.remove();
    if (d.ghost) d.ghost.remove();
    clearHints();
    d.pe.classList.remove('dragging');
    if (d.anchor && d.anchor.valid) commit(d.i, d.anchor.r, d.anchor.c);
    else if (d.pe.animate && !RM) d.pe.animate([{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 160 });
  }

  function rotateTray(i) {
    const before = state.tray[i];
    if (!before || before.len === 1) return;
    state = E.rotate(state, i);
    buildTray(false);
    Sound.tick();
  }

  trayEl.addEventListener('pointerdown', (e) => {
    const pe = e.target.closest('.tray-piece');
    if (!pe || state.over) return;
    e.preventDefault();
    Sound.unlock();
    drag = { i: +pe.dataset.i, pe, sx: e.clientX, sy: e.clientY, active: false, id: e.pointerId, touch: e.pointerType !== 'mouse', key: '', anchor: null };
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 8) return;
      startDrag();
    }
    moveDrag(e.clientX, e.clientY);
  });
  const finish = (e, cancel) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.active) { if (!cancel) rotateTray(d.i); return; }
    if (cancel) d.anchor = null;
    endDrag(d);
  };
  window.addEventListener('pointerup', (e) => finish(e, false));
  window.addEventListener('pointercancel', (e) => finish(e, true));
  window.addEventListener('resize', () => { FX.sizeCanvas(); if (state && !drag) buildTray(false); });

  $('restart').addEventListener('click', newGame);
  $('again').addEventListener('click', newGame);
  $('undo').addEventListener('click', undo);
  const soundBtn = $('sound');
  const paintSound = () => { soundBtn.textContent = Sound.enabled ? '🔊' : '🔇'; };
  soundBtn.addEventListener('click', () => { Sound.toggle(); paintSound(); });
  paintSound();

  // test hook for automated checks
  window.__box = {
    commit: (i, r, c) => commit(i, r, c),
    load: (s) => { token++; state = s; history = []; resetVisuals(); buildCells(); render(); buildTray(false); showOver(s.over, 0); },
    get state() { return state; },
  };

  newGame();
})();
