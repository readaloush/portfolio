(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ICONS = {
    github: '<path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/>',
    linkedin: '<path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.05a4.17 4.17 0 0 1 3.75-2.06c4 0 4.75 2.64 4.75 6.07V21h-4v-5.4c0-1.29-.02-2.95-1.8-2.95-1.8 0-2.08 1.4-2.08 2.85V21h-4V9Z"/>',
    instagram: '<path d="M12 2.2c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23C2.21 15.58 2.2 15.2 2.2 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.21 8.8 2.2 12 2.2Zm0 3.05a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5Zm0 11.13a4.38 4.38 0 1 1 0-8.76 4.38 4.38 0 0 1 0 8.76Zm7.02-11.4a1.58 1.58 0 1 1-3.15 0 1.58 1.58 0 0 1 3.15 0Z"/>',
    facebook: '<path d="M14 9h3V5.5h-3c-2.3 0-4 1.9-4 4.2V12H7v3.5h3V22h3.5v-6.5h3L17 12h-3.5v-2.1c0-.5.4-.9 1-.9Z"/>',
    tiktok: '<path d="M16.5 2h-3v13.2a2.7 2.7 0 1 1-2.2-2.65V9.4a6 6 0 1 0 5.2 5.94V9.1a7.3 7.3 0 0 0 4 1.2V7.2a4.3 4.3 0 0 1-4-4.2V2Z"/>',
    x: '<path d="M17.5 3h3.2l-7 8 8.2 10h-6.4l-5-6.1L4.7 21H1.5l7.5-8.6L1.2 3h6.6l4.5 5.6L17.5 3Zm-1.1 16.2h1.8L7.7 4.7H5.8l10.6 14.5Z"/>',
    youtube: '<path d="M22.5 7.5a3 3 0 0 0-2.1-2.1C18.5 4.9 12 4.9 12 4.9s-6.5 0-8.4.5A3 3 0 0 0 1.5 7.5C1 9.4 1 12 1 12s0 2.6.5 4.5a3 3 0 0 0 2.1 2.1c1.9.5 8.4.5 8.4.5s6.5 0 8.4-.5a3 3 0 0 0 2.1-2.1C23 14.6 23 12 23 12s0-2.6-.5-4.5ZM9.9 15.4V8.6L15.7 12l-5.8 3.4Z"/>',
    mail: '<path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1.4 2L12 12.3 19.6 7H4.4ZM20 8.9l-7.4 5.2a1 1 0 0 1-1.2 0L4 8.9V17h16V8.9Z"/>',
    phone: '<path d="M6.6 2.5a1.5 1.5 0 0 1 1.4 1l1 2.6a1.5 1.5 0 0 1-.4 1.7L7.3 9a13 13 0 0 0 6 6l1.2-1.3a1.5 1.5 0 0 1 1.7-.4l2.6 1a1.5 1.5 0 0 1 1 1.4v2.5a1.9 1.9 0 0 1-2.1 1.9C10.9 19.4 4.6 13.1 4 6.6A1.9 1.9 0 0 1 5.9 4.5h.7Z"/>',
    pin: '<path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"/>',
    web: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 9h-3a15.6 15.6 0 0 0-1.3-5.6A8 8 0 0 1 18.9 11ZM12 4.2c.8 1.2 1.5 3.6 1.7 6.8h-3.4c.2-3.2.9-5.6 1.7-6.8ZM5.1 11a8 8 0 0 1 4.3-5.6A15.6 15.6 0 0 0 8.1 11h-3Zm0 2h3a15.6 15.6 0 0 0 1.3 5.6A8 8 0 0 1 5.1 13Zm6.9 6.8c-.8-1.2-1.5-3.6-1.7-6.8h3.4c-.2 3.2-.9 5.6-1.7 6.8Zm2.6-1.2a15.6 15.6 0 0 0 1.3-5.6h3a8 8 0 0 1-4.3 5.6Z"/>'
  };
  const icon = (name, size = 20) =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" aria-hidden="true">${ICONS[name] || ICONS.web}</svg>`;
  const guessIcon = (label = '') => {
    const k = label.toLowerCase();
    for (const key of Object.keys(ICONS)) if (k.includes(key)) return key;
    if (k.includes('twitter')) return 'x';
    if (k.includes('mail') || k.includes('e-mail')) return 'mail';
    return 'web';
  };

  const perf = () => (window.PERF ? window.PERF.tier : 'high');
  const atLeast = (t) => (window.PERF ? window.PERF.allows(t) : true);

  function initSound() {
    const btn = $('#soundBtn');
    if (!btn) return;

    const paint = () => btn.classList.toggle('on', !!window.SFX?.enabled);
    paint();
    document.addEventListener('sound:changed', paint);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.SFX?.unlockAudio();
      window.SFX?.toggle();
      paint();
      toast(window.SFX?.enabled ? 'Sound on' : 'Sound off', 1600);
    });

    document.addEventListener('pointerdown', (e) => {
      if (e.target.closest('#soundBtn, #themeSwitch, #photoFrame')) return;
      if (e.target.closest('a, button, input, .tilt')) window.SFX?.click();
    });
  }

  function bindTilt(root = document) {
    return;
    $$('.tilt', root).forEach((el) => {
      if (el.__tilt) return;
      el.__tilt = true;
      let raf, r = null;

      el.addEventListener('pointerenter', () => { r = el.getBoundingClientRect(); });

      el.addEventListener('pointermove', (e) => {
        if (!r) r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const strength = Number(el.dataset.tilt || 9);
          el.style.setProperty('--gx', px * 100 + '%');
          el.style.setProperty('--gy', py * 100 + '%');
          el.style.transform =
            `perspective(1000px) rotateX(${(0.5 - py) * strength * 2}deg) rotateY(${(px - 0.5) * strength * 2}deg) translateZ(6px)`;
        });
      }, { passive: true });

      el.addEventListener('pointerleave', () => {
        cancelAnimationFrame(raf);
        r = null;
        el.style.transform = '';
      });
    });
  }

  let refreshParallax = () => {};

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        $$('[data-stagger]', en.target).forEach((c, i) => setTimeout(() => c.classList.add('in'), i * 90));
        $$('.bar i', en.target).forEach((b, i) => setTimeout(() => (b.style.width = b.dataset.level + '%'), 120 + i * 80));
        $$('[data-count]', en.target).forEach((el) => countUp(el));
        io.unobserve(en.target);
      });
    },
    { threshold: 0.14, rootMargin: '0px 0px -8% 0px' }
  );
  const observe = (root = document) => $$('.reveal, .section-head, .stats li, .tl-item, .project, .skill-card, .edu-card', root).forEach((el) => io.observe(el));

  function countUp(el) {
    const target = Number(el.dataset.count);
    const dec = Number(el.dataset.decimals || 0);
    const suffix = el.dataset.suffix || '';
    const dur = 1600;
    const t0 = performance.now();
    (function step(now) {
      const p = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * e).toFixed(dec) + suffix;
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  function scramble(el, finalText, duration = 1400) {
    setTimeout(() => { el.textContent = finalText; }, duration + 400);

    const chars = '!<>-_\\/[]{}—=+*^?#01';
    const len = finalText.length;
    const t0 = performance.now();
    (function step(now) {
      const p = Math.min((now - t0) / duration, 1);
      let out = '';
      for (let i = 0; i < len; i++) {
        if (p * len > i) out += finalText[i];
        else out += finalText[i] === ' ' ? ' ' : chars[(Math.random() * chars.length) | 0];
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = finalText;
    })(t0);
  }

  function typeLoop(el, list) {
    if (!list.length) return;
    let i = 0, j = 0, deleting = false;
    (function tick() {
      const word = list[i % list.length];
      j += deleting ? -1 : 1;
      el.textContent = word.slice(0, j);
      let delay = deleting ? 38 : 72;
      if (!deleting && j === word.length) { delay = 1900; deleting = true; }
      else if (deleting && j === 0) { deleting = false; i++; delay = 320; }
      setTimeout(tick, delay);
    })();
  }

  let toastTimer;
  function toast(msg, ms = 3200) {
    const t = $('#toast');
    $('#toastText').textContent = window.I18N ? window.I18N.t(msg) : msg;
    t.hidden = false;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => (t.hidden = true), 400);
    }, ms);
  }

  function initThemeSwitch() {
    const sw = $('#themeSwitch');
    const blackout = $('#blackout');
    let clicks = 0, resetTimer, exhausted = false;

    const stored = localStorage.getItem('theme');
    if (stored) document.documentElement.dataset.theme = stored;

    const REACTIONS = [
      [5, 'Easy on that switch.'],
      [8, 'Are you testing the wiring?'],
      [11, 'You are wearing me out.'],
      [14, 'Seriously. I need a break.'],
      [17, 'My circuits are getting warm.'],
      [20, 'Fine. You win. Lights out.']
    ];

    sw.addEventListener('click', () => {
      if (exhausted) return;

      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('theme', next);
      window.SFX?.unlockAudio();
      window.SFX?.flip(next === 'light');

      sw.classList.remove('sparking');
      void sw.offsetWidth;
      sw.classList.add('sparking');
      setTimeout(() => sw.classList.remove('sparking'), 460);

      clicks++;
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => (clicks = 0), 9000);

      const hit = REACTIONS.find(([n]) => n === clicks);
      if (hit) {
        toast(hit[1]);
        sw.classList.add('tired');
        setTimeout(() => sw.classList.remove('tired'), 520);
      }

      if (clicks >= 20) {
        exhausted = true;
        window.SFX?.powerDown();
        blackout.classList.add('flicker');
        setTimeout(() => {
          blackout.classList.remove('flicker');
          toast('Okay, I am back. Please be gentle.', 4000);
          exhausted = false;
          clicks = 0;
        }, 1600);
      }
    });
  }

  function initSecretAdmin() {
    const frame = $('#photoFrame');
    const modal = $('#loginModal');
    const form = $('#loginForm');
    const errorEl = $('#loginError');
    let count = 0, timer;

    const openModal = () => {
      modal.hidden = false;
      errorEl.hidden = true;
      setTimeout(() => form.querySelector('input')?.focus(), 120);
    };
    const closeModal = () => { modal.hidden = true; form.reset(); };

    frame?.addEventListener('click', () => {
      count++;
      window.SFX?.unlockAudio();
      frame.classList.remove('knock'); void frame.offsetWidth; frame.classList.add('knock');
      clearTimeout(timer);
      timer = setTimeout(() => (count = 0), 5000);

      if (count === 2) toast('.');
      if (count === 3) toast('..');
      if (count === 4) toast('...');
      if (count >= 5) { count = 0; window.SFX?.unlock(); openModal(); }
      else window.SFX?.knock(count);
    });

    addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') { e.preventDefault(); openModal(); }
      if (e.key === 'Escape' && !modal.hidden) closeModal();
    });

    $$('[data-close]', modal).forEach((b) => b.addEventListener('click', closeModal));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = { username: form.username.value, password: form.password.value };
      errorEl.hidden = true;
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed.');
        try { if (data.token) sessionStorage.setItem('rp_token', data.token); } catch {  }

        closeModal();
        window.SFX?.chime();
        showAdminBar(data.username);
        toast('Signed in. Use “Edit the site” when you want the panel.', 5000);
      } catch (err) {
        window.SFX?.error();
        errorEl.textContent = err.message;
        errorEl.hidden = false;
        form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
      }
    });
  }

  function initNav() {
    const nav = $('#nav'), links = $('#navLinks'), burger = $('#navBurger');
    const progressBar = $('#scrollBar');

    let queued = false;
    const onScroll = () => {
      queued = false;
      nav.classList.toggle('stuck', scrollY > 30);
      const d = document.documentElement;
      const span = d.scrollHeight - innerHeight;
      if (progressBar) progressBar.style.width = (span > 0 ? (scrollY / span) * 100 : 0) + '%';

      const tl = $('#timeline'), fill = $('#timelineFill');
      if (tl && fill) {
        const r = tl.getBoundingClientRect();
        const p = Math.min(Math.max((innerHeight * 0.75 - r.top) / r.height, 0), 1);
        fill.style.height = p * 100 + '%';
      }
    };
    addEventListener('scroll', () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(onScroll);
    }, { passive: true });
    onScroll();

    burger?.addEventListener('click', () => {
      burger.classList.toggle('on');
      links.classList.toggle('open');
    });
    $$('#navLinks a').forEach((a) =>
      a.addEventListener('click', () => { burger.classList.remove('on'); links.classList.remove('open'); })
    );

    const sections = $$('main section[id]');
    const spy = new IntersectionObserver(
      (es) => es.forEach((en) => {
        if (!en.isIntersecting) return;
        $$('#navLinks a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id));
      }),
      { threshold: 0.3 }
    );
    sections.forEach((s) => spy.observe(s));
  }

  function bindMagnetic() {
    return;
    $$('.magnetic').forEach((el) => {
      if (el.__mag) return;
      el.__mag = true;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.28}px, ${(e.clientY - r.top - r.height / 2) * 0.35}px)`;
      });
      el.addEventListener('pointerleave', () => (el.style.transform = ''));
    });
  }

  const NEWS_SEEN = 'rp_news_seen';

  const seenIds = () => {
    try { return new Set(JSON.parse(localStorage.getItem(NEWS_SEEN) || '[]')); }
    catch { return new Set(); }
  };
  const saveSeen = (set) => {
    try { localStorage.setItem(NEWS_SEEN, JSON.stringify(Array.from(set).slice(-200))); }
    catch {  }
  };

  function liveNews(list) {
    return (list || [])
      .filter((a) => a && a.published !== false && (a.title || a.body))
      .map((a, i) => ({ ...a, id: a.id || `a-${i}-${String(a.title || '').slice(0, 24)}` }))
      .sort((a, b) => {
        if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
        return String(b.date || '').localeCompare(String(a.date || ''));
      });
  }

  const FILE_KIND = {
    pdf:  { label: 'PDF',        cls: 'pdf' },
    doc:  { label: 'Word',       cls: 'doc' },
    docx: { label: 'Word',       cls: 'doc' },
    rtf:  { label: 'Word',       cls: 'doc' },
    xls:  { label: 'Excel',      cls: 'xls' },
    xlsx: { label: 'Excel',      cls: 'xls' },
    csv:  { label: 'CSV',        cls: 'xls' },
    ppt:  { label: 'Slides',     cls: 'ppt' },
    pptx: { label: 'Slides',     cls: 'ppt' },
    zip:  { label: 'ZIP',        cls: 'zip' },
    txt:  { label: 'Text',       cls: 'txt' },
    png:  { label: 'Image',      cls: 'img' },
    jpg:  { label: 'Image',      cls: 'img' },
    jpeg: { label: 'Image',      cls: 'img' },
    webp: { label: 'Image',      cls: 'img' },
    gif:  { label: 'Image',      cls: 'img' },
    svg:  { label: 'Image',      cls: 'img' }
  };

  const fileKind = (url = '') => {
    const clean = String(url).split(/[?#]/)[0];
    const ext = (clean.split('.').pop() || '').toLowerCase();
    if (FILE_KIND[ext]) return FILE_KIND[ext];
    return /^https?:/i.test(url) ? { label: 'Link', cls: 'link' } : { label: 'File', cls: 'txt' };
  };

  const attachmentsHTML = (files) => {
    const list = (files || []).filter((f) => f && f.url);
    if (!list.length) return '';
    return `<ul class="news-files">${list.map((f) => {
      const kind = fileKind(f.url);
      const external = /^https?:/i.test(f.url);
      const dl = external ? '' : ' download';
      return `<li><a class="news-file ${kind.cls}" href="${esc(f.url)}"${external ? ' target="_blank" rel="noopener"' : dl} data-cursor="open">
        <span class="news-file-kind">${esc(kind.label)}</span>
        <span class="news-file-name">${esc(f.label || kind.label)}</span>
      </a></li>`;
    }).join('')}</ul>`;
  };

  const niceDate = (raw) => {
    const d = new Date(raw);
    if (!raw || isNaN(d)) return String(raw || '');
    return d.toLocaleDateString((window.I18N && window.I18N.locale) || 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  let NEWS = [];

  function paintBadge() {
    const bell = $('#bellBtn'), badge = $('#bellBadge');
    if (!bell || !badge) return;
    const seen = seenIds();
    const unread = NEWS.filter((a) => !seen.has(a.id)).length;
    badge.textContent = unread > 9 ? '9+' : String(unread);
    badge.hidden = unread === 0;
    bell.classList.toggle('unread', unread > 0);
    bell.setAttribute('aria-label', unread ? `Announcements, ${unread} unread` : 'Announcements');
    bell.hidden = NEWS.length === 0;
  }

  function markAllSeen() {
    const seen = seenIds();
    let changed = false;
    NEWS.forEach((a) => { if (!seen.has(a.id)) { seen.add(a.id); changed = true; } });
    if (changed) { saveSeen(seen); paintBadge(); }
  }

  function renderNews(list) {
    NEWS = liveNews(list);
    const section = $('#news');
    const grid = $('#newsGrid');
    if (!grid || !section) return;

    const empty = NEWS.length === 0;
    section.hidden = empty;
    $$('#navLinks a[href="#news"]').forEach((a) => (a.hidden = empty));
    if (empty) { paintBadge(); return; }

    const seen = seenIds();
    grid.innerHTML = NEWS.map((a) => {
      const files = attachmentsHTML(a.files);
      return `
      <article data-id="${esc(a.id || '')}" class="news-card reveal${a.pinned ? ' pinned' : ''}${seen.has(a.id) ? '' : ' fresh'}${a.image ? ' has-image' : ''}">
        <div class="news-when">
          <span class="news-date">${esc(niceDate(a.date))}</span>
          ${a.tag ? `<span class="news-tag">${esc(a.tag)}</span>` : ''}
        </div>
        ${a.image ? `<a class="news-shot" href="${esc(a.image)}" target="_blank" rel="noopener" data-cursor="open">
          <img src="${esc(a.image)}" alt="${esc(a.title)}" loading="lazy" decoding="async">
        </a>` : ''}
        <div class="news-text">
          <h3>${esc(a.title)}</h3>
          <p>${esc(a.body)}</p>
          ${files}
          ${a.link ? `<a class="news-more" href="${esc(a.link)}"${/^https?:/i.test(a.link) ? ' target="_blank" rel="noopener"' : ''} data-cursor="open">Read more</a>` : ''}
        </div>
      </article>`;
    }).join('');

    paintBadge();
  }

  function initBell() {
    const bell = $('#bellBtn');
    const pop = $('#newsPop');
    const list = $('#newsPopList');
    if (!bell || !pop) return;

    const close = () => { pop.hidden = true; bell.classList.remove('on'); };

    const open = () => {
      const seen = seenIds();
      list.innerHTML = NEWS.slice(0, 6).map((a) => {
        const href = a.link || '#news';
        const external = /^https?:/i.test(a.link || '');
        const n = (a.files || []).filter((f) => f && f.url).length;
        const attached = n ? ` · ${n} file${n > 1 ? 's' : ''}` : '';
        return `<a class="news-pop-item${seen.has(a.id) ? ' read' : ''}" href="${esc(href)}"${external ? ' target="_blank" rel="noopener"' : ' data-news-close'}>
          <span class="t"><i></i>${esc(a.title)}</span>
          <span class="b">${esc(String(a.body || '').slice(0, 120))}${String(a.body || '').length > 120 ? '…' : ''}</span>
          <span class="d">${esc(niceDate(a.date))}${a.tag ? ' · ' + esc(a.tag) : ''}${attached}</span>
        </a>`;
      }).join('') || '<p class="news-pop-item">Nothing yet.</p>';

      pop.hidden = false;
      bell.classList.add('on');
      window.SFX?.click();

      setTimeout(markAllSeen, 1000);
    };

    bell.addEventListener('click', (e) => { e.stopPropagation(); pop.hidden ? open() : close(); });
    pop.addEventListener('click', (e) => { if (e.target.closest('[data-news-close]')) close(); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) close(); });

    const sec = $('#news');
    if (sec) {
      let dwell;
      new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          clearTimeout(dwell);
          if (en.isIntersecting) dwell = setTimeout(markAllSeen, 1800);
        });
      }, { threshold: 0.35 }).observe(sec);
    }
  }

  function showAdminBar(username) {
    const bar = $('#adminBar');
    if (!bar) return;
    $('#adminBarUser').textContent = username || 'admin';
    bar.hidden = false;
    document.body.classList.add('has-adminbar');
  }
  window.showAdminBar = showAdminBar;

  function bindAdminBar() {
    const bar = $('#adminBar');
    if (!bar) return;

    $('#adminBarNews')?.addEventListener('click', () => { location.href = '/admin#news'; });

    $('#adminBarOut')?.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
        sessionStorage.removeItem('rp_token');
      } catch {  }
      bar.hidden = true;
      document.body.classList.remove('has-adminbar');
      toast('Signed out.');
    });
  }

  async function checkSession() {
    let token = null;
    try { token = sessionStorage.getItem('rp_token'); } catch {  }

    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'same-origin',
        headers: token ? { Authorization: 'Bearer ' + token } : {}
      });
      if (!res.ok) return;
      const me = await res.json();
      showAdminBar(me.username);
    } catch {  }
  }

  function initPerfTab() {
    if (!window.PERF) return;
    const actions = $('.nav-actions');
    if (!actions) return;

    const btn = document.createElement('button');
    btn.className = 'perf-tab';
    btn.id = 'perfTab';
    btn.type = 'button';
    btn.dataset.cursor = 'quality';

    const LABEL = { high: 'Full', mid: 'Balanced', low: 'Fast' };
    const NOTE = {
      high: 'Every effect on.',
      mid: 'Blur faked, grain still. Looks the same, costs less.',
      low: 'No blur, no grain, small network. Built for a tired laptop.'
    };

    const paint = () => {
      const t = window.PERF.tier;
      const auto = !window.PERF.pinned;
      btn.innerHTML = `<i></i><span>${auto ? 'Auto' : LABEL[t]}</span>`;
      btn.title = auto
        ? `Graphics: measured automatically — currently ${LABEL[t]}. Click to choose one yourself.`
        : `Graphics: ${LABEL[t]} — ${NOTE[t]} Click again to cycle; keep clicking to return to Auto.`;
    };
    paint();
    document.addEventListener('perf:changed', paint);

    btn.addEventListener('click', () => {
      const order = ['high', 'mid', 'low'];
      if (!window.PERF.pinned) {
        const start = order.indexOf(window.PERF.tier);
        window.PERF.set(order[start < 0 ? 0 : start]);
        paint();
        return toast(`Graphics: ${LABEL[window.PERF.tier]} — ${NOTE[window.PERF.tier]}`, 3600);
      }
      const i = order.indexOf(window.PERF.tier);
      if (i === order.length - 1) {
        window.PERF.auto();
        paint();
        return toast('Graphics: back to automatic — measured on this machine.', 3600);
      }
      const next = order[i + 1];
      window.PERF.set(next);
      paint();
      toast(`Graphics: ${LABEL[next]} — ${NOTE[next]}`, 3600);
    });

    actions.insertBefore(btn, actions.firstChild);
  }

  function paintHeroName(name) {
    const h = $('#heroName');
    if (!h) return;
    const words = String(name).trim().split(/\s+/).filter(Boolean);
    h.setAttribute('aria-label', name);
    let n = 0;
    h.innerHTML = words.map((w) =>
      `<span class="ph-line" aria-hidden="true">${[...w].map((ch) => `<span class="ph-l" style="--i:${n++}">${esc(ch)}</span>`).join('')}</span>`
    ).join('');
    if (document.body.classList.contains('is-ready')) {
      requestAnimationFrame(() => requestAnimationFrame(() => $('#phStage')?.classList.add('in')));
    }
  }
  function paintBlurWords(el, text) {
    if (!el) return;
    el.setAttribute('aria-label', text);
    el.innerHTML = String(text).split(/\s+/).filter(Boolean)
      .map((w, i) => `<span class="ph-w" aria-hidden="true" style="--i:${i}">${esc(w)}</span>`).join(' ');
  }

  function render(c) {
    const p = c.profile || {};
    const s = c.sections || {};
    const m = c.meta || {};

    if (m.siteTitle) {
      const base = String(m.siteTitle).trim();
      document.documentElement.dataset.baseTitle = base;
      const v = window.PRESS?.current?.();
      const t = v && document.querySelector(v + ' .section-title')?.textContent?.trim();
      document.title = t ? `${t} — ${base}` : base;
    }
    if (m.metaDescription) $('#metaDescription').setAttribute('content', m.metaDescription);

    $('#heroAvailability').textContent = p.availability || 'Available';
    $('#heroAvailabilityChip').hidden = !(p.showAvailability === true && p.availability);
    paintHeroName(p.name || '');
    paintBlurWords($('#heroTagline'), p.tagline || '');
    $('#heroSummary').textContent = p.summary || '';
    if ($('#photoCaption')) $('#photoCaption').textContent = p.location || '';
    if (p.photo) $('#profilePhoto').src = p.photo;
    $('#profilePhoto').alt = p.name || 'Profile photo';

    const cv = $('#cvButton');
    cv.href = p.cvUrl || '/assets/files/cv.pdf';

    typeLoop($('#typedRole'), (p.roles && p.roles.length ? p.roles : [p.title || 'Engineer']));

    const socialHTML = (c.socials || [])
      .filter((x) => x && x.url)
      .map(
        (x) =>
          `<li><a href="${esc(x.url)}" target="_blank" rel="noopener" aria-label="${esc(x.label)}" data-cursor="${esc(x.label)}">${icon(
            x.icon || guessIcon(x.label)
          )}<span class="tip">${esc(x.label)}</span></a></li>`
      )
      .join('');
    $('#socialList').innerHTML = socialHTML;
    $('#socialList2').innerHTML = socialHTML;

    $('#statList').innerHTML = (c.stats || [])
      .map(
        (st) =>
          `<li class="reveal"><b data-count="${esc(st.value)}" data-decimals="${esc(st.decimals || 0)}" data-suffix="${esc(
            st.suffix || ''
          )}">0</b><span>${esc(st.label)}</span><i>${esc(st.detail || '')}</i></li>`
      )
      .join('');

    $('#newsKicker').textContent = s.newsKicker || '';
    $('#newsTitle').textContent = s.newsTitle || 'Announcements';
    renderNews(c.announcements);

    $('#aboutKicker').textContent = s.aboutKicker || '';
    $('#aboutTitle').textContent = s.aboutTitle || 'About';
    $('#aboutCopy').innerHTML = String(p.summary || '')
      .split(/\n{2,}/)
      .map((par) => `<p>${esc(par)}</p>`)
      .join('');

    $('#langList').innerHTML = (c.languages || [])
      .map((l) => `<li><span>${esc(l.name)}</span><em>${esc(l.level)}</em></li>`)
      .join('');

    const contactItems = [
      p.email && { icon: 'mail', text: p.email, href: 'mailto:' + p.email },
      p.phone && { icon: 'phone', text: p.phone, href: 'tel:' + String(p.phone).replace(/\s/g, '') },
      p.location && { icon: 'pin', text: p.location, href: '#' }
    ].filter(Boolean);
    const contactHTML = contactItems
      .map((i) => `<li><a href="${esc(i.href)}">${icon(i.icon, 16)}<span>${esc(i.text)}</span></a></li>`)
      .join('');
    $('#contactQuick').innerHTML = contactHTML;
    $('#contactBig').innerHTML = contactHTML;

    $('#skillsKicker').textContent = s.skillsKicker || '';
    $('#skillsTitle').textContent = s.skillsTitle || 'Skills';
    $('#skillGrid').innerHTML = (c.skills || [])
      .map(
        (g) => `<div class="card glow tilt skill-card reveal">
          <h3>${esc(g.category)}</h3>
          ${(g.items || [])
            .map(
              (it) => `<div class="skill-row">
                <div class="top"><span>${esc(it.name)}</span><em>${esc(it.level)}%</em></div>
                <div class="bar"><i data-level="${Number(it.level) || 0}"></i></div>
              </div>`
            )
            .join('')}
        </div>`
      )
      .join('');

    $('#experienceKicker').textContent = s.experienceKicker || '';
    $('#experienceTitle').textContent = s.experienceTitle || 'Experience';

    $('#projectsKicker').textContent = s.projectsKicker || '';
    $('#projectsTitle').textContent = s.projectsTitle || 'Projects';

    $('#educationKicker').textContent = s.educationKicker || '';
    $('#educationTitle').textContent = s.educationTitle || 'Education';
    $('#eduGrid').innerHTML = (c.education || [])
      .map(
        (e) => `<div class="card glow tilt edu-card reveal">
          <h3>${esc(e.degree)}</h3>
          <p class="school">${esc(e.school)}</p>
          <p class="period">${esc(e.period)}</p>
          ${e.note ? `<p class="note">${esc(e.note)}</p>` : ''}
        </div>`
      )
      .join('');

    $('#contactKicker').textContent = s.contactKicker || '';
    $('#contactTitle').textContent = s.contactTitle || "Let's talk";
    $('#calendarNote').textContent = p.calendarNote || '';

    const box = $('#calendarBox');
    const url = (p.calendarUrl || '').trim();

    const isGoogleLong = /calendar\.google\.com\/calendar\/appointments\/schedules\//.test(url);
    const isGoogleShort = /(^|\/\/)calendar\.app\.google\//.test(url);
    const isWrongGoogleLink = /calendar\.google\.com/.test(url) && !isGoogleLong;

    const embeddable = isGoogleLong || /calendly\.com|cal\.com|tidycal\.com|savvycal\.com|zcal\.co/.test(url);

    if (url && embeddable) {
      const src = isGoogleLong && !url.includes('?') ? url + '?gv=true' : url;
      box.innerHTML = `<iframe src="${esc(src)}" frameborder="0" title="Book a meeting" loading="lazy"></iframe>`;
    } else if (url && !isWrongGoogleLink) {
      box.classList.add('is-card');
      box.innerHTML = `<div class="cal-card">
        <div class="cal-card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>
            <path d="M9 15l2 2 4-4"/>
          </svg>
          <span class="cal-card-pulse"></span>
        </div>
        <h4>Book a meeting</h4>
        <p>${esc(p.calendarNote || 'Pick a slot that suits you.')}</p>
        <a class="btn btn-primary magnetic" href="${esc(url)}" target="_blank" rel="noopener" data-cursor="book">
          <span class="btn-shine"></span><span>See my availability</span>
        </a>
        <span class="cal-card-meta">Opens my live calendar${isGoogleShort ? ' · Google Meet link sent automatically' : ''}</span>
      </div>`;
    } else {
      box.innerHTML = `<div class="cal-empty">
        ${icon('web', 54)}
        <h4>${isWrongGoogleLink ? 'That Google link will not work here' : 'No booking page linked yet'}</h4>
        <p>${
          isWrongGoogleLink
            ? 'This looks like a "subscribe to my calendar" link. A booking link must contain <code>/appointments/schedules/</code>.'
            : 'Paste a booking link into the admin panel under <code>Profile → Google Schedule URL</code>. Google appointment schedules, Calendly and Cal.com all work.'
        }</p>
        ${p.email ? `<a class="btn btn-primary magnetic" href="mailto:${esc(p.email)}"><span class="btn-shine"></span><span>Email me instead</span></a>` : ''}
      </div>`;
    }

    $('#footerNote').textContent = m.footerNote || '';
    $('#year').textContent = new Date().getFullYear();

    bindTilt();
    bindMagnetic();
    refreshParallax();
    observe();
    document.dispatchEvent(new CustomEvent('content:rendered', { detail: c }));
  }

  async function boot() {
    initNav();
    initSound();
    initThemeSwitch();
    initSecretAdmin();
    initBell();
    initPerfTab();
    bindAdminBar();
    checkSession();

    $('#navSignature').appendChild(window.buildSignature({ strokeWidth: 9, duration: 2200, delay: 1200 }));
    $('#photoSignature')?.appendChild(window.buildSignature({ strokeWidth: 7, duration: 2400, delay: 1400 }));
    $('#footerSignature').appendChild(window.buildSignature({ strokeWidth: 10, duration: 2800, delay: 2000, glow: false }));

    try {
      const res = await fetch('/api/content');
      const data = await res.json();
      render(window.I18N ? window.I18N.content(data.content) : data.content);
    } catch (e) {
      console.error('Could not load content from the database.', e);
      toast('Could not reach the database. Is the server running?', 6000);
    }

    let nameSettled = false;
    document.addEventListener('loader:done', () => {
      if (!nameSettled) {
        nameSettled = true;
        $('#phStage')?.classList.add('in');
      }
      window.SFX?.chime();
      observe();
    });
    if (document.body.classList.contains('is-ready')) observe();
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();
