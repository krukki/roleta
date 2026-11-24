/* Infra dos minigames: registro, arena de tela dividida, contagem, revanche em empate. */
(function () {
  const R = (window.R = window.R || {});
  const U = R.ui;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const mg = (R.mg = { list: [], byKey: {}, sleep });

  /**
   * Cada minigame: { key, name, emoji, how, split, start(container, a, b) -> Promise<{winner, loser, detail, burned?} | {tie: true}> }
   */
  mg.register = (g) => {
    mg.list.push(g);
    mg.byKey[g.key] = g;
  };

  /**
   * Arena de 2 jogadores no mesmo celular deitado na mesa.
   * Jogador A fica na metade de cima (girada 180°), jogador B na de baixo.
   */
  mg.arena = function (container, a, b) {
    container.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'arena';
    const half = (side, p) => `
      <div class="half ${side === 'a' ? 'top' : 'bottom'}" data-side="${side}" style="--pc:${U.esc(p.color)}">
        <div class="half-inner">
          <div class="who">${U.avatar(p, 'sm')}<span>${U.esc(p.name)}</span></div>
          <div class="big"></div>
          <div class="small"></div>
        </div>
      </div>`;
    el.innerHTML = half('a', a) + '<div class="mid"><div class="mid-bar"></div></div>' + half('b', b);
    container.appendChild(el);
    const H = { a: el.querySelector('[data-side=a]'), b: el.querySelector('[data-side=b]') };
    let tapFn = null;
    const handler = (e) => {
      e.preventDefault();
      tapFn && tapFn(e.currentTarget.dataset.side, e);
    };
    H.a.addEventListener('pointerdown', handler);
    H.b.addEventListener('pointerdown', handler);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    const sides = (s) => (s === 'both' ? ['a', 'b'] : [s]);
    return {
      el,
      H,
      big(side, html) {
        sides(side).forEach((s) => (H[s].querySelector('.big').innerHTML = html));
      },
      small(side, html) {
        sides(side).forEach((s) => (H[s].querySelector('.small').innerHTML = html));
      },
      state(side, st) {
        sides(side).forEach((s) => (H[s].dataset.state = st || ''));
      },
      bar(frac) {
        el.querySelector('.mid-bar').style.transform = `scaleX(${Math.max(0, Math.min(1, frac))})`;
      },
      onTap(fn) {
        tapFn = fn;
      },
      destroy() {
        tapFn = null;
        el.remove();
      },
    };
  };

  mg.countdown = async function (ar) {
    for (const n of [3, 2, 1]) {
      ar.big('both', `<span class="count">${n}</span>`);
      R.audio.beep(false);
      await sleep(750);
    }
  };

  /** Marca vencedor/perdedor nas duas metades. */
  mg.finish = function (ar, winSide, extraWin = '', extraLose = '') {
    const loseSide = winSide === 'a' ? 'b' : 'a';
    ar.state(winSide, 'win');
    ar.state(loseSide, 'lose');
    ar.big(winSide, 'ESCAPOU! 😮‍💨');
    ar.big(loseSide, 'PAGA A COCA 🥤');
    ar.small(winSide, extraWin);
    ar.small(loseSide, extraLose);
  };

  function intro(container, g, a, b) {
    return new Promise((resolve) => {
      container.innerHTML = `
        <div class="mg-intro">
          <div class="mg-emoji">${g.emoji}</div>
          <h2>${U.esc(g.name)}</h2>
          <div class="mg-vs">${U.avatar(a, 'md')}<span class="vs-mini">VS</span>${U.avatar(b, 'md')}</div>
          <p class="mg-how">${g.how}</p>
          ${g.split ? `<p class="mg-tip">📱 Deitem o celular na mesa. <b>${U.esc(a.name)}</b> fica do lado de cima, <b>${U.esc(b.name)}</b> do lado de baixo.</p>` : ''}
          <button type="button" class="btn big primary" data-go>BORA!</button>
        </div>`;
      container.querySelector('[data-go]').addEventListener('click', () => resolve(), { once: true });
    });
  }

  /** Roda o minigame; em caso de empate, revanche automática. */
  mg.play = async function (key, container, a, b) {
    const g = mg.byKey[key];
    await intro(container, g, a, b);
    let attempt = 1;
    for (;;) {
      const r = await g.start(container, a, b, { attempt });
      if (!r.tie) return r;
      container.innerHTML = `<div class="mg-msg"><div class="mg-msg-big">EMPATE!</div><div>Revanche… 🔁</div></div>`;
      R.audio.buzz();
      await sleep(1800);
      attempt++;
    }
  };
})();
