(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  const PALETTE = ['#C3E41D', '#ffb829', '#ff6b5b', '#5bc0ff', '#a78bfa', '#ff7ac6', '#f2efe6', '#3ddc97'];

  const SECTIONS = [
    { key: 'a', label: 'About', screen: 'about', color: '#C3E41D', w: 1.5 },
    { key: 'p', label: 'Projects', screen: 'projects', color: '#ffb829', w: 2 },
    { key: 'w', label: 'Work', screen: 'experience', color: '#5bc0ff', w: 1.5 },
    { key: 'e', label: 'Education', screen: 'education', color: '#a78bfa', w: 2 },
    { key: 's', label: 'Skills', screen: 'skills', color: '#3ddc97', w: 1.5 },
    { key: 'c', label: 'Certificates', screen: 'certificates', color: '#ff7ac6', w: 2.25 },
    { key: 'n', label: 'News', screen: 'news', color: '#f2efe6', w: 1.25 },
    { key: 'm', label: 'Contact', screen: 'contact', color: '#ff6b5b', w: 1.75 },
    { key: 'v', label: 'CV', screen: 'cv', color: '#C3E41D', w: 1.25 }
  ];

  let root, screen, out, typed, board, content = null, mounted = false, current = '';
  let idleT = 0, idlePlays = 0, buf = '';

  let ac = null;
  function clack(low) {
    if (!window.SFX || !window.SFX.enabled) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      const t = ac.currentTime;
      const len = Math.floor(ac.sampleRate * 0.03);
      const b = ac.createBuffer(1, len, ac.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      const src = ac.createBufferSource(); src.buffer = b;
      const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = low ? 1400 : 2600 + Math.random() * 900; f.Q.value = 1.4;
      const g = ac.createGain(); g.gain.value = 0.22;
      src.connect(f).connect(g).connect(ac.destination);
      src.start(t);
      const o = ac.createOscillator(); const og = ac.createGain();
      o.frequency.setValueAtTime(low ? 120 : 170, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.06);
      og.gain.setValueAtTime(0.12, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(og).connect(ac.destination); o.start(t); o.stop(t + 0.08);
    } catch {  }
  }

  const yearOf = (period) => {
    const p = String(period || '');
    if (/present|now|günümüz|devam/i.test(p)) return 'now';
    const ys = p.match(/(19|20)\d{2}/g);
    return ys ? ys[ys.length - 1] : '';
  };
  const ext = (u) => /^https?:/i.test(u || '') ? ' target="_blank" rel="noopener"' : '';
  const caseHref = (kind, i) => window.CASE ? window.CASE.url(kind, i) : '/' + kind;

  function row(title, sub, right, attrs) {
    return `<li><a class="kb-item" ${attrs}><span class="kb-it">${esc(title)}</span>` +
      `<span class="kb-is">${esc(sub || '')}</span><span class="kb-iy">${esc(right || '')}</span></a></li>`;
  }

  function screenHTML(name) {
    const c = content || {};
    const p = c.profile || {};
    switch (name) {
      case 'about': return `
        <p class="kb-k">About</p>
        <h2 class="kb-h">${esc(p.name || '')}</h2>
        <p class="kb-role">${esc(p.title || (p.roles || [])[0] || '')}</p>
        <p class="kb-p">${esc(p.summary || '')}</p>
        <p class="kb-dim">${esc(p.location || '')}</p>`;
      case 'projects': return `<p class="kb-k">Projects · ${(c.projects || []).length}</p><ul class="kb-list">${
        (c.projects || []).map((x, i) => x && x.title ? row(x.title, (x.tags || []).slice(0, 3).join(' · '), yearOf(x.period),
          `href="${esc(caseHref('projects', i))}" data-case="projects:${i}"`) : '').join('')}</ul>`;
      case 'experience': return `<p class="kb-k">Work</p><ul class="kb-list">${
        (c.experience || []).map((x, i) => x && (x.role || x.company) ? row(x.role, x.company, yearOf(x.period),
          `href="${esc(caseHref('experience', i))}" data-case="experience:${i}"`) : '').join('')}</ul>`;
      case 'education': return `<p class="kb-k">Education</p><ul class="kb-list">${
        (c.education || []).map((x, i) => x && x.degree ? row(x.degree, x.school, yearOf(x.period),
          `href="${esc(caseHref('education', i))}" data-case="education:${i}"`) : '').join('')}</ul>`;
      case 'certificates': {
        const list = (c.certificates || []).filter((x) => x && (x.title || x.image));
        return `<p class="kb-k">Certificates</p>${list.length ? `<ul class="kb-list">${list.map((x, i) =>
          row(x.title || `Certificate ${i + 1}`, x.issuer, yearOf(x.date), `href="${esc(x.url || x.pdf || x.image || '#')}" target="_blank" rel="noopener"`)).join('')}</ul>`
          : '<p class="kb-dim">Nothing here yet.</p>'}`;
      }
      case 'skills': return `<p class="kb-k">Skills</p>${(c.skills || []).map((g) => `
        <div class="kb-group"><p class="kb-gt">${esc(g.category)}</p><p class="kb-chips">${
          (g.items || []).map((s) => `<span>${esc(s.name || s)}</span>`).join('')}</p></div>`).join('')}`;
      case 'news': {
        const list = (c.announcements || []).filter((a) => a && a.published !== false && (a.title || a.body))
          .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
        return `<p class="kb-k">News</p>${list.length ? `<ul class="kb-news">${list.map((a) => `
          <li><span class="kb-dim">${esc(a.date || '')}</span><b>${esc(a.title || '')}</b>${a.body ? `<span>${esc(a.body)}</span>` : ''}${
            a.link ? `<a href="${esc(a.link)}"${ext(a.link)}>read more →</a>` : ''}</li>`).join('')}</ul>` : '<p class="kb-dim">No news right now.</p>'}`;
      }
      case 'contact': return `<p class="kb-k">Contact</p>
        <p class="kb-big">${p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : ''}</p>
        ${p.phone ? `<p class="kb-p"><a href="tel:${esc(String(p.phone).replace(/\s/g, ''))}">${esc(p.phone)}</a></p>` : ''}
        ${p.calendarUrl ? `<p class="kb-p"><a class="kb-btn" href="${esc(p.calendarUrl)}" target="_blank" rel="noopener">Book a call →</a></p>` : ''}
        <p class="kb-chips kb-social">${(c.socials || []).map((s) => `<a href="${esc(s.url)}"${ext(s.url)}>${esc(s.label)}</a>`).join('')}</p>`;
      case 'cv': return `<p class="kb-k">CV</p>
        <h2 class="kb-h">Curriculum vitae</h2>
        <p class="kb-p">${esc(p.name || '')} — ${esc(p.title || '')}</p>
        ${p.cvUrl ? `<p class="kb-p"><a class="kb-btn" href="${esc(p.cvUrl)}" target="_blank" rel="noopener">Open the CV →</a></p>` : '<p class="kb-dim">Not uploaded yet.</p>'}`;
      default: return `
        <p class="kb-k">Hello</p>
        <h2 class="kb-h">${esc(p.name || '')}</h2>
        <p class="kb-role">${esc(p.tagline || p.title || '')}</p>
        <p class="kb-p kb-hint">Press a key — click it, tap it, or type its letter.
          <span>Space</span> opens a random project, <span>Esc</span> comes back here.</p>`;
    }
  }

  function show(name) {
    current = name;
    out.innerHTML = screenHTML(name);
    out.scrollTop = 0;
    screen.classList.remove('flash'); void screen.offsetWidth; screen.classList.add('flash');
    $$('.kb-key.sec', board).forEach((k) => k.classList.toggle('lit', k.dataset.screen === name));
  }

  function capHTML(o) {
    return `<button type="button" class="kb-key${o.cls ? ' ' + o.cls : ''}" style="--k:${o.color};--w:${o.w || 1};--d:${o.d || 0}"` +
      `${o.screen ? ` data-screen="${o.screen}"` : ''}${o.key ? ` data-key="${esc(o.key)}"` : ''}${o.action ? ` data-action="${o.action}"` : ''}` +
      ` aria-label="${esc(o.aria || o.label)}">` +
      `<span class="kb-cap"><span class="kb-glyph">${esc(o.glyph || '')}</span>${o.label && o.glyph !== o.label ? `<span class="kb-label">${esc(o.label)}</span>` : ''}</span></button>`;
  }

  function build(c) {
    const p = c.profile || {};
    const letters = String(p.shortName || p.name || 'Portfolio').toUpperCase().replace(/[^A-ZÇĞİÖŞÜ0-9]/g, '').split('');
    let d = 0;
    const nameRow = letters.map((L, i) => capHTML({ glyph: L, label: L, key: L.toLowerCase(), color: PALETTE[i % PALETTE.length],
      cls: 'nm', d: d++, aria: `Letter ${L}` })).join('');
    const secRow1 = SECTIONS.slice(0, 5).map((s) => capHTML({ ...s, glyph: s.key.toUpperCase(), cls: 'sec', d: d++, aria: `${s.label} (${s.key.toUpperCase()})` })).join('');
    const secRow2 = SECTIONS.slice(5).map((s) => capHTML({ ...s, glyph: s.key.toUpperCase(), cls: 'sec', d: d++, aria: `${s.label} (${s.key.toUpperCase()})` })).join('');
    const bottom =
      capHTML({ glyph: 'esc', label: 'Home', key: 'escape', action: 'home', color: '#2a2833', cls: 'mod', w: 1.25, d: d++, aria: 'Home (Escape)' }) +
      capHTML({ glyph: '', label: 'space · surprise me', key: ' ', action: 'random', color: '#C3E41D', cls: 'space', w: 5, d: d++, aria: 'Random project (Space)' }) +
      capHTML({ glyph: '⌫', label: 'Clear', key: 'backspace', action: 'clear', color: '#2a2833', cls: 'mod', w: 1.25, d: d++, aria: 'Clear typing (Backspace)' });

    root = document.createElement('section');
    root.className = 'kb';
    root.id = 'keysMode';
    root.hidden = true;
    root.setAttribute('aria-label', 'Keyboard portfolio');
    root.innerHTML = `
      <h1 class="sr-only">${esc(p.name || 'Portfolio')} — keyboard</h1>
      <div class="kb-wrap">
        <div class="kb-screen" aria-live="polite">
          <div class="kb-bar" aria-hidden="true"><i></i><i></i><i></i><span class="kb-typed"></span><b class="kb-caret"></b></div>
          <div class="kb-out"></div>
        </div>
        <div class="kb-board" role="group" aria-label="Keys">
          <div class="kb-row">${nameRow}</div>
          <div class="kb-secs"><div class="kb-row">${secRow1}</div><div class="kb-row">${secRow2}</div></div>
          <div class="kb-row">${bottom}</div>
        </div>
      </div>`;
    document.body.appendChild(root);
    screen = $('.kb-screen', root);
    out = $('.kb-out', root);
    typed = $('.kb-typed', root);
    board = $('.kb-board', root);

    board.addEventListener('pointerdown', (e) => {
      const k = e.target.closest('.kb-key');
      if (!k) return;
      down(k);
      const up = () => { release(k); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); };
      addEventListener('pointerup', up); addEventListener('pointercancel', up);
    });
    board.addEventListener('click', (e) => {
      const k = e.target.closest('.kb-key');
      if (!k) return;
      if (e.detail === 0) { down(k); setTimeout(() => release(k), 110); }
      act(k);
    });
  }

  function down(k) {
    stopIdle();
    k.classList.add('down');
    clack(k.classList.contains('space') || k.classList.contains('mod'));
  }
  function release(k) { k.classList.remove('down'); startIdle(); }

  function act(k) {
    const a = k.dataset.action;
    if (k.classList.contains('nm')) { type(k.querySelector('.kb-glyph').textContent); return; }
    if (k.dataset.screen) { type(k.dataset.key.toUpperCase()); show(k.dataset.screen); return; }
    if (a === 'home') { buf = ''; typed.textContent = ''; show(''); return; }
    if (a === 'clear') { buf = buf.slice(0, -1); typed.textContent = buf; return; }
    if (a === 'random') {
      const list = (content && content.projects || []).map((x, i) => (x && x.title ? i : -1)).filter((i) => i >= 0);
      if (list.length && window.CASE) window.CASE.open('projects', list[(Math.random() * list.length) | 0]);
    }
  }
  function type(ch) {
    buf = (buf + ch).slice(-24);
    typed.textContent = buf;
  }

  function onKey(e) {
    if (!mounted || e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.documentElement.classList.contains('case-on')) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (document.querySelector('.chat.open, .cmdk.open, #chatPanel:not([hidden])')) return;
    const name = e.key === ' ' ? ' ' : e.key.toLowerCase();
    if ((name === ' ' || name === 'enter') && t && t.closest && t.closest('.kb-key')) return;
    const sec = $(`.kb-key.sec[data-key="${CSS.escape(name)}"]`, board) || $(`.kb-key:not(.nm)[data-key="${CSS.escape(name)}"]`, board);
    const caps = sec ? [sec] : $$(`.kb-key.nm[data-key="${CSS.escape(name)}"]`, board).slice(0, 1);
    if (!caps.length) return;
    e.preventDefault();
    if (e.repeat) return;
    caps.forEach((k) => { down(k); setTimeout(() => release(k), 120); act(k); });
  }

  function startIdle() {
    clearTimeout(idleT);
    if (reduced() || idlePlays >= 2 || !mounted) return;
    idleT = setTimeout(() => {
      if (!mounted) return;
      idlePlays++;
      board.classList.remove('wave'); void board.offsetWidth; board.classList.add('wave');
      idleT = setTimeout(() => { board.classList.remove('wave'); startIdle(); }, 2400);
    }, 7000);
  }
  function stopIdle() { clearTimeout(idleT); board?.classList.remove('wave'); }

  async function load() {
    if (content) return content;
    try {
      const r = await fetch('/api/content', { cache: 'no-store' });
      content = (await r.json()).content || {};
      if (window.I18N) content = window.I18N.content(content);
    } catch { content = {}; }
    return content;
  }
  document.addEventListener('content:rendered', (e) => { if (e.detail) content = e.detail; });

  window.KEYSMODE = {
    async mount() {
      mounted = true;
      if (!root) { build(await load()); show(''); }
      if (!mounted) return;
      root.hidden = false;
      document.body.classList.add('kb-on');
      root.classList.remove('intro'); void root.offsetWidth;
      if (!reduced()) root.classList.add('intro');
      idlePlays = 0;
      startIdle();
      addEventListener('keydown', onKey);
    },
    unmount() {
      mounted = false;
      removeEventListener('keydown', onKey);
      if (!root) return;
      root.hidden = true;
      document.body.classList.remove('kb-on');
      stopIdle();
    }
  };
  document.dispatchEvent(new CustomEvent('keys:ready'));
})();
