/* ==================================================================
   SHOWCASE
   The four big set pieces, written without a framework or a library so
   the site keeps its promise of zero dependencies:

     1. Experience   — a timeline that pins and slides sideways
     2. Projects     — a stack of cards that scatters as you scroll
     3. Certificates — a wheel you turn
     4. The badge    — a credential hanging in the rain, behind the hero

   Plus the constellation that plays between views.

   Everything reads the same content object app.js renders, and waits
   for its 'content:rendered' event before building anything.
   ================================================================== */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const reducedQ = matchMedia('(prefers-reduced-motion: reduce)');
  const coarseQ = matchMedia('(pointer: coarse)');
  const reduced = () => reducedQ.matches;
  const low = () => !!(window.PERF && window.PERF.low);
  const mode = () => document.documentElement.dataset.mode || 'modern';

  /* ------------------------------------------------ the scroll engine
     One listener, one frame, every scroll-driven part updated from it. */
  const parts = new Set();
  let queued = false;
  const frame = () => { queued = false; parts.forEach((p) => p.update && p.update()); };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(frame); } };
  const remeasure = () => { parts.forEach((p) => p.measure && p.measure()); frame(); };

  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', remeasure);
  document.addEventListener('view:changed', () => requestAnimationFrame(remeasure));
  document.addEventListener('mode:changed', () => requestAnimationFrame(remeasure));
  addEventListener('load', remeasure);

  /** Distance from the top of the document, ignoring transforms. */
  function docTop(el) {
    let y = 0;
    for (let n = el; n; n = n.offsetParent) y += n.offsetTop;
    return y;
  }

  /* ==================================================================
     1. EXPERIENCE — the timeline
     ================================================================== */
  const years = (list) => {
    const ys = [];
    let present = false;
    list.forEach((x) => {
      (String(x.period || '').match(/\d{4}/g) || []).forEach((y) => ys.push(Number(y)));
      if (/present|now|günümüz|devam/i.test(x.period || '')) present = true;
    });
    if (!ys.length) return '';
    const lo = Math.min(...ys);
    const hi = present ? 'Present' : Math.max(...ys);
    return lo === hi ? String(lo) : `${lo} — ${hi}`;
  };

  function buildTimeline(c) {
    const host = $('#journey');
    if (!host) return;
    const s = c.sections || {};
    const p = c.profile || {};
    // the panel lists newest first; a timeline reads left to right, oldest first
    const items = (c.experience || []).filter((x) => x && (x.role || x.company)).slice().reverse();

    const img = s.experienceImage || p.photo || '';
    const itemHTML = (x, i) => {
      const side = i % 2 ? 'bottom' : 'top';
      return `<div class="jt-item ${side}" data-i="${i}" style="--i:${i}">
        <div class="jt-stem"><i class="jt-node"></i><span class="jt-stick"></span></div>
        <div class="jt-copy">
          <h4 class="jt-when"><span class="jt-mask"><span>${esc(x.period)}</span></span></h4>
          <p class="jt-what"><span class="jt-mask"><span><b>${esc(String(x.role || '').trim())}</b></span></span>
            <span class="jt-mask"><span>${esc(x.company)}</span></span></p>
          ${x.tools ? `<p class="jt-tools"><span class="jt-mask"><span>${esc(x.tools)}</span></span></p>` : ''}
        </div>
      </div>`;
    };

    host.innerHTML = `
      <div class="jt-sticky">
        <div class="jt-slider">
          ${img ? `<figure class="jt-img"><img src="${esc(img)}" alt="${esc(p.name || '')}" draggable="false"></figure>` : ''}
          <div class="jt-track" style="--n:${items.length}">
            <div class="jt-axis"><i class="jt-dot"></i><span class="jt-line"></span><i class="jt-dot end"></i></div>
            <div class="jt-lead top"><h3 class="jt-title">${esc(s.experienceTitle || 'Experience')}</h3></div>
            <div class="jt-lead bottom"><p class="jt-range">${esc(years(items))}</p></div>
            ${items.map(itemHTML).join('')}
          </div>
        </div>
        <div class="scroll-cue jt-cue" aria-hidden="true"><span>Scroll down to travel through the years</span><i></i></div>
      </div>`;

    const details = $('#journeyDetails');
    if (details) {
      details.innerHTML = (c.experience || [])
        .filter((x) => x && (x.role || x.company))
        .map((x) => `<article class="jt-detail">
          <header>
            <span class="jt-detail-when">${esc(x.period)}</span>
            <h3>${esc(String(x.role || '').trim())}</h3>
            <p>${esc(x.company)}${x.tools ? ` <em>· ${esc(x.tools)}</em>` : ''}</p>
          </header>
          <ul>${(x.bullets || []).filter(Boolean).map((b) => `<li>${esc(String(b).replace(/\s*\n\s*/g, ' '))}</li>`).join('')}</ul>
        </article>`)
        .join('');
    }
  }

  const timeline = {
    measure() {
      const host = $('#journey');
      this.host = host;
      if (!host || !host.offsetParent) { this.live = false; return; }
      const slider = $('.jt-slider', host);
      const track = $('.jt-track', host);
      if (!slider || !track) { this.live = false; return; }
      this.slider = slider;
      this.items = $$('.jt-item', host).map((el) => ({
        el,
        stick: $('.jt-stick', el),
        node: $('.jt-node', el),
        texts: $$('.jt-mask > span', el),
        x: 0
      }));
      this.line = $('.jt-line', host);

      host.classList.toggle('is-static', reduced());
      if (reduced()) { this.live = false; return; }

      // how far the slider has to travel so its end reaches the right edge
      slider.style.transform = 'none';
      const W = innerWidth;
      this.travel = Math.max(0, slider.scrollWidth - W + W * 0.04);
      this.items.forEach((it) => { it.x = it.el.getBoundingClientRect().left; });
      host.style.height = (innerHeight + this.travel * 1.05) + 'px';
      this.top = docTop(host);
      this.span = Math.max(1, host.offsetHeight - innerHeight);
      this.live = true;
    },
    update() {
      if (!this.live) return;
      const W = innerWidth;
      const pr = clamp((scrollY - this.top) / this.span, 0, 1);
      const tx = -pr * this.travel;
      this.slider.style.transform = `translate3d(${tx}px,0,0)`;
      if (this.line) this.line.style.transform = `scaleX(${clamp((pr - 0.02) / 0.9, 0, 1)})`;
      if (!this.cue) this.cue = $('.jt-cue', this.host);
      if (this.cue) this.cue.style.opacity = String(1 - clamp(pr / 0.12, 0, 1));

      this.items.forEach((it) => {
        const onScreen = it.x + tx;
        const r = clamp((W * 0.9 - onScreen) / (W * 0.32), 0, 1);
        it.stick.style.transform = `scaleY(${easeOut(r)})`;
        it.node.style.transform = `translate(-50%,-50%) scale(${easeOut(clamp(r * 1.6, 0, 1))})`;
        const t = easeOut(clamp((r - 0.25) / 0.75, 0, 1));
        it.texts.forEach((sp, k) => {
          const tk = clamp(t * 1.25 - k * 0.12, 0, 1);
          sp.style.transform = `translate3d(0,${(1 - tk) * 105}%,0)`;
        });
      });
    }
  };
  parts.add(timeline);

  /* ==================================================================
     2. PROJECTS — the stack that spreads
     ================================================================== */
  function spreadTargets(n, small) {
    const out = [];
    if (small) {
      const rows = Math.ceil(n / 2);
      for (let i = 0; i < n; i++) {
        const r = Math.floor(i / 2);
        const lone = i === n - 1 && n % 2 === 1;
        const y = rows === 1 ? -24 : lerp(-29, 29, r / (rows - 1));
        out.push({ x: lone ? 0 : (i % 2 ? 23 : -23), y, w: 40, h: 19 });
      }
      return out;
    }
    const size = n <= 4 ? { w: 21, h: 29 } : n <= 6 ? { w: 17, h: 25 } : { w: 14, h: 21 };
    const start = -90 + 180 / n;
    for (let i = 0; i < n; i++) {
      const a = ((start + (360 / n) * i) * Math.PI) / 180;
      out.push({ x: Math.cos(a) * 34, y: Math.sin(a) * 31, ...size });
    }
    return out;
  }

  // the clustered pose: small offsets and a fan of angles, the same every visit
  const STACK = [
    { x: -8, y: -6, r: -14 }, { x: 10, y: -8, r: 16 }, { x: -12, y: 2, r: -5 },
    { x: 2, y: -7, r: -2 }, { x: 13, y: 2, r: 7 }, { x: -5, y: 7, r: 5 },
    { x: 7, y: 6, r: 3 }, { x: 14, y: 9, r: -7 }
  ];

  function buildProjects(c) {
    const host = $('#spread');
    if (!host) return;
    const s = c.sections || {};
    const list = (c.projects || []).filter((p) => p && p.title);
    const head = esc(s.projectsKicker || 'Things I built and measured')
      .replace(/\b(and|&amp;|ve)\b/i, '<span>$1</span>');

    host.innerHTML = `
      <div class="ss-sticky">
        <div class="ss-copy">
          <h3 class="ss-head">${head}</h3>
          <p class="ss-sub">${list.length} ${list.length === 1 ? 'project' : 'projects'} · pick one to read it</p>
        </div>
        <div class="ss-cards">
          ${list.map((p, i) => `<a class="ss-card" href="#proj-${i + 1}" data-i="${i}" style="z-index:${i + 2}">
            <span class="ss-face"><img src="${esc(p.image || '/assets/img/project-waste.svg')}" alt="${esc(p.title)}" draggable="false" loading="lazy"></span>
            <span class="ss-label"><em>${String(i + 1).padStart(2, '0')}</em>${esc(p.title)}</span>
          </a>`).join('')}
        </div>
        <div class="ss-hint scroll-cue" aria-hidden="true"><span>Scroll down to spread the cards</span>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </div>
      </div>`;

    const listHost = $('#projectList');
    if (listHost) {
      listHost.innerHTML = list.map((pr, i) => `<article class="pj" id="proj-${i + 1}">
        <figure class="pj-media"><img src="${esc(pr.image || '/assets/img/project-waste.svg')}" alt="${esc(pr.title)}" loading="lazy"></figure>
        <div class="pj-body">
          <p class="pj-num">Project ${String(i + 1).padStart(2, '0')} · ${esc(pr.period)}</p>
          <h3>${esc(pr.title)}</h3>
          <ul class="pj-bullets">${(pr.bullets || []).filter(Boolean).map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
          <ul class="pj-tags">${(pr.tags || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
          <div class="pj-links">
            ${pr.repo ? `<a class="btn btn-ghost" href="${esc(pr.repo)}" target="_blank" rel="noopener"><span>Code</span></a>` : ''}
            ${pr.report ? `<a class="btn btn-ghost" href="${esc(pr.report)}" target="_blank" rel="noopener"><span>Report (PDF)</span></a>` : ''}
            ${pr.link ? `<a class="btn btn-ghost" href="${esc(pr.link)}" target="_blank" rel="noopener"><span>View project</span></a>` : ''}
          </div>
        </div>
      </article>`).join('');
    }

    // a card is a way to its write-up, not a page jump
    host.addEventListener('click', (e) => {
      const a = e.target.closest('.ss-card');
      if (!a) return;
      e.preventDefault();
      e.stopPropagation();
      const t = document.getElementById(a.getAttribute('href').slice(1));
      if (t) t.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    }, true);
  }

  const spread = {
    px: 0, py: 0, tx: 0, ty: 0,
    measure() {
      const host = $('#spread');
      this.host = host;
      if (!host || !host.offsetParent) { this.live = false; return; }
      this.cards = $$('.ss-card', host);
      this.copy = $('.ss-copy', host);
      this.hint = $('.ss-hint', host);
      this.small = innerWidth < 760 || coarseQ.matches;
      this.targets = spreadTargets(this.cards.length, this.small);
      this.cards.forEach((el, i) => {
        const t = this.targets[i];
        el.style.width = t.w + 'vw';
        el.style.height = t.h + 'vh';
      });
      host.classList.toggle('is-static', reduced());
      host.style.height = reduced() ? '' : (this.small ? 260 : 320) + 'vh';
      this.top = docTop(host);
      this.span = Math.max(1, host.offsetHeight - innerHeight);
      this.live = true;
    },
    update() {
      if (!this.live) return;
      const raw = reduced() ? 1 : clamp((scrollY - this.top) / this.span, 0, 1);
      const p = clamp((raw - 0.12) / (0.9 - 0.12), 0, 1);
      const spreadOut = p > 0.995;
      // pointer parallax once the cards have landed, on a mouse only
      this.px = lerp(this.px, spreadOut && !this.small ? this.tx : 0, 0.08);
      this.py = lerp(this.py, spreadOut && !this.small ? this.ty : 0, 0.08);

      const n = this.cards.length;
      this.cards.forEach((el, i) => {
        const t = this.targets[i];
        const st = STACK[i % STACK.length];
        const depth = n <= 1 ? 1 : 0.55 + (i / (n - 1)) * 0.75;
        const x = lerp(st.x, t.x, p) - this.px * 2.6 * depth * p;
        const y = lerp(st.y, t.y, p) - this.py * 2.2 * depth * p;
        const rot = reduced() ? 0 : lerp(st.r, 0, p);
        const sc = lerp(0.82, 1, p);
        el.style.transform = `translate(-50%,-50%) translate(${x}vw,${y}vh) rotate(${rot}deg) scale(${sc})`;
      });
      const cp = clamp((p - 0.3) / 0.35, 0, 1);
      if (this.copy) {
        this.copy.style.opacity = cp;
        this.copy.style.transform = `scale(${reduced() ? 1 : lerp(0.85, 1, clamp((p - 0.3) / 0.6, 0, 1))})`;
      }
      if (this.hint) this.hint.style.opacity = 1 - clamp(raw / 0.12, 0, 1);
      if (Math.abs(this.px - (spreadOut ? this.tx : 0)) > 0.002) queue();
    }
  };
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    spread.tx = (e.clientX / innerWidth) * 2 - 1;
    spread.ty = (e.clientY / innerHeight) * 2 - 1;
    if (spread.live) queue();
  }, { passive: true });
  parts.add(spread);

  /* ==================================================================
     3. CERTIFICATES — the wheel
     ================================================================== */
  const W = {
    CARD_H: 0.38, CARD_MAX_W: 0.34, CARD_RATIO: 1.45, STEP: 40, DRUM: 2.22, LENS: 2.7,
    RING_R: 1.14, BOW: 1.82, TITLE: 0.124, INDEX: 0.04, CULL: 1.6,
    WHEEL_UNITS: 900, DRAG_UNITS: 420, SETTLE: 140, EASE: 0.12
  };
  const rad = (d) => (d * Math.PI) / 180;
  const bowAt = (deg, bow) => -bow * (1 - Math.cos(rad(deg)));
  const place = (ringDeg, drumDeg, ringR, drumR, bow, m) =>
    `translateX(${m * bowAt(drumDeg, bow)}px) rotateZ(${(1 - m) * ringDeg}deg) translateY(${-(1 - m) * ringR}px)` +
    ` rotateX(${m * drumDeg}deg) translateZ(${m * drumR}px)`;

  /** A cover drawn from the words, for a certificate with no picture yet. */
  function certCover(cert, i) {
    const hues = ['#8052ff', '#ffb829', '#15846e', '#e05cff', '#4f8bff'];
    const a = hues[i % hues.length];
    const wrap = (str, n) => {
      const words = String(str || '').split(/\s+/);
      const lines = [''];
      words.forEach((w) => {
        if ((lines[lines.length - 1] + ' ' + w).trim().length > n) lines.push(w);
        else lines[lines.length - 1] = (lines[lines.length - 1] + ' ' + w).trim();
      });
      return lines.slice(0, 3);
    };
    const t = wrap(cert.title, 20).map((l, k) =>
      `<text x="40" y="${150 + k * 40}" font-size="34" font-weight="400" letter-spacing="-1">${esc(l)}</text>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 580 400">
      <rect width="580" height="400" fill="#07060b"/>
      <circle cx="500" cy="70" r="150" fill="${a}" opacity=".18"/>
      <circle cx="80" cy="420" r="160" fill="#8052ff" opacity=".12"/>
      <rect x="18" y="18" width="544" height="364" rx="14" fill="none" stroke="#ffffff" stroke-opacity=".14"/>
      <g font-family="Inter, Helvetica, Arial, sans-serif" fill="#ffffff">
        <text x="40" y="74" font-size="13" letter-spacing="3.5" fill="${a}">CERTIFICATE</text>
        ${t}
        <text x="40" y="344" font-size="15" fill="#9a9a9a">${esc([cert.issuer, cert.date].filter(Boolean).join(' · '))}</text>
      </g>
      <g transform="translate(486 310)"><circle r="38" fill="none" stroke="${a}" stroke-width="2"/>
      <circle r="28" fill="none" stroke="${a}" stroke-opacity=".5" stroke-dasharray="3 4"/>
      <path d="M-11 0l7 8 15-17" fill="none" stroke="${a}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function buildCertificates(c) {
    const sec = $('#certificates');
    const host = $('#wheel');
    if (!sec || !host) return;
    const s = c.sections || {};
    const items = (c.certificates || []).filter((x) => x && (x.title || x.image || x.pdf || x.url))
      .map((x, i) => ({ ...x, title: x.title || `Certificate ${i + 1}` }));

    // same rule as announcements: an empty section takes itself off the page
    sec.hidden = !items.length;
    $$('#navLinks a[href="#certificates"]').forEach((a) => (a.hidden = !items.length));
    const k = $('#certificatesKicker'); if (k) k.textContent = s.certificatesKicker || '';
    const t = $('#certificatesTitle'); if (t) t.textContent = s.certificatesTitle || 'Certificates';
    if (wheel.stop) wheel.stop();
    if (!items.length) {
      host.innerHTML = '';
      // a deep link to an empty section lands on the contents instead
      if (window.PRESS && window.PRESS.current() === '#certificates') window.PRESS.show('');
      return;
    }

    const label = s.certificatesTitle || 'Certificates';
    host.innerHTML = `
      <div class="ww-stage" tabindex="0" role="listbox" aria-label="${esc(label)}">
        <div class="ww-wheel">
          ${items.map((it, i) => {
            const href = it.url || it.pdf || '';
            const tag = href ? 'a' : 'div';
            return `<${tag} class="ww-card" id="ww-${i}" role="option"${href ? ` href="${esc(href)}" target="_blank" rel="noopener"` : ''}>
              <span class="ww-face">
                <img src="${esc(it.image || certCover(it, i))}" alt="${esc(it.title)}" draggable="false">
                ${'<span class="ww-view"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 9 9 3M4 3h5v5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>View</span>'}
              </span>
            </${tag}>`;
          }).join('')}
        </div>
      </div>
      <div class="ww-label">${esc(label)} '${String(new Date().getFullYear()).slice(2)}</div>
      <div class="ww-front"><b></b><span></span></div>
      <div class="scroll-cue ww-cue" aria-hidden="true"><span>Scroll or drag on the wheel to turn it</span></div>
      <ol class="ww-index">${items.map((it, i) => `<li><button type="button" data-to="${i}">${esc(it.title)}</button></li>`).join('')}</ol>`;
    wheel.start(host, items);
  }

  /* The front certificate opens full size — a certificate with only a
     picture still gets its "View". */
  function certLightbox(img, it) {
    if (!img) return;
    document.querySelector('.ww-lightbox')?.remove();
    const box = document.createElement('div');
    box.className = 'ww-lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', it.title || 'Certificate');
    const cap = [it.issuer, it.date].filter(Boolean).join(' · ');
    box.innerHTML = `<figure>
        <img src="${esc(img.getAttribute('src'))}" alt="${esc(it.title || 'Certificate')}">
        ${it.title && !/^Certificate \d+$/.test(it.title) ? `<figcaption><b>${esc(it.title)}</b>${cap ? `<span>${esc(cap)}</span>` : ''}</figcaption>` : ''}
      </figure>
      <button type="button" class="ww-lb-close" aria-label="Close">×</button>`;
    const close = () => {
      box.classList.remove('on');
      removeEventListener('keydown', onKey, true);
      setTimeout(() => box.remove(), 300);
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
    box.addEventListener('click', (e) => { if (e.target === box || e.target.closest('.ww-lb-close')) close(); });
    addEventListener('keydown', onKey, true);
    document.body.appendChild(box);
    requestAnimationFrame(() => box.classList.add('on'));
    box.querySelector('.ww-lb-close').focus();
  }

  const wheel = {
    start(host, items) {
      const stage = $('.ww-stage', host);
      const wheelEl = $('.ww-wheel', host);
      const cards = $$('.ww-card', host);
      const labelEl = $('.ww-label', host);
      const front = $('.ww-front', host);
      const idx = $$('.ww-index button', host);
      const count = items.length;
      const last = Math.max(count - 1, 0);
      let turn = 0, target = 0, active = -1, raf = 0, settleT = 0;
      let M = null;

      const measure = () => {
        const w = host.clientWidth, h = host.clientHeight;
        const cardW = Math.min(h * W.CARD_H * W.CARD_RATIO, w * (w < 760 ? 0.7 : W.CARD_MAX_W));
        const cardH = cardW / W.CARD_RATIO;
        // a short list makes a small ring; a long one opens it up to full size
        const ringR = cardH * W.RING_R * clamp(0.62 + count * 0.05, 0.7, 1);
        M = {
          cardW, cardH, ringR,
          ringScale: count ? clamp((((2 * Math.PI * ringR) / count) * 0.82) / (cardW || 1), 0.16, 0.44) : 1,
          drumR: cardH * W.DRUM, bow: cardH * W.BOW, depth: cardH * W.LENS,
          title: cardH * W.TITLE, index: Math.max(11, cardH * W.INDEX)
        };
        stage.style.perspective = M.depth + 'px';
        cards.forEach((el) => {
          el.style.width = cardW + 'px';
          el.style.height = cardH + 'px';
          el.style.marginLeft = -cardW / 2 + 'px';
          el.style.marginTop = -cardH / 2 + 'px';
        });
        labelEl.style.fontSize = M.title + 'px';
        front.style.fontSize = M.title * 0.62 + 'px';
        $('.ww-index', host).style.fontSize = M.index + 'px';
      };

      const setActive = (i) => {
        if (i === active) return;
        active = i;
        $('b', front).textContent = items[i]?.title || '';
        $('span', front).textContent = [items[i]?.issuer, items[i]?.date].filter(Boolean).join(' · ');
        idx.forEach((b, k) => b.classList.toggle('on', k === i));
        stage.setAttribute('aria-activedescendant', 'ww-' + i);
        cards.forEach((c, k) => c.setAttribute('aria-selected', k === i ? 'true' : 'false'));
      };

      const draw = () => {
        raf = requestAnimationFrame(draw);
        if (!M || !host.offsetParent) return;
        const gap = target - turn;
        if (Math.abs(gap) < 0.0005) turn = target;
        else turn += gap * (reduced() ? 1 : W.EASE);
        const m = clamp(turn, 0, 1);
        const pos = Math.max(0, turn - 1);
        wheelEl.style.transform = `translateZ(${-m * M.drumR}px)`;
        for (let i = 0; i < count; i++) {
          const d = i - pos;
          const card = cards[i];
          card.style.transform = place(d * (360 / count), d * W.STEP, M.ringR, M.drumR, M.bow, m);
          card.style.opacity = m > 0.5 && Math.abs(d) > W.CULL ? '0' : '1';
          card.style.zIndex = String(Math.round(100 - Math.abs(d) * 2));
          card.firstElementChild.style.transform = `scale(${lerp(M.ringScale, 1, m)})`;
        }
        labelEl.style.opacity = String(1 - m);
        const cue = $('.ww-cue', host);
        if (cue) cue.style.opacity = String(1 - m);
        front.style.opacity = String(m);
        setActive(clamp(Math.round(pos), 0, last));
      };

      const to = (next) => { target = clamp(next, 0, last + 1); };

      /* Settle onto an item in the direction the wheel was going, so a
         single notch is enough to move one card rather than springing back. */
      const settle = (dir) => {
        const f = target - Math.floor(target);
        if (f < 0.02 || f > 0.98) return to(Math.round(target));
        to(dir > 0 ? Math.ceil(target) : Math.floor(target));
      };
      const onWheel = (e) => {
        const next = target + e.deltaY / W.WHEEL_UNITS;
        if (next > 0 && next < last + 1) e.preventDefault();
        to(next);
        clearTimeout(settleT);
        const dir = Math.sign(e.deltaY);
        settleT = setTimeout(() => settle(dir), W.SETTLE);
      };
      let drag = null;
      const onDown = (e) => {
        drag = { x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse' };
        stage.setPointerCapture?.(e.pointerId);
      };
      const onMove = (e) => {
        if (!drag) return;
        // a finger turns the wheel sideways, so the page can still scroll under it
        const delta = drag.touch ? (drag.x - e.clientX) * 1.4 : drag.y - e.clientY;
        to(target + delta / W.DRAG_UNITS);
        drag.x = e.clientX; drag.y = e.clientY;
      };
      const onUp = () => {
        if (!drag) return;
        drag = null;
        if (target > 0.25) to(Math.max(1, Math.round(target)));
        else to(0);
      };
      const onKey = (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') to(Math.round(target) + 1);
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') to(Math.round(target) - 1);
        else return;
        e.preventDefault();
        e.stopPropagation();   // the arrows turn the wheel, not the page's views
      };
      const onIndex = (e) => {
        const b = e.target.closest('[data-to]');
        if (b) to(Number(b.dataset.to) + 1);
      };

      stage.addEventListener('wheel', onWheel, { passive: false });
      stage.addEventListener('pointerdown', onDown);
      stage.addEventListener('pointermove', onMove);
      stage.addEventListener('pointerup', onUp);
      stage.addEventListener('pointercancel', onUp);
      stage.addEventListener('keydown', onKey);
      host.addEventListener('click', onIndex);
      /* A drag that ends on a card must not also open its link, and a
         click on a card that is not at the front brings it round first. */
      let down = null;
      stage.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
      stage.addEventListener('click', (e) => {
        /* The stage captures the pointer for dragging, so the click lands
           on the stage itself; find the card that is under the pointer. */
        const card = e.target.closest('.ww-card') ||
          document.elementsFromPoint(e.clientX, e.clientY).map((el) => el.closest && el.closest('.ww-card')).find(Boolean);
        if (!card) return;
        e.preventDefault();
        const dragged = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6;
        const i = cards.indexOf(card);
        if (dragged) return;
        if (turn < 0.9 || i !== active) { to(i + 1); return; }
        const href = card.getAttribute('href');
        if (href) window.open(href, '_blank', 'noopener');
        else certLightbox(card.querySelector('img'), items[i]);
      });
      stage.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || turn < 0.9) return;
        const card = cards[active];
        if (!card) return;
        e.preventDefault();
        const href = card.getAttribute('href');
        if (href) window.open(href, '_blank', 'noopener');
        else certLightbox(card.querySelector('img'), items[active]);
      });

      const ro = new ResizeObserver(measure);
      ro.observe(host);
      measure();
      setActive(0);
      raf = requestAnimationFrame(draw);

      this.stop = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        stage.removeEventListener('wheel', onWheel);
        clearTimeout(settleT);
        this.stop = null;
      };
    },
    stop: null
  };

  /* ==================================================================
     4. THE BADGE IN THE RAIN
     A credential on a lanyard, swaying behind the hero text, with rain
     falling across the whole page and sparking where it hits the badge.
     ================================================================== */
  function buildBadge(c) {
    const p = c.profile || {};
    const name = $('#badgeName');
    if (name) name.textContent = String(p.name || 'Read Aloush').toUpperCase();
    const role = $('#badgeRole');
    if (role) role.textContent = p.title || '';
    const yr = $('#badgeYear');
    if (yr) yr.textContent = new Date().getFullYear();
  }

  const rain = (() => {
    const cv = document.createElement('canvas');
    cv.id = 'rainCanvas';
    cv.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(cv, document.body.firstChild);
    const ctx = cv.getContext('2d');
    let Wd = 0, Ht = 0, dpr = 1, drops = [], sparks = [], raf = 0, last = 0, badge = null, badgeAt = 0;

    const SPARK = ['255,184,41', '128,82,255', '255,255,255', '21,132,110'];

    function size() {
      dpr = Math.min(devicePixelRatio || 1, 1.75);
      Wd = innerWidth; Ht = innerHeight;
      cv.width = Wd * dpr; cv.height = Ht * dpr;
      cv.style.width = Wd + 'px'; cv.style.height = Ht + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round((Wd * Ht) / (low() ? 26000 : 9500));
      drops = Array.from({ length: n }, () => fresh(true));
    }
    function fresh(anywhere) {
      const z = Math.random();             // depth: far drops are thin, slow, faint
      return {
        x: Math.random() * (Wd + 200) - 100,
        y: anywhere ? Math.random() * Ht : -20 - Math.random() * 120,
        len: 8 + z * 18,
        v: 7 + z * 11,
        a: 0.08 + z * 0.22,
        w: 0.6 + z * 0.8
      };
    }
    function burst(x, y, n) {
      for (let i = 0; i < n; i++) {
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
        const sp = 1.2 + Math.random() * 2.6;
        sparks.push({
          x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
          life: 1, decay: 0.03 + Math.random() * 0.04,
          c: SPARK[(Math.random() * (Math.random() < 0.55 ? 1 : SPARK.length)) | 0]
        });
      }
    }

    function tick(now) {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(2.5, (now - (last || now)) / 16.67);
      last = now;
      if (document.hidden) return;

      // the badge moves (it sways), so its edge is re-read a few times a second
      if (now - badgeAt > 120) {
        badgeAt = now;
        const el = document.getElementById('badgeCard');
        const r = el && el.offsetParent ? el.getBoundingClientRect() : null;
        badge = r && r.bottom > 0 && r.top < Ht ? r : null;
      }

      const dark = document.documentElement.dataset.theme !== 'light';
      const ink = dark ? '255,255,255' : '40,24,90';
      ctx.clearRect(0, 0, Wd, Ht);
      ctx.lineCap = 'round';

      for (const d of drops) {
        const py = d.y;
        d.y += d.v * dt;
        d.x += d.v * 0.16 * dt;
        if (badge && d.x > badge.left + 6 && d.x < badge.right - 6 && py < badge.top && d.y >= badge.top) {
          if (Math.random() < 0.6) burst(d.x, badge.top, 2 + ((Math.random() * 3) | 0));
          Object.assign(d, fresh(false));
          continue;
        }
        if (d.y > Ht + 20) {
          if (Math.random() < 0.08) burst(d.x, Ht - 2, 2);
          Object.assign(d, fresh(false));
          continue;
        }
        ctx.strokeStyle = `rgba(${ink},${d.a * (dark ? 1 : 0.8)})`;
        ctx.lineWidth = d.w;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.len * 0.16, d.y - d.len);
        ctx.stroke();
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 0.16 * dt;
        s.life -= s.decay * dt;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        ctx.fillStyle = `rgba(${s.c},${s.life})`;
        ctx.fillRect(s.x - 0.9, s.y - 0.9, 1.8, 1.8);
      }
    }

    function run() {
      const on = !reduced() && (mode() === 'modern' || mode() === 'shell');
      cv.style.display = on ? '' : 'none';
      cancelAnimationFrame(raf);
      if (on) { last = 0; raf = requestAnimationFrame(tick); }
    }
    addEventListener('resize', () => { size(); });
    document.addEventListener('mode:changed', run);
    reducedQ.addEventListener?.('change', run);
    size();
    run();
    return { run };
  })();

  /* ==================================================================
     5. THE CONSTELLATION — between views
     Outlined triangles in every colour of the palette gather into one
     shape, the page is swapped behind them, and they scatter again.
     ================================================================== */
  const constellation = (() => {
    const cv = document.createElement('canvas');
    cv.id = 'constellation';
    cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    const COLORS = ['#8052ff', '#8052ff', '#9a78ff', '#ffb829', '#ffb829', '#15846e', '#1fb89a', '#e05cff', '#4f8bff'];
    let busy = false;

    // a brain, roughly: two lobes, a fold between them, a stem
    function shapePoint(cx, cy, R) {
      for (;;) {
        const x = (Math.random() * 2 - 1);
        const y = (Math.random() * 2 - 1);
        const lobeL = ((x + 0.28) / 0.62) ** 2 + (y / 0.5) ** 2 < 1;
        const lobeR = ((x - 0.28) / 0.62) ** 2 + (y / 0.5) ** 2 < 1;
        const stem = Math.abs(x - 0.12) < 0.12 && y > 0.3 && y < 0.72;
        const fold = Math.abs(x) < 0.025 && y < 0.1;
        if ((lobeL || lobeR || stem) && !fold) {
          const wob = Math.sin(x * 11) * 0.03 + Math.cos(y * 9) * 0.03;
          return { x: cx + x * R, y: cy + (y + wob) * R * 0.95 };
        }
      }
    }

    function play(swap) {
      if (busy || reduced()) { swap(); return; }
      busy = true;
      const dpr = Math.min(devicePixelRatio || 1, 1.75);
      const Wd = innerWidth, Ht = innerHeight;
      cv.width = Wd * dpr; cv.height = Ht * dpr;
      cv.style.width = Wd + 'px'; cv.style.height = Ht + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cv.classList.add('on');

      const light = document.documentElement.dataset.theme === 'light';
      const veil = light ? '246,245,249' : '0,0,0';
      const R = Math.min(Wd, Ht) * 0.34;
      const cx = Wd / 2, cy = Ht / 2;
      const N = low() ? 260 : 620;
      const pts = Array.from({ length: N }, (_, i) => {
        const ambient = i % 6 === 0;
        const to = ambient
          ? { x: Math.random() * Wd, y: Math.random() * Ht }
          : shapePoint(cx, cy, R);
        const ang = Math.atan2(to.y - cy, to.x - cx) + (Math.random() - 0.5) * 0.6;
        return {
          fx: Math.random() * Wd, fy: Math.random() * Ht,
          tx: to.x, ty: to.y,
          ox: Math.cos(ang), oy: Math.sin(ang),
          fly: Wd * (0.25 + Math.random() * 0.6),
          s: 2.2 + Math.random() * 4.6,
          r: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 0.08,
          c: COLORS[(Math.random() * COLORS.length) | 0],
          d: Math.random() * 0.18,
          amb: ambient
        };
      });

      const GATHER = 520, SWAP = 560, HOLD = 700, END = 1250;
      let swapped = false;
      const t0 = performance.now();

      const tri = (x, y, s, r) => {
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const a = r + (k * Math.PI * 2) / 3;
          const px = x + Math.cos(a) * s, py = y + Math.sin(a) * s;
          k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      };

      const step = (now) => {
        const t = now - t0;
        ctx.clearRect(0, 0, Wd, Ht);

        // the veil hides the old page, then lets the new one through
        const va = t < SWAP ? easeInOut(clamp(t / 420, 0, 1)) : 1 - easeInOut(clamp((t - HOLD + 60) / 460, 0, 1));
        ctx.fillStyle = `rgba(${veil},${va})`;
        ctx.fillRect(0, 0, Wd, Ht);

        if (!swapped && t >= SWAP) { swapped = true; try { swap(); } catch (e) { console.error(e); } }

        ctx.lineWidth = 1.1;
        for (const p of pts) {
          let x, y, a;
          if (t < HOLD) {
            const g = easeInOut(clamp((t / GATHER - p.d) / (1 - p.d), 0, 1));
            x = lerp(p.fx, p.tx, g);
            y = lerp(p.fy, p.ty, g);
            a = (p.amb ? 0.45 : 0.95) * clamp(t / 260, 0, 1);
          } else {
            const o = clamp((t - HOLD) / (END - HOLD), 0, 1);
            const e = o * o;
            x = p.tx + p.ox * p.fly * e;
            y = p.ty + p.oy * p.fly * e;
            a = (p.amb ? 0.45 : 0.95) * (1 - o);
          }
          p.r += p.spin;
          ctx.globalAlpha = a;
          ctx.strokeStyle = p.c;
          tri(x, y, p.s, p.r);
        }
        ctx.globalAlpha = 1;

        if (t < END) requestAnimationFrame(step);
        else {
          ctx.clearRect(0, 0, Wd, Ht);
          cv.classList.remove('on');
          busy = false;
        }
      };
      requestAnimationFrame(step);
    }
    return { play };
  })();
  window.CONSTELLATION = constellation;

  /* ------------------------------------------------------ build all */
  document.addEventListener('content:rendered', (e) => {
    const c = e.detail || {};
    buildBadge(c);
    buildTimeline(c);
    buildProjects(c);
    buildCertificates(c);
    requestAnimationFrame(remeasure);
    setTimeout(remeasure, 400);
  });
  // images change the layout as they land
  addEventListener('load', () => setTimeout(remeasure, 50));
  document.addEventListener('loader:done', () => setTimeout(remeasure, 60));
})();
