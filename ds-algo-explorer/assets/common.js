/* DS/Algo Explorer — Shared JS Utilities + SimulationPlayer */

/* ── SimulationPlayer CSS (injected once per page load) ───── */
(function () {
  if (document.getElementById('_sim_css')) return;
  const s = document.createElement('style');
  s.id = '_sim_css';
  s.textContent = `
    /* Playback bar */
    .sim-bar{
      position:sticky;bottom:0;
      background:#fff;
      border-top:2px solid rgba(0,200,255,.22);
      box-shadow:0 -4px 20px rgba(0,0,0,.07);
      padding:10px 16px 8px;z-index:50;
    }
    .sim-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
    .sim-counter{
      font-family:'JetBrains Mono',monospace;font-size:.7rem;font-weight:700;
      color:#4a4a7a;white-space:nowrap;min-width:104px;
    }
    .sim-scrubber-wrap{flex:1;min-width:80px}
    .sim-scrubber{
      -webkit-appearance:none;appearance:none;
      width:100%;height:4px;border-radius:4px;outline:none;cursor:pointer;
      background:linear-gradient(90deg,#00c8ff var(--sp,0%),#e2e0da var(--sp,0%));
    }
    .sim-scrubber::-webkit-slider-thumb{
      -webkit-appearance:none;width:14px;height:14px;border-radius:50%;
      background:#00c8ff;box-shadow:0 0 6px rgba(0,200,255,.5);cursor:pointer;
    }
    .sim-btns{display:flex;gap:4px}
    .sim-btn{
      width:30px;height:30px;padding:0;
      border:1.5px solid rgba(0,200,255,.25);border-radius:6px;
      background:#f8f9fc;color:#4a4a7a;font-size:.75rem;
      cursor:pointer;display:flex;align-items:center;justify-content:center;
      transition:all .12s;
    }
    .sim-btn:hover:not(:disabled){
      background:rgba(0,200,255,.1);border-color:#00c8ff;color:#00c8ff;
    }
    .sim-btn:disabled{opacity:.3;cursor:default}
    .sim-btn-play{
      width:34px!important;height:34px!important;
      background:linear-gradient(135deg,#00c8ff,#8b5cf6)!important;
      color:#fff!important;border:none!important;font-size:.9rem;border-radius:8px;
      box-shadow:0 0 10px rgba(0,200,255,.4);
    }
    .sim-btn-play:hover:not(:disabled){
      filter:brightness(1.12);box-shadow:0 0 18px rgba(0,200,255,.6)!important;
    }
    .sim-speed select{
      font-family:'JetBrains Mono',monospace;font-size:.7rem;
      padding:.18rem .4rem;border:1.5px solid rgba(0,200,255,.25);
      border-radius:6px;background:#f8f9fc;color:#4a4a7a;cursor:pointer;
    }
    .sim-kbd{
      margin-top:6px;font-size:.6rem;color:#9090b0;text-align:center;
      font-family:'JetBrains Mono',monospace;
    }
    /* Explanation panel */
    .sim-exp{
      background:#f8f9fd;border:1.5px solid rgba(0,200,255,.2);
      border-radius:10px;padding:14px 18px;margin:12px 0;
    }
    .sim-exp-title{font-weight:700;font-size:.92rem;color:#080818;margin-bottom:5px}
    .sim-exp-what{font-size:.83rem;color:#2a2a4a;margin-bottom:4px;line-height:1.55}
    .sim-exp-why{font-size:.8rem;color:#5a5a7a;margin-bottom:7px;line-height:1.55}
    .sim-exp-state{
      font-family:'JetBrains Mono',monospace;font-size:.7rem;color:#00c8ff;
      background:rgba(0,200,255,.07);border-radius:5px;padding:4px 9px;
      display:inline-block;
    }
  `;
  document.head.appendChild(s);
})();

