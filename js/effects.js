/* Efeitos visuais: confete + tampinhas (canvas), bolhas, tremida e flash. */
(function () {
  const R = (window.R = window.R || {});
  const TAU = Math.PI * 2;
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let canvas = null;
  let ctx = null;
  let parts = [];
  let raf = 0;
  let last = 0;

  function ensure() {
    if (!canvas) {
      canvas = document.getElementById('fx');
      ctx = canvas.getContext('2d');
      window.addEventListener('resize', size);
      size();
    }
  }
  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const COLORS = ['#e10f1f', '#ffffff', '#ffc531', '#ff5a5f', '#fff3b0', '#1ec760'];

  function drawCap(p) {
    const r = p.size;
    const n = 21;
    ctx.beginPath();
    for (let i = 0; i <= n * 2; i++) {
      const a = (i / (n * 2)) * TAU;
      const rr = i % 2 ? r * 0.86 : r;
      i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = '#d50f20';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#7d000d';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.58, 0, TAU);
    ctx.fillStyle = '#fbeee6';
    ctx.fill();
  }

  function loop(now) {
    const dt = Math.min(40, now - last) / 16.67;
    last = now;
    const W = window.innerWidth;
    const H = window.innerHeight;
    ctx.clearRect(0, 0, W, H);
    parts = parts.filter((p) => p.y < H + 40 && p.life > 0);
    for (const p of parts) {
      p.vy += p.g * dt;
      p.vx *= Math.pow(p.drag, dt);
      p.vy *= Math.pow(p.drag, dt);
      p.x += p.vx * dt + Math.sin((now / 300) + p.wob) * 0.4;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.tilt += p.vt * dt;
      p.life -= dt;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.tilt));
      ctx.globalAlpha = Math.min(1, p.life / 30);
      if (p.shape === 'cap') drawCap(p);
      else if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, TAU);
        ctx.fillStyle = p.color;
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }
      ctx.restore();
    }
    if (parts.length) raf = requestAnimationFrame(loop);
    else ctx.clearRect(0, 0, W, H);
  }

  function spawn(p) {
    parts.push({
      rot: Math.random() * TAU,
      vr: (Math.random() - 0.5) * 0.3,
      tilt: Math.random() * TAU,
      vt: 0.05 + Math.random() * 0.15,
      wob: Math.random() * TAU,
      drag: 0.985,
      g: 0.22,
      life: 260 + Math.random() * 120,
      ...p,
    });
  }

  /**
   * Explosão de confete. origin: 'cannons' (dos cantos de baixo) | 'top' (chuva) | 'center'.
   */
  function confetti({ count = 140, caps = true, colors = COLORS, origin = 'cannons' } = {}) {
    ensure();
    if (reduced()) count = Math.round(count / 4);
    const W = window.innerWidth;
    const H = window.innerHeight;
    for (let i = 0; i < count; i++) {
      const isCap = caps && Math.random() < 0.18;
      const base = {
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: isCap ? 'cap' : Math.random() < 0.25 ? 'circle' : 'rect',
        size: isCap ? 9 + Math.random() * 6 : 7 + Math.random() * 7,
      };
      if (origin === 'top') {
        spawn({ ...base, x: Math.random() * W, y: -20 - Math.random() * H * 0.5, vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 2, g: 0.06, drag: 0.99 });
      } else if (origin === 'center') {
        const a = Math.random() * TAU;
        const s = 4 + Math.random() * 9;
        spawn({ ...base, x: W / 2, y: H * 0.42, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 3 });
      } else {
        const left = i % 2 === 0;
        const ang = (left ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.6;
        const s = 11 + Math.random() * 10;
        spawn({ ...base, x: left ? -10 : W + 10, y: H * 0.9, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s });
      }
    }
    cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function shake(el, strength = 10, duration = 600) {
    if (!el || reduced() || !el.animate) return;
    const k = [];
    for (let i = 0; i < 10; i++) {
      const s = strength * (1 - i / 10);
      k.push({ transform: `translate(${(Math.random() - 0.5) * 2 * s}px, ${(Math.random() - 0.5) * 2 * s}px) rotate(${(Math.random() - 0.5) * s * 0.3}deg)` });
    }
    k.push({ transform: 'none' });
    el.animate(k, { duration, easing: 'ease-out' });
  }

  function flash(color = '#ffffff') {
    const d = document.createElement('div');
    d.className = 'flash';
    d.style.background = color;
    document.body.appendChild(d);
    d.addEventListener('animationend', () => d.remove());
  }

  function bubbles(container, n = 22) {
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const b = document.createElement('span');
      const s = 6 + Math.random() * 26;
      b.style.width = b.style.height = `${s}px`;
      b.style.left = `${Math.random() * 100}%`;
      b.style.animationDuration = `${9 + Math.random() * 14}s`;
      b.style.animationDelay = `${-Math.random() * 20}s`;
      b.style.setProperty('--drift', `${(Math.random() - 0.5) * 60}px`);
      container.appendChild(b);
    }
  }

  R.fx = { confetti, shake, flash, bubbles };
})();
