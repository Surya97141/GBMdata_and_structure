/* DS/Algo Explorer — Shared JS Utilities */

/* ── Log helper ─────────────────────────────────────────────── */
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

/* ── Animation frame throttle ────────────────────────────────── */
function animLoop(cb) {
  let id, running = false;
  return {
    start() { if (running) return; running = true; const step = () => { cb(); if (running) id = requestAnimationFrame(step); }; id = requestAnimationFrame(step); },
    stop()  { running = false; cancelAnimationFrame(id); },
    toggle(){ running ? this.stop() : this.start(); }
  };
}

/* ── Sleep (promise-based) ───────────────────────────────────── */
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── Shuffle array (Fisher-Yates) ───────────────────────────── */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ── Random int in [lo, hi] ─────────────────────────────────── */
const randInt = (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo;

/* ── Canvas helpers ─────────────────────────────────────────── */
function resizeCanvas(canvas, w, h) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return ctx;
}

function clearCanvas(ctx, canvas, bg = '#f7f6f2') {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height); }
}

function drawRect(ctx, x, y, w, h, fill, stroke, radius = 6) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  if (fill)   { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
}

function drawText(ctx, text, x, y, { font = '13px Inter, sans-serif', fill = '#1a1a2e', align = 'center', baseline = 'middle' } = {}) {
  ctx.font = font;
  ctx.fillStyle = fill;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
}

function drawArrow(ctx, x1, y1, x2, y2, color = '#1a1a2e', head = 10) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawCircle(ctx, cx, cy, r, fill, stroke) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  if (fill)   { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}

/* ── Bar chart for sorting visualizations ───────────────────── */
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
    if (arr.length <= 20) drawText(ctx, v, x + barW / 2, H - 8, { font: '11px JetBrains Mono, monospace', fill: '#5a5a72' });
  });
}

/* ── Speed slider value → ms delay ─────────────────────────── */
const speedToMs = v => Math.round(1200 / v);

/* ── Accessible button toggle ───────────────────────────────── */
function toggleBtn(btn, activeLabel, inactiveLabel, active) {
  btn.textContent = active ? activeLabel : inactiveLabel;
  btn.setAttribute('aria-pressed', active);
}

/* ── Export to global scope ─────────────────────────────────── */
Object.assign(window, {
  initLog, animLoop, sleep, shuffle, randInt,
  resizeCanvas, clearCanvas, drawRect, drawText, drawArrow, drawCircle,
  drawBars, speedToMs, toggleBtn
});
