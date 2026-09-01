/* ==================================================================
   Portfolio front-end.
   All content comes from the SQLite database via /api/content.
   ================================================================== */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------- icons */
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

  /* ================================================== THE TICKER
     One requestAnimationFrame loop for the whole page.

     There used to be three: the network canvas, the cursor and the
     parallax each ran their own. Three loops is not three times the
     work of one — each callback reads and writes layout separately, so
     the browser is forced to recalculate style three times per frame
     instead of once. Now everything that wants a frame subscribes here
     and gets called in a fixed order.

     The loop also stops. If nobody is subscribed, or the tab is in the
     background, there is no rAF pending at all — not a rAF that runs
     and does nothing.
  ================================================================ */
  const Ticker = (() => {
    const jobs = new Set();
    let running = false;

    function frame(now) {
      running = false;
      if (jobs.size && !document.hidden) {
        for (const job of jobs) job(now);
        start();
      }
    }
    function start() {
      if (running || !jobs.size || document.hidden) return;
      running = true;
      requestAnimationFrame(frame);
    }

    document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });

    return {
      add(job) { jobs.add(job); start(); return () => jobs.delete(job); },
      remove(job) { jobs.delete(job); }
    };
  })();

  /* The tier this machine was put in. perf.js decides; if it somehow
     failed to load, assume the best and behave exactly as before. */
  const perf = () => (window.PERF ? window.PERF.tier : 'high');
  const atLeast = (t) => (window.PERF ? window.PERF.allows(t) : true);

  /* ================================================ NETWORK CANVAS
     Nodes connected by lines. The mouse pushes them around and draws
     extra links to whatever is nearby.

     Three things here were expensive enough to matter.

     getComputedStyle was called twice per frame, once for the line
     colour and once for the accent. Reading a computed style forces the
     browser to resolve style for the whole document; doing it 120 times
     a second is a bill for information that only changes when the theme
     changes. It is now read on a timer and on theme changes.

     The link pass compared every node with every other node — 130 nodes
     is 8,385 pairs, every frame. Links only exist under 128px, so all
     but a handful of those comparisons were guaranteed to fail. The
     nodes now go into a grid of 128px cells and each one only looks at
     its own cell and four neighbours.

     And every link was its own beginPath/stroke, which is a separate
     draw call because the alpha differed. They now go into five paths
     bucketed by opacity: five stroke calls a frame instead of hundreds.
  ================================================================ */
  function initNetwork() {
    const canvas = $('#netCanvas');
    if (!canvas || reduced) return;
    const ctx = canvas.getContext('2d');

    let w, h, dpr, nodes = [], cell, cols, rows, grid = [], cursorLinks = true;
    const mouse = { x: -9999, y: -9999, active: false };

    // How much of this the machine can afford. Read on resize and on a
    // tier change, not per frame — the answer cannot change in between,
    // and building this object sixty times a second is pure garbage.
    const BUDGET = {
      high: { dpr: 2,   div: 13000, cap: 130, cursorLinks: true },
      mid:  { dpr: 1.5, div: 26000, cap: 74,  cursorLinks: true },
      low:  { dpr: 1,   div: 52000, cap: 34,  cursorLinks: false }
    };

    function resize() {
      const b = BUDGET[perf()] || BUDGET.high;
      cursorLinks = b.cursorLinks;
      dpr = Math.min(devicePixelRatio || 1, b.dpr);
      w = canvas.width = Math.round(innerWidth * dpr);
      h = canvas.height = Math.round(innerHeight * dpr);
      canvas.style.width = innerWidth + 'px';
      canvas.style.height = innerHeight + 'px';

      const target = Math.round(Math.min(b.cap, (innerWidth * innerHeight) / b.div));
      nodes = Array.from({ length: target }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.32 * dpr,
        vy: (Math.random() - 0.5) * 0.32 * dpr,
        r: (Math.random() * 1.5 + 0.9) * dpr
      }));

      // The grid is allocated once here and emptied in place each frame,
      // so the link pass never allocates and never triggers collection.
      cell = 128 * dpr;
      cols = Math.max(1, Math.ceil(w / cell));
      rows = Math.max(1, Math.ceil(h / cell));
      grid = Array.from({ length: cols * rows }, () => []);
    }

    let resizeTimer;
    addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 180); });
    document.addEventListener('perf:changed', resize);

    addEventListener('pointermove', (e) => {
      mouse.x = e.clientX * dpr; mouse.y = e.clientY * dpr;
      mouse.active = true;
    }, { passive: true });
    addEventListener('pointerleave', () => { mouse.active = false; mouse.x = mouse.y = -9999; });
    addEventListener('click', (e) => {
      // click = shockwave through the network
      const cx = e.clientX * dpr, cy = e.clientY * dpr;
      const R = 320 * dpr;
      for (const n of nodes) {
        const dx = n.x - cx, dy = n.y - cy, d = Math.hypot(dx, dy) || 1;
        if (d < R) { n.vx += (dx / d) * 5; n.vy += (dy / d) * 5; }
      }
    });

    /* ---- colours, read rarely instead of twice a frame ---- */
    let LINE = '255,255,255', AC = '#00e5ff';
    function readColours() {
      const cs = getComputedStyle(document.documentElement);
      LINE = cs.getPropertyValue('--net-line').trim() || LINE;
      AC = cs.getPropertyValue('--accent').trim() || AC;
    }
    readColours();
    // The palette only changes when the theme or the mode changes, and
    // both of those are attributes on <html>.
    new MutationObserver(readColours).observe(document.documentElement, {
      attributes: true, attributeFilter: ['data-theme', 'data-mode']
    });

    /* Five opacity buckets. A link's alpha runs 0 → 0.34; rounding it to
       one of five values is invisible and turns hundreds of draw calls
       into five. */
    const BUCKETS = 5;
    const paths = Array.from({ length: BUCKETS }, () => new Path2D());

    function frame() {
      ctx.clearRect(0, 0, w, h);
      const LINK = cell;
      const LINK2 = LINK * LINK;
      const MOUSE_R = 190 * dpr;

      /* ---- move, and file each node into its grid cell ---- */
      for (const g of grid) g.length = 0;

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (mouse.active) {
          const dx = n.x - mouse.x, dy = n.y - mouse.y, d = Math.hypot(dx, dy);
          if (d < MOUSE_R && d > 0.001) {
            const f = (1 - d / MOUSE_R) * 0.55;
            n.vx += (dx / d) * f - (dy / d) * f * 0.25;
            n.vy += (dy / d) * f + (dx / d) * f * 0.25;
          }
        }
        n.x += n.vx; n.y += n.vy;
        n.vx *= 0.985; n.vy *= 0.985;
        // a gentle nudge so the field never settles into stillness
        if (n.vx * n.vx + n.vy * n.vy < 0.0144 * dpr * dpr) {
          n.vx += (Math.random() - 0.5) * 0.09 * dpr;
          n.vy += (Math.random() - 0.5) * 0.09 * dpr;
        }
        if (n.x < 0) { n.x = 0; n.vx *= -1; } else if (n.x > w) { n.x = w; n.vx *= -1; }
        if (n.y < 0) { n.y = 0; n.vy *= -1; } else if (n.y > h) { n.y = h; n.vy *= -1; }

        const ci = Math.min(cols - 1, (n.x / cell) | 0);
        const cj = Math.min(rows - 1, (n.y / cell) | 0);
        grid[cj * cols + ci].push(i);
      }

      /* ---- links, via the grid ----
         Each cell is checked against itself and four neighbours. Those
         five cover every pair exactly once: going right, down, and both
         diagonals downward means the cell above-left already handled
         the pair from its side. */
      // Path2D has no clear(), so each frame gets fresh ones. Five small
      // allocations a frame is nothing next to the hundreds of separate
      // stroke calls this replaced.
      for (let k = 0; k < BUCKETS; k++) paths[k] = new Path2D();

      const NEIGHBOURS = [[0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
      for (let cj = 0; cj < rows; cj++) {
        for (let ci = 0; ci < cols; ci++) {
          const here = grid[cj * cols + ci];
          if (!here.length) continue;
          for (const [ox, oy] of NEIGHBOURS) {
            const nx = ci + ox, ny = cj + oy;
            if (nx < 0 || nx >= cols || ny >= rows) continue;
            const there = grid[ny * cols + nx];
            if (!there.length) continue;
            const same = ox === 0 && oy === 0;
            for (let ii = 0; ii < here.length; ii++) {
              const a = nodes[here[ii]];
              for (let jj = same ? ii + 1 : 0; jj < there.length; jj++) {
                const b = nodes[there[jj]];
                const dx = a.x - b.x, dy = a.y - b.y;
                const d2 = dx * dx + dy * dy;
                if (d2 >= LINK2) continue;
                const t = 1 - Math.sqrt(d2) / LINK;          // 0 → 1
                const bucket = Math.min(BUCKETS - 1, (t * BUCKETS) | 0);
                const p = paths[bucket];
                p.moveTo(a.x, a.y); p.lineTo(b.x, b.y);
              }
            }
          }
        }
      }

      ctx.lineWidth = dpr;
      for (let k = 0; k < BUCKETS; k++) {
        const alpha = ((k + 0.5) / BUCKETS) * 0.34;
        ctx.strokeStyle = `rgba(${LINE},${alpha.toFixed(3)})`;
        ctx.stroke(paths[k]);
      }

      /* ---- links to the cursor, one path, one stroke ---- */
      if (mouse.active && cursorLinks) {
        const reach = new Path2D();
        let any = false;
        for (const n of nodes) {
          const dx = n.x - mouse.x, dy = n.y - mouse.y;
          if (dx * dx + dy * dy < MOUSE_R * MOUSE_R) {
            reach.moveTo(n.x, n.y); reach.lineTo(mouse.x, mouse.y);
            any = true;
          }
        }
        if (any) {
          ctx.strokeStyle = AC;
          ctx.globalAlpha = 0.28;
          ctx.stroke(reach);
          ctx.globalAlpha = 1;
        }
      }

      /* ---- the nodes themselves, also one path ---- */
      const dots = new Path2D();
      for (const n of nodes) {
        dots.moveTo(n.x + n.r, n.y);
        dots.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      }
      ctx.fillStyle = `rgba(${LINE},.55)`;
      ctx.fill(dots);
    }

    resize();
    Ticker.add(frame);
  }

  /* ==================================================== CURSOR */
  function initCursor() {
    const dot = $('#cursorDot'), ring = $('#cursorRing'), label = $('#cursorLabel');
    if (!dot || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    // On a slow machine a lagging custom cursor is worse than none: it is
    // the one element the eye tracks continuously, so every dropped frame
    // is visible in it. The stylesheet gives the real pointer back at that
    // tier; this makes sure we are not still computing one nobody sees.
    if (!atLeast('mid')) return;

    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;

    addEventListener('pointermove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.opacity = ring.style.opacity = '1';
      dot.style.transform = `translate(${mx}px, ${my}px)`;
    }, { passive: true });
    addEventListener('pointerdown', () => ring.classList.add('hot'));
    addEventListener('pointerup', () => {
      if (!document.querySelector(':hover[data-cursor]')) ring.classList.remove('hot');
    });

    // The ring eases toward the pointer. Once it has arrived there is
    // nothing to interpolate, so it stops writing style entirely rather
    // than assigning the same transform sixty times a second.
    Ticker.add(() => {
      const dx = mx - rx, dy = my - ry;
      if (dx * dx + dy * dy < 0.01) return;
      rx += dx * 0.16; ry += dy * 0.16;
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
    });

    let lastHover = null;
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest('a, button, .tilt, [data-cursor]');
      if (t) {
        ring.classList.add('hot');
        label.textContent = t.dataset.cursor || '';
        if (t !== lastHover) { lastHover = t; window.SFX?.hover(); }
      } else {
        ring.classList.remove('hot');
        label.textContent = '';
        lastHover = null;
      }
    });
  }

  /* ======================================================== SOUND */
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

    // a click anywhere gets a soft tick (the button handles its own)
    document.addEventListener('pointerdown', (e) => {
      if (e.target.closest('#soundBtn, #themeSwitch, #photoFrame')) return;
      if (e.target.closest('a, button, input, .tilt')) window.SFX?.click();
    });
  }

  /* ============================== 3D TILT + GLARE (mouse reactive) */
  function bindTilt(root = document) {
    if (reduced || !atLeast('mid')) return;
    $$('.tilt', root).forEach((el) => {
      if (el.__tilt) return;
      el.__tilt = true;
      let raf, r = null;

      // getBoundingClientRect used to run on every pointermove. That is a
      // forced synchronous layout — the browser has to stop and reflow the
      // page to answer it — several hundred times while the cursor crosses
      // one card. The card is not moving or resizing while you hover it,
      // so measure once on the way in.
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

  /* ================================= PARALLAX ON MOUSE (whole page) */
  let refreshParallax = () => {};
  function initParallax() {
    if (reduced || !atLeast('mid')) return;

    // The old loop ran querySelectorAll('.parallax') on every frame,
    // forever — a fresh DOM query sixty times a second for a list of two
    // elements that only changes when the page is re-rendered. Cache it,
    // and re-read it when render() replaces the markup.
    let items = [];
    refreshParallax = () => {
      items = $$('.parallax').map((el) => ({ el, d: Number(el.dataset.depth || 10) }));
    };
    refreshParallax();

    let tx = 0, ty = 0, cx = 0, cy = 0;
    addEventListener('pointermove', (e) => {
      tx = (e.clientX / innerWidth - 0.5) * 2;
      ty = (e.clientY / innerHeight - 0.5) * 2;
    }, { passive: true });

    Ticker.add(() => {
      const dx = tx - cx, dy = ty - cy;
      // Settled. Writing the same transform again would still cost a
      // style recalculation, so do nothing at all.
      if (dx * dx + dy * dy < 1e-6) return;
      cx += dx * 0.06; cy += dy * 0.06;
      for (const it of items) {
        it.el.style.transform = `translate3d(${(cx * it.d).toFixed(2)}px, ${(cy * it.d).toFixed(2)}px, 0)`;
      }
    });
  }

  /* ==================================================== REVEALS */
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        // stagger children
        $$('[data-stagger]', en.target).forEach((c, i) => setTimeout(() => c.classList.add('in'), i * 90));
        // animate skill bars
        $$('.bar i', en.target).forEach((b, i) => setTimeout(() => (b.style.width = b.dataset.level + '%'), 120 + i * 80));
        // count up
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

  /* ================================================ TEXT SCRAMBLE */
  function scramble(el, finalText, duration = 1400) {
    // Browsers suspend requestAnimationFrame in background tabs, which would
    // leave the name frozen mid-scramble. This timer runs regardless, so the
    // real text always lands.
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

  /* ==================================================== TYPEWRITER */
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

  /* ======================================================== TOAST */
  let toastTimer;
  function toast(msg, ms = 3200) {
    const t = $('#toast');
    $('#toastText').textContent = msg;
    t.hidden = false;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => (t.hidden = true), 400);
    }, ms);
  }

  /* ============================================ ELECTRIC SWITCH
     Flipping it changes the theme. Flip it too often and it complains.
  ============================================================== */
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

  /* =================================== HIDDEN ADMIN — 5 PHOTO CLICKS
     There is no password anywhere in this file. The form posts to the
     server, which compares against a bcrypt hash inside SQLite.
  ================================================================= */
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
      timer = setTimeout(() => (count = 0), 5000);   // generous window

      if (count === 2) toast('.');
      if (count === 3) toast('..');
      if (count === 4) toast('...');
      if (count >= 5) { count = 0; window.SFX?.unlock(); openModal(); }
      else window.SFX?.knock(count);
    });

    // keyboard shortcut as a backup: Ctrl/Cmd + Shift + A
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
        // hand the session to the admin page in case cookies are blocked
        try { if (data.token) sessionStorage.setItem('rp_token', data.token); } catch { /* ignore */ }

        // Signing in no longer means "take me to the editor". You come
        // back to your own site, look at it, and open the panel from the
        // bar at the top when there is actually something to change.
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

  /* ========================================================= NAV */
  function initNav() {
    const nav = $('#nav'), links = $('#navLinks'), burger = $('#navBurger');
    const progressBar = $('#scrollBar');

    // Scroll fires far more often than the screen refreshes — on a
    // trackpad, dozens of times between two frames. This handler read
    // layout (getBoundingClientRect) and then wrote style, which forces
    // a reflow *per event*. Collapsing it to one run per frame is the
    // single cheapest scroll fix there is.
    let queued = false;
    const onScroll = () => {
      queued = false;
      nav.classList.toggle('stuck', scrollY > 30);
      const d = document.documentElement;
      const span = d.scrollHeight - innerHeight;
      if (progressBar) progressBar.style.width = (span > 0 ? (scrollY / span) * 100 : 0) + '%';

      // timeline fill follows the scroll
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

  /* ======================================== MAGNETIC BUTTONS */
  function bindMagnetic() {
    if (reduced) return;
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

  /* ================================================ ANNOUNCEMENTS
     Written in the admin panel, stored in the database with the rest of
     the content, shown in two places: a section on the page and a short
     list behind the bell in the nav.

     "Unread" is a fact about one browser, not about a person, so it is
     kept in localStorage and never sent anywhere. Nobody is counted.

     An announcement is identified by its `id`, which is why editing the
     wording of one does not re-notify everybody who already read it —
     and why giving it a new id deliberately is how you do.
  ================================================================= */
  const NEWS_SEEN = 'rp_news_seen';

  const seenIds = () => {
    try { return new Set(JSON.parse(localStorage.getItem(NEWS_SEEN) || '[]')); }
    catch { return new Set(); }
  };
  const saveSeen = (set) => {
    try { localStorage.setItem(NEWS_SEEN, JSON.stringify(Array.from(set).slice(-200))); }
    catch { /* private browsing; the badge simply comes back */ }
  };

  /** Published, newest first, pinned above everything. */
  function liveNews(list) {
    return (list || [])
      .filter((a) => a && a.published !== false && (a.title || a.body))
      .map((a, i) => ({ ...a, id: a.id || `a-${i}-${String(a.title || '').slice(0, 24)}` }))
      .sort((a, b) => {
        if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
        return String(b.date || '').localeCompare(String(a.date || ''));
      });
  }

  const niceDate = (raw) => {
    const d = new Date(raw);
    if (!raw || isNaN(d)) return String(raw || '');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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
    // Nothing to announce at all: the bell would be a dead control.
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

    // An empty announcements section is worse than no section: it reads
    // as an unfinished site. If there is nothing published, it is gone —
    // and so is its entry in the nav and in the other modes' contents.
    const empty = NEWS.length === 0;
    section.hidden = empty;
    $$('#navLinks a[href="#news"]').forEach((a) => (a.hidden = empty));
    if (empty) { paintBadge(); return; }

    const seen = seenIds();
    grid.innerHTML = NEWS.map((a) => `
      <article class="news-card reveal${a.pinned ? ' pinned' : ''}${seen.has(a.id) ? '' : ' fresh'}">
        <div class="news-when">
          <span class="news-date">${esc(niceDate(a.date))}</span>
          ${a.tag ? `<span class="news-tag">${esc(a.tag)}</span>` : ''}
        </div>
        <h3>${esc(a.title)}</h3>
        <p>${esc(a.body)}</p>
        ${a.link ? `<a class="news-more" href="${esc(a.link)}"${/^https?:/i.test(a.link) ? ' target="_blank" rel="noopener"' : ''} data-cursor="open">Read more</a>` : ''}
      </article>`).join('');

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
        return `<a class="news-pop-item${seen.has(a.id) ? ' read' : ''}" href="${esc(href)}"${external ? ' target="_blank" rel="noopener"' : ' data-news-close'}>
          <span class="t"><i></i>${esc(a.title)}</span>
          <span class="b">${esc(String(a.body || '').slice(0, 120))}${String(a.body || '').length > 120 ? '…' : ''}</span>
          <span class="d">${esc(niceDate(a.date))}${a.tag ? ' · ' + esc(a.tag) : ''}</span>
        </a>`;
      }).join('') || '<p class="news-pop-item">Nothing yet.</p>';

      pop.hidden = false;
      bell.classList.add('on');
      window.SFX?.click();

      // Marked read a beat after opening, so the dots are still visible
      // when the panel appears — otherwise you never see what was new.
      setTimeout(markAllSeen, 1000);
    };

    bell.addEventListener('click', (e) => { e.stopPropagation(); pop.hidden ? open() : close(); });
    pop.addEventListener('click', (e) => { if (e.target.closest('[data-news-close]')) close(); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) close(); });

    // Reading the section itself counts. A short dwell, not a glance:
    // scrolling past at speed should not clear the badge.
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

  /* ===================================================== ADMIN BAR
     Signing in used to send you straight to /admin. It now leaves you on
     the site with this strip at the top, because the thing you almost
     always want to do after logging in is *look at the site* — and the
     editor is one click away when you actually want it.
  ================================================================= */
  /** Show the bar. Called from two places — the session check on load,
      and the moment the login form succeeds — so it lives on its own. */
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

    // Bound once, whether or not anyone is signed in yet. Binding these
    // only after a successful session check would leave the buttons dead
    // for the one case that matters most: the click straight after login.
    $('#adminBarNews')?.addEventListener('click', () => { location.href = '/admin#news'; });

    $('#adminBarOut')?.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
        sessionStorage.removeItem('rp_token');
      } catch { /* ignore */ }
      bar.hidden = true;
      document.body.classList.remove('has-adminbar');
      toast('Signed out.');
    });
  }

  async function checkSession() {
    // The session lives in an HttpOnly cookie, with a header fallback for
    // browsers that refuse cookies. Either way the answer comes from the
    // server: this page cannot decide for itself that it is signed in,
    // and showing the bar would not grant anything if it lied — every
    // write endpoint checks the token again.
    let token = null;
    try { token = sessionStorage.getItem('rp_token'); } catch { /* ignore */ }

    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'same-origin',
        headers: token ? { Authorization: 'Bearer ' + token } : {}
      });
      if (!res.ok) return;                 // anonymous: no bar, no trace
      const me = await res.json();
      showAdminBar(me.username);
    } catch { /* offline; stay a visitor */ }
  }

  /* ============================================ PERFORMANCE CONTROL
     The automatic tier is right most of the time and wrong sometimes.
     This is the escape hatch, and it is honest about what it does. */
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
      btn.innerHTML = `<i></i><span>${LABEL[t]}</span>`;
      btn.title = `Graphics: ${LABEL[t]} — ${NOTE[t]}`;
    };
    paint();
    document.addEventListener('perf:changed', paint);

    btn.addEventListener('click', () => {
      const order = ['high', 'mid', 'low'];
      const next = order[(order.indexOf(window.PERF.tier) + 1) % 3];
      window.PERF.set(next);
      paint();
      toast(`Graphics: ${LABEL[next]} — ${NOTE[next]}`, 3600);
    });

    actions.insertBefore(btn, actions.firstChild);
  }

  /* ================================================== RENDERING */
  function render(c) {
    const p = c.profile || {};
    const s = c.sections || {};
    const m = c.meta || {};

    if (m.accent) document.documentElement.style.setProperty('--accent', m.accent);
    if (m.accent2) document.documentElement.style.setProperty('--accent2', m.accent2);
    if (m.siteTitle) document.title = m.siteTitle;
    if (m.metaDescription) $('#metaDescription').setAttribute('content', m.metaDescription);

    /* hero */
    $('#heroAvailability').textContent = p.availability || 'Available';
    $('#heroName').textContent = p.name || '';
    $('#heroName').dataset.realName = p.name || '';   // the animation's source of truth
    $('#heroTagline').textContent = p.tagline || '';
    $('#heroSummary').textContent = p.summary || '';
    $('#photoCaption').textContent = p.location || '';
    if (p.photo) $('#profilePhoto').src = p.photo;
    $('#profilePhoto').alt = p.name || 'Profile photo';

    const cv = $('#cvButton');
    cv.href = p.cvUrl || '/assets/files/cv.pdf';

    typeLoop($('#typedRole'), (p.roles && p.roles.length ? p.roles : [p.title || 'Engineer']));

    /* socials (rendered twice: hero + contact) */
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

    /* stats */
    $('#statList').innerHTML = (c.stats || [])
      .map(
        (st) =>
          `<li class="reveal"><b data-count="${esc(st.value)}" data-decimals="${esc(st.decimals || 0)}" data-suffix="${esc(
            st.suffix || ''
          )}">0</b><span>${esc(st.label)}</span><i>${esc(st.detail || '')}</i></li>`
      )
      .join('');

    /* announcements */
    $('#newsKicker').textContent = s.newsKicker || '';
    $('#newsTitle').textContent = s.newsTitle || 'Announcements';
    renderNews(c.announcements);

    /* about */
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

    /* skills */
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

    /* experience */
    $('#experienceKicker').textContent = s.experienceKicker || '';
    $('#experienceTitle').textContent = s.experienceTitle || 'Experience';
    const tl = $('#timeline');
    tl.innerHTML = '<span class="timeline-rail"><i id="timelineFill"></i></span>' +
      (c.experience || [])
        .map(
          (x) => `<article class="tl-item card glow tilt reveal" data-tilt="5">
            <div class="tl-head">
              <h3 class="tl-role">${esc(x.role)}</h3>
              <span class="tl-period">${esc(x.period)}</span>
            </div>
            <p class="tl-company">${esc(x.company)}</p>
            ${x.tools ? `<span class="tl-tools">${esc(x.tools)}</span>` : ''}
            <ul class="bullets">${(x.bullets || []).map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
          </article>`
        )
        .join('');

    /* projects */
    $('#projectsKicker').textContent = s.projectsKicker || '';
    $('#projectsTitle').textContent = s.projectsTitle || 'Projects';
    $('#projectGrid').innerHTML = (c.projects || [])
      .map(
        (pr, i) => `<article class="project tilt reveal" data-tilt="3.5">
          <div class="project-media">
            <img src="${esc(pr.image || '/assets/img/project-waste.svg')}" alt="${esc(pr.title)}" loading="lazy">
          </div>
          <div class="project-body">
            <p class="project-num">PROJECT ${String(i + 1).padStart(2, '0')}</p>
            <h3>${esc(pr.title)}</h3>
            <p class="period">${esc(pr.period)}</p>
            <ul class="bullets">${(pr.bullets || []).map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
            <ul class="tags">${(pr.tags || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
            <div class="project-links">
              ${pr.repo ? `<a class="btn btn-ghost project-link magnetic" href="${esc(pr.repo)}" target="_blank" rel="noopener" data-cursor="code"><span>Code</span></a>` : ''}
              ${pr.report ? `<a class="btn btn-ghost project-link magnetic" href="${esc(pr.report)}" target="_blank" rel="noopener" data-cursor="read"><span>Report (PDF)</span></a>` : ''}
              ${pr.link ? `<a class="btn btn-ghost project-link magnetic" href="${esc(pr.link)}" target="_blank" rel="noopener" data-cursor="open"><span>View project</span></a>` : ''}
            </div>
          </div>
        </article>`
      )
      .join('');

    /* education */
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

    /* contact + google schedule */
    $('#contactKicker').textContent = s.contactKicker || '';
    $('#contactTitle').textContent = s.contactTitle || 'Let us talk';
    $('#calendarNote').textContent = p.calendarNote || '';

    const box = $('#calendarBox');
    const url = (p.calendarUrl || '').trim();

    // Works with any booking provider: Google appointment schedules,
    // Calendly, Cal.com, TidyCal, SavvyCal …
    const isGoogleLong = /calendar\.google\.com\/calendar\/appointments\/schedules\//.test(url);
    const isGoogleShort = /(^|\/\/)calendar\.app\.google\//.test(url);
    const isWrongGoogleLink = /calendar\.google\.com/.test(url) && !isGoogleLong;

    // Only these can legally be shown inside another page. Google's short
    // links (calendar.app.google) send X-Frame-Options and refuse, so for
    // those we show a proper booking card instead of a broken frame.
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

    /* footer */
    $('#footerNote').textContent = m.footerNote || '';
    $('#year').textContent = new Date().getFullYear();

    /* re-bind everything that was just injected */
    bindTilt();
    bindMagnetic();
    refreshParallax();
    observe();
    document.dispatchEvent(new CustomEvent('content:rendered', { detail: c }));
  }

  /* ======================================================== BOOT */
  async function boot() {
    initNetwork();
    initCursor();
    initParallax();
    initNav();
    initSound();
    initThemeSwitch();
    initSecretAdmin();
    initBell();
    initPerfTab();
    bindAdminBar();
    checkSession();          // async on purpose: never blocks the page

    // signature as logo, under the photo and in the footer — always drawing
    $('#navSignature').appendChild(window.buildSignature({ strokeWidth: 9, duration: 4200, delay: 1200 }));
    $('#photoSignature').appendChild(window.buildSignature({ strokeWidth: 7, duration: 5200, delay: 1400 }));
    $('#footerSignature').appendChild(window.buildSignature({ strokeWidth: 10, duration: 6000, delay: 2000, glow: false }));

    try {
      const res = await fetch('/api/content');
      const data = await res.json();
      render(data.content);
    } catch (e) {
      console.error('Could not load content from the database.', e);
      toast('Could not reach the database. Is the server running?', 6000);
    }

    // The name animation must never take its target from the screen: if it
    // ran twice, the second run would treat the first run's scrambled
    // characters as the real name and freeze them there. Keep the true
    // name aside and only ever animate once.
    let nameSettled = false;
    document.addEventListener('loader:done', () => {
      const name = $('#heroName');
      if (name && !reduced && !nameSettled) {
        nameSettled = true;
        const realName = name.dataset.realName || name.textContent;
        scramble(name, realName, 1500);
      }
      window.SFX?.chime();   // the system comes online
      observe();
    });
    // if the loader already finished (cached fast load)
    if (document.body.classList.contains('is-ready')) observe();
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();
