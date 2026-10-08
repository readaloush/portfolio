(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NS = 'http://www.w3.org/2000/svg';
  const reducedQ = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => reducedQ.matches;
  const clamp01 = (x) => (x <= 0 ? 0 : x > 1 ? 1 : x);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const easeOutBack = (t) => { const c = 1.70158, u = clamp01(t) - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
  const low = () => !!(window.PERF && window.PERF.low);

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };

  const drop = (() => {
    let done = false;
    function fall() {
      const b = $('#badgeDrop');
      if (done || !b) return;
      done = true;
      if (reduced()) { b.classList.add('landed'); return; }
      b.classList.add('falling');
      b.addEventListener('animationend', () => { b.classList.remove('falling'); b.classList.add('landed'); }, { once: true });
    }
    function watch() {
      const hero = $('#hero');
      if (!hero) return;
      new IntersectionObserver((es) => {
        es.forEach((e) => { if (e.isIntersecting) fall(); });
      }, { threshold: 0.05 }).observe(hero);
    }
    let watching = false;
    const once = () => { if (!watching) { watching = true; watch(); } };
    document.addEventListener('loader:done', () => setTimeout(once, 150));
    setTimeout(once, 6000);
    return { fall };
  })();

  const planet = (() => {
    let host, cv, ctx, W = 0, H = 0, dpr = 1, raf = 0, visible = false;
    const m = { angle: 0, vel: 0, target: 0, dragging: false, lastTouch: -10, time: 0, phase: 0, activity: 0, dir: 1, paused: false, wave: 0 };
    let props = [], stars = [], clouds = [];
    const COL = {
      sea: '#155e75', land: '#C3E41D', land2: '#9fc015', rim: '#d4f05a',
      trunk: '#3d2a1a', leaf: '#1fb89a', roof: '#ffb829', wall: '#f4f2f8',
      body: '#f4f2f8', visor: '#0c0a14', eye: '#ffb829', joint: '#C3E41D'
    };

    function build() {
      host = $('#planet');
      if (!host || cv) return;
      host.innerHTML = `
        <canvas class="planet-canvas" aria-hidden="true"></canvas>
        <div class="planet-caption" aria-hidden="true"><p>Drag to turn<br>the world</p>
          <svg viewBox="0 0 180 165" fill="none"><path d="M161 148C137 82 103 39 28 14m0 0 6 16m-6-16 19-2" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <button type="button" class="planet-pause" aria-pressed="false">Pause</button>
        <p class="sr-only">A small planet with a robot walking on it. Drag or use the arrow keys to turn it. Press Space to pause and the robot waves.</p>`;
      host.tabIndex = 0;
      host.setAttribute('role', 'group');
      host.setAttribute('aria-label', 'A small world. Drag to turn it.');
      cv = $('canvas', host);
      ctx = cv.getContext('2d');

      const r = rng(7);
      const kinds = ['tree', 'tree', 'house', 'tree', 'dish', 'tree', 'tree', 'lab', 'tree', 'tower', 'tree', 'house', 'tree', 'panel'];
      props = kinds.map((k, i) => ({ k, a: (i / kinds.length) * Math.PI * 2 + (r() - 0.5) * 0.25, s: 0.8 + r() * 0.45 }));
      stars = Array.from({ length: 70 }, () => ({ x: r(), y: r(), s: r() * 1.4 + 0.3, t: r() * 6 }));
      clouds = Array.from({ length: 5 }, (_, i) => ({ a: (i / 5) * Math.PI * 2 + r(), h: 1.28 + r() * 0.14, w: 0.18 + r() * 0.1, sp: 0.04 + r() * 0.05 }));

      let drag = null;
      host.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.planet-pause') || m.paused) return;
        drag = { id: e.pointerId, x: e.clientX };
        host.setPointerCapture(e.pointerId);
        m.dragging = true; m.target = m.angle; m.lastTouch = m.time;
        host.classList.add('dragging');
      });
      host.addEventListener('pointermove', (e) => {
        if (!drag || drag.id !== e.pointerId) return;
        const dx = e.clientX - drag.x;
        drag.x = e.clientX;
        m.target += dx * (5 / Math.max(360, host.clientWidth));
        m.lastTouch = m.time;
      });
      const up = (e) => {
        if (!drag || drag.id !== e.pointerId) return;
        drag = null; m.dragging = false; m.lastTouch = m.time;
        host.classList.remove('dragging');
      };
      host.addEventListener('pointerup', up);
      host.addEventListener('pointercancel', up);
      host.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault(); e.stopPropagation();
          if (!m.paused) { m.vel += (e.key === 'ArrowRight' ? 1 : -1) * 0.65; m.lastTouch = m.time; }
        } else if (e.key === ' ') { e.preventDefault(); togglePause(); }
      });
      const btn = $('.planet-pause', host);
      btn.addEventListener('click', togglePause);
      function togglePause() {
        m.paused = !m.paused;
        btn.textContent = m.paused ? 'Start' : 'Pause';
        btn.setAttribute('aria-pressed', String(m.paused));
        if (!m.paused) m.lastTouch = m.time - 4;
      }

      new ResizeObserver(size).observe(host);
      new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible && !raf) { last = 0; raf = requestAnimationFrame(tick); }
      }).observe(host);
      size();
    }

    function size() {
      dpr = Math.min(devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.5 : 2);
      W = host.clientWidth; H = host.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    let last = 0;
    function step(dt) {
      m.time += dt;
      if (m.paused) {
        m.vel = lerp(m.vel, 0, 1 - Math.exp(-10 * dt));
      } else if (m.dragging) {
        m.vel += (90 * (m.target - m.angle) - 18 * m.vel) * dt;
      } else {
        const want = !reduced() && m.time - m.lastTouch > 3.5 ? -0.24 : 0;
        m.vel = lerp(m.vel, want, 1 - Math.exp(-(reduced() ? 12 : 5) * dt));
      }
      m.vel = clamp(m.vel, -1.15, 1.15);
      m.angle += m.vel * dt;
      const speed = Math.abs(m.vel);
      m.activity = lerp(m.activity, smooth(0.01, 0.12, speed), 1 - Math.exp(-9 * dt));
      if (speed > 0.03) m.dir = -Math.sign(m.vel);
      m.phase += speed * 14 * dt;
      m.wave = lerp(m.wave, m.paused && speed < 0.05 ? 1 : 0, 1 - Math.exp(-5 * dt));
    }

    function drawProp(p, R) {
      const s = p.s * R * 0.085;
      ctx.save();
      ctx.lineJoin = 'round';
      switch (p.k) {
        case 'tree':
          ctx.fillStyle = COL.trunk; ctx.fillRect(-s * 0.1, -s * 0.9, s * 0.2, s * 0.9);
          ctx.fillStyle = COL.leaf;
          ctx.beginPath(); ctx.moveTo(-s * 0.55, -s * 0.7); ctx.lineTo(0, -s * 2); ctx.lineTo(s * 0.55, -s * 0.7); ctx.closePath(); ctx.fill();
          ctx.fillStyle = COL.land; ctx.globalAlpha = 0.5;
          ctx.beginPath(); ctx.moveTo(0, -s * 0.7); ctx.lineTo(0, -s * 2); ctx.lineTo(s * 0.55, -s * 0.7); ctx.closePath(); ctx.fill();
          break;
        case 'house':
          ctx.fillStyle = COL.wall; ctx.fillRect(-s * 0.6, -s * 0.9, s * 1.2, s * 0.9);
          ctx.fillStyle = COL.roof; ctx.beginPath(); ctx.moveTo(-s * 0.75, -s * 0.85); ctx.lineTo(0, -s * 1.5); ctx.lineTo(s * 0.75, -s * 0.85); ctx.closePath(); ctx.fill();
          ctx.fillStyle = COL.sea; ctx.fillRect(-s * 0.15, -s * 0.5, s * 0.3, s * 0.5);
          break;
        case 'lab':
          ctx.fillStyle = COL.wall; ctx.fillRect(-s * 0.9, -s * 1.0, s * 1.8, s);
          ctx.fillStyle = COL.sea; ctx.beginPath(); ctx.arc(0, -s * 1.0, s * 0.55, Math.PI, 0); ctx.fill();
          ctx.fillStyle = COL.roof; for (let i = -1; i <= 1; i++) ctx.fillRect(i * s * 0.5 - s * 0.12, -s * 0.7, s * 0.24, s * 0.24);
          break;
        case 'dish':
          ctx.strokeStyle = COL.wall; ctx.lineWidth = s * 0.14;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s * 0.9); ctx.stroke();
          ctx.fillStyle = COL.wall; ctx.beginPath(); ctx.ellipse(s * 0.1, -s * 1.15, s * 0.6, s * 0.28, -0.6, 0, Math.PI); ctx.fill();
          ctx.fillStyle = COL.roof; ctx.beginPath(); ctx.arc(s * 0.35, -s * 1.5, s * 0.1, 0, Math.PI * 2); ctx.fill();
          break;
        case 'tower':
          ctx.strokeStyle = COL.rim; ctx.lineWidth = s * 0.1;
          ctx.beginPath(); ctx.moveTo(-s * 0.4, 0); ctx.lineTo(0, -s * 2.2); ctx.lineTo(s * 0.4, 0); ctx.moveTo(-s * 0.25, -s * 0.8); ctx.lineTo(s * 0.25, -s * 0.8); ctx.stroke();
          ctx.fillStyle = COL.roof; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(m.time * 4);
          ctx.beginPath(); ctx.arc(0, -s * 2.25, s * 0.14, 0, Math.PI * 2); ctx.fill();
          break;
        case 'panel':
          ctx.strokeStyle = COL.wall; ctx.lineWidth = s * 0.1;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s * 0.5); ctx.stroke();
          ctx.fillStyle = '#4f8bff'; ctx.save(); ctx.translate(0, -s * 0.6); ctx.rotate(-0.4); ctx.fillRect(-s * 0.6, -s * 0.18, s * 1.2, s * 0.36); ctx.restore();
          break;
      }
      ctx.restore();
    }

    function drawRobot(R, cx, topY) {
      const s = R * 0.12;
      const a = m.activity * (1 - m.wave);
      const sw = Math.sin(m.phase) * 0.6 * a;
      const bob = Math.abs(Math.sin(m.phase)) * s * 0.06 * a;
      ctx.save();
      ctx.translate(cx, topY - bob);
      ctx.scale(m.wave > 0.5 ? 1 : m.dir, 1);
      ctx.lineCap = 'round';
      ctx.strokeStyle = COL.visor; ctx.lineWidth = s * 0.16;
      for (const k of [-1, 1]) {
        ctx.save(); ctx.translate(k * s * 0.18, -s * 0.9); ctx.rotate(sw * k);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, s * 0.85); ctx.stroke();
        ctx.fillStyle = COL.joint; ctx.fillRect(-s * 0.14, s * 0.78, s * 0.3, s * 0.12);
        ctx.restore();
      }
      ctx.fillStyle = COL.body;
      roundRect(-s * 0.42, -s * 1.75, s * 0.84, s * 0.9, s * 0.18); ctx.fill();
      ctx.fillStyle = COL.joint; roundRect(-s * 0.2, -s * 1.5, s * 0.4, s * 0.24, s * 0.06); ctx.fill();
      ctx.strokeStyle = COL.body; ctx.lineWidth = s * 0.15;
      ctx.save(); ctx.translate(-s * 0.46, -s * 1.6); ctx.rotate(-sw * 1.1 + 0.15);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, s * 0.7); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.translate(s * 0.46, -s * 1.6);
      const waveA = m.wave * (-2.6 + Math.sin(m.time * 7) * 0.35);
      ctx.rotate(lerp(sw * 1.1 - 0.15, 0, m.wave) + waveA);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, s * 0.7); ctx.stroke(); ctx.restore();
      ctx.fillStyle = COL.body; roundRect(-s * 0.5, -s * 2.45, s * 1.0, s * 0.68, s * 0.22); ctx.fill();
      ctx.fillStyle = COL.visor; roundRect(-s * 0.36, -s * 2.3, s * 0.72, s * 0.34, s * 0.14); ctx.fill();
      ctx.fillStyle = COL.eye;
      const blink = (m.time % 4) > 3.88 ? 0.2 : 1;
      for (const k of [-1, 1]) { ctx.beginPath(); ctx.ellipse(k * s * 0.15 + s * 0.05, -s * 2.13, s * 0.06, s * 0.07 * blink, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = COL.body; ctx.lineWidth = s * 0.06;
      ctx.beginPath(); ctx.moveTo(0, -s * 2.45); ctx.lineTo(0, -s * 2.75); ctx.stroke();
      ctx.fillStyle = COL.eye; ctx.globalAlpha = 0.55 + 0.45 * Math.sin(m.time * 5);
      ctx.beginPath(); ctx.arc(0, -s * 2.8, s * 0.08, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const light = document.documentElement.dataset.theme === 'light';
      const R = Math.min(W * 0.36, H * 0.34);
      const cx = W / 2, cy = H * 0.62;

      for (const s of stars) {
        ctx.globalAlpha = (light ? 0.25 : 0.5) * (0.5 + 0.5 * Math.sin(m.time * 1.5 + s.t));
        ctx.fillStyle = light ? '#0c0a14' : '#ffffff';
        ctx.fillRect(s.x * W, s.y * H * 0.9, s.s, s.s);
      }
      ctx.globalAlpha = 1;

      const halo = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.55);
      halo.addColorStop(0, 'rgba(195,228,29,.35)');
      halo.addColorStop(1, 'rgba(195,228,29,0)');
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, R * 1.6, 0, Math.PI * 2); ctx.fill();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(m.angle);
      const g = ctx.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R);
      g.addColorStop(0, '#1fb89a'); g.addColorStop(0.7, COL.land); g.addColorStop(1, '#0c5a4b');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COL.sea;
      for (let i = 0; i < 5; i++) {
        const a = i * 1.3 + 0.4, rr = R * (0.35 + (i % 3) * 0.17);
        ctx.globalAlpha = 0.55;
        ctx.beginPath(); ctx.ellipse(Math.cos(a) * rr, Math.sin(a) * rr, R * 0.16, R * 0.09, a, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const p of props) {
        ctx.save(); ctx.rotate(p.a); ctx.translate(0, -R + 1); drawProp(p, R); ctx.restore();
      }
      ctx.restore();

      const shade = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.45, R * 0.2, cx, cy, R * 1.02);
      shade.addColorStop(0, 'rgba(255,255,255,.14)');
      shade.addColorStop(0.6, 'rgba(0,0,0,0)');
      shade.addColorStop(1, 'rgba(0,0,0,.45)');
      ctx.fillStyle = shade; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(154,120,255,.55)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, R + 0.5, 0, Math.PI * 2); ctx.stroke();

      for (const c of clouds) {
        const a = c.a + m.angle * 0.6 + m.time * c.sp;
        const x = cx + Math.sin(a) * R * c.h, y = cy - Math.cos(a) * R * c.h;
        ctx.fillStyle = light ? 'rgba(255,255,255,.9)' : 'rgba(244,242,248,.75)';
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath(); ctx.arc(x + k * R * c.w * 0.35, y - (k === 0 ? R * 0.03 : 0), R * c.w * (k === 0 ? 0.3 : 0.22), 0, Math.PI * 2); ctx.fill();
        }
      }

      drawRobot(R, cx, cy - R);
    }

    const touch = matchMedia('(pointer: coarse)').matches;
    function tick(now) {
      raf = 0;
      if (!visible || !host.offsetParent || document.hidden) return;
      if (touch && last && now - last < 31) { raf = requestAnimationFrame(tick); return; }
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      const n = Math.max(1, Math.ceil(dt / (1 / 120)));
      for (let i = 0; i < n; i++) step(dt / n);
      draw();
      raf = requestAnimationFrame(tick);
    }

    return {
      render() { build(); if (host && visible && !raf) raf = requestAnimationFrame(tick); },
      wake() { if (host && cv) { size(); if (!raf) { last = 0; raf = requestAnimationFrame(tick); } } }
    };
  })();

  window.SHOWCASE2 = { drop, planet };
  window.__sc2 = { $, $$, esc, reduced, reducedQ, clamp, clamp01, lerp, smooth, rng, low };
})();
