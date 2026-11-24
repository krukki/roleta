/* Helpers de interface: escape, avatar, contraste, toast e modais. */
(function () {
  const R = (window.R = window.R || {});

  const esc = (s) =>
    String(s == null ? '' : s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );

  function luminance(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return 0.5;
    const n = parseInt(m[1], 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /** Cor de texto com melhor contraste sobre a cor dada. */
  const textOn = (hex) => (luminance(hex) > 0.179 ? '#1c0b0b' : '#ffffff');

  function avatar(p, cls = '') {
    p = p || { name: '?', color: '#888888' };
    if (p.photo) {
      return `<span class="avatar ${cls}"><img src="${esc(p.photo)}" alt=""></span>`;
    }
    const initial = esc((p.name || '?').trim().charAt(0).toUpperCase() || '?');
    const color = /^#[0-9a-f]{6}$/i.test(p.color || '') ? p.color : '#888888';
    return `<span class="avatar ${cls}" style="background:${color};color:${textOn(color)}">${initial}</span>`;
  }

  let toastTimer = null;
  function toast(msg, ms = 2600) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  /**
   * Modal genérico. actions: [{label, primary?, danger?, value?: any | (wrap)=>any, validate?: (wrap)=>bool}]
   * Resolve com o value da ação clicada, ou null se fechado.
   */
  function modal({ title, body = '', actions = [{ label: 'OK', primary: true }] }) {
    return new Promise((resolve) => {
      const root = document.getElementById('overlay-root');
      const wrap = document.createElement('div');
      wrap.className = 'overlay modal-overlay';
      wrap.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
          <h2>${esc(title)}</h2>
          <div class="modal-body">${body}</div>
          <div class="modal-actions">
            ${actions
              .map(
                (a, i) =>
                  `<button type="button" class="btn ${a.primary ? 'primary' : a.danger ? 'danger' : 'ghost'}" data-i="${i}">${esc(a.label)}</button>`
              )
              .join('')}
          </div>
        </div>`;
      root.appendChild(wrap);
      const close = (v) => {
        document.removeEventListener('keydown', onKey);
        wrap.remove();
        resolve(v);
      };
      function onKey(e) {
        if (e.key === 'Escape') close(null);
      }
      wrap.addEventListener('click', (e) => {
        const b = e.target.closest('[data-i]');
        if (b) {
          const a = actions[+b.dataset.i];
          if (a.validate && !a.validate(wrap)) return;
          const v = typeof a.value === 'function' ? a.value(wrap) : a.value === undefined ? true : a.value;
          close(v);
        } else if (e.target === wrap) {
          close(null);
        }
      });
      wrap.addEventListener('submit', (e) => {
        e.preventDefault();
        const primary = wrap.querySelector('.modal-actions .primary');
        primary && primary.click();
      });
      document.addEventListener('keydown', onKey);
      const first = wrap.querySelector('.modal-body input, .modal-body select, .modal-actions .primary, .modal-actions button');
      first && first.focus();
    });
  }

  function confirm(msg, { title = 'Tem certeza?', ok = 'Sim', cancel = 'Cancelar', danger = false } = {}) {
    return modal({
      title,
      body: `<p>${esc(msg)}</p>`,
      actions: [
        { label: cancel, value: false },
        danger ? { label: ok, danger: true, value: true } : { label: ok, primary: true, value: true },
      ],
    }).then((v) => v === true);
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  R.ui = { esc, luminance, textOn, avatar, toast, modal, confirm, sleep };
})();
