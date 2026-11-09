(() => {
  const root = document.documentElement;
  const buttons = document.querySelectorAll('[data-set-theme]');
  const sync = () => buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.setTheme === root.dataset.theme)));
  buttons.forEach(button => button.addEventListener('click', () => {
    root.dataset.theme = button.dataset.setTheme;
    try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
    sync();
  }));
  const media = matchMedia('(prefers-color-scheme: dark)');
  const onChange = event => {
    let saved; try { saved = localStorage.getItem('theme'); } catch (e) {}
    if (saved !== 'light' && saved !== 'dark') { root.dataset.theme = event.matches ? 'dark' : 'light'; sync(); }
  };
  if (media.addEventListener) media.addEventListener('change', onChange);
  sync();

  // Do not pollute the public counter from local previews or other hosts.
  const stats = document.querySelector('.visitors');
  const unavailable = () => {
    stats?.setAttribute('aria-busy', 'false');
    if (!['busuanzi_value_site_pv', 'busuanzi_value_site_uv'].every(id => /^\d/.test(document.getElementById(id)?.textContent || ''))) stats?.setAttribute('title', 'Visitor statistics are temporarily unavailable.');
    ['busuanzi_value_site_pv', 'busuanzi_value_site_uv'].forEach(id => {
      const el = document.getElementById(id);
      if (el && !/^\d/.test(el.textContent)) el.textContent = '—';
    });
  };
  if (location.hostname !== 'anson-he.github.io') { unavailable(); return; }
  // Owner devices hold a private dashboard connection on this origin.
  // Keep third-party counter code off those devices; public visitor behavior is unchanged.
  try { if (localStorage.getItem('github-traffic-owner') === 'Anson-He') { unavailable(); return; } } catch (e) {}
  const script = document.createElement('script');
  script.src = 'https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js';
  script.async = true;
  script.onerror = unavailable;
  const observer = new MutationObserver(() => {
    if (['busuanzi_value_site_pv', 'busuanzi_value_site_uv'].every(id => /^\d/.test(document.getElementById(id)?.textContent || ''))) {
      stats?.setAttribute('aria-busy', 'false');
      stats?.removeAttribute('title');
      observer.disconnect();
    }
  });
  if (stats) observer.observe(stats, { childList: true, subtree: true });
  document.body.appendChild(script);
  setTimeout(unavailable, 15000);
})();
