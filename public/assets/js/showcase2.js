/* ==================================================================
   SHOWCASE, PART TWO
   More set pieces, still without a framework or a library:

     1. The torn poster   — the intro on the cover, torn open by scrolling
     2. The badge drop    — the credential falls in on its lanyard
     3. The small world   — a planet with a robot walking on it (About)
     4. The bento board   — skill cards you can drag into a new order
     5. The glass lens    — education cards seen through a liquid lens

   Every piece reads the content app.js renders and waits for its
   'content:rendered' event.
   ================================================================== */
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

  /** Seeded PRNG (mulberry32): the tear and the fur are the same every visit. */
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

  /* ==================================================================
     1. THE TORN POSTER
     A plain sheet with his name on it. Scroll, and a crack runs out
     from the middle of the word, the sheet tears in two, the halves
     pull apart and a tiger rises into the gap and opens its eyes. Once
     it is looking, the eyes follow the pointer and blink.
     ================================================================== */
  const tear = (() => {
    const CX = 500, CY = 318, FAR = 4000, VIEW_W = 1000;
    const FRAME = '36 44 928 468';
    const EYES = [[-138, 6], [138, -4]];
    const INK = '#8052ff', IRIS = '#ffb829', FUR = '#d9832c';

    const d = (pts, close = true) =>
      'M' + pts.map(([x, y]) => x.toFixed(1) + ' ' + y.toFixed(1)).join('L') + (close ? 'Z' : '');

    function tearLine(seed = 11, from = -800, to = 1800, step = 9, cx = 500, cy = 318, angle = -7) {
      const r = rng(seed);
      const slope = Math.tan((angle * Math.PI) / 180);
      const out = [];
      for (let x = from; x <= to; x += step) {
        const fibre = (r() - 0.5) * 5;
        const tooth = r() < 0.09 ? (r() - 0.5) * 26 : 0;
        const wander = Math.sin(x * 0.019 + seed) * 10 + Math.sin(x * 0.053 + seed * 2) * 4;
        out.push([x, cy + (x - cx) * slope + wander + fibre + tooth]);
      }
      return out;
    }
    const pieceMotion = (open) => ({
      top: { dx: -10 * open, dy: -82 * open, rot: -2.6 * open },
      bottom: { dx: 12 * open, dy: 78 * open, rot: 2.1 * open }
    });
    function fibreWidths(n, open, seed = 5) {
      const r = rng(seed);
      const k = Math.min(1, open * 4);
      return Array.from({ length: n }, (_, i) =>
        k * (2.5 + 6 * (0.5 + 0.5 * Math.sin(i * 0.37 + seed)) * (0.6 + r() * 0.8)));
    }
    const stages = (p) => ({
      crack: smooth(0.03, 0.2, p),
      open: smooth(0.18, 0.62, p),
      rise: smooth(0.26, 0.74, p),
      pop: smooth(0.58, 0.88, p),
      shake: smooth(0.16, 0.22, p) * (1 - smooth(0.26, 0.36, p))
    });

    function stripe(p0, p1, p2, w, n = 18) {
      const left = [], right = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n, m = 1 - t;
        const x = m * m * p0[0] + 2 * m * t * p1[0] + t * t * p2[0];
        const y = m * m * p0[1] + 2 * m * t * p1[1] + t * t * p2[1];
        const dx = 2 * m * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
        const dy = 2 * m * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
        const l = Math.hypot(dx, dy) || 1;
        const h = (w / 2) * Math.pow(Math.sin(Math.PI * t), 0.6);
        left.push([x - (dy / l) * h, y + (dx / l) * h]);
        right.push([x + (dy / l) * h, y - (dx / l) * h]);
      }
      return d(left.concat(right.reverse()));
    }
    function buildStripes() {
      const r = rng(29);
      const j = (a) => (r() - 0.5) * a;
      const out = [];
      for (const k of [-2, -1, 0, 1, 2]) {
        out.push(stripe([k * 27 + j(8), -205], [k * 21 + j(6), -140], [k * 11, -72 + Math.abs(k) * 10], 13 - Math.abs(k) * 2));
      }
      for (const s of [-1, 1]) {
        out.push(stripe([s * 50, -108], [s * 138, -140 + j(8)], [s * 228, -96], 13));
        out.push(stripe([s * 72, -158], [s * 150, -188 + j(8)], [s * 250, -150], 11));
        for (const y of [-160, -104, -48, 14, 76, 138]) {
          out.push(stripe([s * 350, y + j(10)], [s * 292, y + j(26)], [s * (222 + r() * 30), y + j(34)], 18 + r() * 8));
        }
        out.push(stripe([s * 212, 38], [s * 256, 72], [s * 330, 98], 14));
        out.push(stripe([s * 182, 74], [s * 226, 120], [s * 312, 156], 12));
        out.push(stripe([s * 64, 22], [s * 50, 88], [s * 42, 178], 8));
        for (let k = 0; k < 16; k++) {
          const x = s * (390 + k * 70 + j(30));
          out.push(stripe([x + j(40), -330], [x + s * 30 + j(40), j(60)], [x + s * 10 + j(40), 330], 20 + r() * 14));
        }
      }
      return out.join('');
    }
    function buildHairs() {
      const r = rng(53);
      const tones = ['', '', ''];
      const n = low() ? 1200 : 2600;
      for (let i = 0; i < n; i++) {
        const x = (r() - 0.5) * 1900;
        const y = (r() - 0.5) * 480;
        const a = Math.atan2(y - 150, x) + (r() - 0.5) * 0.5;
        const l = 9 + r() * 12;
        const seg = 'M' + x.toFixed(1) + ' ' + y.toFixed(1) + 'l' + (Math.cos(a) * l).toFixed(1) + ' ' + (Math.sin(a) * l).toFixed(1);
        tones[r() < 0.45 ? 0 : r() < 0.7 ? 1 : 2] += seg;
      }
      return tones;
    }
    function buildFibres() {
      const r = rng(71);
      let s = '';
      for (let i = 0; i < 56; i++) {
        const a = (i / 56) * Math.PI * 2 + r() * 0.08;
        const r0 = 12 + r() * 4, r1 = 30 + r() * 5;
        s += 'M' + (Math.cos(a) * r0).toFixed(1) + ' ' + (Math.sin(a) * r0).toFixed(1) + 'L' + (Math.cos(a) * r1).toFixed(1) + ' ' + (Math.sin(a) * r1).toFixed(1);
      }
      return s;
    }
    const ALMOND = 'M-78 10 C-52 -40 30 -56 80 -8 C44 40 -30 50 -78 10Z';
    const CURLS = {
      top: [[300, 44, 30], [575, 30, 20], [790, 52, 34]],
      bottom: [[205, 50, 32], [470, 34, 22], [690, 40, 28]]
    };

    let built = false, root, stage, svg, parts = {}, line, raf = 0, visible = false;
    let p = 0, look = [0, 0], idle = [0, 0], nextIdle = 0, nextBlink = 0, squintAt = -1e9, pointer = null;
    let word = 'Read Aloush', tagline = 'AI & Robotics Engineer';

    function build() {
      root = $('#intro');
      stage = $('#tearStage');
      if (!root || !stage) return;
      built = true;
      line = tearLine();
      const id = 'ttr';
      stage.innerHTML = '';
      svg = el('svg', {
        viewBox: FRAME, preserveAspectRatio: 'xMidYMid meet', role: 'img',
        'aria-label': tagline + '. ' + word + ', torn in two by a tiger looking through.'
      }, stage);
      svg.innerHTML = `<defs>
        <linearGradient id="${id}-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1203" stop-opacity=".45"/><stop offset=".45" stop-color="#ffd08a" stop-opacity=".12"/><stop offset="1" stop-color="#2a1203" stop-opacity=".5"/></linearGradient>
        <radialGradient id="${id}-vignette" cx=".5" cy=".5" r=".5" gradientTransform="translate(0.5 0.5) scale(0.25 1) translate(-0.5 -0.5)"><stop offset=".5" stop-color="#1a0a02" stop-opacity="0"/><stop offset="1" stop-color="#1a0a02" stop-opacity=".55"/></radialGradient>
        <radialGradient id="${id}-iris"><stop offset="0" stop-color="#fff0a8"/><stop offset=".35" stop-color="${IRIS}"/><stop offset=".8" stop-color="#b8570f"/><stop offset="1" stop-color="#4d1f03"/></radialGradient>
        <linearGradient id="${id}-lid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".75"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
        <linearGradient id="${id}-curl-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--tear-core)"/><stop offset="1" style="stop-color:var(--tear-curl)"/></linearGradient>
        <linearGradient id="${id}-curl-bottom" x1="0" y1="1" x2="0" y2="0"><stop offset="0" style="stop-color:var(--tear-core)"/><stop offset="1" style="stop-color:var(--tear-curl)"/></linearGradient>
        <filter id="${id}-soft" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>
        <filter id="${id}-rough" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="9"/></filter>
        <filter id="${id}-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <g id="${id}-sheet">
          <rect x="${-FAR}" y="${-FAR}" width="${FAR * 2 + VIEW_W}" height="${FAR * 2}" style="fill:var(--tear-paper)"/>
          <text id="${id}-tag" x="${CX}" y="150" text-anchor="middle" style="fill:var(--tear-ink);font:italic 500 34px 'Bodoni Moda',Georgia,serif;letter-spacing:.04em"></text>
          <text id="${id}-word" x="${CX}" y="404" text-anchor="middle" textLength="880" lengthAdjust="spacingAndGlyphs" fill="${INK}" style="font-family:'Italianno','Caveat',cursive;font-size:330px;font-weight:400"></text>
        </g>
      </defs>`;
      $('#' + id + '-tag', svg).textContent = tagline;
      $('#' + id + '-word', svg).textContent = word;

      const shakeG = el('g', {}, svg);

      /* the tiger, behind the paper */
      const tiger = el('g', { visibility: 'hidden' }, shakeG);
      const fur = el('g', {}, tiger);
      for (const f of [FUR, `url(#${id}-shade)`, `url(#${id}-vignette)`]) {
        el('rect', { x: -2600, y: -420, width: 5200, height: 840, fill: f }, fur);
      }
      const patches = el('g', { filter: `url(#${id}-soft)`, fill: '#fbf6ec' }, fur);
      EYES.forEach(([x, y]) => {
        el('ellipse', { cx: x, cy: y - 52, rx: 78, ry: 22 }, patches);
        el('ellipse', { cx: x, cy: y + 44, rx: 64, ry: 15, opacity: 0.9 }, patches);
      });
      el('ellipse', { cx: 0, cy: 188, rx: 96, ry: 52, opacity: 0.85 }, patches);
      el('path', { d: buildStripes(), fill: '#140b05', filter: `url(#${id}-rough)` }, fur);
      const hairs = buildHairs();
      el('path', { d: hairs[0], stroke: '#3b1c07', 'stroke-width': 1.4, opacity: 0.35, 'stroke-linecap': 'round' }, fur);
      el('path', { d: hairs[1], stroke: '#f7c46e', 'stroke-width': 1.2, opacity: 0.35, 'stroke-linecap': 'round' }, fur);
      el('path', { d: hairs[2], stroke: '#fff6e4', 'stroke-width': 1, opacity: 0.22, 'stroke-linecap': 'round' }, fur);

      const eyesG = el('g', {}, tiger);
      const fibres = buildFibres();
      const eyes = EYES.map(([x, y], i) => {
        const flip = i === 0;
        const g = el('g', {}, eyesG);
        const clip = id + (flip ? '-cl' : '-cr');
        const cp = el('clipPath', { id: clip }, g);
        el('path', { d: ALMOND }, cp);
        el('path', { d: ALMOND, fill: '#0c0603', stroke: '#0c0603', 'stroke-width': 11, 'stroke-linejoin': 'round' }, g);
        el('path', { d: 'M-80 8 C-86 20 -96 30 -98 44 C-90 34 -80 24 -70 18Z', fill: '#0c0603' }, g);
        const inner = el('g', { 'clip-path': `url(#${clip})` }, g);
        el('ellipse', { cx: 0, cy: 0, rx: 80, ry: 52, fill: '#3d1a05' }, inner);
        const iris = el('g', {}, inner);
        el('circle', { r: 38, fill: `url(#${id}-iris)` }, iris);
        el('path', { d: fibres, stroke: '#6b2d05', 'stroke-width': 1, opacity: 0.35 }, iris);
        el('circle', { r: 38, fill: 'none', stroke: '#3a1602', 'stroke-width': 3, opacity: 0.8 }, iris);
        const pupil = el('circle', { r: 13, fill: '#050302' }, iris);
        el('ellipse', { cx: -12, cy: -13, rx: 7.5, ry: 5.5, fill: '#fff', opacity: 0.92 }, iris);
        el('circle', { cx: 9, cy: 10, r: 2.6, fill: '#fff', opacity: 0.6 }, iris);
        el('ellipse', { cx: 0, cy: -46, rx: 90, ry: 34, fill: `url(#${id}-lid)` }, inner);
        const lid = el('g', {}, inner);
        el('rect', { x: -90, y: -80, width: 180, height: 80, fill: '#9c5212' }, lid);
        el('path', { d: 'M-90 0 H90', stroke: '#0c0603', 'stroke-width': 8 }, lid);
        return { g, iris, pupil, lid, x, y, flip };
      });

      /* the sheet: whole until it tears, then two halves */
      const whole = el('use', { href: `#${id}-sheet` }, shakeG);
      const halves = ['top', 'bottom'].map((side) => {
        const up = side === 'top';
        const shape = up
          ? [[line[0][0], -FAR], [line[line.length - 1][0], -FAR], ...[...line].reverse()]
          : [...line, [line[line.length - 1][0], FAR], [line[0][0], FAR]];
        const g = el('g', { visibility: 'hidden' }, shakeG);
        const shadow = el('path', {
          d: d(line, false), fill: 'none', stroke: '#000', 'stroke-width': 22,
          transform: `translate(0 ${up ? 10 : -10})`, filter: `url(#${id}-soft)`
        }, g);
        const cp = el('clipPath', { id: id + '-' + side }, g);
        el('path', { d: d(shape) }, cp);
        const clipped = el('g', { 'clip-path': `url(#${id}-${side})` }, g);
        el('use', { href: `#${id}-sheet` }, clipped);
        const core = el('path', { style: 'fill:var(--tear-core)' }, g);
        const curls = CURLS[side].map(() => el('path', { fill: `url(#${id}-curl-${side})`, style: 'stroke:var(--tear-core)', 'stroke-width': 1 }, g));
        return { side, up, g, shadow, core, curls };
      });
      const crack = el('path', { fill: 'none', style: 'stroke:var(--tear-crack)', 'stroke-width': 2.4, 'stroke-linejoin': 'bevel' }, shakeG);

      const hint = document.createElement('div');
      hint.className = 'scroll-cue tear-hint';
      hint.setAttribute('aria-hidden', 'true');
      hint.innerHTML = '<span>Scroll down</span><i></i>';
      stage.appendChild(hint);

      parts = { shakeG, tiger, eyes, whole, halves, crack, hint };

      stage.addEventListener('pointermove', (e) => { pointer = { x: e.clientX, y: e.clientY }; });
      stage.addEventListener('pointerleave', () => { pointer = null; });
      stage.addEventListener('pointerdown', () => { if (stages(p).pop > 0.5) squintAt = performance.now(); });

      new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible && !raf) raf = requestAnimationFrame(tick);
      }).observe(root);
    }

    function progress() {
      const top = root.getBoundingClientRect().top;
      const range = root.offsetHeight - stage.offsetHeight;
      if (range <= 0) return top <= 0 ? 1 : 0;
      return clamp01(-top / range);
    }

    function paint(f) {
      const s = stages(f.p);
      const pop = reduced() ? s.pop : easeOutBack(s.pop);
      const eyeScale = 0.9 + 0.1 * pop;
      const pupil = 1.3 - 0.5 * s.pop + 0.35 * f.squint;
      const blink = Math.max(1 - clamp01(pop), f.blink, f.squint * 0.45);
      const rise = (1 - s.rise) * 150;
      const shake = reduced() ? 0 : Math.sin(f.p * 900) * 6 * s.shake;

      parts.shakeG.setAttribute('transform', `translate(${shake.toFixed(2)} ${(shake * 0.4).toFixed(2)})`);
      const open = s.open > 0;
      parts.tiger.setAttribute('visibility', open ? 'visible' : 'hidden');
      parts.tiger.setAttribute('transform', `translate(${CX} ${(CY + rise).toFixed(2)}) rotate(-7) scale(${(1.34 - 0.06 * s.rise).toFixed(4)})`);
      if (open) {
        const glow = s.pop > 0.02;
        parts.eyes.forEach((e) => {
          e.g.setAttribute('transform', `translate(${e.x} ${e.y}) scale(${e.flip ? -eyeScale : eyeScale} ${eyeScale})`);
          e.g.parentNode.setAttribute('filter', glow ? 'url(#ttr-glow)' : '');
          const lx = f.look[0] * (e.flip ? -1 : 1);
          e.iris.setAttribute('transform', `translate(${(lx * 13).toFixed(2)} ${(4 + f.look[1] * 7).toFixed(2)})`);
          e.pupil.setAttribute('r', (13 * pupil).toFixed(2));
          e.lid.setAttribute('transform', `translate(0 ${(-62 + blink * 72).toFixed(2)})`);
        });
      }

      parts.whole.setAttribute('visibility', open ? 'hidden' : 'visible');
      const m = pieceMotion(s.open);
      parts.halves.forEach((h) => {
        h.g.setAttribute('visibility', open ? 'visible' : 'hidden');
        if (!open) return;
        const mm = m[h.side];
        h.g.setAttribute('transform', `translate(${mm.dx.toFixed(2)} ${mm.dy.toFixed(2)}) rotate(${mm.rot.toFixed(3)} ${CX} ${CY})`);
        h.shadow.setAttribute('stroke-opacity', (0.55 * Math.min(1, s.open * 3)).toFixed(3));
        const widths = fibreWidths(line.length, s.open, h.up ? 5 : 8);
        const core = line.concat(line.map(([x, y], i) => [x, y + (h.up ? -widths[i] : widths[i])]).reverse());
        h.core.setAttribute('d', d(core));
        CURLS[h.side].forEach(([cx, hw, depth], i) => {
          const pts = line.filter(([x]) => Math.abs(x - cx) <= hw);
          const back = pts.map(([x, y]) => {
            const sv = Math.cos(((x - cx) / hw) * (Math.PI / 2));
            return [x + (h.up ? 6 : -6) * sv * s.open, y + (h.up ? 1 : -1) * depth * sv * sv * Math.min(1, s.open * 2.5)];
          });
          h.curls[i].setAttribute('d', d(pts.concat(back.reverse())));
        });
      });

      const reach = s.crack * 620;
      const crackPts = line.filter(([x]) => Math.abs(x - CX) <= reach);
      if (s.crack > 0 && s.open < 0.15 && crackPts.length > 1) {
        parts.crack.setAttribute('d', d(crackPts, false));
        parts.crack.setAttribute('opacity', (1 - s.open / 0.15).toFixed(3));
      } else parts.crack.setAttribute('d', '');

      parts.hint.style.opacity = Math.max(0, 1 - s.crack * 3).toFixed(3);
      stage.style.cursor = s.pop > 0.9 ? 'crosshair' : '';
    }

    function tick(now) {
      raf = 0;
      if (!visible || !built || !root.offsetParent) return;
      const target = progress();
      p = reduced() ? (target > 0.3 ? 1 : 0) : p + (target - p) * 0.14;
      if (Math.abs(target - p) < 0.0005) p = target;

      let want;
      if (pointer) {
        const r = stage.getBoundingClientRect();
        want = [
          clamp((pointer.x - r.left - r.width / 2) / (r.width * 0.35), -1, 1),
          clamp((pointer.y - r.top - r.height * 0.58) / (r.height * 0.35), -1, 1)
        ];
      } else {
        if (now > nextIdle && !reduced()) {
          const g = rng(Math.floor(now));
          idle = [(g() - 0.5) * 1.4, (g() - 0.5) * 0.8];
          nextIdle = now + 1400 + g() * 1800;
        }
        want = reduced() ? [0, 0] : idle;
      }
      look = [look[0] + (want[0] - look[0]) * 0.14, look[1] + (want[1] - look[1]) * 0.14];

      let blink = 0;
      if (!reduced()) {
        if (!nextBlink) nextBlink = now + 2500;
        const since = now - nextBlink;
        if (since > 0) blink = since < 90 ? since / 90 : since < 200 ? 1 - (since - 90) / 110 : 0;
        if (since > 200) nextBlink = now + 2600 + Math.random() * 3200;
      }
      const squint = reduced() ? 0 : Math.max(0, 1 - (now - squintAt) / 900);
      paint({ p, look, blink, squint });

      raf = requestAnimationFrame(tick);
    }

    return {
      render(c) {
        const pr = c.profile || {};
        word = String(pr.shortName || pr.name || word);
        tagline = String(pr.title || tagline);
        if (!built) build();
        else {
          $('#ttr-word', svg).textContent = word;
          $('#ttr-tag', svg).textContent = tagline;
        }
        if (built) {
          paint({ p, look, blink: 1, squint: 0 });
          if (!raf) raf = requestAnimationFrame(tick);
        }
      },
      wake() { if (built && !raf) raf = requestAnimationFrame(tick); }
    };
  })();

  /* ==================================================================
     2. THE BADGE DROP
     The credential waits above the screen and drops in on its lanyard
     once the poster has been torn open, or as soon as the hero is in
     view for anyone who skips past the poster.
     ================================================================== */
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
        es.forEach((e) => { if (e.isIntersecting && e.intersectionRatio > 0.35) fall(); });
      }, { threshold: [0, 0.35, 0.6] }).observe(hero);
    }
    document.addEventListener('loader:done', () => setTimeout(watch, 300));
    setTimeout(watch, 9000);
    return { fall };
  })();

  /* ==================================================================
     3. THE SMALL WORLD
     A planet you turn by dragging, with a little robot walking on top.
     Leave it alone and it rolls slowly; stop it (or press Space) and
     the robot turns round and waves.
     ================================================================== */
  const planet = (() => {
    let host, cv, ctx, W = 0, H = 0, dpr = 1, raf = 0, visible = false;
    const m = { angle: 0, vel: 0, target: 0, dragging: false, lastTouch: -10, time: 0, phase: 0, activity: 0, dir: 1, paused: false, wave: 0 };
    let props = [], stars = [], clouds = [];
    const COL = {
      sea: '#6b3cf5', land: '#15846e', land2: '#1fb89a', rim: '#9a78ff',
      trunk: '#3d2a1a', leaf: '#1fb89a', roof: '#ffb829', wall: '#f4f2f8',
      body: '#f4f2f8', visor: '#0c0a14', eye: '#ffb829', joint: '#8052ff'
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
      // things standing on the planet, at an angle round it
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
      dpr = Math.min(devicePixelRatio || 1, 2);
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
      // legs
      ctx.strokeStyle = COL.visor; ctx.lineWidth = s * 0.16;
      for (const k of [-1, 1]) {
        ctx.save(); ctx.translate(k * s * 0.18, -s * 0.9); ctx.rotate(sw * k);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, s * 0.85); ctx.stroke();
        ctx.fillStyle = COL.joint; ctx.fillRect(-s * 0.14, s * 0.78, s * 0.3, s * 0.12);
        ctx.restore();
      }
      // body
      ctx.fillStyle = COL.body;
      roundRect(-s * 0.42, -s * 1.75, s * 0.84, s * 0.9, s * 0.18); ctx.fill();
      ctx.fillStyle = COL.joint; roundRect(-s * 0.2, -s * 1.5, s * 0.4, s * 0.24, s * 0.06); ctx.fill();
      // arms
      ctx.strokeStyle = COL.body; ctx.lineWidth = s * 0.15;
      ctx.save(); ctx.translate(-s * 0.46, -s * 1.6); ctx.rotate(-sw * 1.1 + 0.15);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, s * 0.7); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.translate(s * 0.46, -s * 1.6);
      const waveA = m.wave * (-2.6 + Math.sin(m.time * 7) * 0.35);
      ctx.rotate(lerp(sw * 1.1 - 0.15, 0, m.wave) + waveA);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, s * 0.7); ctx.stroke(); ctx.restore();
      // head
      ctx.fillStyle = COL.body; roundRect(-s * 0.5, -s * 2.45, s * 1.0, s * 0.68, s * 0.22); ctx.fill();
      ctx.fillStyle = COL.visor; roundRect(-s * 0.36, -s * 2.3, s * 0.72, s * 0.34, s * 0.14); ctx.fill();
      ctx.fillStyle = COL.eye;
      const blink = (m.time % 4) > 3.88 ? 0.2 : 1;
      for (const k of [-1, 1]) { ctx.beginPath(); ctx.ellipse(k * s * 0.15 + s * 0.05, -s * 2.13, s * 0.06, s * 0.07 * blink, 0, 0, Math.PI * 2); ctx.fill(); }
      // antenna
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

      // stars
      for (const s of stars) {
        ctx.globalAlpha = (light ? 0.25 : 0.5) * (0.5 + 0.5 * Math.sin(m.time * 1.5 + s.t));
        ctx.fillStyle = light ? '#6b3cf5' : '#ffffff';
        ctx.fillRect(s.x * W, s.y * H * 0.9, s.s, s.s);
      }
      ctx.globalAlpha = 1;

      // glow behind the world
      const halo = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.55);
      halo.addColorStop(0, 'rgba(128,82,255,.35)');
      halo.addColorStop(1, 'rgba(128,82,255,0)');
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, R * 1.6, 0, Math.PI * 2); ctx.fill();

      // the world
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(m.angle);
      const g = ctx.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R);
      g.addColorStop(0, '#1fb89a'); g.addColorStop(0.7, COL.land); g.addColorStop(1, '#0c5a4b');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
      // lakes that turn with it
      ctx.fillStyle = COL.sea;
      for (let i = 0; i < 5; i++) {
        const a = i * 1.3 + 0.4, rr = R * (0.35 + (i % 3) * 0.17);
        ctx.globalAlpha = 0.55;
        ctx.beginPath(); ctx.ellipse(Math.cos(a) * rr, Math.sin(a) * rr, R * 0.16, R * 0.09, a, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // props on the rim
      for (const p of props) {
        ctx.save(); ctx.rotate(p.a); ctx.translate(0, -R + 1); drawProp(p, R); ctx.restore();
      }
      ctx.restore();

      // shading over the sphere so it reads as round
      const shade = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.45, R * 0.2, cx, cy, R * 1.02);
      shade.addColorStop(0, 'rgba(255,255,255,.14)');
      shade.addColorStop(0.6, 'rgba(0,0,0,0)');
      shade.addColorStop(1, 'rgba(0,0,0,.45)');
      ctx.fillStyle = shade; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(154,120,255,.55)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, R + 0.5, 0, Math.PI * 2); ctx.stroke();

      // clouds drifting round
      for (const c of clouds) {
        const a = c.a + m.angle * 0.6 + m.time * c.sp;
        const x = cx + Math.sin(a) * R * c.h, y = cy - Math.cos(a) * R * c.h;
        ctx.fillStyle = light ? 'rgba(255,255,255,.9)' : 'rgba(244,242,248,.75)';
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath(); ctx.arc(x + k * R * c.w * 0.35, y - (k === 0 ? R * 0.03 : 0), R * c.w * (k === 0 ? 0.3 : 0.22), 0, Math.PI * 2); ctx.fill();
        }
      }

      // the robot stands on top, always
      drawRobot(R, cx, cy - R);
    }

    function tick(now) {
      raf = 0;
      if (!visible || !host.offsetParent || document.hidden) return;
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

  window.SHOWCASE2 = { tear, drop, planet };
  // the rest of this file is filled in below
  window.__sc2 = { $, $$, esc, reduced, reducedQ, clamp, clamp01, lerp, smooth, rng, low };
})();
