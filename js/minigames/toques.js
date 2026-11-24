/* Batalha de Toques: 5 segundos, quem tocar mais vezes ganha. */
(function () {
  const R = window.R;
  const { mg } = R;
  const DURATION = 5000;

  mg.register({
    key: 'toques',
    name: 'Batalha de Toques',
    emoji: '👆',
    split: true,
    how: 'Vocês têm <b>5 segundos</b>. Toquem o mais rápido que conseguirem na sua metade da tela. Quem tocar <b>mais vezes</b> escapa!',
    start(container, a, b) {
      return new Promise(async (resolve) => {
        const ar = mg.arena(container, a, b);
        const P = { a, b };
        const count = { a: 0, b: 0 };
        let armed = false;
        let lastSound = 0;

        ar.onTap((side) => {
          if (!armed) return;
          count[side]++;
          ar.big(side, `<span class="score">${count[side]}</span>`);
          const now = performance.now();
          if (now - lastSound > 45) {
            lastSound = now;
            R.audio.tap();
          }
        });

        ar.small('both', 'Toque o máximo que puder!');
        await mg.countdown(ar);
        ar.state('both', 'go');
        ar.big('both', '<span class="score">0</span>');
        ar.small('both', 'VAI VAI VAI!');
        armed = true;
        const t0 = performance.now();
        await new Promise((done) => {
          const tick = () => {
            const left = DURATION - (performance.now() - t0);
            ar.bar(left / DURATION);
            if (left <= 0) return done();
            ar.small('both', `${(left / 1000).toFixed(1).replace('.', ',')} s`);
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
        armed = false;
        ar.bar(0);

        if (count.a === count.b) {
          ar.state('both', '');
          ar.big('both', `<span class="score">${count.a}</span>`);
          ar.small('both', 'Empate!');
          await mg.sleep(1500);
          ar.destroy();
          return resolve({ tie: true });
        }
        const w = count.a > count.b ? 'a' : 'b';
        const l = w === 'a' ? 'b' : 'a';
        R.audio.win();
        mg.finish(ar, w, `${count[w]} toques`, `${count[l]} toques`);
        setTimeout(() => {
          ar.destroy();
          resolve({ winner: P[w], loser: P[l], detail: `${count[w]} x ${count[l]} toques` });
        }, 2600);
      });
    },
  });
})();
