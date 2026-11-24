/* Sorteio justo: usa crypto.getRandomValues com amostragem por rejeição (sem viés de módulo). */
(function () {
  const R = (window.R = window.R || {});

  function u32() {
    const a = new Uint32Array(1);
    window.crypto.getRandomValues(a);
    return a[0];
  }

  /** Inteiro uniforme em [0, n). */
  function int(n) {
    if (!(n >= 1)) throw new Error('n precisa ser >= 1');
    const limit = Math.floor(0x100000000 / n) * n;
    let x;
    do {
      x = u32();
    } while (x >= limit);
    return x % n;
  }

  /** Float uniforme em [0, 1). */
  function float() {
    return u32() / 0x100000000;
  }

  function range(a, b) {
    return a + float() * (b - a);
  }

  function pick(arr) {
    return arr[int(arr.length)];
  }

  /** Fisher–Yates com crypto. Retorna uma cópia embaralhada. */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = int(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  R.rand = { int, float, range, pick, shuffle };
})();
