/* App: telas, fluxo da rodada, zoeira, compartilhar. */
(function () {
  const R = window.R;
  const L = R.logic;
  const U = R.ui;
  const { esc, avatar, toast, sleep } = U;
  const S = () => R.store.state;
  const $ = (sel, root = document) => root.querySelector(sel);

  const app = (R.app = { tab: 'rodada', busy: false, wheel: null, slotShownFor: null });

  /* ---------------- Zoeira ---------------- */
  const Z = {
    payer: [
      'A carteira chora, mas a coca é sagrada. 🥲',
      'Patrocínio confirmado. A galera agradece! 🫡',
      'Hoje o gelo é por sua conta. ❄️',
      'Parabéns! Você ganhou o direito de pagar. 🎉',
      'Abre a carteira que a sede é grande! 💸',
      'O destino escolheu. Não adianta chorar. 😭',
      'Pix na conta, coca na mesa! 📲',
      'A roleta não perdoa. 🎡',
      'Já pode ir pegando a de 2 litros. 🥤',
      'Obrigado pela preferência, volte sempre! 🛒',
      'Sorte no amor, azar na roleta. 💔',
    ],
    firstTime: ['Estreia com estilo! Primeira coca na conta. 🍾', 'Bem-vindo ao clube dos pagadores! 🎟️'],
    veteran: [
      '{n} cocas pagas. Isso já é investimento. 📈',
      'Patrocinador oficial de novo! Já pode pedir uniforme. 👕',
      'A fábrica de coca já te manda cartão de Natal. 🎄',
    ],
    burned: ['Queimou a largada! Ansiedade custa caro… custa uma coca. 🔥', 'Dedo nervoso, carteira aberta. 🔥'],
    direct: ['Era só você na roleta. Nem precisou girar. 😬', 'Sem concorrência, sem chance. 🤷'],
    savedFirst: ['Primeiro a escapar! Sorte de principiante? 🍀', 'Saiu de fininho logo de cara. 🏃', 'A roleta gosta de você. Por enquanto. 😏'],
    saved: ['Escapou dessa! 😮‍💨', 'Tá salvo… essa semana. 😌', 'Livre! Agora é só assistir. 🍿', 'Ufa! Pode respirar. 🫁', 'Hoje não, carteira! 🙅'],
  };
  const pickZ = (list, vars = {}) => R.rand.pick(list).replace(/\{(\w+)\}/g, (_, k) => vars[k]);

  function payerPhrase(id, { burned = false, direct = false } = {}) {
    if (direct) return pickZ(Z.direct);
    if (burned) return pickZ(Z.burned);
    const n = L.paidCount(id) + 1;
    if (n === 1) return pickZ(Z.firstTime);
    if (n >= 3 && R.rand.float() < 0.5) return pickZ(Z.veteran, { n });
    return pickZ(Z.payer);
  }

  /* ---------------- SVGs ---------------- */
  const POINTER_SVG = `
    <svg viewBox="0 0 60 70" width="54" height="63" aria-hidden="true">
      <defs><filter id="ps" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-opacity="0.45"/></filter></defs>
      <path d="M30 66 L8 22 A24 24 0 1 1 52 22 Z" fill="#fff7ec" stroke="#8c0010" stroke-width="4" stroke-linejoin="round" filter="url(#ps)"/>
      <circle cx="30" cy="24" r="9" fill="#d90f22"/>
    </svg>`;

  /* ---------------- Inicialização ---------------- */
  function init() {
    L.ensureWeek();
    R.fx.bubbles($('.bubbles'));
    $('.tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (b) setTab(b.dataset.tab);
    });
    $('#mute').addEventListener('click', () => {
      S().settings.muted = !S().settings.muted;
      R.store.save();
      renderHeader();
      if (!S().settings.muted) R.audio.ding();
    });
    document.addEventListener('pointerdown', () => R.audio.unlock(), { passive: true });
    bindAmigos();
    bindHistorico();
    renderAll();
    if (!R.store.save()) {
      toast('⚠️ Este navegador não está salvando os dados. Use o backup no Histórico.', 5000);
    }
  }

  function setTab(t) {
    if (app.busy) {
      toast('Calma! Espera terminar. 🎡');
      return;
    }
    app.tab = t;
    document.querySelectorAll('.tabs [data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
    document.querySelectorAll('main > .tab').forEach((s) => s.classList.toggle('active', s.id === `tab-${t}`));
    if (t === 'rodada') renderRodada();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderAll() {
    renderHeader();
    if (!app.busy) renderRodada();
    renderAmigos();
    renderHistorico();
  }

  function renderHeader() {
    $('#week-label').textContent = `Semana de ${L.fmtDate(L.currentWeek())}`;
    const m = S().settings.muted;
    $('#mute').textContent = m ? '🔇' : '🔊';
    $('#mute').setAttribute('aria-label', m ? 'Ligar som' : 'Desligar som');
  }

  /* ================= ABA RODADA ================= */
  function renderRodada() {
    const el = $('#tab-rodada');
    if (app.wheel) {
      app.wheel.destroy();
      app.wheel = null;
    }
    const round = S().round;
    if (round && round.phase === 'spin') return renderSpin(el, round);
    if (round && round.phase === 'final') return renderFinal(el, round);
    const locked = L.lockedEntry();
    if (locked) return renderLocked(el, locked);
    if (S().friends.length < 2) return renderEmpty(el);
    renderIdle(el);
  }

  function mountWheel(el, items) {
    const c = $('canvas.wheel', el);
    app.wheel = new R.Wheel(c);
    app.wheel.setItems(items);
    return app.wheel;
  }

  function wheelHTML() {
    return `<div class="wheel-wrap"><div class="pointer">${POINTER_SVG}</div><canvas class="wheel" aria-label="Roleta"></canvas></div>`;
  }

  function renderEmpty(el) {
    el.innerHTML = `
      <div class="card empty">
        <div class="empty-emoji">🥤</div>
        <h2>Bora montar a galera!</h2>
        <p>Cadastre pelo menos <b>2 amigos</b> para começar a roleta da coca.</p>
        <button type="button" class="btn big primary" data-goto="amigos">Adicionar amigos</button>
      </div>`;
    $('[data-goto]', el).addEventListener('click', () => setTab('amigos'));
  }

  function renderIdle(el) {
    const info = L.eligibility();
    const st = S();
    const n = info.eligible.length;
    const chips = st.friends
      .map((f) => {
        const absent = st.absent.includes(f.id);
        const immune = f.id === info.immuneId && !info.ignoredImmunity;
        return `<button type="button" class="chip ${absent ? 'off' : ''} ${immune ? 'immune' : ''}" data-id="${esc(f.id)}" aria-pressed="${!absent}">
            ${avatar(f, 'xs')}<span class="chip-name">${esc(f.name)}</span>${immune && !absent ? '<em>🛡️ imune</em>' : ''}${absent ? '<em>fora</em>' : ''}
          </button>`;
      })
      .join('');

    let status = '';
    if (info.immuneId && !info.ignoredImmunity) status += `🛡️ <b>${esc(L.nameOf(info.immuneId))}</b> tá imune (pagou na última rodada). `;
    if (info.ignoredImmunity) status += `Só sobrou quem tá imune, então a imunidade foi ignorada. `;
    if (n === 0) status += 'Ninguém na roleta!';
    else if (n === 1) status += `Só <b>${esc(L.nameOf(info.eligible[0]))}</b> na roleta… 😬`;
    else if (n === 2) status += `Só 2 na roleta → <b>direto pra final!</b>`;
    else status += `<b>${n}</b> na roleta. Cada giro salva um; os 2 últimos vão pro minigame.`;

    const label = n === 0 ? 'Ninguém na roleta' : n === 1 ? 'Ver quem paga' : n === 2 ? 'IR PRA FINAL ⚔️' : 'COMEÇAR RODADA 🎡';

    el.innerHTML = `
      <div class="round-grid">
        ${wheelHTML()}
        <div class="panel card">
          <h2>Quem vai essa semana?</h2>
          <p class="hint">Toque em quem <b>não vai</b> pra tirar da rodada.</p>
          <div class="chips">${chips}</div>
          <p class="status">${status}</p>
          <button type="button" id="start" class="btn big primary" ${n === 0 ? 'disabled' : ''}>${label}</button>
        </div>
      </div>`;

    const items = info.eligible.map((id) => L.person(id));
    mountWheel(el, items).startIdle();

    $('.chips', el).addEventListener('click', (e) => {
      const c = e.target.closest('.chip');
      if (!c) return;
      L.toggleAbsent(c.dataset.id);
      renderRodada();
    });
    $('#start', el).addEventListener('click', startRound);
  }

  async function startRound() {
    R.audio.unlock();
    const res = L.startRound();
    if (res.type === 'error') return toast(res.msg);
    if (res.type === 'direct') {
      const entry = L.directEntry(res.payerId, payerPhrase(res.payerId, { direct: true }));
      renderAll();
      return showResult(entry);
    }
    if (res.round.phase === 'final') toast('Só 2 na roleta: direto pra final! ⚔️');
    else R.audio.whoosh();
    renderRodada();
  }

  /* ---------- Fase: giros de eliminação ---------- */
  function renderSpin(el, round) {
    const remaining = round.remaining.map((id) => L.person(id, round));
    const savedList = round.saved.map((id) => L.person(id, round));
    const spinNo = round.saved.length + 1;
    const lastSpin = round.remaining.length === 3;
    el.innerHTML = `
      <div class="round-grid">
        ${wheelHTML()}
        <div class="panel card">
          <div class="step-badge">${lastSpin ? '🔥 ÚLTIMO GIRO' : `GIRO ${spinNo}`}</div>
          <p class="hint">Quem a roleta escolher está <b>SALVO</b>. Os 2 últimos vão pra <b>final</b>.</p>
          <button type="button" id="spin" class="btn big primary">GIRAR 🎡</button>
          <div class="cols">
            <div>
              <h3>Salvos ✅</h3>
              <ol class="mini-list">${savedList.map((p) => `<li>${avatar(p, 'xs')}<span>${esc(p.name)}</span></li>`).join('') || '<li class="muted">ninguém ainda</li>'}</ol>
            </div>
            <div>
              <h3>Na roleta 😬</h3>
              <ul class="mini-list">${remaining.map((p) => `<li>${avatar(p, 'xs')}<span>${esc(p.name)}</span></li>`).join('')}</ul>
            </div>
          </div>
          <button type="button" class="link danger" id="cancel-round">Cancelar rodada</button>
        </div>
      </div>`;
    mountWheel(el, remaining);
    $('#spin', el).addEventListener('click', doSpin);
    $('#cancel-round', el).addEventListener('click', cancelRound);
  }

  function wigglePointer() {
    const p = $('.pointer svg');
    if (p && p.animate) p.animate([{ transform: 'rotate(-16deg)' }, { transform: 'rotate(0deg)' }], { duration: 140, easing: 'ease-out' });
  }

  async function doSpin() {
    if (app.busy) return;
    const round = S().round;
    if (!round || round.phase !== 'spin') return;
    app.busy = true;
    document.body.classList.add('spinning');
    const btn = $('#spin');
    if (btn) btn.disabled = true;
    const cancelBtn = $('#cancel-round');
    if (cancelBtn) cancelBtn.disabled = true;

    const target = L.prepareSpin();
    const idx = round.remaining.indexOf(target);
    const last = round.remaining.length === 3;
    const nearMiss = R.rand.float() < (last ? 0.65 : 0.3);
    if (last) {
      document.body.classList.add('drama');
      R.audio.drumStart();
    }
    R.audio.whoosh();
    const landed = await app.wheel.spinTo(idx, {
      duration: last ? R.rand.range(7500, 9000) : R.rand.range(4800, 6200),
      nearMiss,
      onTick: () => {
        R.audio.tick();
        wigglePointer();
      },
    });
    if (landed !== idx) console.warn('Roleta parou em fatia diferente do sorteio', landed, idx);
    if (last) R.audio.drumStop();
    app.wheel.flash(idx);
    const isFirst = round.saved.length === 0;
    const res = L.applySpin();
    await sleep(700);
    await showSaved(L.person(res.savedId, round), isFirst);
    document.body.classList.remove('drama', 'spinning');
    app.busy = false;
    renderRodada();
  }

  function showSaved(p, isFirst) {
    return new Promise((resolve) => {
      R.audio.ding();
      R.fx.confetti({ count: 70, caps: false, origin: 'center', colors: ['#1ec760', '#ffffff', '#b8ffcf', '#ffc531'] });
      const wrap = document.createElement('div');
      wrap.className = 'overlay saved-overlay';
      wrap.innerHTML = `
        <div class="saved-card pop">
          <div class="saved-stamp">SALVO! ✅</div>
          ${avatar(p, 'xl')}
          <div class="saved-name">${esc(p.name)}</div>
          <p>${esc(pickZ(isFirst ? Z.savedFirst : Z.saved))}</p>
          <small>toque para continuar</small>
        </div>`;
      $('#overlay-root').appendChild(wrap);
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        wrap.classList.add('out');
        setTimeout(() => {
          wrap.remove();
          resolve();
        }, 220);
      };
      wrap.addEventListener('click', close);
      setTimeout(close, 2800);
    });
  }

  async function cancelRound() {
    if (app.busy) return;
    const ok = await U.confirm('A rodada vai ser cancelada e fica registrada no histórico como cancelada.', {
      title: 'Cancelar rodada?',
      ok: 'Cancelar rodada',
      cancel: 'Voltar',
      danger: true,
    });
    if (!ok) return;
    L.cancelRound();
    renderAll();
    toast('Rodada cancelada.');
  }

  /* ---------- Fase: final ---------- */
  function renderFinal(el, round) {
    const [a, b] = round.finalists.map((id) => L.person(id, round));
    const keys = R.mg.list.map((g) => g.key);
    const key = L.chooseMinigame(keys);
    const g = R.mg.byKey[key];
    const shown = app.slotShownFor === round.id + key;
    el.innerHTML = `
      <div class="final card">
        <h2 class="final-title">A GRANDE FINAL</h2>
        <p class="hint">Quem perder o minigame <b>paga a coca</b>.</p>
        <div class="vs">
          <div class="fighter">${avatar(a, 'xl')}<b>${esc(a.name)}</b></div>
          <div class="vs-badge">VS</div>
          <div class="fighter">${avatar(b, 'xl')}<b>${esc(b.name)}</b></div>
        </div>
        <div class="slot">
          <div class="slot-label">🎰 Minigame sorteado</div>
          <div class="slot-window"><div class="slot-item">${shown ? `${g.emoji} ${esc(g.name)}` : '…'}</div></div>
        </div>
        <p class="mg-desc">${shown ? g.how : ''}</p>
        <button type="button" id="play" class="btn big primary" ${shown ? '' : 'disabled'}>JOGAR 🎮</button>
        <button type="button" class="link danger" id="cancel-round">Cancelar rodada</button>
      </div>`;
    $('#play', el).addEventListener('click', () => playFinal(a, b, key));
    $('#cancel-round', el).addEventListener('click', cancelRound);
    if (!shown) slotSpin(el, key, round.id);
  }

  async function slotSpin(el, key, roundId) {
    app.busy = true;
    const list = R.mg.list;
    const item = $('.slot-item', el);
    const ti = list.findIndex((g) => g.key === key);
    let i = R.rand.int(list.length);
    const steps = 4 * list.length + ((ti - i + list.length) % list.length);
    await sleep(400);
    for (let s = 1; s <= steps; s++) {
      i = (i + 1) % list.length;
      item.textContent = `${list[i].emoji} ${list[i].name}`;
      item.classList.remove('roll');
      void item.offsetWidth;
      item.classList.add('roll');
      R.audio.slot();
      await sleep(45 + Math.pow(s / steps, 3) * 380);
    }
    app.slotShownFor = roundId + key;
    $('.slot-window', el).classList.add('landed');
    $('.mg-desc', el).innerHTML = list[ti].how;
    $('#play', el).disabled = false;
    R.audio.fanfare();
    app.busy = false;
  }

  async function playFinal(a, b, key) {
    if (app.busy) return;
    app.busy = true;
    R.audio.unlock();
    const overlay = document.createElement('div');
    overlay.className = 'overlay mg';
    $('#overlay-root').appendChild(overlay);
    document.body.classList.add('no-scroll');
    let result;
    try {
      result = await R.mg.play(key, overlay, a, b);
    } finally {
      overlay.remove();
      document.body.classList.remove('no-scroll');
      app.busy = false;
    }
    const entry = L.finishFinal(result, payerPhrase(result.loser.id, { burned: !!result.burned }));
    renderAll();
    showResult(entry);
  }

  /* ---------- Resultado ---------- */
  function minigameName(key) {
    const g = key && R.mg.byKey[key];
    return g ? `${g.emoji} ${g.name}` : '';
  }

  function showResult(entry) {
    const payer = L.person(entry.payerId, entry);
    const winner = entry.winnerId ? L.person(entry.winnerId, entry) : null;
    const wrap = document.createElement('div');
    wrap.className = 'overlay result-overlay';
    wrap.innerHTML = `
      <div class="result-card">
        <div class="result-kicker">🥤 PAGADOR DA SEMANA 🥤</div>
        <div class="result-avatar">${avatar(payer, 'xxl')}</div>
        <div class="result-name">${esc(payer.name)}</div>
        <p class="result-phrase">${esc(entry.phrase || '')}</p>
        ${entry.minigame ? `<p class="result-detail">${minigameName(entry.minigame)} · ${esc(entry.detail)}</p>` : ''}
        ${winner ? `<p class="result-escaped">${avatar(winner, 'xs')} <b>${esc(winner.name)}</b> escapou por pouco 😮‍💨</p>` : ''}
        <div class="result-actions">
          <button type="button" class="btn primary" data-share>Compartilhar no WhatsApp</button>
          <button type="button" class="btn ghost" data-close>Fechar</button>
        </div>
      </div>`;
    $('#overlay-root').appendChild(wrap);
    R.audio.canOpen();
    R.fx.flash('#ffffff');
    setTimeout(() => {
      R.fx.shake($('.result-card', wrap), 14, 700);
      R.fx.confetti({ count: 180, caps: true, origin: 'cannons' });
      R.fx.confetti({ count: 80, caps: true, origin: 'top' });
      R.audio.trombone();
    }, 450);
    $('[data-share]', wrap).addEventListener('click', () => share(entry));
    $('[data-close]', wrap).addEventListener('click', () => wrap.remove());
  }

  function shareText(entry) {
    const nm = (id) => L.nameOf(id, entry);
    const lines = [`🥤 ROLETA DA COCA · semana de ${L.fmtShort(entry.week)}`];
    if (entry.saved && entry.saved.length) lines.push(`✅ Salvos: ${entry.saved.map(nm).join(', ')}`);
    if (entry.finalists) lines.push(`⚔️ Final: ${entry.finalists.map(nm).join(' x ')}${entry.minigame ? ` (${minigameName(entry.minigame)})` : ''}`);
    if (entry.detail && entry.minigame) lines.push(`🎮 ${entry.detail}`);
    lines.push(`💸 Quem paga a coca: *${nm(entry.payerId)}*!`);
    if (entry.phrase) lines.push(`"${entry.phrase}"`);
    return lines.join('\n');
  }

  async function share(entry) {
    const text = shareText(entry);
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }

  /* ---------- Trava da semana ---------- */
  function renderLocked(el, entry) {
    const payer = L.person(entry.payerId, entry);
    const next = L.addDays(L.currentWeek(), 7);
    el.innerHTML = `
      <div class="card payer-card">
        <div class="result-kicker">Pagador da semana</div>
        <div class="result-avatar">${avatar(payer, 'xxl')}</div>
        <div class="result-name">${esc(payer.name)} 🥤</div>
        <p class="result-phrase">${esc(entry.phrase || '')}</p>
        ${entry.minigame ? `<p class="result-detail">${minigameName(entry.minigame)} · ${esc(entry.detail)}</p>` : entry.manual ? '<p class="result-detail">Registrado manualmente</p>' : ''}
        <div class="result-actions">
          <button type="button" class="btn primary" data-share>Compartilhar no WhatsApp</button>
          <button type="button" class="btn ghost" data-goto="historico">Ver histórico</button>
        </div>
        <p class="hint">Nova rodada liberada na segunda, ${L.fmtShort(next)}.</p>
        <button type="button" class="link danger" data-void>Anular rodada</button>
      </div>`;
    $('[data-share]', el).addEventListener('click', () => share(entry));
    $('[data-goto]', el).addEventListener('click', () => setTab('historico'));
    $('[data-void]', el).addEventListener('click', async () => {
      const ok = await U.confirm(`O resultado (${payer.name} pagando) vai ser anulado e a roleta fica liberada de novo. Isso fica registrado no histórico.`, {
        title: 'Anular rodada?',
        ok: 'Anular',
        danger: true,
      });
      if (!ok) return;
      L.voidEntry(entry.id);
      renderAll();
      toast('Rodada anulada. Pode jogar de novo.');
    });
  }

  /* ================= ABA AMIGOS ================= */
  function renderAmigos() {
    const st = S();
    const el = $('#tab-amigos');
    el.innerHTML = `
      <div class="card">
        <h2>A galera</h2>
        <form id="add-friend" class="add-row" autocomplete="off">
          <input name="name" placeholder="Nome do amigo" maxlength="24" aria-label="Nome do amigo" required>
          <button type="submit" class="btn primary">Adicionar</button>
        </form>
        <ul class="friend-list">
          ${
            st.friends
              .map(
                (f) => `
            <li data-id="${esc(f.id)}">
              <button type="button" class="avatar-btn" data-act="photo" aria-label="Trocar foto de ${esc(f.name)}">${avatar(f, 'md')}<span class="cam">📷</span></button>
              <input class="name-input" data-act="name" value="${esc(f.name)}" maxlength="24" aria-label="Nome">
              <input type="color" data-act="color" value="${esc(f.color)}" aria-label="Cor da fatia">
              ${f.photo ? '<button type="button" class="icon-btn small" data-act="nophoto" title="Tirar foto" aria-label="Tirar foto">🚫</button>' : ''}
              <button type="button" class="icon-btn small" data-act="del" title="Remover" aria-label="Remover ${esc(f.name)}">🗑️</button>
            </li>`
              )
              .join('') || '<li class="muted empty-li">Ninguém ainda. Adicione a galera aí em cima! 👆</li>'
          }
        </ul>
        <p class="hint">Toque na foto para trocar. A cor é a da fatia na roleta. Fotos ficam salvas só neste aparelho.</p>
      </div>
      <input type="file" accept="image/*" id="photo-input" hidden>`;
  }

  function resizeImage(file, size = 160) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const ctx = c.getContext('2d');
        const s = Math.min(img.naturalWidth, img.naturalHeight);
        ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Imagem inválida'));
      };
      img.src = url;
    });
  }

  function bindAmigos() {
    const el = $('#tab-amigos');
    let photoFor = null;
    el.addEventListener('submit', (e) => {
      if (e.target.id !== 'add-friend') return;
      e.preventDefault();
      const input = e.target.elements.name;
      const name = input.value.trim();
      if (!name) return;
      if (S().friends.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
        toast('Já tem alguém com esse nome!');
        return;
      }
      L.addFriend(name);
      renderAll();
      $('#add-friend input').focus();
      toast(`${name} entrou na roleta! 🎉`);
    });
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const id = b.closest('li') && b.closest('li').dataset.id;
      const f = L.friend(id);
      if (!f) return;
      const act = b.dataset.act;
      if (act === 'photo') {
        photoFor = id;
        $('#photo-input').click();
      } else if (act === 'nophoto') {
        f.photo = null;
        R.store.save();
        renderAll();
      } else if (act === 'del') {
        const ok = await U.confirm(`Tirar ${f.name} da galera? O histórico dele continua salvo.`, { title: 'Remover amigo?', ok: 'Remover', danger: true });
        if (!ok) return;
        L.removeFriend(id);
        renderAll();
      }
    });
    el.addEventListener('change', async (e) => {
      const t = e.target;
      if (t.id === 'photo-input') {
        const file = t.files && t.files[0];
        t.value = '';
        const f = L.friend(photoFor);
        if (!file || !f) return;
        try {
          const prev = f.photo;
          f.photo = await resizeImage(file);
          if (!R.store.save()) {
            f.photo = prev;
            R.store.save();
            toast('Sem espaço para salvar a foto neste aparelho. 😕');
          }
        } catch (err) {
          toast('Não consegui abrir essa imagem.');
        }
        renderAll();
        return;
      }
      const li = t.closest('li[data-id]');
      if (!li) return;
      const f = L.friend(li.dataset.id);
      if (!f) return;
      if (t.dataset.act === 'name') {
        const v = t.value.trim().slice(0, 24);
        if (v) f.name = v;
        else t.value = f.name;
      } else if (t.dataset.act === 'color') {
        f.color = t.value;
      }
      R.store.save();
      renderHeader();
      if (!app.busy) renderRodada();
      renderHistorico();
      if (t.dataset.act === 'color') {
        const av = li.querySelector('.avatar-btn');
        av.innerHTML = `${avatar(f, 'md')}<span class="cam">📷</span>`;
      }
    });
  }

  /* ================= ABA HISTÓRICO ================= */
  function weeksLabel(w) {
    if (w == null) return 'nunca pagou';
    if (w === 0) return 'pagou essa semana';
    return w === 1 ? 'há 1 semana' : `há ${w} semanas`;
  }

  const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  function renderHistorico() {
    const el = $('#tab-historico');
    const stats = L.stats();
    const sp = L.sponsorOfMonth();
    const month = MONTHS[R.now().getMonth()];
    const sponsor = sp
      ? `🏆 Patrocinador oficial de ${month}: <b>${sp.ids.map((id) => esc(L.nameOf(id))).join(' e ')}</b> (${sp.count} ${sp.count === 1 ? 'coca' : 'cocas'})`
      : `🏆 Ninguém pagou em ${month} ainda.`;
    const entries = L.allHistorySorted();
    el.innerHTML = `
      <div class="card">
        <h2>Ranking</h2>
        <div class="sponsor">${sponsor}</div>
        <ul class="rank-list">
          ${
            stats
              .map(
                (s, i) => `
            <li>
              <span class="rank-pos">${i + 1}</span>
              ${avatar(s.f, 'sm')}
              <div class="rank-main">
                <b>${esc(s.f.name)}</b>
                <span class="rank-sub">${weeksLabel(s.weeksSince)} · ${s.finals} ${s.finals === 1 ? 'final' : 'finais'} · minigames ${s.wins}V ${s.losses}D</span>
              </div>
              <span class="rank-count" title="Cocas pagas">${s.paid} 🥤</span>
            </li>`
              )
              .join('') || '<li class="muted">Cadastre a galera para ver o ranking.</li>'
          }
        </ul>
      </div>
      <div class="card">
        <div class="card-head">
          <h2>Histórico</h2>
          <button type="button" class="btn small ghost" data-h="add">+ Adicionar semana</button>
        </div>
        <ol class="history">
          ${entries.map(entryHTML).join('') || '<li class="muted">Nenhuma rodada ainda. Bora girar! 🎡</li>'}
        </ol>
      </div>
      <div class="card">
        <h2>Backup</h2>
        <p class="hint">Os dados ficam salvos só neste aparelho. Exporte um backup para passar para outro celular ou não perder nada.</p>
        <div class="backup-row">
          <button type="button" class="btn ghost" data-h="export">⬇️ Exportar backup</button>
          <label class="btn ghost">⬆️ Importar backup<input type="file" accept="application/json,.json" data-h="import" hidden></label>
        </div>
      </div>`;
  }

  function entryHTML(e) {
    const nm = (id) => esc(L.nameOf(id, e));
    const tag = e.cancelled ? '<span class="tag gray">CANCELADA</span>' : e.voided ? '<span class="tag gray">ANULADA</span>' : e.manual ? '<span class="tag">manual</span>' : '';
    const payer = e.payerId ? L.person(e.payerId, e) : null;
    return `
      <li class="h-entry ${e.voided ? 'voided' : ''}" data-id="${esc(e.id)}">
        <div class="h-head"><span class="h-date">Semana de ${L.fmtDate(e.week)}</span>${tag}</div>
        ${payer ? `<div class="h-payer">${avatar(payer, 'sm')}<span><b>${esc(payer.name)}</b> pagou a coca 🥤</span></div>` : '<div class="h-payer muted">Sem pagador</div>'}
        ${e.saved && e.saved.length ? `<div class="h-meta">✅ Salvos: ${e.saved.map(nm).join(' → ')}</div>` : ''}
        ${e.finalists ? `<div class="h-meta">⚔️ Final: ${e.finalists.map(nm).join(' x ')}${e.minigame ? ` · ${minigameName(e.minigame)}` : ''}</div>` : ''}
        ${e.detail && e.minigame ? `<div class="h-meta">🎮 ${esc(e.detail)}</div>` : ''}
        ${e.note ? `<div class="h-meta">📝 ${esc(e.note)}</div>` : ''}
        <div class="h-actions">
          ${e.payerId ? '<button type="button" class="link" data-h="edit">Editar</button>' : ''}
          <button type="button" class="link danger" data-h="del">Excluir</button>
        </div>
      </li>`;
  }

  function entryForm({ week, payerId, note }) {
    const opts = S()
      .friends.map((f) => `<option value="${esc(f.id)}" ${f.id === payerId ? 'selected' : ''}>${esc(f.name)}</option>`)
      .join('');
    return `
      <form class="form-grid">
        <label>Segunda-feira da semana<input type="date" name="week" value="${esc(week)}" required></label>
        <label>Quem pagou<select name="payer" required>${opts}</select></label>
        <label>Observação (opcional)<input name="note" maxlength="80" value="${esc(note || '')}"></label>
      </form>`;
  }

  function readEntryForm(wrap) {
    const f = $('form', wrap);
    return { week: f.elements.week.value, payerId: f.elements.payer.value, note: f.elements.note.value.trim() };
  }

  function bindHistorico() {
    const el = $('#tab-historico');
    el.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-h]');
      if (!b) return;
      const act = b.dataset.h;
      const li = b.closest('li[data-id]');
      const entry = li ? S().history.find((x) => x.id === li.dataset.id) : null;

      if (act === 'add') {
        if (!S().friends.length) return toast('Cadastre a galera primeiro.');
        const data = await U.modal({
          title: 'Adicionar semana',
          body: entryForm({ week: L.addDays(L.currentWeek(), -7), payerId: S().friends[0].id }),
          actions: [
            { label: 'Cancelar', value: null },
            { label: 'Salvar', primary: true, validate: (w) => !!$('form', w).elements.week.value, value: readEntryForm },
          ],
        });
        if (!data) return;
        const wk = L.weekKey(L.parseKey(data.week));
        if (L.validHistory().some((x) => x.week === wk)) {
          const ok = await U.confirm('Já tem um pagador registrado nessa semana. Adicionar mesmo assim?', { ok: 'Adicionar' });
          if (!ok) return;
        }
        L.addManualEntry(data);
        renderAll();
        toast('Semana adicionada!');
      } else if (act === 'edit' && entry) {
        const data = await U.modal({
          title: 'Editar semana',
          body: entryForm({ week: entry.week, payerId: entry.payerId, note: entry.note }),
          actions: [
            { label: 'Cancelar', value: null },
            { label: 'Salvar', primary: true, validate: (w) => !!$('form', w).elements.week.value, value: readEntryForm },
          ],
        });
        if (!data) return;
        L.updateEntry(entry.id, data);
        renderAll();
      } else if (act === 'del' && entry) {
        const ok = await U.confirm('Excluir essa semana do histórico de vez?', { title: 'Excluir?', ok: 'Excluir', danger: true });
        if (!ok) return;
        L.deleteEntry(entry.id);
        renderAll();
      } else if (act === 'export') {
        const blob = new Blob([R.store.exportJSON()], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `roleta-da-coca-backup-${L.weekKey(R.now())}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }
    });
    el.addEventListener('change', async (ev) => {
      const t = ev.target;
      if (t.dataset.h !== 'import') return;
      const file = t.files && t.files[0];
      t.value = '';
      if (!file) return;
      const ok = await U.confirm('Isso vai SUBSTITUIR todos os dados deste aparelho pelos do backup.', { title: 'Importar backup?', ok: 'Importar', danger: true });
      if (!ok) return;
      try {
        R.store.importJSON(await file.text());
        L.ensureWeek();
        app.slotShownFor = null;
        renderAll();
        toast('Backup importado! ✅');
      } catch (err) {
        toast('Arquivo de backup inválido. 😕');
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
