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

  /* ================================================ NETWORK CANVAS
     Nodes connected by lines. The mouse pushes them around and
     draws extra links to whatever is nearby.
  ================================================================ */
  function initNetwork() {
    const canvas = $('#netCanvas');
    if (!canvas || reduced) return;
    const ctx = canvas.getContext('2d');
    let w, h, nodes = [], dpr = Math.min(devicePixelRatio || 1, 2);
    const mouse = { x: -9999, y: -9999, px: -9999, py: -9999, active: false, speed: 0 };

    function resize() {
      w = canvas.width = innerWidth * dpr;
      h = canvas.height = innerHeight * dpr;
      canvas.style.width = innerWidth + 'px';
      canvas.style.height = innerHeight + 'px';
      const target = Math.round(Math.min(130, (innerWidth * innerHeight) / 13000));
      nodes = Array.from({ length: target }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.32 * dpr,
        vy: (Math.random() - 0.5) * 0.32 * dpr,
        r: (Math.random() * 1.5 + 0.9) * dpr
      }));
    }

    addEventListener('resize', resize);
    addEventListener('pointermove', (e) => {
      mouse.px = mouse.x; mouse.py = mouse.y;
      mouse.x = e.clientX * dpr; mouse.y = e.clientY * dpr;
      mouse.speed = Math.hypot(mouse.x - mouse.px, mouse.y - mouse.py);
      mouse.active = true;
    });
    addEventListener('pointerleave', () => { mouse.active = false; mouse.x = mouse.y = -9999; });
    addEventListener('click', (e) => {
      // click = shockwave through the network
      const cx = e.clientX * dpr, cy = e.clientY * dpr;
      nodes.forEach((n) => {
        const dx = n.x - cx, dy = n.y - cy, d = Math.hypot(dx, dy) || 1;
        if (d < 320 * dpr) { n.vx += (dx / d) * 5; n.vy += (dy / d) * 5; }
      });
    });

    const rgb = () => getComputedStyle(document.documentElement).getPropertyValue('--net-line').trim();
    const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();

    function frame() {
      ctx.clearRect(0, 0, w, h);
      const LINE = rgb();
      const AC = accent();
      const LINK = 128 * dpr;
      const MOUSE_R = 190 * dpr;

      for (const n of nodes) {
        // mouse repulsion + a little swirl
        if (mouse.active) {
          const dx = n.x - mouse.x, dy = n.y - mouse.y, d = Math.hypot(dx, dy);
          if (d < MOUSE_R && d > 0.001) {
            const f = (1 - d / MOUSE_R) * 0.55;
            n.vx += (dx / d) * f;
            n.vy += (dy / d) * f;
            n.vx += (-dy / d) * f * 0.25;
            n.vy += (dx / d) * f * 0.25;
          }
        }
        n.x += n.vx; n.y += n.vy;
        n.vx *= 0.985; n.vy *= 0.985;
        // gentle constant drift so it never freezes
        const sp = Math.hypot(n.vx, n.vy);
        if (sp < 0.12 * dpr) { n.vx += (Math.random() - 0.5) * 0.09 * dpr; n.vy += (Math.random() - 0.5) * 0.09 * dpr; }
        if (n.x < 0) { n.x = 0; n.vx *= -1; } if (n.x > w) { n.x = w; n.vx *= -1; }
        if (n.y < 0) { n.y = 0; n.vy *= -1; } if (n.y > h) { n.y = h; n.vy *= -1; }
      }

      // links
      ctx.lineWidth = 1 * dpr;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            const alpha = (1 - Math.sqrt(d2) / LINK) * 0.34;
            ctx.strokeStyle = `rgba(${LINE},${alpha})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        // link to cursor
        if (mouse.active) {
          const dx = a.x - mouse.x, dy = a.y - mouse.y, d = Math.hypot(dx, dy);
          if (d < MOUSE_R) {
            ctx.strokeStyle = AC;
            ctx.globalAlpha = (1 - d / MOUSE_R) * 0.5;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
        ctx.fillStyle = `rgba(${LINE},.55)`;
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
      }
      requestAnimationFrame(frame);
    }

    resize();
    requestAnimationFrame(frame);
  }

  /* ==================================================== CURSOR */
  function initCursor() {
    const dot = $('#cursorDot'), ring = $('#cursorRing'), label = $('#cursorLabel');
    if (!dot || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;

    addEventListener('pointermove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.opacity = ring.style.opacity = '1';
      dot.style.transform = `translate(${mx}px, ${my}px)`;
    });
    addEventListener('pointerdown', () => ring.classList.add('hot'));
    addEventListener('pointerup', () => {
      if (!document.querySelector(':hover[data-cursor]')) ring.classList.remove('hot');
    });

    (function loop() {
      rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
      requestAnimationFrame(loop);
    })();

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
    if (reduced) return;
    $$('.tilt', root).forEach((el) => {
      if (el.__tilt) return;
      el.__tilt = true;
      let raf;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.setProperty('--gx', px * 100 + '%');
        el.style.setProperty('--gy', py * 100 + '%');
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const strength = Number(el.dataset.tilt || 9);
          el.style.transform =
            `perspective(1000px) rotateX(${(0.5 - py) * strength * 2}deg) rotateY(${(px - 0.5) * strength * 2}deg) translateZ(6px)`;
        });
      });
      el.addEventListener('pointerleave', () => {
        cancelAnimationFrame(raf);
        el.style.transform = '';
      });
    });
  }

  /* ================================= PARALLAX ON MOUSE (whole page) */
  function initParallax() {
    if (reduced) return;
    let tx = 0, ty = 0, cx = 0, cy = 0;
    addEventListener('pointermove', (e) => {
      tx = (e.clientX / innerWidth - 0.5) * 2;
      ty = (e.clientY / innerHeight - 0.5) * 2;
    });
    (function loop() {
      cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
      $$('.parallax').forEach((el) => {
        const d = Number(el.dataset.depth || 10);
        el.style.transform = `translate3d(${cx * d}px, ${cy * d}px, 0)`;
      });
      requestAnimationFrame(loop);
    })();
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
        location.href = '/admin';
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
    addEventListener('scroll', () => {
      nav.classList.toggle('stuck', scrollY > 30);
      const d = document.documentElement;
      $('#scrollBar').style.width = (scrollY / (d.scrollHeight - innerHeight)) * 100 + '%';

      // timeline fill follows the scroll
      const tl = $('#timeline'), fill = $('#timelineFill');
      if (tl && fill) {
        const r = tl.getBoundingClientRect();
        const p = Math.min(Math.max((innerHeight * 0.75 - r.top) / r.height, 0), 1);
        fill.style.height = p * 100 + '%';
      }
    }, { passive: true });

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
     $('#heroName').dataset.realName = p.name || '';
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
            ${pr.link ? `<a class="btn btn-ghost project-link magnetic" href="${esc(pr.link)}" target="_blank" rel="noopener" data-cursor="open"><span>View project</span></a>` : ''}
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
    observe();
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

    document.addEventListener('loader:done', () => {
      const name = $('#heroName');
      if (name && !reduced && !name.dataset.settled) { name.dataset.settled = '1'; scramble(name, name.dataset.realName || name.textContent, 1500); }
      window.SFX?.chime();   // the system comes online
      observe();
    });
    // if the loader already finished (cached fast load)
    if (document.body.classList.contains('is-ready')) observe();
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();
