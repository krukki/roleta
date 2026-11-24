/* Duelo de Reflexo: quem tocar primeiro quando ficar verde ganha. Tocou antes, queimou. */
(function () {
  const R = window.R;
  const { mg } = R;

  mg.register({
    key: 'reflexo',
    name: 'Duelo de Reflexo',
    emoji: '⚡',
    split: true,
    how: 'A tela fica vermelha escrito <b>ESPERA…</b> e de repente fica <b>VERDE</b>. Quem tocar primeiro ganha. Quem tocar antes do verde <b>queima</b> e perde na hora!',
    start(container, a, b) {
      return new Promise(async (resolve) => {
        const ar = mg.arena(container, a, b);
        const P = { a, b };
        let armed = false;
        let green = false;
        let done = false;
        let greenAt = 0;
        let timer = null;

        ar.onTap((side) => {
          if (!armed || done) return;
          done = true;
          clearTimeout(timer);
          const other = side === 'a' ? 'b' : 'a';
          if (!green) {
            R.audio.buzz();
            mg.finish(ar, other, `${P[side].name} queimou!`, 'Queimou a largada! 🔥');
            end({ winner: P[other], loser: P[side], burned: true, detail: `${P[side].name} queimou a largada 🔥` });
          } else {
            const ms = Math.round(performance.now() - greenAt);
            R.audio.win();
            mg.finish(ar, side, `${ms} ms ⚡`, 'Lento demais 🐢');
            end({ winner: P[side], loser: P[other], detail: `${P[side].name} reagiu em ${ms} ms` });
          }
        });

        function end(r) {
          setTimeout(() => {
            ar.destroy();
            resolve(r);
          }, 2600);
        }

        ar.small('both', 'Toque na SUA metade quando ficar verde');
        await mg.countdown(ar);
        ar.state('both', 'wait');
        ar.big('both', 'ESPERA…');
        ar.small('both', 'não toca ainda!');
        armed = true;
        timer = setTimeout(() => {
          if (done) return;
          green = true;
          greenAt = performance.now();
          ar.state('both', 'go');
          ar.big('both', 'TOCA!');
          ar.small('both', '');
          R.audio.beep(true);
        }, R.rand.range(1600, 5000));
      });
    },
  });
})();
