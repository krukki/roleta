/* Lógica da rodada: semanas, imunidade, eliminação, final e histórico. Sem DOM. */
(function () {
  const R = (window.R = window.R || {});
  const S = () => R.store.state;
  const save = () => R.store.save();

  /* Permite simular a data em testes: window.__ROLETA_NOW = '2026-12-01T10:00:00' */
  R.now = () => (window.__ROLETA_NOW ? new Date(window.__ROLETA_NOW) : new Date());

  /* ---------- Datas / semanas (semana começa na segunda) ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  function mondayOf(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }
  function keyOf(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  const weekKey = (date = R.now()) => keyOf(mondayOf(date));
  function parseKey(k) {
    const [y, m, d] = String(k).split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const weeksBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / (7 * 864e5));
  function fmtDate(k) {
    const d = parseKey(k);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }
  function fmtShort(k) {
    const d = parseKey(k);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  }
  function addDays(k, n) {
    const d = parseKey(k);
    d.setDate(d.getDate() + n);
    return keyOf(d);
  }
  const currentWeek = () => weekKey(R.now());

  /* ---------- Amigos ---------- */
  const PALETTE = [
    '#e63946', '#2a9d8f', '#f4a261', '#3a86ff', '#8338ec', '#ffbe0b',
    '#06d6a0', '#ff006e', '#264653', '#fb5607', '#118ab2', '#9b5de5',
  ];

  const friend = (id) => S().friends.find((f) => f.id === id) || null;

  function nextColor() {
    const used = new Set(S().friends.map((f) => f.color));
    return PALETTE.find((c) => !used.has(c)) || PALETTE[S().friends.length % PALETTE.length];
  }

  function addFriend(name) {
    name = String(name || '').trim().slice(0, 24);
    if (!name) return null;
    const f = { id: R.uid(), name, color: nextColor(), photo: null };
    S().friends.push(f);
    save();
    return f;
  }

  function removeFriend(id) {
    const st = S();
    st.friends = st.friends.filter((f) => f.id !== id);
    st.absent = st.absent.filter((x) => x !== id);
    save();
  }

  /** Pessoa para exibição: amigo atual, ou o "retrato" salvo na rodada/entrada. */
  function person(id, snap) {
    const f = friend(id);
    if (f) return f;
    const name = (snap && snap.names && snap.names[id]) || '???';
    const color = (snap && snap.colors && snap.colors[id]) || '#888888';
    return { id, name, color, photo: null };
  }
  const nameOf = (id, snap) => person(id, snap).name;

  /* ---------- Presença da semana ---------- */
  function ensureWeek() {
    const st = S();
    const cw = currentWeek();
    if (st.absentWeek !== cw) {
      st.absent = [];
      st.absentWeek = cw;
      save();
    }
  }

  function toggleAbsent(id) {
    ensureWeek();
    const st = S();
    st.absent = st.absent.includes(id) ? st.absent.filter((x) => x !== id) : [...st.absent, id];
    save();
  }

  /* ---------- Histórico ---------- */
  function validHistory() {
    return S()
      .history.filter((e) => !e.voided && e.payerId)
      .slice()
      .sort((a, b) => (a.week < b.week ? 1 : a.week > b.week ? -1 : (b.createdAt || 0) - (a.createdAt || 0)));
  }

  function allHistorySorted() {
    return S()
      .history.slice()
      .sort((a, b) => (a.week < b.week ? 1 : a.week > b.week ? -1 : (b.createdAt || 0) - (a.createdAt || 0)));
  }

  /** Pagador desta semana (trava), se houver. */
  const lockedEntry = () => validHistory().find((e) => e.week === currentWeek()) || null;

  /** Quem pagou na última rodada válida antes desta semana. */
  function immuneId() {
    const cw = currentWeek();
    const e = validHistory().find((x) => x.week < cw);
    return e && friend(e.payerId) ? e.payerId : null;
  }

  function eligibility() {
    ensureWeek();
    const st = S();
    const present = st.friends.filter((f) => !st.absent.includes(f.id)).map((f) => f.id);
    const imm = immuneId();
    let eligible = present.filter((id) => id !== imm);
    let ignoredImmunity = false;
    if (eligible.length === 0 && present.length > 0) {
      eligible = present.slice();
      ignoredImmunity = true;
    }
    return { present, eligible, immuneId: imm, ignoredImmunity };
  }

  function snapshot(ids) {
    const names = {};
    const colors = {};
    ids.forEach((id) => {
      const f = friend(id);
      if (f) {
        names[id] = f.name;
        colors[id] = f.color;
      }
    });
    return { names, colors };
  }

  /* ---------- Rodada ---------- */
  function startRound() {
    if (S().round) return { type: 'round', round: S().round };
    const info = eligibility();
    const ids = info.eligible;
    if (ids.length === 0) return { type: 'error', msg: 'Ninguém na roleta! Marque quem vai essa semana.' };
    if (ids.length === 1) return { type: 'direct', payerId: ids[0], info };

    const order = R.rand.shuffle(ids);
    const snap = snapshot(order);
    const round = {
      id: R.uid(),
      week: currentWeek(),
      startedAt: Date.now(),
      participants: order.slice(),
      remaining: order.slice(),
      saved: [],
      pending: null,
      phase: order.length === 2 ? 'final' : 'spin',
      finalists: order.length === 2 ? order.slice() : null,
      minigame: null,
      names: snap.names,
      colors: snap.colors,
      immuneId: info.immuneId,
      ignoredImmunity: info.ignoredImmunity,
    };
    S().round = round;
    save();
    return { type: 'round', round };
  }

  /** Sorteia (e grava) quem será salvo neste giro, antes da animação. */
  function prepareSpin() {
    const r = S().round;
    if (!r || r.phase !== 'spin') return null;
    if (!r.pending || !r.remaining.includes(r.pending)) {
      r.pending = r.remaining[R.rand.int(r.remaining.length)];
      save();
    }
    return r.pending;
  }

  /** Aplica o giro já sorteado: a pessoa sai salva. */
  function applySpin() {
    const r = S().round;
    if (!r || !r.pending) return null;
    const savedId = r.pending;
    r.saved.push(savedId);
    r.remaining = r.remaining.filter((id) => id !== savedId);
    r.pending = null;
    let toFinal = false;
    if (r.remaining.length <= 2) {
      r.phase = 'final';
      r.finalists = r.remaining.slice();
      toFinal = true;
    }
    save();
    return { savedId, toFinal };
  }

  /** Sorteia (e grava) o minigame da final. */
  function chooseMinigame(keys) {
    const r = S().round;
    if (!r) return null;
    if (!r.minigame || !keys.includes(r.minigame)) {
      r.minigame = keys[R.rand.int(keys.length)];
      save();
    }
    return r.minigame;
  }

  function finishFinal(result, phrase) {
    const r = S().round;
    if (!r) return null;
    const entry = {
      id: R.uid(),
      week: r.week,
      createdAt: Date.now(),
      payerId: result.loser.id,
      winnerId: result.winner.id,
      loserId: result.loser.id,
      saved: r.saved.slice(),
      finalists: r.finalists.slice(),
      minigame: r.minigame,
      detail: result.detail || '',
      names: { ...r.names },
      colors: { ...r.colors },
      phrase: phrase || '',
      voided: false,
      manual: false,
    };
    S().history.push(entry);
    S().round = null;
    save();
    return entry;
  }

  function directEntry(payerId, phrase) {
    const snap = snapshot([payerId]);
    const entry = {
      id: R.uid(),
      week: currentWeek(),
      createdAt: Date.now(),
      payerId,
      winnerId: null,
      loserId: null,
      saved: [],
      finalists: null,
      minigame: null,
      detail: 'Era o único na roleta',
      names: snap.names,
      colors: snap.colors,
      phrase: phrase || '',
      voided: false,
      manual: false,
    };
    S().history.push(entry);
    save();
    return entry;
  }

  function cancelRound() {
    const r = S().round;
    if (!r) return;
    S().history.push({
      id: R.uid(),
      week: r.week,
      createdAt: Date.now(),
      payerId: null,
      saved: r.saved.slice(),
      finalists: r.finalists ? r.finalists.slice() : null,
      minigame: r.minigame,
      detail: '',
      names: { ...r.names },
      colors: { ...r.colors },
      voided: true,
      cancelled: true,
      manual: false,
      note: 'Rodada cancelada no meio',
    });
    S().round = null;
    save();
  }

  function voidEntry(id) {
    const e = S().history.find((x) => x.id === id);
    if (e) {
      e.voided = true;
      e.voidedAt = Date.now();
      save();
    }
  }

  function addManualEntry({ week, payerId, note }) {
    const snap = snapshot([payerId]);
    const entry = {
      id: R.uid(),
      week: weekKey(parseKey(week)),
      createdAt: Date.now(),
      payerId,
      saved: [],
      finalists: null,
      minigame: null,
      detail: '',
      names: snap.names,
      colors: snap.colors,
      note: note || '',
      voided: false,
      manual: true,
    };
    S().history.push(entry);
    save();
    return entry;
  }

  function updateEntry(id, { week, payerId, note }) {
    const e = S().history.find((x) => x.id === id);
    if (!e) return;
    if (week) e.week = weekKey(parseKey(week));
    if (payerId && payerId !== e.payerId) {
      e.payerId = payerId;
      const f = friend(payerId);
      if (f) {
        e.names = { ...(e.names || {}), [payerId]: f.name };
        e.colors = { ...(e.colors || {}), [payerId]: f.color };
      }
    }
    if (note !== undefined) e.note = note;
    save();
  }

  function deleteEntry(id) {
    S().history = S().history.filter((x) => x.id !== id);
    save();
  }

  /* ---------- Ranking ---------- */
  function stats() {
    const valid = validHistory();
    const cw = currentWeek();
    return S()
      .friends.map((f) => {
        const paid = valid.filter((e) => e.payerId === f.id);
        return {
          f,
          paid: paid.length,
          finals: valid.filter((e) => e.finalists && e.finalists.includes(f.id)).length,
          wins: valid.filter((e) => e.minigame && e.winnerId === f.id).length,
          losses: valid.filter((e) => e.minigame && e.loserId === f.id).length,
          weeksSince: paid[0] ? weeksBetween(paid[0].week, cw) : null,
        };
      })
      .sort((a, b) => b.paid - a.paid || a.f.name.localeCompare(b.f.name, 'pt-BR'));
  }

  function sponsorOfMonth() {
    const now = R.now();
    const counts = {};
    validHistory().forEach((e) => {
      const d = parseKey(e.week);
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
        counts[e.payerId] = (counts[e.payerId] || 0) + 1;
      }
    });
    const max = Math.max(0, ...Object.values(counts));
    if (!max) return null;
    return { ids: Object.keys(counts).filter((id) => counts[id] === max), count: max };
  }

  const paidCount = (id) => validHistory().filter((e) => e.payerId === id).length;

  R.logic = {
    PALETTE,
    weekKey, parseKey, fmtDate, fmtShort, addDays, weeksBetween, currentWeek,
    friend, addFriend, removeFriend, person, nameOf,
    ensureWeek, toggleAbsent, eligibility,
    validHistory, allHistorySorted, lockedEntry, immuneId,
    startRound, prepareSpin, applySpin, chooseMinigame, finishFinal, directEntry, cancelRound,
    voidEntry, addManualEntry, updateEntry, deleteEntry,
    stats, sponsorOfMonth, paidCount,
  };
})();
