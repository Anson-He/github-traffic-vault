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
  if (!stats || location.hostname !== 'anson-he.github.io') { unavailable(); return; }
  // Keep third-party code in an opaque-origin sandbox, away from private browser storage.
  const frame = document.createElement('iframe');
  frame.src = '/assets/visitor-counter.html';
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('title', 'Isolated visitor counter');
  frame.hidden = true;
  frame.tabIndex = -1;
  let received = false;
  const onCounter = event => {
    if (event.source !== frame.contentWindow || event.origin !== 'null') return;
    const value = event.data;
    if (value?.type !== 'site-counter-result-v1' ||
        !/^\d{1,20}$/.test(String(value.pv)) || !/^\d{1,20}$/.test(String(value.uv))) return;
    document.getElementById('busuanzi_value_site_pv').textContent = String(value.pv);
    document.getElementById('busuanzi_value_site_uv').textContent = String(value.uv);
    stats.setAttribute('aria-busy', 'false');
    stats.removeAttribute('title');
    received = true;
    window.removeEventListener('message', onCounter);
  };
  window.addEventListener('message', onCounter);
  frame.onerror = unavailable;
  document.body.appendChild(frame);
  setTimeout(() => { if (!received) unavailable(); }, 15000);
})();
