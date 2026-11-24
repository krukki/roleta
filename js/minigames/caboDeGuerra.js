/* Cabo de Guerra da Lata: cada toque puxa a lata para o seu lado. */
(function () {
  const R = window.R;
  const { mg } = R;
  const STEP = 0.055;

  const CAN_SVG = `
    <svg viewBox="0 0 40 70" width="44" height="77" aria-hidden="true">
      <rect x="4" y="6" width="32" height="58" rx="7" fill="#d90f22" stroke="#7d000d" stroke-width="2"/>
      <rect x="7" y="2" width="26" height="7" rx="3" fill="#cfd4da" stroke="#8b9299" stroke-width="1.5"/>
      <rect x="7" y="61" width="26" height="6" rx="3" fill="#cfd4da" stroke="#8b9299" stroke-width="1.5"/>
      <path d="M4 32 C 14 24, 26 42, 36 30" stroke="#fff" stroke-width="4" fill="none"/>
      <rect x="9" y="12" width="4" height="40" rx="2" fill="rgba(255,255,255,0.35)"/>
    </svg>`;

  mg.register({
    key: 'cabo',
    name: 'Cabo de Guerra da Lata',
    emoji: '🪢',
    split: true,
    how: 'Tem uma lata no meio da tela. Cada toque na sua metade <b>puxa a lata para o seu lado</b>. Quem trouxer a lata até a sua ponta escapa!',
    start(container, a, b) {
      return new Promise(async (resolve) => {
        const ar = mg.arena(container, a, b);
        const P = { a, b };
        const can = document.createElement('div');
        can.className = 'tug-can';
        can.innerHTML = CAN_SVG;
        ar.el.appendChild(can);
        let pos = 0; // -1 = ponta do A (cima), +1 = ponta do B (baixo)
        let armed = false;
        let lastSound = 0;
        const place = () => {
          can.style.top = `${50 + pos * 40}%`;
        };
        place();

        ar.onTap((side) => {
          if (!armed) return;
          pos += side === 'a' ? -STEP : STEP;
          place();
          const now = performance.now();
          if (now - lastSound > 45) {
            lastSound = now;
            R.audio.tap();
          }
          if (Math.abs(pos) >= 1) {
            armed = false;
            const w = pos < 0 ? 'a' : 'b';
            const l = w === 'a' ? 'b' : 'a';
            pos = w === 'a' ? -1 : 1;
            place();
            R.audio.win();
            mg.finish(ar, w, 'Puxou a lata! 💪', 'Perdeu a lata 😩');
            setTimeout(() => {
              ar.destroy();
              resolve({ winner: P[w], loser: P[l], detail: `${P[w].name} puxou a lata` });
            }, 2600);
          }
        });

        ar.small('both', 'Toque pra puxar a lata!');
        await mg.countdown(ar);
        ar.state('both', 'go');
        ar.big('both', 'PUXA!');
        ar.small('both', 'toca toca toca!');
        armed = true;
      });
    },
  });
})();
