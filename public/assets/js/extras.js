(() => {
  const strip = () => {
    const s = document.documentElement.style;
    if (s.getPropertyValue('--accent') || s.getPropertyValue('--accent2')) {
      s.removeProperty('--accent');
      s.removeProperty('--accent2');
    }
  };
  new MutationObserver(strip).observe(document.documentElement, {
    attributes: true, attributeFilter: ['style']
  });
  strip();
})();

(() => {
  try {
    if (!localStorage.getItem('theme')) document.documentElement.dataset.theme = 'dark';
  } catch (e) { document.documentElement.dataset.theme = 'dark'; }
})();

(() => {
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const pending = [];

  function layoutTop(el) {
    let y = 0;
    let n = el;
    while (n) { y += n.offsetTop; n = n.offsetParent; }
    return y;
  }

  let ticking = false;
  function checkPending() {
    ticking = false;
    if (!pending.length) return;
    const line = scrollY + innerHeight * 0.86;
    for (let i = pending.length - 1; i >= 0; i--) {
      const el = pending[i];
      if (layoutTop(el) < line) {
        el.classList.add('in');
        pending.splice(i, 1);
      }
    }
  }
  const queueCheck = () => { if (!ticking) { ticking = true; requestAnimationFrame(checkPending); } };
  addEventListener('scroll', queueCheck, { passive: true });
  addEventListener('resize', queueCheck);

  function applySideReveals() {
    if (reduced) return;
    const groups = [
      { sel: '.project',    alternate: true,  dist: 75, rot: 16 },
      { sel: '.tl-item',    alternate: false, from: -60, rot: 12 },
      { sel: '.skill-card', alternate: true,  dist: 65, rot: 14 },
      { sel: '.edu-card',   alternate: true,  dist: 65, rot: 14 },
      { sel: '.stats li',   alternate: true,  dist: 45, rot: 10 }
    ];

    groups.forEach(({ sel, alternate, from, dist = 70, rot = 14 }) => {
      $$(sel).forEach((el, i) => {
        if (el.dataset.sideBound) return;
        el.dataset.sideBound = '1';

        const vw = from !== undefined ? from : (alternate && i % 2 ? -dist : dist);
        el.style.setProperty('--from', vw + 'vw');
        el.style.setProperty('--rot', (vw > 0 ? -rot : rot) + 'deg');

        el.classList.remove('reveal', 'in');
        el.classList.add('reveal-x');

        if (layoutTop(el) < scrollY + innerHeight * 0.86) {
          requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
        } else {
          pending.push(el);
        }
      });
    });
    queueCheck();
  }

  const contentWatcher = new MutationObserver(() => applySideReveals());
  ['#projectGrid', '#timeline', '#skillGrid', '#eduGrid', '#statList'].forEach((sel) => {
    const node = document.querySelector(sel);
    if (node) contentWatcher.observe(node, { childList: true });
  });
  document.addEventListener('loader:done', () => setTimeout(applySideReveals, 60));
  setTimeout(applySideReveals, 1200);
  setTimeout(applySideReveals, 3000);

  const SECTIONS = ['#top', '#news', '#about', '#skills', '#experience', '#projects', '#education', '#contact'];

  const currentIndex = () => {
    if (window.PRESS) {
      const v = window.PRESS.current();
      return v ? Math.max(0, SECTIONS.indexOf(v)) : 0;
    }
    let best = 0;
    let bestDist = Infinity;
    SECTIONS.forEach((sel, i) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const d = Math.abs(el.getBoundingClientRect().top - 80);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return best;
  };

  function goTo(i) {
    const clamped = Math.max(0, Math.min(SECTIONS.length - 1, i));
    const sel = SECTIONS[clamped];
    if (window.PRESS) { window.PRESS.show(sel === '#top' ? '' : sel); return; }
    const el = document.querySelector(sel);
    if (!el) return;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    window.SFX?.hover();
  }

  const isTyping = () => {
    const a = document.activeElement;
    return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
  };

  addEventListener('keydown', (e) => {
    if (isTyping() || e.metaKey || e.ctrlKey || e.altKey) return;
    const chatOpen = !document.getElementById('chatPanel')?.hidden;
    const modalOpen = !document.getElementById('loginModal')?.hidden;
    if (modalOpen) return;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case 'PageDown':
        e.preventDefault(); goTo(currentIndex() + 1); break;
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
        e.preventDefault(); goTo(currentIndex() - 1); break;
      case 'Home':
        e.preventDefault(); goTo(0); break;
      case 'End':
        e.preventDefault(); goTo(SECTIONS.length - 1); break;
      case '/':
        if (!chatOpen) { e.preventDefault(); document.getElementById('chatOrb')?.click(); }
        break;
      default:
        return;
    }
    hideHint();
  });

  const hint = document.createElement('div');
  hint.className = 'kbd-hint';
  hint.innerHTML = '<kbd>←</kbd><kbd>→</kbd> move between sections <kbd>/</kbd> ask a question';
  document.body.appendChild(hint);

  let hintTimer;
  function showHint() {
    if (matchMedia('(hover: none), (pointer: coarse)').matches) return;
    try { if (localStorage.getItem('rp_kbd_hint') === 'seen') return; } catch {  }
    hint.classList.add('show');
    hintTimer = setTimeout(hideHint, 7000);
  }
  function hideHint() {
    clearTimeout(hintTimer);
    hint.classList.remove('show');
    try { localStorage.setItem('rp_kbd_hint', 'seen'); } catch {  }
  }
  document.addEventListener('loader:done', () => setTimeout(showHint, 2200));
})();

