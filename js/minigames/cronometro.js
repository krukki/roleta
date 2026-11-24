/* Cronômetro 5,00: cada um tenta parar em exatamente 5 segundos, sem ver o tempo. */
(function () {
  const R = window.R;
  const { mg } = R;
  const U = R.ui;
  const TARGET = 5;
  const fmt = (t, d = 2) => t.toFixed(d).replace('.', ',');

  function turn(container, p, idx) {
    return new Promise((resolve) => {
      container.innerHTML = `
        <div class="crono">
          <div class="crono-turn">${idx === 0 ? '1º' : '2º'} jogador</div>
          <div class="crono-who">${U.avatar(p, 'lg')}<b>Vez de ${U.esc(p.name)}</b></div>
          <p>Pare o cronômetro em exatamente <b>5,00 s</b>.<br>O tempo some depois de 1 segundo!</p>
          <div class="crono-display">0,00</div>
          <button type="button" class="btn big primary crono-btn">COMEÇAR</button>
        </div>`;
      const disp = container.querySelector('.crono-display');
      const btn = container.querySelector('.crono-btn');
      let state = 'ready';
      let t0 = 0;
      let raf = 0;
      const loop = () => {
        const t = (performance.now() - t0) / 1000;
        if (t < 1) disp.textContent = fmt(t);
        else if (!disp.classList.contains('hidden-time')) {
          disp.textContent = '??,??';
          disp.classList.add('hidden-time');
        }
        if (t > 20) return stop();
        raf = requestAnimationFrame(loop);
      };
      const stop = () => {
        if (state !== 'run') return;
        state = 'done';
        const t = (performance.now() - t0) / 1000;
        cancelAnimationFrame(raf);
        disp.classList.remove('hidden-time');
        disp.textContent = '✓';
        btn.textContent = 'Anotado!';
        btn.disabled = true;
        R.audio.ding();
        setTimeout(() => resolve(t), 1100);
      };
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (state === 'ready') {
          state = 'run';
          t0 = performance.now();
          btn.textContent = 'PARAR';
          btn.classList.add('stop');
          R.audio.beep(false);
          raf = requestAnimationFrame(loop);
        } else stop();
      });
    });
  }

  mg.register({
    key: 'cronometro',
    name: 'Cronômetro 5,00',
    emoji: '⏱️',
    split: false,
    how: 'Um de cada vez. Aperte <b>COMEÇAR</b> e tente parar em <b>exatamente 5,00 segundos</b>. O tempo some da tela depois de 1 segundo. Quem chegar <b>mais perto</b> escapa!',
    async start(container, a, b) {
      const order = R.rand.int(2) === 0 ? [a, b] : [b, a];
      const times = {};
      for (let i = 0; i < order.length; i++) times[order[i].id] = await turn(container, order[i], i);

      const diff = (p) => Math.round(Math.abs(times[p.id] - TARGET) * 1000);
      container.innerHTML = `
        <div class="crono crono-reveal">
          <h2>Resultado</h2>
          ${order
            .map(
              (p) => `
            <div class="crono-row" data-id="${U.esc(p.id)}">
              ${U.avatar(p, 'md')}
              <b>${U.esc(p.name)}</b>
              <span class="crono-time">…</span>
            </div>`
            )
            .join('')}
          <p class="crono-verdict"></p>
        </div>`;
      for (const p of order) {
        await mg.sleep(800);
        const row = container.querySelector(`[data-id="${CSS.escape(p.id)}"] .crono-time`);
        const d = times[p.id] - TARGET;
        row.innerHTML = `${fmt(times[p.id], 3)} s <small>(${d >= 0 ? '+' : '−'}${fmt(Math.abs(d), 3)})</small>`;
        R.audio.beep(true);
      }
      await mg.sleep(700);
      if (diff(a) === diff(b)) {
        await mg.sleep(800);
        return { tie: true };
      }
      const [w, l] = diff(a) < diff(b) ? [a, b] : [b, a];
      container.querySelector(`[data-id="${CSS.escape(w.id)}"]`).classList.add('win');
      container.querySelector(`[data-id="${CSS.escape(l.id)}"]`).classList.add('lose');
      container.querySelector('.crono-verdict').innerHTML = `<b>${U.esc(l.name)}</b> paga a coca! 🥤`;
      R.audio.win();
      await mg.sleep(2400);
      return {
        winner: w,
        loser: l,
        detail: `${w.name} ${fmt(times[w.id], 3)} s x ${fmt(times[l.id], 3)} s ${l.name}`,
      };
    },
  });
})();