/* ── SimulationPlayer ──────────────────────────────────────── */
class SimulationPlayer {
  /**
   * @param {Array}    steps               Pre-generated step objects
   * @param {Function} renderFn            Called with a step object to draw/update the viz
   * @param {string}   explanationPanelId  ID of the explanation <div>
   * @param {string}   playbackBarId       ID of the playback bar <div>
   */
  constructor(steps, renderFn, explanationPanelId, playbackBarId) {
    this.steps    = steps;
    this.renderFn = renderFn;
    this.expPanel = document.getElementById(explanationPanelId);
    this.bar      = document.getElementById(playbackBarId);
    this.current  = 0;
    this.playing  = false;
    this._speed   = 1;
    this._timer   = null;
    this._tx      = 0;
    this._ty      = 0;
    this._SPEEDS  = [0.25, 0.5, 1, 1.5, 2];
    this._kh      = null;

    this._buildBar();
    this._kbd();
    this._touch();
    this.renderCurrentStep();
    this._emit('step-change', { step: 0, total: steps.length });
  }

  /* ── Bar construction ─────────────────────────────── */
  _buildBar() {
    const id = this.bar.id;
    this.bar.className = 'sim-bar';
    this.bar.innerHTML = `
      <div class="sim-row">
        <span class="sim-counter" id="${id}_c">Step 1 of ${this.steps.length}</span>
        <div class="sim-scrubber-wrap">
          <input class="sim-scrubber" id="${id}_s" type="range"
            min="0" max="${this.steps.length - 1}" value="0"
            aria-label="Step scrubber"/>
        </div>
        <div class="sim-btns">
          <button class="sim-btn" id="${id}_f" aria-label="First step"    title="First (Home)">⏮</button>
          <button class="sim-btn" id="${id}_p" aria-label="Previous step" title="Prev (←)">◀</button>
          <button class="sim-btn sim-btn-play" id="${id}_pl" aria-label="Play" title="Play/Pause (Space)">▶</button>
          <button class="sim-btn" id="${id}_n" aria-label="Next step"    title="Next (→)">▶</button>
          <button class="sim-btn" id="${id}_l" aria-label="Last step"    title="Last (End)">⏭</button>
        </div>
        <div class="sim-speed">
          <select id="${id}_sp" aria-label="Playback speed">
            <option value="0.25">0.25×</option>
            <option value="0.5">0.5×</option>
            <option value="1" selected>1×</option>
            <option value="1.5">1.5×</option>
            <option value="2">2×</option>
          </select>
        </div>
      </div>
      <div class="sim-kbd">⌨ Space: play/pause · ← →: step · Home/End: jump · +/−: speed</div>`;

    const g = k => document.getElementById(id + k);
    this._cnt  = g('_c');  this._scr  = g('_s');
    this._bF   = g('_f');  this._bP   = g('_p');
    this._bPl  = g('_pl'); this._bN   = g('_n');
    this._bL   = g('_l');  this._spSel = g('_sp');

    this._bF.onclick   = () => this.first();
    this._bP.onclick   = () => this.prev();
    this._bPl.onclick  = () => this.togglePlayPause();
    this._bN.onclick   = () => this.next();
    this._bL.onclick   = () => this.last();
    this._scr.oninput  = e  => this.goToStep(+e.target.value);
    this._spSel.onchange = e => this.setSpeed(+e.target.value);
  }

  _pct(n) {
    const p = this.steps.length > 1 ? (n / (this.steps.length - 1)) * 100 : 0;
    if (this._scr) this._scr.style.setProperty('--sp', p + '%');
  }

  /* ── Core controls ─────────────────────────────────── */
  play() {
    if (this.playing) return;
    if (this.current >= this.steps.length - 1) this.current = 0;
    this.playing = true;
    this._bPl.textContent = '⏸'; this._bPl.setAttribute('aria-label', 'Pause');
    this._emit('play', { step: this.current });
    this._tick();
  }

  pause() {
    this.playing = false; clearTimeout(this._timer);
    this._bPl.textContent = '▶'; this._bPl.setAttribute('aria-label', 'Play');
    this._emit('pause', { step: this.current });
  }

