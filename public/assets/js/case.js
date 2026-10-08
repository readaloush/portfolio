(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const para = (s) => String(s || '').trim().split(/\n\s*\n/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  const KINDS = ['projects', 'experience', 'education'];
  const PATHS = !/\.html?$/i.test(location.pathname) && location.protocol !== 'file:';

  let content = null, root = null, openKey = '', pushed = false, lastFocus = null;

  const slugify = (s) => String(s || '')
    .toLowerCase()
    .replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g').replace(/[ıİ]/g, 'i').replace(/[öÖ]/g, 'o').replace(/[şŞ]/g, 's').replace(/[üÜ]/g, 'u')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';

  function listOf(kind, c = content || {}) {
    if (kind === 'projects') return (c.projects || []).filter((p) => p && p.title);
    if (kind === 'experience') return (c.experience || []).filter((x) => x && (x.role || x.company));
    if (kind === 'education') return (c.education || []).filter((e) => e && e.degree);
    return [];
  }
  function slugOf(kind, it) {
    if (it.slug) return slugify(it.slug);
    if (kind === 'experience') return slugify(`${it.company || ''} ${String(it.role || '').trim()}`);
    if (kind === 'education') return slugify(`${it.degree || ''} ${it.school || ''}`);
    return slugify(it.title);
  }
  const urlFor = (kind, slug) => (PATHS ? `/${kind}/${slug}` : `#${kind}/${slug}`);

  function fromLocation() {
    const m = PATHS
      ? location.pathname.match(/^\/([a-z]+)\/([a-z0-9-]+)\/?$/i)
      : location.hash.match(/^#([a-z]+)\/([a-z0-9-]+)$/i);
    if (!m || !KINDS.includes(m[1].toLowerCase())) return null;
    return { kind: m[1].toLowerCase(), slug: m[2].toLowerCase() };
  }

  function shape(kind, it) {
    const c = content || {};
    if (kind === 'projects') return {
      label: 'Project', title: it.title, sub: it.summary || '',
      when: it.period, image: it.image,
      stack: (it.tags || []).join(' · '),
      links: [['Live', it.link], ['Code', it.repo], ['Report', it.report]]
    };
    if (kind === 'experience') return {
      label: 'Experience', title: String(it.role || '').trim(), sub: it.summary || it.company || '',
      org: it.company, when: it.period, image: it.image || (c.sections || {}).experienceImage || '',
      stack: String(it.tools || ''),
      links: [['Company', it.link]]
    };
    return {
      label: 'Education', title: it.degree, sub: it.summary || it.school || '',
      org: it.school, when: it.period, image: it.image, stack: '', links: [], note: it.note
    };
  }

  function render(kind, i) {
    const list = listOf(kind);
    const it = list[i];
    const v = shape(kind, it);
    const next = list.length > 1 ? list[(i + 1) % list.length] : null;
    const nextV = next ? shape(kind, next) : null;
    const back = { projects: 'All projects', experience: 'All experience', education: 'Education' }[kind];
    const meta = [
      ['Role', it.role && kind === 'projects' ? it.role : (kind !== 'projects' ? v.org : it.role)],
      ['When', v.when], ['Duration', it.duration], ['Team', it.team], ['Status', it.status], ['Stack', v.stack]
    ].filter(([, x]) => x && String(x).trim());
    const links = (v.links || []).filter(([, u]) => u && String(u).trim());
    const challenges = (it.challenges || []).filter((x) => x && (x.problem || x.solution));
    const results = (it.results || []).filter(Boolean);
    const bullets = (it.bullets || []).filter(Boolean);

    root.innerHTML = `
      <div class="case-wrap">
        <nav class="case-top">
          <a class="case-back" href="${PATHS ? '/' + kind : '#' + kind}" data-case-close><span aria-hidden="true">←</span> ${esc(back)}</a>
          <span class="case-count">${String(i + 1).padStart(2, '0')} / ${String(list.length).padStart(2, '0')}</span>
        </nav>

        <header class="case-head">
          <p class="case-kicker">${esc(v.label)}${v.when ? ' · ' + esc(v.when) : ''}${it.status ? ' · ' + esc(it.status) : ''}</p>
          <h1 class="case-title">${esc(v.title)}</h1>
          ${v.sub ? `<p class="case-sub">${esc(v.sub)}</p>` : ''}
        </header>

        ${meta.length ? `<dl class="case-meta">${meta.map(([k, x]) => `<div${k === 'Stack' ? ' class="case-meta-wide"' : ''}><dt>${esc(k)}</dt><dd>${esc(x)}</dd></div>`).join('')}</dl>` : ''}

        ${links.length ? `<div class="case-links">${links.map(([k, u]) => {
          const ext = /^https?:/i.test(u);
          const host = ext ? String(u).replace(/^https?:\/\/(www\.)?/i, '').split('/')[0] : 'PDF';
          return `<a class="case-link" href="${esc(u)}"${ext || /\.pdf($|\?)/i.test(u) ? ' target="_blank" rel="noopener"' : ''}><b>${esc(k)} ↗</b><span>${esc(host)}</span></a>`;
        }).join('')}</div>` : ''}

        ${v.image ? `<figure class="case-cover"><img src="${esc(v.image)}" alt="${esc(v.title)}" loading="eager" decoding="async"><figcaption>${esc(v.title)}</figcaption></figure>` : ''}

        ${it.quote ? `<blockquote class="case-quote">${esc(it.quote)}</blockquote>` : ''}

        <div class="case-body">
          ${it.problem ? `<section><h2>The problem</h2>${para(it.problem)}</section>` : ''}
          ${it.approach ? `<section><h2>The approach</h2>${para(it.approach)}</section>` : ''}
          ${bullets.length ? `<section><h2>${kind === 'projects' ? 'What I built' : 'What I did'}</h2><ul class="case-list">${bullets.map((b) => `<li>${esc(String(b).replace(/\s*\n\s*/g, ' '))}</li>`).join('')}</ul></section>` : ''}
          ${v.note ? `<section><h2>Notes</h2>${para(v.note)}</section>` : ''}
          ${challenges.length ? `<section><h2>Challenges &amp; solutions</h2><ol class="case-ch">${challenges.map((x, k) => `
            <li><span class="case-ch-n">${String(k + 1).padStart(2, '0')}</span>
              <div class="case-ch-p"><em>Challenge</em>${para(x.problem)}</div>
              <div class="case-ch-s"><em>Solution</em>${para(x.solution)}</div></li>`).join('')}</ol></section>` : ''}
          ${results.length ? `<section><h2>Results</h2><ul class="case-results">${results.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></section>` : ''}
          ${it.reflection ? `<section><h2>Reflection</h2>${para(it.reflection)}</section>` : ''}
        </div>

        <nav class="case-foot">
          <a href="${PATHS ? '/' + kind : '#' + kind}" data-case-close>← ${esc(back)}</a>
          ${next ? `<a href="${urlFor(kind, slugOf(kind, next))}" data-case-next="${(i + 1) % list.length}">next · ${esc(nextV.title)} →</a>` : ''}
        </nav>
      </div>`;
  }

  function ensureRoot() {
    if (root) return;
    root = document.createElement('article');
    root.className = 'case';
    root.id = 'caseView';
    root.hidden = true;
    root.tabIndex = -1;
    document.body.appendChild(root);
    root.addEventListener('click', (e) => {
      const close = e.target.closest('[data-case-close]');
      if (close) { e.preventDefault(); e.stopPropagation(); closeCase(true); return; }
      const nx = e.target.closest('[data-case-next]');
      if (nx) { e.preventDefault(); e.stopPropagation(); open(openKey.split(':')[0], Number(nx.dataset.caseNext), true, true); }
    }, true);
  }

  function open(kind, i, push = true, replace = false) {
    if (!content) return;
    const list = listOf(kind);
    if (!list[i]) return;
    ensureRoot();
    if (root.hidden) lastFocus = document.activeElement;
    render(kind, i);
    openKey = `${kind}:${i}`;
    root.hidden = false;
    root.scrollTop = 0;
    document.documentElement.classList.add('case-on');
    root.classList.remove('in'); void root.offsetWidth; root.classList.add('in');
    const url = urlFor(kind, slugOf(kind, list[i])) + (PATHS ? location.search : '');
    try {
      if (push && !replace) { history.pushState({ case: openKey }, '', url); pushed = true; }
      else if (push && replace) history.replaceState({ case: openKey }, '', url);
    } catch {  }
    const t = shape(kind, list[i]).title;
    const base = document.documentElement.dataset.baseTitle || document.title.replace(/^.* — /, '');
    document.title = `${t} — ${base}`;
    $('.case-title', root)?.focus?.();
    root.focus({ preventScroll: true });
    document.dispatchEvent(new CustomEvent('case:open', { detail: { kind, i } }));
  }

  function closeCase(viaUi) {
    if (!root || root.hidden) return;
    const kind = openKey.split(':')[0];
    root.hidden = true;
    openKey = '';
    document.documentElement.classList.remove('case-on');
    if (viaUi) {
      if (pushed && history.state && history.state.case) { pushed = false; history.back(); }
      else {
        try { history.replaceState({ view: '#' + kind }, '', PATHS ? '/' + kind : '#' + kind); } catch {  }
        if (!/^(index|keys)$/.test(document.documentElement.dataset.mode) && window.PRESS?.current?.() !== '#' + kind) window.PRESS?.show('#' + kind);
      }
    }
    const base = document.documentElement.dataset.baseTitle;
    if (base) document.title = base;
    lastFocus?.focus?.({ preventScroll: true });
  }

  function openBySlug(kind, slug, push) {
    const list = listOf(kind);
    const i = list.findIndex((it) => slugOf(kind, it) === slug);
    if (i >= 0) open(kind, i, push);
  }

  addEventListener('popstate', () => {
    const r = fromLocation();
    if (r) openBySlug(r.kind, r.slug, false);
    else closeCase(false);
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root && !root.hidden) { e.preventDefault(); e.stopImmediatePropagation(); closeCase(true); }
  }, true);

  const fromAttr = (el) => { const [k, n] = String(el.dataset.case || '').split(':'); return [k, Number(n)]; };
  document.addEventListener('click', (e) => {
    const el = e.target.closest && e.target.closest('[data-case]');
    if (!el || (root && root.contains(el))) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const [k, n] = fromAttr(el);
    open(k, n, true);
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target.closest && e.target.closest('[data-case]:not(a)');
    if (!el) return;
    e.preventDefault();
    const [k, n] = fromAttr(el);
    open(k, n, true);
  });
  const linkUp = () => {
    document.querySelectorAll('a[data-case]').forEach((a) => {
      const [k, n] = fromAttr(a);
      const it = listOf(k)[n];
      if (it) a.setAttribute('href', urlFor(k, slugOf(k, it)));
    });
  };

  document.addEventListener('view:changed', () => { if (root && !root.hidden) closeCase(false); });
  document.addEventListener('mode:changed', () => { if (root && !root.hidden) closeCase(false); });

  document.addEventListener('content:rendered', (e) => {
    const first = !content;
    content = e.detail || content;
    setTimeout(linkUp, 0);
    if (first) {
      const r = fromLocation();
      if (r) setTimeout(() => openBySlug(r.kind, r.slug, false), 30);
    }
  });

  window.CASE = {
    open: (kind, i) => open(kind, i, true),
    openBySlug: (kind, slug) => openBySlug(kind, slug, true),
    close: () => closeCase(true),
    url: (kind, i) => { const it = listOf(kind)[i]; return it ? urlFor(kind, slugOf(kind, it)) : '#'; },
    slugify
  };
})();
