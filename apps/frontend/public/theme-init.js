// Set the theme class before first paint (no flash of the wrong theme).
// Lives as its own same-origin file (not inline in index.html) so a strict
// `script-src 'self'` CSP doesn't need a hash/nonce exception for it.
(function () {
  try {
    var t = localStorage.getItem('izyah.theme');
    if (t !== 'light' && t !== 'dark') {
      t = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.documentElement.classList.toggle('dark', t === 'dark');
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