(() => {
  const KEY = 'rp_mode';
  const MODES = ['modern', 'index', 'keys', 'press', 'shell'];
  const LABEL = { modern: 'Modern', index: 'Index', keys: 'Keys', press: 'Press', shell: 'Terminal' };
  const ICON = {
    modern: '<path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M8 21h8M12 17v4"/>',
    press: '<path d="M4 22h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/>',
    shell: '<path d="m4 17 6-6-6-6M12 19h8"/>',
    index: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    keys: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M10 13h4M7 16h10"/>'
  };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const read = () => {
    try { const v = localStorage.getItem(KEY); return MODES.includes(v) ? v : 'modern'; }
    catch { return 'modern'; }
  };

  let mode = read();

  const FONTS = {
    paper: 'https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Kalam:wght@300;400;700&display=swap',
    press: 'https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,700;1,6..96,400&display=swap'
  };
  const fontsAsked = {};
  function loadFonts(which) {
    if (!FONTS[which] || fontsAsked[which]) return;
    fontsAsked[which] = true;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = FONTS[which];
    document.head.appendChild(l);
  }

  const tabs = document.createElement('div');
  tabs.className = 'mode-tabs';
  tabs.id = 'modeTabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Site mode');
  tabs.innerHTML =
    '<span class="mode-thumb" aria-hidden="true"></span>' +
    MODES.map((m) => `<button type="button" class="mode-tab" role="tab" data-mode="${m}" data-cursor="mode" aria-label="${LABEL[m]} mode" title="${LABEL[m]}">` +
      `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[m]}</svg>` +
      `<span class="mt-label">${LABEL[m]}</span></button>`).join('');

  const thumb = tabs.querySelector('.mode-thumb');
  const buttons = Array.from(tabs.querySelectorAll('.mode-tab'));

  function placeThumb() {
    const on = tabs.querySelector('.mode-tab.is-on');
    if (!on) return;
    thumb.style.left = on.offsetLeft + 'px';
    thumb.style.width = on.offsetWidth + 'px';
  }

  const actions = document.querySelector('.nav-actions');
  const menu = document.querySelector('.nav-links');
  const wide = matchMedia('(min-width: 981px)');

  function placeTabs() {
    const host = wide.matches ? actions : menu;
    if (!host || tabs.parentNode === host) return;
    if (host === actions) host.insertBefore(tabs, host.firstChild);
    else host.appendChild(tabs);
    tabs.classList.toggle('in-menu', host === menu);
    requestAnimationFrame(placeThumb);
  }
  placeTabs();
  wide.addEventListener('change', placeTabs);

  const stage = document.createElement('div');
  stage.className = 'flip-stage';
  stage.id = 'flipStage';
  stage.setAttribute('aria-hidden', 'true');
  stage.innerHTML = '<div class="flip-leaf"><span class="flip-shade"></span></div>';
  document.body.appendChild(stage);

  let flipping = false;
  let lastFlip = 0;

  function flip(back = false) {
    if (reduced || mode !== 'paper' || flipping) return;
    const t = performance.now();
    if (t - lastFlip < 620) return;
    lastFlip = t;
    flipping = true;

    stage.classList.remove('fwd', 'bwd');
    void stage.offsetWidth;
    stage.classList.add('on', back ? 'bwd' : 'fwd');
    rustle();

    setTimeout(() => {
      stage.classList.remove('on', 'fwd', 'bwd');
      flipping = false;
    }, 800);
  }

  let actx = null;
  function rustle() {
    if (window.SFX && window.SFX.enabled === false) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!actx) actx = new AC();
      if (actx.state === 'suspended') actx.resume().catch(() => {});
      const t0 = actx.currentTime;
      const dur = 0.42;

      const len = Math.floor(actx.sampleRate * dur);
      const buf = actx.createBuffer(1, len, actx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const x = i / len;
        const env = Math.sin(Math.PI * Math.pow(x, 0.7));
        d[i] = (Math.random() * 2 - 1) * env * (0.5 + 0.5 * Math.sin(x * 34));
      }

      const src = actx.createBufferSource();
      src.buffer = buf;

      const bp = actx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 0.8;
      bp.frequency.setValueAtTime(1400, t0);
      bp.frequency.exponentialRampToValueAtTime(4200, t0 + dur * 0.55);
      bp.frequency.exponentialRampToValueAtTime(1800, t0 + dur);

      const hp = actx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 700;

      const g = actx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.09);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      src.connect(bp).connect(hp).connect(g).connect(actx.destination);
      src.start(t0);
      src.stop(t0 + dur + 0.05);
    } catch {  }
  }

  const SECTION_NOTES = {
    news: 'what has happened lately.',
    about: 'who is behind the signature.',
    skills: 'what he reaches for, and how far.',
    experience: 'everything shipped, in order.',
    projects: 'the work itself.',
    certificates: 'proof, on paper.',
    education: 'where the theory came from.',
    contact: 'all the ways you can reach him.'
  };

  const VIEWS = ['#news', '#about', '#skills', '#experience', '#projects', '#certificates', '#education', '#contact'];
  let pressReady = false;

  const PATHS = !/\.html?$/i.test(location.pathname) && location.protocol !== 'file:';
  const BASE_TITLE = document.title;
  const viewName = (v) => {
    const t = document.querySelector(v + ' .section-title')?.textContent?.trim();
    return t || v.slice(1).charAt(0).toUpperCase() + v.slice(2);
  };
  const urlFor = (v) => (PATHS ? (v ? '/' + v.slice(1) : '/') : (v || location.pathname)) + location.search;
  function viewFromLocation() {
    const m = location.pathname.match(/^\/([a-z]+)(?:\/[a-z0-9-]+)?\/?$/i);
    if (m && VIEWS.includes('#' + m[1].toLowerCase())) return '#' + m[1].toLowerCase();
    const h = location.hash.split('/')[0];
    return VIEWS.includes(h) ? h : '';
  }
  let pressView = '';

  function pressShow(sel, push) {
    const next = VIEWS.includes(sel) ? sel : '';
    const paper = document.documentElement.dataset.mode === 'paper';
    if (!pressReady || next === pressView || paper || !window.CONSTELLATION) return pressApply(sel, push);
    window.CONSTELLATION.play(() => pressApply(sel, push));
  }

  function pressApply(sel, push) {
    let wanted = VIEWS.includes(sel) ? sel : '';

    if (wanted && document.querySelector(wanted)?.hidden) wanted = '';

    pressView = wanted;

    document.querySelectorAll('main .section').forEach((sec) => {
      sec.classList.toggle('press-off', wanted ? ('#' + sec.id) !== wanted : true);
    });
    document.querySelector('#hero')?.classList.toggle('press-off', !!wanted);
    document.getElementById('pressIndex')?.classList.toggle('press-off', !!wanted);
    document.getElementById('pressBack')?.classList.toggle('press-off', !wanted);

    document.querySelectorAll('#navLinks a').forEach((a) => {
      a.classList.toggle('is-here', a.getAttribute('href') === wanted);
    });

    if (push) {
      try { history.pushState({ view: wanted }, '', urlFor(wanted)); } catch {  }
    }
    const base = document.documentElement.dataset.baseTitle || BASE_TITLE;
    document.title = wanted ? `${viewName(wanted)} — ${base}` : base;
    scrollTo(0, 0);

    if (document.documentElement.dataset.mode === 'paper') flip(false);
    else window.SFX?.hover?.();

    document.dispatchEvent(new CustomEvent('view:changed', { detail: { view: wanted } }));
  }

  addEventListener('popstate', () => pressShow(viewFromLocation(), false));

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (href !== '#top' && !VIEWS.includes(href)) return;
    e.preventDefault();
    e.stopPropagation();
    pressShow(href === '#top' ? '' : href, true);
    document.getElementById('navLinks')?.classList.remove('open');
  }, true);

  window.PRESS = { show: (sel) => pressShow(sel, true), current: () => pressView };
  window.VIEWS = VIEWS;

  function buildPress() {
    if (document.getElementById('pressHead')) return;

    const now = new Date();
    const month = now.toLocaleString('en', { month: 'short' }).toUpperCase();
    const head = document.createElement('div');
    head.id = 'pressHead';
    head.className = 'press-head';
    head.innerHTML =
      `<span>VOL. I</span><span>NO. 1</span><span>${month} ${now.getFullYear()}</span>` +
      '<span class="press-title">READ ALOUSH — AN ENGINEERING QUARTERLY</span>';
    document.body.insertBefore(head, document.body.firstChild);

    const index = document.createElement('nav');
    index.id = 'pressIndex';
    index.className = 'press-index';
    index.setAttribute('aria-label', 'In this issue');
    const rows = Object.keys(SECTION_NOTES).map((k) => {
      const el = document.querySelector('#' + k);
      const title = el?.querySelector('.section-title')?.textContent?.trim() || k;
      return `<a href="#${k}" data-index-for="${k}"><b>00</b>` +
             `<em>${title}</em><i>${SECTION_NOTES[k]}</i></a>`;
    }).join('');
    index.innerHTML = '<p class="press-index-label">In this issue</p>' + rows +
      '<a href="#arcade" data-arcade><b>00</b><em>Arcade</em>' +
      '<i>snake, tetris, breakout \u2014 while you decide.</i></a>';
    index.addEventListener('click', (e) => {
      const a = e.target.closest('[data-arcade]');
      if (!a) return;
      e.preventDefault();
      e.stopPropagation();
      window.openArcade('snake');
    }, true);

    const hero = document.querySelector('#hero');
    if (hero && hero.parentNode) hero.parentNode.insertBefore(index, hero.nextSibling);

    const back = document.createElement('a');
    back.id = 'pressBack';
    back.className = 'press-back press-off';
    back.href = '#top';
    back.innerHTML = '<span>&larr;</span> Contents';
    document.querySelector('main')?.insertBefore(back, document.querySelector('main').firstChild);

    syncIndex();
    const first = viewFromLocation();
    pressShow(first, false);
    if (first && PATHS && location.hash) {
      try { history.replaceState({ view: first }, '', urlFor(first)); } catch {  }
    }
    pressReady = true;
  }

  function syncIndex() {
    const index = document.getElementById('pressIndex');
    if (!index) return;

    index.querySelectorAll('[data-index-for]').forEach((a) => {
      const key = a.dataset.indexFor;
      const sec = document.getElementById(key);
      a.hidden = !sec || sec.hidden;
      const title = sec?.querySelector('.section-title')?.textContent?.trim();
      if (title) a.querySelector('em').textContent = title;
    });

    let n = 0;
    index.querySelectorAll('a').forEach((a) => {
      if (a.hidden) return;
      a.querySelector('b').textContent = String(++n).padStart(2, '0');
    });
  }

  document.addEventListener('content:rendered', syncIndex);

  const TILT_PAPER = { '.project': '1.2', '.tl-item': '1.6', '.card': '2' };

  function calmTilt(on) {
    document.querySelectorAll('.tilt').forEach((el) => {
      if (el.__origTilt === undefined) el.__origTilt = el.dataset.tilt || '';
      if (on) {
        const k = Object.keys(TILT_PAPER).find((s) => el.matches(s));
        el.dataset.tilt = k ? TILT_PAPER[k] : '2';
      } else if (el.__origTilt) {
        el.dataset.tilt = el.__origTilt;
      } else {
        delete el.dataset.tilt;
      }
    });
  }

  function apply(next, announce = false) {
    mode = next;
    loadFonts(mode);
    document.documentElement.dataset.mode = mode;
    buttons.forEach((b) => {
      const on = b.dataset.mode === mode;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    placeThumb();
    calmTilt(mode === 'paper');
    try { localStorage.setItem(KEY, mode); } catch {  }
    buildPress();

    if (mode === 'shell') {
      if (window.TERMINAL) window.TERMINAL.mount();
      else if (!document.getElementById('shellScript')) {
        const sc = document.createElement('script');
        sc.id = 'shellScript';
        sc.src = '/assets/js/terminal.js?v=2';
        sc.addEventListener('load', () => {
          if (document.documentElement.dataset.mode === 'shell') window.TERMINAL?.mount();
        });
        document.head.appendChild(sc);
      }
    } else {
      window.TERMINAL?.unmount();
    }

    if (mode === 'index') {
      if (window.INDEXMODE) window.INDEXMODE.mount();
      else if (!document.getElementById('indexScript')) {
        const sc = document.createElement('script');
        sc.id = 'indexScript';
        sc.src = '/assets/js/index-mode.js?v=3';
        sc.addEventListener('load', () => {
          if (document.documentElement.dataset.mode === 'index') window.INDEXMODE?.mount();
        });
        document.head.appendChild(sc);
      }
    } else {
      window.INDEXMODE?.unmount();
    }

    if (mode === 'keys') {
      if (window.KEYSMODE) window.KEYSMODE.mount();
      else if (!document.getElementById('keysScript')) {
        const sc = document.createElement('script');
        sc.id = 'keysScript';
        sc.src = '/assets/js/keys-mode.js?v=3';
        sc.addEventListener('load', () => {
          if (document.documentElement.dataset.mode === 'keys') window.KEYSMODE?.mount();
        });
        document.head.appendChild(sc);
      }
    } else {
      window.KEYSMODE?.unmount();
    }

    if (announce && mode === 'paper') flip(false);
    document.dispatchEvent(new CustomEvent('mode:changed', { detail: { mode } }));
  }

  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('.mode-tab');
    if (!b || b.dataset.mode === mode) return;
    apply(b.dataset.mode, true);
    document.getElementById('navLinks')?.classList.remove('open');
    document.getElementById('navBurger')?.classList.remove('on');
    if (b.dataset.mode === 'modern') window.SFX?.flip?.();
  });

  apply(mode);
  addEventListener('resize', placeThumb);
  addEventListener('load', placeThumb);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeThumb).catch(() => {});
  document.addEventListener('loader:done', () => setTimeout(() => calmTilt(mode === 'paper'), 200));
  setTimeout(() => calmTilt(mode === 'paper'), 1500);

  const PAGES = ['#top', '#news', '#about', '#skills', '#experience', '#projects', '#education', '#contact'];

  function pageIndex() {
    let best = 0;
    let bestTop = -Infinity;
    PAGES.forEach((sel, i) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      if (top <= innerHeight * 0.45 && top > bestTop) { bestTop = top; best = i; }
    });
    return best;
  }

  let current = pageIndex();
  let raf = false;
  addEventListener('scroll', () => {
    if (raf || mode !== 'paper') return;
    raf = true;
    requestAnimationFrame(() => {
      raf = false;
      const i = pageIndex();
      if (i === current) return;
      const back = i < current;
      current = i;
      flip(back);
    });
  }, { passive: true });
})();

(() => {
  const a = document.createElement('a');
  a.className = 'skip-link';
  a.href = '#about';
  a.textContent = 'Skip to content';
  a.addEventListener('click', () => {
    const t = document.getElementById('about');
    if (t) { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
  });
  document.body.insertBefore(a, document.body.firstChild);
})();

(() => {
  if (document.getElementById('cmdkScript')) return;
  const s = document.createElement('script');
  s.id = 'cmdkScript';
  s.src = '/assets/js/palette.js';
  s.defer = true;
  document.head.appendChild(s);
})();

(() => {
  let asked = false;
  window.openArcade = (name) => {
    if (window.ARCADE) { window.ARCADE.show(name); return; }
    if (asked) return;
    asked = true;
    const s = document.createElement('script');
    s.id = 'arcadeScript';
    s.src = '/assets/js/arcade.js?v=2';
    s.addEventListener('load', () => window.ARCADE?.show(name));
    document.head.appendChild(s);
  };
})();
