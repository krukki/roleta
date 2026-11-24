/* Sons sintetizados com Web Audio API — nenhum arquivo de áudio necessário. */
(function () {
  const R = (window.R = window.R || {});
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let drumTimer = null;

  const muted = () => !!(R.store && R.store.state.settings.muted);

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
      } catch (e) {
        return null;
      }
      master = ctx.createGain();
      master.gain.value = 0.7;
      master.connect(ctx.destination);
      const len = ctx.sampleRate * 2;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function envelope(g, t, attack, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
  }

  function tone(freq, dur, o = {}) {
    if (muted()) return;
    const c = ac();
    if (!c) return;
    const t = c.currentTime + (o.when || 0);
    const osc = c.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t + dur);
    const g = c.createGain();
    envelope(g, t, o.attack || 0.005, o.vol || 0.2, dur);
    let node = osc;
    if (o.lp) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
      osc.connect(f);
      node = f;
    }
    if (o.vibrato) {
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = 6;
      lg.gain.value = o.vibrato;
      lfo.connect(lg);
      lg.connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.1);
    }
    node.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + (o.attack || 0.005) + dur + 0.05);
  }

  function noise(dur, o = {}) {
    if (muted()) return;
    const c = ac();
    if (!c) return;
    const t = c.currentTime + (o.when || 0);
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const f = c.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1200, t);
    if (o.freqTo) f.frequency.exponentialRampToValueAtTime(o.freqTo, t + dur);
    f.Q.value = o.q || 0.8;
    const g = c.createGain();
    envelope(g, t, o.attack || 0.003, o.vol || 0.2, dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.1);
  }

  const A = {
    unlock() {
      ac();
    },
    tick() {
      tone(1700, 0.025, { type: 'square', vol: 0.06 });
      noise(0.02, { filter: 'highpass', freq: 3500, vol: 0.12 });
    },
    whoosh() {
      noise(0.7, { filter: 'bandpass', freq: 400, freqTo: 2500, q: 1.2, vol: 0.18, attack: 0.08 });
    },
    drumStart() {
      A.drumStop(true);
      if (muted()) return;
      const t0 = performance.now();
      drumTimer = setInterval(() => {
        const k = Math.min(1, (performance.now() - t0) / 7000);
        const v = 0.05 + k * 0.22;
        noise(0.05, { filter: 'bandpass', freq: 1900, q: 0.6, vol: v });
        tone(150, 0.04, { type: 'triangle', vol: v * 0.5 });
      }, 42);
    },
    drumStop(silent) {
      clearInterval(drumTimer);
      drumTimer = null;
      if (silent) return;
      noise(1.3, { filter: 'highpass', freq: 5000, vol: 0.22 });
      tone(70, 0.6, { type: 'triangle', vol: 0.5 });
    },
    ding() {
      tone(880, 0.5, { type: 'triangle', vol: 0.22 });
      tone(1318, 0.7, { type: 'triangle', vol: 0.18, when: 0.09 });
    },
    beep(high) {
      tone(high ? 1046 : 523, high ? 0.35 : 0.14, { type: 'square', vol: 0.1 });
    },
    tap() {
      tone(500 + Math.random() * 300, 0.04, { type: 'triangle', vol: 0.09 });
    },
    buzz() {
      tone(110, 0.55, { type: 'sawtooth', vol: 0.16, lp: 900 });
      tone(116, 0.55, { type: 'sawtooth', vol: 0.12, lp: 900 });
    },
    win() {
      [659, 784, 1046].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.18, when: i * 0.09 }));
    },
    canOpen() {
      noise(0.03, { filter: 'highpass', freq: 1800, vol: 0.55 });
      tone(2400, 0.03, { type: 'square', vol: 0.06 });
      noise(1.2, { filter: 'highpass', freq: 7000, freqTo: 2200, vol: 0.22, when: 0.05, attack: 0.03 });
    },
    trombone() {
      const notes = [
        [392, 0.32],
        [370, 0.32],
        [349, 0.32],
        [330, 1.1],
      ];
      let w = 0;
      notes.forEach(([f, d], i) => {
        tone(f, d, { type: 'sawtooth', vol: 0.13, lp: 1300, when: w, attack: 0.03, vibrato: i === 3 ? 7 : 0 });
        w += d + 0.06;
      });
    },
    fanfare() {
      [[523, 0], [659, 0.12], [784, 0.24], [1046, 0.36]].forEach(([f, w]) =>
        tone(f, w === 0.36 ? 0.6 : 0.14, { type: 'triangle', vol: 0.2, when: w })
      );
      [[523, 0.36], [659, 0.36], [784, 0.36]].forEach(([f, w]) => tone(f, 0.6, { type: 'square', vol: 0.05, when: w }));
    },
    slot() {
      tone(1200, 0.03, { type: 'square', vol: 0.05 });
    },
  };

  R.audio = A;
})();
