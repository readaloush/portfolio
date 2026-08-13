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
