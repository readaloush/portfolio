/* ==================================================================
   NEURAL MODE
   ------------------------------------------------------------------
   A third presentation of the site. After the signature has finished
   drawing, a network trains in front of you — real epochs, a loss
   that falls, an accuracy that climbs — and then the very nodes that
   were training migrate into the shape of a robot, which greets you
   and asks you to scroll. The robot never leaves: it stays behind the
   whole site afterwards, faint, watching the cursor.

   One canvas does all of it. The same array of points is the network
   in the first act and the robot in the second, which is the whole
   trick — nothing is created or destroyed, the points simply move.

   Loaded on demand by extras.js; it does nothing unless neural mode
   is actually selected.
   ================================================================== */
(() => {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SEEN_KEY = 'rp_neuro_seen';

  /* ================================================== the geometry */

  /** Walk a polyline and drop a point every `step` units. */
  function walk(points, step, close, out, tag) {
    const pts = close ? points.concat([points[0]]) : points;
    let carry = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = Math.hypot(dx, dy);
      if (len < 0.001) continue;
      let d = carry;
      while (d < len) {
        out.push({ x: x0 + (dx * d) / len, y: y0 + (dy * d) / len, tag });
        d += step;
      }
      carry = d - len;
    }
  }

  function circle(cx, cy, r, step, out, tag) {
    const n = Math.max(6, Math.round((2 * Math.PI * r) / step));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, tag });
    }
  }

  function roundRect(x0, y0, x1, y1, r, step, out, tag) {
    const pts = [];
    const corner = (cx, cy, from) => {
      const n = 7;
      for (let i = 0; i <= n; i++) {
        const a = from + (i / n) * (Math.PI / 2);
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
    };
    pts.push([x0 + r, y0]);
    pts.push([x1 - r, y0]);
    corner(x1 - r, y0 + r, -Math.PI / 2);
    pts.push([x1, y1 - r]);
    corner(x1 - r, y1 - r, 0);
    pts.push([x0 + r, y1]);
    corner(x0 + r, y1 - r, Math.PI / 2);
    pts.push([x0, y0 + r]);
    corner(x0 + r, y0 + r, Math.PI);
    walk(pts, step, true, out, tag);
  }

  /** The robot, in a virtual space roughly 320 wide and 560 tall. */
  function buildRobot() {
    const P = [];
    const S = 12;                       // spacing between points

    roundRect(-74, -206, 74, -84, 26, S, P, 'head');
    walk([[0, -206], [0, -246]], S, false, P, 'head');
    circle(0, -254, 9, 7, P, 'head');

    circle(-34, -156, 15, 8, P, 'eyeL');
    circle(34, -156, 15, 8, P, 'eyeR');
    walk([[-28, -112], [28, -112]], 9, false, P, 'mouth');

    walk([[-18, -84], [-18, -62]], S, false, P, 'head');
    walk([[18, -84], [18, -62]], S, false, P, 'head');

    walk([[-98, -58], [98, -58], [78, 78], [-78, 78]], S, true, P, 'body');
    circle(0, 6, 22, 9, P, 'core');
    circle(0, 6, 9, 7, P, 'core');

    walk([[-96, -44], [-146, 14], [-132, 76]], S, false, P, 'armL');
    walk([[96, -44], [146, 14], [132, 76]], S, false, P, 'armR');
    circle(-134, 88, 12, 8, P, 'armL');
    circle(134, 88, 12, 8, P, 'armR');

    return P;
  }

  /* ============================================== the point system */

  function makeState() {
    const shape = buildRobot();
    const n = shape.length;

    // The training formation: the same points, arranged as layers.
    // Sharing one array is the point — the robot is not drawn over the
    // network, it *is* the network after it has moved.
    const spread = [0.14, 0.21, 0.24, 0.23, 0.18];
    const layers = [];
    let used = 0;
    spread.forEach((frac, i) => {
      const count = i === spread.length - 1 ? n - used : Math.round(n * frac);
      layers.push(count);
      used += count;
    });

    const nodes = [];
    let k = 0;
    layers.forEach((count, li) => {
      const lx = -230 + (li * 460) / (layers.length - 1);
      for (let j = 0; j < count; j++) {
        const s = shape[k];
        const ly = count === 1 ? 0 : -190 + (j * 380) / (count - 1);
        nodes.push({
          nx: lx, ny: ly,               // where it sits while training
          rx: s.x, ry: s.y,             // where it sits as the robot
          x: lx, y: ly,                 // where it is being drawn
          ox: 0, oy: 0,                 // live offset (mouse, breathing)
          tag: s.tag,
          layer: li,
          delay: Math.random(),
          phase: Math.random() * Math.PI * 2
        });
        k++;
      }
    });

    // edges of the trained network: each node to a few in the next layer
    const netEdges = [];
    let start = 0;
    for (let li = 0; li < layers.length - 1; li++) {
      const aStart = start;
      const aEnd = start + layers[li];
      const bStart = aEnd;
      const bEnd = bStart + layers[li + 1];
      for (let a = aStart; a < aEnd; a++) {
        const links = 2 + Math.floor(Math.random() * 2);
        for (let t = 0; t < links; t++) {
          const b = bStart + Math.floor(Math.random() * (bEnd - bStart));
          netEdges.push([a, b, 0.35 + Math.random() * 0.5]);
        }
      }
      start = aEnd;
    }

    // edges of the robot: neighbours in space, which traces the outline
    // and cross-links it into something that still reads as a network
    const robEdges = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const d = Math.hypot(nodes[i].rx - nodes[j].rx, nodes[i].ry - nodes[j].ry);
        if (d < 26) robEdges.push([i, j, 1 - d / 26]);
      }
    }

    // signals travelling through the network during training
    const pulses = [];
    for (let i = 0; i < 46; i++) {
      pulses.push({ e: Math.floor(Math.random() * netEdges.length), t: Math.random(), v: 0.006 + Math.random() * 0.012 });
    }

    return { nodes, netEdges, robEdges, pulses, layers };
  }

  /* ======================================================== sound */

  let actx = null;
  function audio() {
    if (window.SFX && window.SFX.enabled === false) return null;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!actx) actx = new AC();
      if (actx.state === 'suspended') actx.resume().catch(() => {});
      return actx;
    } catch { return null; }
  }

  function blip(freq = 880, dur = 0.05, gain = 0.05, type = 'square') {
    const c = audio();
    if (!c) return;
    try {
      const t = c.currentTime;
      const o = c.createOscillator();
      const g = c.createGain();
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 2600;
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f).connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch { /* decoration only */ }
  }

  /* ========================================================= the DOM */

  function buildStage() {
    const el = document.createElement('div');
    el.className = 'neuro';
    el.id = 'neuroStage';
    el.innerHTML = `
      <canvas class="neuro-canvas" id="neuroCanvas" aria-hidden="true"></canvas>
      <div class="neuro-ui">
        <div class="neuro-hud" id="neuroHud">
          <span class="nh-row"><b>epoch</b><i id="nhEpoch">000/060</i></span>
          <span class="nh-row"><b>loss</b><i id="nhLoss">2.9814</i></span>
          <span class="nh-row"><b>acc</b><i id="nhAcc">0.0000</i></span>
          <span class="nh-bar"><u id="nhBar"></u></span>
        </div>
        <p class="neuro-say" id="neuroSay" role="status" aria-live="polite"></p>
        <button class="neuro-go" id="neuroGo" type="button" hidden>
          <span>scroll down</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 5v14M6 13l6 6 6-6"/></svg>
        </button>
        <button class="neuro-skip" id="neuroSkip" type="button">skip intro</button>
      </div>`;
    document.body.appendChild(el);
    return el;
  }

  /* ========================================================= the run */

  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  const NEURO = {
    started: false,
    ended: false,
    state: null,
    raf: 0,

    start() {
      if (this.started) return;
      this.started = true;

      const short = (() => {
        try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
      })();

      const T = reduced
        ? { train: 200, morph: 200, greet: 200, hold: 400 }
        : short
          ? { train: 1400, morph: 900, greet: 1500, hold: 2600 }
          : { train: 5200, morph: 1700, greet: 3400, hold: 7000 };

      const stage = buildStage();
      const canvas = stage.querySelector('#neuroCanvas');
      const ctx = canvas.getContext('2d');
      const hud = stage.querySelector('#neuroHud');
      const say = stage.querySelector('#neuroSay');
      const go = stage.querySelector('#neuroGo');
      const skip = stage.querySelector('#neuroSkip');
      const st = makeState();
      this.state = st;

      document.body.classList.add('neuro-intro');

      /* ---------------------------------------------------- sizing */
      let W = 0;
      let H = 0;
      let scale = 1;
      let cx = 0;
      let cy = 0;
      const fit = () => {
        const dpr = Math.min(2, devicePixelRatio || 1);
        W = innerWidth;
        H = innerHeight;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        scale = Math.min(W / 620, H / 640, 1.25);
        cx = W / 2;
        cy = H / 2;
      };
      fit();
      addEventListener('resize', fit);

      /* ----------------------------------------------------- mouse */
      const mouse = { x: 0, y: 0, has: false };
      addEventListener('pointermove', (e) => {
        mouse.x = (e.clientX - cx) / (W / 2);
        mouse.y = (e.clientY - cy) / (H / 2);
        mouse.has = true;
      }, { passive: true });

      /* ------------------------------------------------- the phases
         One clock, read every frame, rather than a chain of timeouts:
         a background tab throttles frames, and with timeouts the
         phases would drift apart from what is actually on screen. */
      const t0 = performance.now();
      let phase = 'train';
      let greeted = false;
      let invited = false;
      let bgAt = 0;

      const LINE1 = 'HELLO. WELCOME TO MY WORLD.';
      const LINE2 = 'I am the network Read trained. Scroll down and I will show you his work.';
      let typed = 0;
      let lastTick = 0;

      /* ------------------------------------------------------ HUD */
      const nhEpoch = stage.querySelector('#nhEpoch');
      const nhLoss = stage.querySelector('#nhLoss');
      const nhAcc = stage.querySelector('#nhAcc');
      const nhBar = stage.querySelector('#nhBar');
      let lastEpoch = -1;

      const finish = () => {
        if (this.ended) return;
        this.ended = true;
        try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
        stage.classList.add('done');
        document.body.classList.remove('neuro-intro');
        document.body.classList.add('neuro-bg');
        bgAt = performance.now();
        phase = 'bg';
        blip(520, 0.12, 0.05, 'sine');
        document.dispatchEvent(new CustomEvent('neuro:done'));
      };

      const leave = () => {
        if (phase === 'bg') return;
        finish();
      };

      skip.addEventListener('click', leave);
      go.addEventListener('click', () => {
        leave();
        setTimeout(() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' }), 260);
      });
      addEventListener('wheel', leave, { passive: true });
      addEventListener('touchmove', leave, { passive: true });
      addEventListener('keydown', (e) => {
        if (['Escape', 'Enter', ' ', 'ArrowDown', 'PageDown'].includes(e.key)) leave();
      });

      /* ---------------------------------------------------- drawing */
      // A canvas cannot read a stylesheet, so the two colours are copied
      // out of it. Re-read them when the theme attribute changes rather
      // than on a custom event: nothing on this page emits one, and a
      // listener for an event that is never fired is a silent failure.
      let node = '224,85,59';
      let link = '241,238,231';
      const readColours = () => {
        const c = getComputedStyle(document.documentElement);
        node = c.getPropertyValue('--neuro-node').trim() || node;
        link = c.getPropertyValue('--neuro-link').trim() || link;
      };
      readColours();
      new MutationObserver(readColours).observe(document.documentElement, {
        attributes: true, attributeFilter: ['data-theme', 'data-mode']
      });

      let lastPaint = 0;
      const draw = (now) => {
        this.raf = requestAnimationFrame(draw);
        // as wallpaper it does not need 60fps, and the visitor is
        // reading, not watching
        if (phase === 'bg' && now - lastPaint < 33) return;
        lastPaint = now;
        const el = now - t0;
        ctx.clearRect(0, 0, W, H);

        /* ---- where are we in the story ---- */
        let morph = 0;
        if (el > T.train) morph = clamp01((el - T.train) / T.morph);
        if (phase === 'train' && morph > 0) phase = 'morph';
        if (phase === 'morph' && morph >= 1) { phase = 'greet'; }

        /* ---- the training read-out ---- */
        if (phase === 'train') {
          const p = clamp01(el / T.train);
          const epoch = Math.floor(p * 60);
          if (epoch !== lastEpoch) {
            lastEpoch = epoch;
            nhEpoch.textContent = String(epoch).padStart(3, '0') + '/060';
            // a loss curve that falls fast and then grinds, with noise
            const loss = 2.98 * Math.exp(-3.1 * p) + 0.06 + Math.random() * 0.03;
            const acc = clamp01(1 - Math.exp(-3.4 * p)) * 0.9843;
            nhLoss.textContent = loss.toFixed(4);
            nhAcc.textContent = acc.toFixed(4);
            nhBar.style.width = (p * 100).toFixed(1) + '%';
            if (epoch % 6 === 0) blip(300 + p * 700, 0.03, 0.028);
          }
        } else if (!hud.classList.contains('out')) {
          hud.classList.add('out');
          nhEpoch.textContent = '060/060';
          nhLoss.textContent = '0.0614';
          nhAcc.textContent = '0.9843';
        }

        /* ---- the greeting ---- */
        if (phase === 'greet' && !greeted) {
          greeted = true;
          say.classList.add('show');
        }
        if (greeted && typed < LINE1.length + LINE2.length + 1) {
          const per = T.greet / (LINE1.length + LINE2.length + 1);
          const want = Math.floor((el - T.train - T.morph) / per);
          if (want > typed) {
            typed = Math.min(want, LINE1.length + LINE2.length + 1);
            const a = LINE1.slice(0, Math.min(typed, LINE1.length));
            const b = typed > LINE1.length ? LINE2.slice(0, typed - LINE1.length - 1) : '';
            say.innerHTML = `<b>${a}</b>${b ? '<span>' + b + '</span>' : ''}`;
            if (now - lastTick > 28) {
              lastTick = now;
              blip(1400 + Math.random() * 500, 0.018, 0.02);
            }
          }
        }

        /* ---- the invitation ---- */
        if (!invited && el > T.train + T.morph + T.greet) {
          invited = true;
          go.hidden = false;
          requestAnimationFrame(() => go.classList.add('show'));
        }
        if (invited && !this.ended && el > T.train + T.morph + T.greet + T.hold) finish();

        /* ---- background settling ---- */
        let bg = 0;
        if (phase === 'bg') bg = clamp01((now - bgAt) / 1100);

        /* ---- positions ---- */
        const speaking = greeted && typed < LINE1.length + LINE2.length;
        const em = easeInOut(morph);
        const bgE = easeOut(bg);
        const viewScale = scale * (1 - bgE * 0.24);
        const originX = cx + bgE * (W * 0.22);
        const originY = cy - bgE * (H * 0.02);
        const mx = mouse.has ? mouse.x : 0;
        const my = mouse.has ? mouse.y : 0;

        const N = st.nodes;
        for (let i = 0; i < N.length; i++) {
          const p = N[i];
          // each node leaves at a slightly different moment, so the
          // formation dissolves rather than snapping
          const d = clamp01((em - p.delay * 0.35) / 0.65);
          const e = easeInOut(d);
          const bx = p.nx + (p.rx - p.nx) * e;
          const by = p.ny + (p.ry - p.ny) * e;

          let ox = Math.sin(now / 1400 + p.phase) * (1.6 + 2.4 * (1 - e));
          let oy = Math.cos(now / 1600 + p.phase) * (1.6 + 2.4 * (1 - e));

          // the head turns towards the pointer; the eyes lead it
          if (e > 0.4) {
            const head = p.tag === 'head' || p.tag === 'eyeL' || p.tag === 'eyeR' || p.tag === 'mouth';
            if (head) { ox += mx * 13 * e; oy += my * 7 * e; }
            if (p.tag === 'eyeL' || p.tag === 'eyeR') { ox += mx * 7; oy += my * 5; }
            if (p.tag === 'mouth' && speaking) oy += Math.sin(now / 55 + p.x * 0.4) * 3.4;
            if (p.tag === 'core') {
              const b = 1 + Math.sin(now / 620) * 0.06;
              ox += p.rx * (b - 1) * 4;
              oy += p.ry * (b - 1) * 4;
            }
          }

          p.x = originX + (bx + ox) * viewScale;
          p.y = originY + (by + oy) * viewScale;
        }

        /* ---- edges ---- */
        const netA = 1 - em;
        const robA = em;
        const fade = 1 - bgE * 0.62;

        if (netA > 0.01) {
          ctx.lineWidth = 1;
          for (let i = 0; i < st.netEdges.length; i++) {
            const [a, b, w] = st.netEdges[i];
            ctx.strokeStyle = `rgba(${link},${(0.1 * w * netA * fade).toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(N[a].x, N[a].y);
            ctx.lineTo(N[b].x, N[b].y);
            ctx.stroke();
          }
          // signals running forward through the net
          for (let i = 0; i < st.pulses.length; i++) {
            const s = st.pulses[i];
            s.t += s.v;
            if (s.t > 1) { s.t = 0; s.e = Math.floor(Math.random() * st.netEdges.length); }
            const [a, b] = st.netEdges[s.e];
            const x = N[a].x + (N[b].x - N[a].x) * s.t;
            const y = N[a].y + (N[b].y - N[a].y) * s.t;
            ctx.fillStyle = `rgba(${node},${(0.75 * netA * fade).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(x, y, 1.9, 0, 6.284);
            ctx.fill();
          }
        }

        if (robA > 0.01) {
          ctx.lineWidth = 1;
          const step = phase === 'bg' ? 2 : 1;   // half the lines once it is scenery
          for (let i = 0; i < st.robEdges.length; i += step) {
            const [a, b, w] = st.robEdges[i];
            ctx.strokeStyle = `rgba(${link},${(0.22 * w * robA * fade).toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(N[a].x, N[a].y);
            ctx.lineTo(N[b].x, N[b].y);
            ctx.stroke();
          }
        }

        /* ---- nodes ---- */
        for (let i = 0; i < N.length; i++) {
          const p = N[i];
          const eye = p.tag === 'eyeL' || p.tag === 'eyeR';
          const core = p.tag === 'core';
          const hot = (eye || core) && robA > 0.5;
          const r = (hot ? 2.5 : 1.7) * viewScale * (hot ? 1 : 0.9);
          const alpha = (hot ? 0.95 : 0.5 + 0.35 * robA) * fade;
          ctx.fillStyle = hot
            ? `rgba(${node},${alpha.toFixed(3)})`
            : `rgba(${link},${(alpha * 0.7).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.7, r), 0, 6.284);
          ctx.fill();
        }
      };

      this.raf = requestAnimationFrame(draw);
      if (reduced) setTimeout(finish, 500);
    },

    stop() {
      cancelAnimationFrame(this.raf);
      document.getElementById('neuroStage')?.remove();
      document.body.classList.remove('neuro-intro', 'neuro-bg');
      this.started = false;
      this.ended = false;
    }
  };

  window.NEURO = NEURO;
  document.dispatchEvent(new CustomEvent('neuro:ready'));
})();
