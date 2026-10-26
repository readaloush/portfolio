(function () {
  const doc = document, root = doc.documentElement;
  const PALETTES = {
    lime: { name: 'Lime', chips: ['#0c0b10', '#C3E41D', '#ffffff'], theme: null },
    neon: { name: 'Neon', chips: ['#0A0A0A', '#FF2D95', '#007BA7'], theme: 'dark' },
    aubergine: { name: 'Aubergine', chips: ['#DDE3E8', '#3A0F34', '#EAAA00'], theme: 'light' },
    mocha: { name: 'Mocha', chips: ['#E5E4E2', '#6F4E37', '#E6E0F0'], theme: 'light' },
    crimson: { name: 'Crimson', chips: ['#171717', '#06110c', '#A31C1B'], theme: 'dark' },
    electric: { name: 'Electric', chips: ['#FFF21A', '#171717', '#A66BFF'], theme: 'dark' },
    desert: { name: 'Desert', chips: ['#5B4632', '#F4D9A0', '#C8792C'], theme: 'light' }
  };
  const ORDER = Object.keys(PALETTES);
  const KEY = 'rp_palette';

  const read = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  let current = PALETTES[read()] ? read() : 'lime';

  function apply(id) {
    if (id === 'lime') root.removeAttribute('data-palette');
    else root.setAttribute('data-palette', id);
  }
  apply(current);

  const acc = { accent: '#C3E41D', rgb: '195,228,29', deep: '#4d5c0a' };
  window.RP_ACC = acc;
  function refresh() {
    const s = getComputedStyle(root);
    acc.accent = s.getPropertyValue('--accent').trim() || '#C3E41D';
    acc.rgb = s.getPropertyValue('--accent-rgb').trim() || '195,228,29';
    acc.deep = s.getPropertyValue('--accent-deep').trim() || '#4d5c0a';
  }

  const chipsHTML = (p) => `<span class="pal-sw-chips" aria-hidden="true">${p.chips.map((c) => `<i style="background:${c}"></i>`).join('')}</span>`;

  function sync() {
    doc.querySelectorAll('#palSwitch [data-pal]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.pal === current)));
    doc.querySelectorAll('#palRow [data-pal]').forEach((b) => {
      const on = b.dataset.pal === current;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    const dots = doc.querySelector('#palSwitch .pal-dots');
    if (dots) dots.innerHTML = PALETTES[current].chips.map((c) => `<i style="background:${c}"></i>`).join('');
  }

  function choose(id) {
    if (!PALETTES[id]) return;
    current = id;
    try { localStorage.setItem(KEY, id); } catch (e) {}
    apply(id);
    const want = PALETTES[id].theme;
    if (want && root.dataset.theme !== want) {
      root.dataset.theme = want;
      try { localStorage.setItem('theme', want); } catch (e) {}
    }
    refresh();
    sync();
    window.dispatchEvent(new CustomEvent('palettechange', { detail: { palette: id } }));
  }

  function build() {
    refresh();
    new MutationObserver(refresh).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-palette', 'data-mode'] });

    const actions = doc.querySelector('#nav .nav-actions');
    if (actions && !doc.getElementById('palSwitch')) {
      const box = doc.createElement('div');
      box.className = 'pal-sw';
      box.id = 'palSwitch';
      box.innerHTML =
        `<button type="button" class="pal-btn" aria-haspopup="true" aria-expanded="false" aria-label="Colour theme" title="Colour theme" data-cursor="colours"><span class="pal-dots" aria-hidden="true"></span></button>` +
        `<div class="pal-menu" role="menu" aria-label="Colour theme" hidden>${ORDER.map((id) =>
          `<button type="button" role="menuitemradio" aria-checked="false" data-pal="${id}">${chipsHTML(PALETTES[id])}<b>${PALETTES[id].name}</b><em aria-hidden="true">✓</em></button>`).join('')}</div>`;
      const sw = doc.getElementById('themeSwitch');
      actions.insertBefore(box, sw || actions.firstChild);
      const btn = box.querySelector('.pal-btn'), menu = box.querySelector('.pal-menu');
      const shut = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.hidden = !menu.hidden;
        btn.setAttribute('aria-expanded', String(!menu.hidden));
        if (!menu.hidden) menu.querySelector('[aria-checked="true"]')?.focus();
      });
      menu.addEventListener('click', (e) => { const b = e.target.closest('[data-pal]'); if (b) { choose(b.dataset.pal); shut(); btn.focus(); } });
      doc.addEventListener('click', (e) => { if (!box.contains(e.target)) shut(); });
      doc.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { shut(); btn.focus(); } });
    }

    const links = doc.getElementById('navLinks');
    if (links && !doc.getElementById('palRow')) {
      const row = doc.createElement('div');
      row.className = 'pal-row';
      row.id = 'palRow';
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', 'Colour theme');
      row.innerHTML = ORDER.map((id) =>
        `<button type="button" data-pal="${id}" aria-pressed="false">${chipsHTML(PALETTES[id])}<span>${PALETTES[id].name}</span></button>`).join('');
      row.addEventListener('click', (e) => { const b = e.target.closest('[data-pal]'); if (b) choose(b.dataset.pal); });
      links.appendChild(row);
    }
    sync();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', build); else build();
  window.RP_PALETTE = { choose, get: () => current, list: ORDER };
})();
