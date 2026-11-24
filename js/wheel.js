/* Roleta em <canvas>. O vencedor é decidido ANTES; a animação só leva a roleta até ele. */
(function () {
  const R = (window.R = window.R || {});
  const TAU = Math.PI * 2;
  const FONT = '"Lilita One", "Arial Black", Impact, sans-serif';
  const mod = (a, n) => ((a % n) + n) % n;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
  const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

  class Wheel {
    constructor(canvas) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.items = [];
      this.rot = 0;
      this.lights = 0;
      this.highlight = -1;
      this.hlOn = false;
      this.imgs = new Map();
      this.raf = 0;
      this.idleRaf = 0;
      this.size = 0;
      this.dpr = 1;
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(canvas);
      this.resize();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this.draw());
    }

    destroy() {
      cancelAnimationFrame(this.raf);
      cancelAnimationFrame(this.idleRaf);
      clearInterval(this.flashTimer);
      this.ro.disconnect();
      this.dead = true;
    }

    resize() {
      const rect = this.c.getBoundingClientRect();
      const size = Math.round(rect.width) || 320;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      if (size === this.size && dpr === this.dpr) return;
      this.size = size;
      this.dpr = dpr;
      this.c.width = Math.round(size * dpr);
      this.c.height = Math.round(size * dpr);
      this.draw();
    }

    setItems(items) {
      this.items = items.slice();
      this.highlight = -1;
      items.forEach((it) => {
        if (it.photo && !this.imgs.has(it.photo)) {
          const im = new Image();
          im.onload = () => this.draw();
          im.src = it.photo;
          this.imgs.set(it.photo, im);
        }
      });
      this.draw();
    }

    imgFor(it) {
      const im = it.photo && this.imgs.get(it.photo);
      return im && im.complete && im.naturalWidth ? im : null;
    }

    seg() {
      return TAU / Math.max(1, this.items.length);
    }

    /** Índice da fatia que está sob o ponteiro (no topo) para uma rotação. */
    indexAt(rot = this.rot) {
      const n = this.items.length;
      if (!n) return -1;
      const p = mod(-Math.PI / 2 - rot, TAU);
      return Math.min(n - 1, Math.floor(p / this.seg()));
    }

    draw() {
      const ctx = this.ctx;
      const S = this.size;
      if (!S || this.dead) return;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, S, S);
      const cx = S / 2;
      const cy = S / 2;
      const Ro = S / 2 - 2;
      const Rs = Ro - S * 0.05;

      // Aro
      ctx.beginPath();
      ctx.arc(cx, cy, Ro, 0, TAU);
      const g = ctx.createRadialGradient(cx, cy, Rs, cx, cy, Ro);
      g.addColorStop(0, '#5e000a');
      g.addColorStop(1, '#b3001b');
      ctx.fillStyle = g;
      ctx.fill();

      // Lâmpadas
      const nb = 24;
      const br = Math.max(2.5, S * 0.009);
      const bR = (Ro + Rs) / 2;
      for (let i = 0; i < nb; i++) {
        const a = (i / nb) * TAU;
        const on = (i + this.lights) % 2 === 0;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * bR, cy + Math.sin(a) * bR, br, 0, TAU);
        ctx.fillStyle = on ? '#fff3b0' : '#7d1a22';
        ctx.shadowColor = on ? 'rgba(255,230,120,0.95)' : 'transparent';
        ctx.shadowBlur = on ? br * 3 : 0;
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';

      // Fatias
      const n = this.items.length;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(this.rot);
      if (n === 0) {
        ctx.beginPath();
        ctx.arc(0, 0, Rs, 0, TAU);
        ctx.fillStyle = '#f6e9dc';
        ctx.fill();
      } else {
        const seg = TAU / n;
        for (let i = 0; i < n; i++) {
          const it = this.items[i];
          const a0 = i * seg;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, Rs, a0, a0 + seg);
          ctx.closePath();
          ctx.fillStyle = it.color;
          ctx.fill();
          // brilho radial sutil
          const sh = ctx.createRadialGradient(0, 0, Rs * 0.2, 0, 0, Rs);
          sh.addColorStop(0, 'rgba(255,255,255,0.10)');
          sh.addColorStop(1, 'rgba(0,0,0,0.12)');
          ctx.fillStyle = sh;
          ctx.fill();
          if (i === this.highlight && this.hlOn) {
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.fill();
          }
          if (n > 1) {
            ctx.lineWidth = Math.max(1.5, S * 0.006);
            ctx.strokeStyle = 'rgba(255,255,255,0.95)';
            ctx.stroke();
          }

          // Rótulo: foto perto da borda + nome
          ctx.save();
          ctx.rotate(a0 + seg / 2);
          const img = this.imgFor(it);
          const ph = img ? Math.min(Rs * 0.22, n > 1 ? 2 * Math.sin(Math.min(seg, Math.PI) / 2) * Rs * 0.78 * 0.8 : Rs * 0.3) : 0;
          let right = Rs * 0.9;
          if (ph > 6) {
            const pcx = Rs * 0.92 - ph / 2;
            ctx.save();
            ctx.translate(pcx, 0);
            ctx.beginPath();
            ctx.arc(0, 0, ph / 2 + 2, 0, TAU);
            ctx.fillStyle = '#fff';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(0, 0, ph / 2, 0, TAU);
            ctx.clip();
            ctx.rotate(Math.PI / 2);
            ctx.drawImage(img, -ph / 2, -ph / 2, ph, ph);
            ctx.restore();
            right = Rs * 0.92 - ph - Rs * 0.05;
          }
          const left = Rs * 0.2;
          let fs = n > 1 ? Math.min(Rs * 0.11, Math.sin(Math.min(seg, Math.PI) / 2) * Rs * 0.55) : Rs * 0.12;
          fs = Math.max(10, fs);
          ctx.font = `${fs}px ${FONT}`;
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = R.ui.textOn(it.color);
          let name = it.name;
          const maxW = Math.max(20, right - left);
          if (ctx.measureText(name).width > maxW) {
            while (name.length > 1 && ctx.measureText(name + '…').width > maxW) name = name.slice(0, -1);
            name += '…';
          }
          ctx.fillText(name, right, 1);
          ctx.restore();
        }
      }

      // Tampinha central (gira junto)
      const hr = Rs * 0.17;
      const crimps = 21;
      ctx.beginPath();
      for (let i = 0; i <= crimps * 2; i++) {
        const a = (i / (crimps * 2)) * TAU;
        const r = i % 2 ? hr * 0.9 : hr;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = '#d90f22';
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#8c0010';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, hr * 0.7, 0, TAU);
      ctx.fillStyle = '#fff7ec';
      ctx.fill();
      ctx.restore();

      // Texto central (não gira)
      ctx.font = `${hr * 0.5}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#d90f22';
      ctx.fillText(n === 0 ? '?' : 'COCA', cx, cy + 1);
    }

    /** Giro lento decorativo (tela inicial). */
    startIdle() {
      this.stopIdle();
      let last = performance.now();
      let lightT = 0;
      const loop = (now) => {
        const dt = Math.min(64, now - last);
        last = now;
        this.rot = mod(this.rot + dt * 0.00018, TAU);
        lightT += dt;
        if (lightT > 550) {
          lightT = 0;
          this.lights++;
        }
        this.draw();
        this.idleRaf = requestAnimationFrame(loop);
      };
      this.idleRaf = requestAnimationFrame(loop);
    }

    stopIdle() {
      cancelAnimationFrame(this.idleRaf);
    }

    /**
     * Gira até a fatia `index`.
     * nearMiss: a roleta quase para na vizinha e anda mais um pouquinho até o alvo.
     */
    spinTo(index, { duration = 6000, nearMiss = false, spins, onTick } = {}) {
      this.stopIdle();
      cancelAnimationFrame(this.raf);
      this.highlight = -1;
      const seg = this.seg();
      const offsetFrac = nearMiss ? R.rand.range(0.9, 0.95) : R.rand.range(0.2, 0.8);
      const targetMod = mod(-Math.PI / 2 - (index + offsetFrac) * seg, TAU);
      const r0 = this.rot;
      const k = spins != null ? spins : 5 + R.rand.int(3);
      const F = r0 + mod(targetMod - mod(r0, TAU), TAU) + k * TAU;
      const crawl = nearMiss ? 1500 : 0;
      const d = nearMiss ? seg * 0.22 : 0;
      const T1 = Math.max(1000, duration - crawl);
      const total = T1 + crawl;
      const ease = nearMiss ? easeOutCubic : easeOutQuart;

      return new Promise((resolve) => {
        const t0 = performance.now();
        let lastIdx = this.indexAt(r0);
        const frame = (now) => {
          if (this.dead) return resolve(index);
          const t = now - t0;
          let r;
          if (t < T1) r = r0 + (F - d - r0) * ease(t / T1);
          else if (t < total) r = F - d + d * easeInOutSine((t - T1) / crawl);
          else r = F;
          this.rot = r;
          this.lights = Math.floor(t / 90);
          const idx = this.indexAt(r);
          if (idx !== lastIdx) {
            lastIdx = idx;
            onTick && onTick(idx);
          }
          this.draw();
          if (t < total) {
            this.raf = requestAnimationFrame(frame);
          } else {
            this.rot = mod(F, TAU);
            this.draw();
            resolve(this.indexAt());
          }
        };
        this.raf = requestAnimationFrame(frame);
      });
    }

    /** Pisca a fatia sorteada. */
    flash(index, times = 6) {
      this.highlight = index;
      let k = 0;
      clearInterval(this.flashTimer);
      this.flashTimer = setInterval(() => {
        this.hlOn = !this.hlOn;
        this.draw();
        if (++k >= times * 2) {
          clearInterval(this.flashTimer);
          this.hlOn = true;
          this.draw();
        }
      }, 110);
    }
  }

  R.Wheel = Wheel;
})();