  togglePlayPause() { this.playing ? this.pause() : this.play(); }

  goToStep(n) {
    const was = this.playing; this.pause();
    this.current = Math.max(0, Math.min(n, this.steps.length - 1));
    this.renderCurrentStep();
    this._emit('step-change', { step: this.current, total: this.steps.length });
    if (was && this.current < this.steps.length - 1) this.play();
  }

  next()  { if (this.current >= this.steps.length - 1) return; this.pause(); this.current++; this.renderCurrentStep(); this._emit('step-change', { step: this.current, total: this.steps.length }); }
  prev()  { if (this.current <= 0) return; this.pause(); this.current--; this.renderCurrentStep(); this._emit('step-change', { step: this.current, total: this.steps.length }); }
  first() { this.goToStep(0); }
  last()  { this.goToStep(this.steps.length - 1); }

  _tick() {
    if (!this.playing) return;
    if (this.current >= this.steps.length - 1) {
      this.pause(); this._emit('complete', { total: this.steps.length }); return;
    }
    this.current++; this.renderCurrentStep();
    this._emit('step-change', { step: this.current, total: this.steps.length });
    this._timer = setTimeout(() => this._tick(), this.getIntervalMs());
  }

  /* ── Speed ─────────────────────────────────────────── */
  setSpeed(m) {
    this._speed = m;
    [...this._spSel.options].forEach(o => o.selected = +o.value === m);
  }
  getIntervalMs() { return 700 / this._speed; }
  speedUp()   { const i = this._SPEEDS.indexOf(this._speed); if (i < this._SPEEDS.length - 1) this.setSpeed(this._SPEEDS[i + 1]); }
  slowDown()  { const i = this._SPEEDS.indexOf(this._speed); if (i > 0) this.setSpeed(this._SPEEDS[i - 1]); }

  /* ── Rendering ─────────────────────────────────────── */
  renderCurrentStep() {
    const step = this.steps[this.current];
    if (!step) return;
    this.renderFn(step);
    this.updateExplanation(step);
    this.updateStepCounter();
    this.updateButtonStates();
  }

  updateExplanation(step) {
    if (!this.expPanel) return;
    this.expPanel.className = 'sim-exp';
    this.expPanel.innerHTML =
      `<div class="sim-exp-title">${step.title || ''}</div>` +
      (step.what  ? `<div class="sim-exp-what">${step.what}</div>` : '') +
      (step.why   ? `<div class="sim-exp-why">${step.why}</div>`   : '') +
      (step.state ? `<div class="sim-exp-state">${step.state}</div>` : '');
  }

  updateStepCounter() {
    const txt = `Step ${this.current + 1} of ${this.steps.length}`;
    if (this._cnt)  this._cnt.textContent = txt;
    if (this._scr)  { this._scr.value = this.current; this._scr.setAttribute('aria-valuetext', txt); this._pct(this.current); }
  }

  updateButtonStates() {
    this._bF.disabled = this._bP.disabled = this.current === 0;
    this._bN.disabled = this._bL.disabled = this.current === this.steps.length - 1;
  }

  /* ── Keyboard shortcuts ────────────────────────────── */
  _kbd() {
    this._kh = e => {
      const t = document.activeElement?.tagName;
      if (t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA') return;
      switch (e.key) {
        case ' ': case 'Spacebar': e.preventDefault(); this.togglePlayPause(); break;
        case 'ArrowRight': e.preventDefault(); this.next();    break;
        case 'ArrowLeft':  e.preventDefault(); this.prev();    break;
        case 'Home':       e.preventDefault(); this.first();   break;
        case 'End':        e.preventDefault(); this.last();    break;
        case '+': case '=':  this.speedUp();   break;
        case '-': case '_':  this.slowDown();  break;
      }
    };
    document.addEventListener('keydown', this._kh);
  }

  /* ── Touch swipe ───────────────────────────────────── */
  _touch() {
    document.addEventListener('touchstart', e => {
      this._tx = e.touches[0].clientX; this._ty = e.touches[0].clientY;
    }, { passive: true });
    document.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - this._tx;
      const dy = e.changedTouches[0].clientY - this._ty;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40)
        dx < 0 ? this.next() : this.prev();
    }, { passive: true });
  }

  /* ── Custom events ─────────────────────────────────── */
  _emit(name, detail) {
    document.dispatchEvent(new CustomEvent('sim:' + name, { detail, bubbles: true }));
  }

  /* ── Cleanup ───────────────────────────────────────── */
  destroy() {
    this.pause();
    if (this._kh) document.removeEventListener('keydown', this._kh);
  }
}

