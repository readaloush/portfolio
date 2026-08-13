/* ==================================================================
   Side-entry reveals and keyboard navigation.

   Kept as its own file so it runs after the main script has rendered
   the page, and so it can be reasoned about on its own.
   ================================================================== */
(() => {
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------- arrive from left / right */
  const sideObserver = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      sideObserver.unobserve(e.target);
    }),
    { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
  );

  /** Alternate the direction so the page zig-zags as you scroll. */
  function applySideReveals() {
    if (reduced) return;
    const groups = [
      { sel: '.project', alternate: true },
      { sel: '.tl-item', alternate: false, from: -80 },
      { sel: '.skill-card', alternate: true },
      { sel: '.edu-card', alternate: true },
      { sel: '.stats li', alternate: true, distance: 45 }
    ];

    groups.forEach(({ sel, alternate, from, distance = 80 }) => {
      $$(sel).forEach((el, i) => {
        if (el.dataset.sideBound) return;
        el.dataset.sideBound = '1';
        const dx = from !== undefined ? from : (alternate && i % 2 ? -distance : distance);
        el.style.setProperty('--from', dx + 'px');
        el.classList.add('reveal-x');
        // already on screen when the page loads? show it immediately
        const r = el.getBoundingClientRect();
        if (r.top < innerHeight * 0.9) el.classList.add('in');
        else sideObserver.observe(el);
      });
    });
  }

  // content arrives asynchronously, so watch for it
  const contentWatcher = new MutationObserver(() => applySideReveals());
  ['#projectGrid', '#timeline', '#skillGrid', '#eduGrid', '#statList'].forEach((sel) => {
    const node = document.querySelector(sel);
    if (node) contentWatcher.observe(node, { childList: true });
  });
  document.addEventListener('loader:done', () => setTimeout(applySideReveals, 60));
  setTimeout(applySideReveals, 1200);

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
    if (window.SFX) window.SFX.hover();
  }

  /** Typing somewhere? Then the arrows belong to that field, not the page. */
  const isTyping = () => {
    const a = document.activeElement;
    return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
  };

  addEventListener('keydown', (e) => {
    if (isTyping() || e.metaKey || e.ctrlKey || e.altKey) return;
    const chatPanel = document.getElementById('chatPanel');
    const loginModal = document.getElementById('loginModal');
    const chatOpen = chatPanel && !chatPanel.hidden;
    if (loginModal && !loginModal.hidden) return;

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
        if (!chatOpen) {
          e.preventDefault();
          const orb = document.getElementById('chatOrb');
          if (orb) orb.click();
        }
        break;
      default:
        return;
    }
    hideHint();
  });

  /* ------------------------------------------------------ the hint */
  const hint = document.createElement('div');
  hint.className = 'kbd-hint';
  hint.innerHTML = '<kbd>&larr;</kbd><kbd>&rarr;</kbd> move between sections <kbd>/</kbd> ask a question';
  document.body.appendChild(hint);

  let hintTimer;
  function showHint() {
    try { if (localStorage.getItem('rp_kbd_hint') === 'seen') return; } catch (e) { /* ignore */ }
    hint.classList.add('show');
    hintTimer = setTimeout(hideHint, 7000);
  }
  function hideHint() {
    clearTimeout(hintTimer);
    hint.classList.remove('show');
    try { localStorage.setItem('rp_kbd_hint', 'seen'); } catch (e) { /* ignore */ }
  }
  document.addEventListener('loader:done', () => setTimeout(showHint, 2200));
})();
