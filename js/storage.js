/* Persistência no aparelho (localStorage) com fallback em memória se o navegador bloquear. */
(function () {
  const R = (window.R = window.R || {});
  const KEY = 'roleta-coca:v1';
  let memory = null;

  function read() {
    try {
      const s = window.localStorage.getItem(KEY);
      if (s) return JSON.parse(s);
    } catch (e) {
      /* localStorage bloqueado ou JSON corrompido */
    }
    try {
      return memory ? JSON.parse(memory) : null;
    } catch (e) {
      return null;
    }
  }

  function write(obj) {
    const s = JSON.stringify(obj);
    memory = s;
    try {
      window.localStorage.setItem(KEY, s);
      return true;
    } catch (e) {
      return false;
    }
  }

  function defaults() {
    return {
      version: 1,
      friends: [],
      history: [],
      round: null,
      absent: [],
      absentWeek: null,
      settings: { muted: false },
    };
  }

  function normalize(d) {
    const base = defaults();
    if (!d || typeof d !== 'object') return base;
    return {
      ...base,
      ...d,
      settings: { ...base.settings, ...(d.settings || {}) },
      friends: Array.isArray(d.friends) ? d.friends : [],
      history: Array.isArray(d.history) ? d.history : [],
      absent: Array.isArray(d.absent) ? d.absent : [],
      round: d.round && typeof d.round === 'object' ? d.round : null,
    };
  }

  const store = {
    state: normalize(read()),
    lastSaveOk: true,
    save() {
      this.lastSaveOk = write(this.state);
      return this.lastSaveOk;
    },
    exportJSON() {
      return JSON.stringify({ ...this.state, exportedAt: new Date().toISOString() }, null, 2);
    },
    importJSON(text) {
      const d = JSON.parse(text);
      if (!d || !Array.isArray(d.friends) || !Array.isArray(d.history)) {
        throw new Error('Arquivo de backup inválido');
      }
      delete d.exportedAt;
      this.state = normalize(d);
      this.save();
    },
  };

  R.store = store;
  R.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
})();
