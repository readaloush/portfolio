(() => {
  // The palette belongs to CSS now, not to the content.
  //
  // render() in app.js writes meta.accent onto <html> as an inline style,
  // and an inline style beats every stylesheet. The database still carries
  // the old cyan, so the paper palette was being overridden the moment the
  // content loaded. Strip those two properties whenever they reappear.
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
  // Paper is the default now. Only fall back to it when the visitor has
  // not chosen a side themselves.
  try {
    if (!localStorage.getItem('theme')) document.documentElement.dataset.theme = 'light';
  } catch (e) { document.documentElement.dataset.theme = 'light'; }
})();

/* ==================================================================
   Side-entry reveals and keyboard navigation.

   Kept as its own block so it runs after the main script has rendered
   the page, and so it can be reasoned about on its own.
   ================================================================== */
(() => {
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------- arrive from outside the page ------
     A card parked off-screen never intersects the viewport, so an
     IntersectionObserver would never fire for it. The trigger therefore
     uses the element's LAYOUT position (offsetTop ignores transforms).  */

  const pending = [];

  /** Distance from the top of the document, unaffected by any transform. */
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
    const line = scrollY + innerHeight * 0.86;   // trigger a little before centre
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

  /** Alternate the direction so the page zig-zags as you scroll. */
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

        // this element is ours now: drop the old fade-up system so the two
        // cannot fight over the same transform
        el.classList.remove('reveal', 'in');
        el.classList.add('reveal-x');

        if (layoutTop(el) < scrollY + innerHeight * 0.86) {
          // already in view — play it on the next frame rather than snapping
          requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
        } else {
          pending.push(el);
        }
      });
    });
    queueCheck();
  }

  // The content arrives from the database after this file runs, so watch
  // for it rather than assuming it is already on the page. Without these
  // calls applySideReveals is defined and never invoked.
  const contentWatcher = new MutationObserver(() => applySideReveals());
  ['#projectGrid', '#timeline', '#skillGrid', '#eduGrid', '#statList'].forEach((sel) => {
    const node = document.querySelector(sel);
    if (node) contentWatcher.observe(node, { childList: true });
  });
  document.addEventListener('loader:done', () => setTimeout(applySideReveals, 60));
  setTimeout(applySideReveals, 1200);
  setTimeout(applySideReveals, 3000);

  /* ------------------------------------------- keyboard navigation */
  const SECTIONS = ['#top', '#about', '#skills', '#experience', '#projects', '#education', '#contact'];

  const currentIndex = () => {
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
    const el = document.querySelector(SECTIONS[clamped]);
    if (!el) return;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    window.SFX?.hover();
  }

  /** Typing somewhere? Then the arrows belong to that field, not the page. */
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

  /* ------------------------------------------------------ the hint */
  const hint = document.createElement('div');
  hint.className = 'kbd-hint';
  hint.innerHTML = '<kbd>←</kbd><kbd>→</kbd> move between sections <kbd>/</kbd> ask a question';
  document.body.appendChild(hint);

  let hintTimer;
  function showHint() {
    try { if (localStorage.getItem('rp_kbd_hint') === 'seen') return; } catch { /* ignore */ }
    hint.classList.add('show');
    hintTimer = setTimeout(hideHint, 7000);
  }
  function hideHint() {
    clearTimeout(hintTimer);
    hint.classList.remove('show');
    try { localStorage.setItem('rp_kbd_hint', 'seen'); } catch { /* ignore */ }
  }
  document.addEventListener('loader:done', () => setTimeout(showHint, 2200));
})();


/* ==================================================================
   MODES
   Not a colour scheme — a different presentation of the same content.
   "modern" is the site as built; "paper" turns it into a ruled
   engineer's notebook whose pages turn as you move down it.

   The light/dark switch is deliberately left alone: it still works
   inside each mode, so there are four states, not two.
   ================================================================== */
