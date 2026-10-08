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

  function docTop(el) {
    let y = 0;
    for (let n = el; n; n = n.offsetParent) y += n.offsetTop;
    return y;
  }

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
    const items = (c.experience || []).filter((x) => x && (x.role || x.company)).slice().reverse();

    const img = s.experienceImage || p.photo || '';
    const itemHTML = (x, i) => {
      const side = i % 2 ? 'bottom' : 'top';
      return `<div class="jt-item ${side}" data-i="${i}" data-case="experience:${items.length - 1 - i}" role="link" tabindex="0" aria-label="${esc(String(x.role || '').trim())} at ${esc(x.company || '')} — read more" style="--i:${i}">
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
        .map((x, k) => `<article class="jt-detail" data-case="experience:${k}">
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
          ${list.map((p, i) => `<a class="ss-card" href="#proj-${i + 1}" data-i="${i}" data-case="projects:${i}" style="z-index:${i + 2}">
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
            <a class="btn btn-primary" href="#proj-${i + 1}" data-case="projects:${i}"><span>Read the case study</span></a>
            ${pr.repo ? `<a class="btn btn-ghost" href="${esc(pr.repo)}" target="_blank" rel="noopener"><span>Code</span></a>` : ''}
            ${pr.report ? `<a class="btn btn-ghost" href="${esc(pr.report)}" target="_blank" rel="noopener"><span>Report (PDF)</span></a>` : ''}
            ${pr.link ? `<a class="btn btn-ghost" href="${esc(pr.link)}" target="_blank" rel="noopener"><span>View project</span></a>` : ''}
          </div>
        </div>
      </article>`).join('');
    }

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

  function certCover(cert, i) {
    const hues = ['#C3E41D', '#ffb829', '#15846e', '#e05cff', '#4f8bff'];
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
      <circle cx="80" cy="420" r="160" fill="#C3E41D" opacity=".12"/>
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

    sec.hidden = !items.length;
    $$('#navLinks a[href="#certificates"]').forEach((a) => (a.hidden = !items.length));
    const k = $('#certificatesKicker'); if (k) k.textContent = s.certificatesKicker || '';
    const t = $('#certificatesTitle'); if (t) t.textContent = s.certificatesTitle || 'Certificates';
    if (wheel.stop) wheel.stop();
    if (!items.length) {
      host.innerHTML = '';
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

      const kick = () => { if (!raf) raf = requestAnimationFrame(draw); };
      const draw = () => {
        raf = 0;
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
        if (turn !== target) kick();
      };

      const to = (next) => { target = clamp(next, 0, last + 1); kick(); };

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
        e.stopPropagation();
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
      let down = null;
      stage.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
      stage.addEventListener('click', (e) => {
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

      const ro = new ResizeObserver(() => { measure(); kick(); });
      ro.observe(host);
      measure();
      setActive(0);
      kick();
      const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) kick(); });
      io.observe(host);

      this.stop = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        stage.removeEventListener('wheel', onWheel);
        clearTimeout(settleT);
        this.stop = null;
      };
    },
    stop: null
  };

  function buildBadge(c) {
    const p = c.profile || {};
    const name = $('#badgeName');
    if (name) name.textContent = String(p.name || 'Read Aloush').toUpperCase();
    const role = $('#badgeRole');
    if (role) role.textContent = p.title || '';
    const yr = $('#badgeYear');
    if (yr) yr.textContent = new Date().getFullYear();
  }

  const constellation = (() => {
    const veil = document.createElement('div');
    veil.id = 'viewVeil';
    veil.setAttribute('aria-hidden', 'true');
    document.body.appendChild(veil);
    let busy = false;
    function play(swap) {
      if (busy || reduced()) { swap(); return; }
      busy = true;
      veil.classList.add('on');
      setTimeout(() => {
        try { swap(); } catch (e) { console.error(e); }
        requestAnimationFrame(() => { veil.classList.remove('on'); busy = false; });
      }, 160);
    }
    return { play };
  })();
  window.CONSTELLATION = constellation;

  document.addEventListener('content:rendered', (e) => {
    const c = e.detail || {};
    buildBadge(c);
    buildTimeline(c);
    buildProjects(c);
    buildCertificates(c);
    requestAnimationFrame(remeasure);
    setTimeout(remeasure, 400);
  });
  addEventListener('load', () => setTimeout(remeasure, 50));
  document.addEventListener('loader:done', () => setTimeout(remeasure, 60));
})();