/* ─────────────────────────────────────────────────────────── */
/* Legacy utilities (used by older pages)                       */
/* ─────────────────────────────────────────────────────────── */

function initLog(panelId) {
  const body = document.getElementById(panelId);
  const clear = body?.parentElement?.querySelector('.log-clear');
  if (clear) clear.onclick = () => { body.innerHTML = '<div class="log-entry info log-empty">Log cleared.</div>'; };
  return {
    post(msg, type = 'step') {
      if (!body) return;
      const empty = body.querySelector('.log-empty');
      if (empty) empty.remove();
      const ts = new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const el = document.createElement('div');
      el.className = `log-entry ${type}`;
      el.innerHTML = `<span class="log-ts">${ts}</span>${msg}`;
      body.appendChild(el);
      body.scrollTop = body.scrollHeight;
    },
    clear() { if (body) body.innerHTML = ''; }
  };
}

function animLoop(cb) {
  let id, running = false;
  return {
    start() { if (running) return; running = true; const step = () => { cb(); if (running) id = requestAnimationFrame(step); }; id = requestAnimationFrame(step); },
    stop()  { running = false; cancelAnimationFrame(id); },
    toggle(){ running ? this.stop() : this.start(); }
  };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const randInt = (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo;

function resizeCanvas(canvas, w, h) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = w * dpr; canvas.height = h * dpr;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr); return ctx;
}

function clearCanvas(ctx, canvas, bg = '#f7f6f2') {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height); }
}

function drawRect(ctx, x, y, w, h, fill, stroke, radius = 6) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, radius); else ctx.rect(x, y, w, h);
  if (fill)   { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
}

function drawText(ctx, text, x, y, { font = '13px Inter,sans-serif', fill = '#1a1a2e', align = 'center', baseline = 'middle' } = {}) {
  ctx.font = font; ctx.fillStyle = fill;
  ctx.textAlign = align; ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
}

function drawArrow(ctx, x1, y1, x2, y2, color = '#1a1a2e', head = 10) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}

function drawCircle(ctx, cx, cy, r, fill, stroke) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  if (fill)   { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}

function drawBars(ctx, arr, W, H, highlights = {}, accent = '#2a7ae8') {
  const pad = 4, barW = (W - pad * 2) / arr.length - 2;
  const maxV = Math.max(...arr, 1);
  clearCanvas(ctx, ctx.canvas);
  arr.forEach((v, i) => {
    const x = pad + i * (barW + 2);
    const bh = ((v / maxV) * (H - 40)) || 2;
    const y = H - bh - 20;
    const col = highlights[i] || accent;
    drawRect(ctx, x, y, barW, bh, col, null, 4);
    if (arr.length <= 20) drawText(ctx, v, x + barW / 2, H - 8, { font: '11px JetBrains Mono,monospace', fill: '#5a5a72' });
  });
}

const speedToMs = v => Math.round(1200 / v);

function toggleBtn(btn, activeLabel, inactiveLabel, active) {
  btn.textContent = active ? activeLabel : inactiveLabel;
  btn.setAttribute('aria-pressed', active);
}

Object.assign(window, {
  SimulationPlayer,
  initLog, animLoop, sleep, shuffle, randInt,
  resizeCanvas, clearCanvas, drawRect, drawText, drawArrow, drawCircle,
  drawBars, speedToMs, toggleBtn
});