(() => {
  const KEY = 'rp_mode';
  const MODES = ['modern', 'paper'];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const read = () => {
    try { const v = localStorage.getItem(KEY); return MODES.includes(v) ? v : 'modern'; }
    catch { return 'modern'; }
  };

  let mode = read();

  /* ---------------------------------------------- the handwriting
     Two script faces, fetched only when paper is actually asked for,
     so a visitor who never leaves modern mode never pays for them. */
  let fontsAsked = false;
  function loadFonts() {
    if (fontsAsked) return;
    fontsAsked = true;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Kalam:wght@300;400;700&display=swap';
    document.head.appendChild(l);
  }

  /* --------------------------------------------------- the selector */
  const tabs = document.createElement('div');
  tabs.className = 'mode-tabs';
  tabs.id = 'modeTabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Site mode');
  tabs.innerHTML =
    '<span class="mode-thumb" aria-hidden="true"></span>' +
    MODES.map((m) => `<button type="button" class="mode-tab" role="tab" data-mode="${m}" data-cursor="mode">${m === 'modern' ? 'Modern' : 'Notebook'}</button>`).join('');

  const thumb = tabs.querySelector('.mode-thumb');
  const buttons = Array.from(tabs.querySelectorAll('.mode-tab'));

  function placeThumb() {
    const on = tabs.querySelector('.mode-tab.is-on');
    if (!on) return;
    thumb.style.left = on.offsetLeft + 'px';
    thumb.style.width = on.offsetWidth + 'px';
  }

  /* Where the selector lives depends on how much room there is.
     On a phone the header already carries a logo, a sound button, a
     wall switch, a CV button and a burger; adding two more pills
     pushes the row off the screen. Below the burger breakpoint the
     same element moves into the opened menu instead — moved, not
     duplicated, so there is only ever one of it to keep in sync. */
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

  /* ------------------------------------------------------ the stage */
  const stage = document.createElement('div');
  stage.className = 'flip-stage';
  stage.id = 'flipStage';
  stage.setAttribute('aria-hidden', 'true');
  stage.innerHTML = '<div class="flip-leaf"><span class="flip-shade"></span></div>';
  document.body.appendChild(stage);

  let flipping = false;
  let lastFlip = 0;

  /** Turn one page. `back` runs the same sheet the other way. */
  function flip(back = false) {
    if (reduced || mode !== 'paper' || flipping) return;
    const t = performance.now();
    if (t - lastFlip < 620) return;          // a fast scroll is one turn, not ten
    lastFlip = t;
    flipping = true;

    stage.classList.remove('fwd', 'bwd');
    void stage.offsetWidth;                   // restart the animation
    stage.classList.add('on', back ? 'bwd' : 'fwd');
    rustle();

    setTimeout(() => {
      stage.classList.remove('on', 'fwd', 'bwd');
      flipping = false;
    }, 800);
  }

  /* ---------------------------------------------------- paper sound
     Its own tiny context so it does not have to reach inside the
     interaction sound engine, but it obeys the same on/off switch:
     if the visitor has muted the site, paper stays quiet too. */
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

      // a short burst of noise, shaped so it swells and dies like a sheet
      const len = Math.floor(actx.sampleRate * dur);
      const buf = actx.createBuffer(1, len, actx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const x = i / len;
        const env = Math.sin(Math.PI * Math.pow(x, 0.7));      // slow in, quick out
        d[i] = (Math.random() * 2 - 1) * env * (0.5 + 0.5 * Math.sin(x * 34));
      }

      const src = actx.createBufferSource();
      src.buffer = buf;

      // paper is mid-high and dry; sweeping the band is what makes it
      // read as movement rather than as static
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
    } catch { /* sound is decoration; never let it break the page */ }
  }

  /* ------------------------------------------------------- applying */
  const TILT_PAPER = { '.project': '1.2', '.tl-item': '1.6', '.card': '2' };

  function calmTilt(on) {
    // A sheet of paper does not pitch in three dimensions. Rather than
    // tear the tilt handler out, reduce what it is allowed to do.
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
    if (mode === 'paper') loadFonts();
    document.documentElement.dataset.mode = mode;
    buttons.forEach((b) => {
      const on = b.dataset.mode === mode;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    placeThumb();
    calmTilt(mode === 'paper');
    try { localStorage.setItem(KEY, mode); } catch { /* ignore */ }
    if (announce && mode === 'paper') flip(false);
    document.dispatchEvent(new CustomEvent('mode:changed', { detail: { mode } }));
  }

  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('.mode-tab');
    if (!b || b.dataset.mode === mode) return;
    apply(b.dataset.mode, true);
    if (b.dataset.mode === 'modern') window.SFX?.flip?.();
  });

  apply(mode);
  addEventListener('resize', placeThumb);
  addEventListener('load', placeThumb);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeThumb).catch(() => {});
  // the content arrives after this runs, so the new cards need calming too
  document.addEventListener('loader:done', () => setTimeout(() => calmTilt(mode === 'paper'), 200));
  setTimeout(() => calmTilt(mode === 'paper'), 1500);

  /* ------------------------------------- turn the page when you move
     Scrolling is kept. What changes is that crossing from one section
     into the next is treated as a page boundary.                     */
  const PAGES = ['#top', '#about', '#skills', '#experience', '#projects', '#education', '#contact'];

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


/* ==================================================================
   A way in for the keyboard.
   The nav is long and the first thing after it is the hero, so a
   keyboard or screen-reader visitor had to tab through every link
   before reaching any content. One link, visible only when focused.
   ================================================================== */
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
