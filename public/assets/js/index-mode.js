(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CHARS = 'qwerty1337h@ck3r/\\<>_#';
  const T = (s) => (window.I18N ? window.I18N.t(s) : s);

  let root, list, bg, clockT = 0, idleT = 0, idlePlays = 0, active = -1, rows = [], mounted = false;

  const yearOf = (period) => {
    const p = String(period || '');
    if (/present|now|günümüz|devam/i.test(p)) return T('NOW');
    const ys = p.match(/(19|20)\d{2}/g);
    return ys ? ys[ys.length - 1] : '';
  };
  const short = (s, n) => { s = String(s || '').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

  function itemsFrom(c) {
    const out = [];
    (c.projects || []).filter((p) => p && p.title).forEach((p, k) => out.push({ case: ['projects', k],
      title: p.title, org: (p.tags || []).slice(0, 2).join(' · '), kind: T('PROJECT'),
      note: (p.tags || []).slice(2, 4).join(' · '), year: yearOf(p.period), image: p.image, view: '#projects'
    }));
    (c.experience || []).filter((e) => e && (e.role || e.company)).forEach((e, k) => out.push({ case: ['experience', k],
      title: e.role, org: e.company, kind: T('EXPERIENCE'),
      note: short(String(e.tools || '').split(',').slice(0, 2).join(' ·'), 26), year: yearOf(e.period),
      image: e.image || c.experienceImage, view: '#experience'
    }));
    (c.certificates || []).filter((x) => x && (x.title || x.image)).forEach((x, i) => out.push({
      title: x.title || `Certificate ${i + 1}`, org: x.issuer, kind: T('CERTIFICATE'), note: '',
      year: yearOf(x.date), image: x.image, view: '#certificates', href: x.url || x.pdf || x.image
    }));
    (c.education || []).filter((e) => e && e.degree).forEach((e, k) => out.push({ case: ['education', k],
      title: e.degree, org: e.school, kind: T('EDUCATION'), note: '', year: yearOf(e.period),
      image: e.image, view: '#education'
    }));
    return out.filter((x) => x.title);
  }

  function build(c) {
    const items = itemsFrom(c);
    const p = c.profile || {};
    const socials = (c.socials || []).filter((s) => /github|linkedin|mail/i.test(s.icon || s.label)).slice(0, 3);

    root = document.createElement('section');
    root.className = 'ix';
    root.id = 'indexMode';
    root.hidden = true;
    root.setAttribute('aria-label', 'Index of work');
    root.innerHTML = `
      <div class="ix-bg" aria-hidden="true"></div>
      <h1 class="sr-only">${esc(p.name || 'Portfolio')} — index of work</h1>
      <div class="ix-head" aria-hidden="true">
        <span>${T('Work')}</span><span>${T('With')}</span><span>${T('Kind')}</span><span>${T('Notes')}</span><span>${T('Year')}</span>
      </div>
      <ul class="ix-list" role="list">
        ${items.map((it, i) => `
          <li class="ix-row" data-i="${i}" style="--i:${i}">
            <a href="${esc(it.case && window.CASE ? window.CASE.url(it.case[0], it.case[1]) : (it.href || '/' + it.view.slice(1)))}" class="ix-link" aria-label="${esc(it.title)} — ${esc(it.kind.toLowerCase())}${it.year ? ', ' + esc(it.year) : ''}">
              <span class="ix-d ix-title" data-t="${esc(it.title)}">${esc(it.title)}</span>
              <span class="ix-d ix-org" data-t="${esc(it.org || '')}">${esc(it.org || '')}</span>
              <span class="ix-d ix-kind" data-t="${esc(it.kind)}">${esc(it.kind)}</span>
              <span class="ix-d ix-note" data-t="${esc(it.note || '')}">${esc(it.note || '')}</span>
              <span class="ix-d ix-year" data-t="${esc(it.year || '')}">${esc(it.year || '')}</span>
            </a>
          </li>`).join('')}
      </ul>
      <aside class="ix-corners" aria-label="About this page">
        <span class="ix-c tl" aria-hidden="true"><i class="ix-square"></i></span>
        <nav class="ix-c tr" aria-label="Contact">${socials.map((s) =>
          `<a href="${esc(s.url)}"${/^https?:/.test(s.url) ? ' target="_blank" rel="noopener"' : ''}>${esc(s.label)}</a>`).join('<span aria-hidden="true"> | </span>')}</nav>
        <span class="ix-c bl">37.8746° N, 32.4932° E · ${esc(p.location || 'Konya, Türkiye')}</span>
        <time class="ix-c br" id="ixTime"></time>
      </aside>`;
    document.body.appendChild(root);
    list = $('.ix-list', root);
    bg = $('.ix-bg', root);
    rows = $$('.ix-row', root).map((li, i) => ({ li, it: items[i], parts: $$('.ix-d', li) }));

    items.forEach((it) => { if (it.image) { const im = new Image(); im.src = it.image; } });

    list.addEventListener('pointerover', (e) => {
      const li = e.target.closest('.ix-row');
      if (li) activate(Number(li.dataset.i));
    });
    list.addEventListener('focusin', (e) => {
      const li = e.target.closest('.ix-row');
      if (li) activate(Number(li.dataset.i));
    });
    root.addEventListener('pointerleave', deactivate);
    list.addEventListener('click', (e) => {
      const a = e.target.closest('.ix-link');
      if (!a) return;
      e.preventDefault(); e.stopPropagation();
      const i = Number(a.closest('.ix-row').dataset.i);
      if (e.pointerType === 'touch' && active !== i) { activate(i); return; }
      openRow(i);
    }, true);
  }

  function decode(el) {
    const target = el.dataset.t || '';
    if (reduced() || !target) { el.textContent = target; return; }
    const t0 = performance.now(), dur = 650, reveal = 0.35;
    cancelAnimationFrame(el._raf);
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const shown = Math.floor(Math.max(0, (p - reveal) / (1 - reveal)) * target.length);
      let s = target.slice(0, shown);
      for (let k = shown; k < target.length; k++) s += target[k] === ' ' ? ' ' : CHARS[(Math.random() * CHARS.length) | 0];
      el.textContent = s;
      if (p < 1) el._raf = requestAnimationFrame(step); else el.textContent = target;
    };
    el._raf = requestAnimationFrame(step);
  }

  function activate(i) {
    stopIdle();
    if (i === active || !rows[i]) return;
    if (rows[active]) { rows[active].li.classList.remove('on'); rows[active].parts.forEach((el) => { cancelAnimationFrame(el._raf); el.textContent = el.dataset.t; }); }
    active = i;
    const r = rows[i];
    root.classList.add('has-active');
    r.li.classList.add('on');
    r.parts.forEach(decode);
    if (r.it.image) {
      bg.classList.remove('text');
      bg.style.transition = 'none';
      bg.style.backgroundImage = `url("${r.it.image.replace(/"/g, '%22')}")`;
      bg.textContent = '';
    } else {
      bg.classList.add('text');
      bg.style.transition = 'none';
      bg.style.backgroundImage = 'none';
      bg.textContent = r.it.title;
    }
    bg.style.opacity = '0';
    bg.style.transform = 'scale(1.15)';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      bg.style.transition = '';
      bg.style.opacity = '1';
      bg.style.transform = 'scale(1)';
    }));
  }

  function deactivate() {
    if (rows[active]) { rows[active].li.classList.remove('on'); rows[active].parts.forEach((el) => { cancelAnimationFrame(el._raf); el.textContent = el.dataset.t; }); }
    active = -1;
    root.classList.remove('has-active');
    bg.style.opacity = '0';
    startIdle();
  }

  function openRow(i) {
    const r = rows[i];
    if (!r) return;
    const it = r.it;
    if (it.case && window.CASE) { window.CASE.open(it.case[0], it.case[1]); return; }
    if (it.href) window.open(it.href, '_blank', 'noopener');
  }

  function startIdle() {
    clearTimeout(idleT);
    if (reduced() || idlePlays >= 3 || !mounted) return;
    idleT = setTimeout(() => {
      if (active !== -1 || !mounted) return;
      idlePlays++;
      list.classList.remove('shimmer'); void list.offsetWidth; list.classList.add('shimmer');
      const total = rows.length * 50 + 600;
      idleT = setTimeout(() => { list.classList.remove('shimmer'); startIdle(); }, total + 2000);
    }, 4000);
  }
  function stopIdle() { clearTimeout(idleT); list?.classList.remove('shimmer'); }

  function tick() {
    const el = document.getElementById('ixTime');
    if (!el) return;
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Istanbul', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(new Date());
    const g = (t) => parts.find((x) => x.type === t)?.value || '';
    el.innerHTML = `${g('hour')}<span class="ix-blink">:</span>${g('minute')} ${g('dayPeriod')} · Konya`;
    el.setAttribute('datetime', new Date().toISOString());
    clearTimeout(clockT);
    clockT = setTimeout(tick, 60000 - (Date.now() % 60000) + 50);
  }

  let content = null;
  async function load() {
    if (content) return content;
    try {
      const r = await fetch('/api/content', { cache: 'no-store' });
      content = (await r.json()).content || {};
      if (window.I18N) content = window.I18N.content(content);
    } catch { content = {}; }
    return content;
  }
  document.addEventListener('content:rendered', (e) => { content = e.detail || content; });

  window.INDEXMODE = {
    async mount() {
      mounted = true;
      if (!root) build(await load());
      if (!mounted) return;
      root.hidden = false;
      document.body.classList.add('ix-on');
      idlePlays = 0;
      tick();
      startIdle();
    },
    unmount() {
      mounted = false;
      if (!root) return;
      root.hidden = true;
      document.body.classList.remove('ix-on');
      clearTimeout(clockT); stopIdle();
      if (active !== -1) deactivate();
      clearTimeout(idleT);
    }
  };
  document.dispatchEvent(new CustomEvent('index:ready'));
})();
