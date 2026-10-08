(() => {
  const { $, $$, esc, reduced, clamp, lerp, low } = window.__sc2;

  const SPANS = { sm: { col: 1, row: 1 }, wide: { col: 2, row: 1 }, tall: { col: 1, row: 2 }, lg: { col: 2, row: 2 } };
  const overlaps = (a, b) => a.col < b.col + b.w && b.col < a.col + a.w && a.row < b.row + b.h && b.row < a.row + a.h;
  const contains = (o, i) => i.col >= o.col && i.row >= o.row && i.col + i.w <= o.col + o.w && i.row + i.h <= o.row + o.h;
  const spanOf = (item, columns) => ({ w: Math.min(SPANS[item.size].col, columns), h: SPANS[item.size].row });

  function layout(items, columns) {
    if (columns < 1 || !items.length) return [];
    return tile(items, columns) || pack(items, columns);
  }
  function tile(items, columns) {
    const spans = items.map((it) => spanOf(it, columns));
    const area = spans.reduce((n, s) => n + s.w * s.h, 0);
    const rows = Math.ceil(area / columns);
    const grid = new Array(rows * columns).fill(false);
    const used = new Array(items.length).fill(false);
    const out = [];
    let budget = 20000;
    const fits = (w, h, r, c) => {
      if (c + w > columns || r + h > rows) return false;
      for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (grid[y * columns + x]) return false;
      return true;
    };
    const mark = (w, h, r, c, v) => { for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) grid[y * columns + x] = v; };
    const place = (count) => {
      if (count === items.length) return true;
      if (--budget < 0) return false;
      const i = grid.indexOf(false);
      if (i < 0) return false;
      const r = Math.floor(i / columns), c = i % columns;
      const tried = new Set();
      for (let k = 0; k < items.length; k++) {
        if (used[k]) continue;
        const { w, h } = spans[k];
        const shape = w + 'x' + h;
        if (tried.has(shape) || !fits(w, h, r, c)) continue;
        tried.add(shape);
        used[k] = true; mark(w, h, r, c, true);
        out.push({ id: items[k].id, col: c, row: r, w, h });
        if (place(count + 1)) return true;
        out.pop(); mark(w, h, r, c, false); used[k] = false;
      }
      return false;
    };
    return place(0) ? out : null;
  }
  function pack(items, columns) {
    const out = [];
    let row = 0;
    let queue = items.map((it) => ({ id: it.id, ...spanOf(it, columns) }));
    while (queue.length) {
      const height = Math.max(...queue.slice(0, columns).map((q) => q.h));
      const cells = new Array(height * columns).fill(false);
      const band = [], rest = [];
      for (const q of queue) {
        let spot = -1;
        for (let i = 0; i < cells.length && spot < 0; i++) {
          const r = Math.floor(i / columns), c = i % columns;
          if (c + q.w > columns || r + q.h > height) continue;
          let free = true;
          for (let y = r; y < r + q.h && free; y++) for (let x = c; x < c + q.w && free; x++) if (cells[y * columns + x]) free = false;
          if (free) spot = i;
        }
        if (spot < 0 || rest.length) { rest.push(q); continue; }
        const r = Math.floor(spot / columns), c = spot % columns;
        for (let y = r; y < r + q.h; y++) for (let x = c; x < c + q.w; x++) cells[y * columns + x] = true;
        band.push({ id: q.id, col: c, row: r, w: q.w, h: q.h });
      }
      for (let i = 0; i < cells.length; i++) {
        if (cells[i]) continue;
        const r = Math.floor(i / columns), c = i % columns;
        const left = band.find((p) => p.col + p.w === c && p.row <= r && p.row + p.h > r && p.h === 1);
        const above = band.find((p) => p.row + p.h === r && p.col === c && p.w === 1);
        const grow = left || above;
        if (!grow) continue;
        if (grow === left) grow.w += 1; else grow.h += 1;
        cells[i] = true;
      }
      out.push(...band.map((p) => ({ ...p, row: p.row + row })));
      row += height;
      queue = rest;
    }
    return out;
  }
  function canonical(items, columns) {
    const places = layout(items, columns);
    if (places.length !== items.length) return items;
    const byId = new Map(items.map((it) => [it.id, it]));
    const sorted = [...places].sort((a, b) => a.row - b.row || a.col - b.col).map((p) => byId.get(p.id));
    if (sorted.every((it, i) => it === items[i])) return items;
    const at = new Map(places.map((p) => [p.id, p]));
    const same = layout(sorted, columns).every((p) => {
      const q = at.get(p.id);
      return q && q.col === p.col && q.row === p.row && q.w === p.w && q.h === p.h;
    });
    return same ? sorted : items;
  }
  function moveTo(items, id, index) {
    const from = items.findIndex((it) => it.id === id);
    if (from < 0 || from === index || index < 0 || index >= items.length) return items;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(index, 0, moved);
    return next;
  }
  const sameOrder = (a, b) => a.length === b.length && a.every((it, i) => it.id === b[i].id);
  const ENTER = 0.18;
  function choose(home, candidates, cx, cy) {
    const distance = (s, inset) => {
      const ix = (s.right - s.left) * inset, iy = (s.bottom - s.top) * inset;
      const dx = Math.max(s.left + ix - cx, 0, cx - (s.right - ix));
      const dy = Math.max(s.top + iy - cy, 0, cy - (s.bottom - iy));
      return Math.hypot(dx, dy);
    };
    const toCentre = (s) => Math.hypot((s.left + s.right) / 2 - cx, (s.top + s.bottom) / 2 - cy);
    let best = distance(home, 0);
    if (best === 0) return null;
    let pick = null, bestCentre = Infinity;
    for (const { order, slot } of candidates) {
      const d = distance(slot, ENTER), c = toCentre(slot);
      if (d < best || (d === best && pick && c < bestCentre)) { best = d; bestCentre = c; pick = order; }
    }
    return pick;
  }
  function candidatesFor(items, id, columns, toSlot) {
    const places = layout(items, columns);
    const me = places.find((p) => p.id === id);
    if (!me) return [];
    const byId = new Map(items.map((it) => [it.id, it]));
    const rows = Math.max(...places.map((p) => p.row + p.h));
    const out = [];
    for (let row = 0; row + me.h <= rows; row++) {
      for (let col = 0; col + me.w <= columns; col++) {
        const area = { col, row, w: me.w, h: me.h };
        if (overlaps(area, me)) continue;
        const group = places.filter((p) => overlaps(p, area));
        if (group.length < 2 || !group.every((p) => contains(area, p))) continue;
        const moved = places.map((p) => p.id === id ? { ...p, col, row }
          : group.includes(p) ? { ...p, col: p.col - col + me.col, row: p.row - row + me.row } : p);
        moved.sort((a, b) => a.row - b.row || a.col - b.col);
        out.push({ order: moved.map((p) => byId.get(p.id)), slot: toSlot(area) });
      }
    }
    const from = items.findIndex((it) => it.id === id);
    for (let i = 0; i < items.length; i++) {
      if (i === from) continue;
      const order = moveTo(items, id, i);
      const p = layout(order, columns).find((q) => q.id === id);
      if (p) out.push({ order, slot: toSlot(p) });
    }
    return out;
  }

  const bento = (() => {
    const KEY = 'rp_bento_order';
    const GAP = 14, CELL = 250;
    let grid, items = [], columns = 4, unit = 200, rowH = 200, els = new Map();
    let drag = null, lastMove = 0, frame = 0;

    const widgetHTML = (w) => {
      if (w.kind === 'group') {
        return `<h3 class="bw-title">${esc(w.data.category)}</h3>
          <ul class="bw-bars">${(w.data.items || []).map((it) => `<li>
            <span class="bw-name">${esc(it.name)}</span><em>${esc(it.level)}%</em>
            <span class="bw-bar"><i style="--lv:${clamp(Number(it.level) || 0, 0, 100)}%"></i></span></li>`).join('')}</ul>`;
      }
      if (w.kind === 'top') {
        return `<p class="bw-label">Top skill · ${String(w.rank).padStart(2, '0')}</p>
          <p class="bw-big">${esc(w.data.level)}<small>%</small></p>
          <p class="bw-sub"><b>${esc(w.data.name)}</b><span>${esc(w.data.category)}</span></p>
          <span class="bw-ring" style="--lv:${clamp(Number(w.data.level) || 0, 0, 100)}"></span>`;
      }
      return `<p class="bw-label">Languages</p>
        <ul class="bw-langs">${w.data.map((l) => `<li><b>${esc(l.name)}</b><span>${esc(l.level)}</span></li>`).join('')}</ul>`;
    };

    function build(c) {
      grid = $('#skillGrid');
      if (!grid) return;
      const groups = (c.skills || []).filter((g) => g && g.category);
      const all = [];
      groups.forEach((g) => (g.items || []).forEach((it) => all.push({ ...it, category: g.category })));
      const tops = [...all].sort((a, b) => (Number(b.level) || 0) - (Number(a.level) || 0)).slice(0, 3);
      const langs = (c.languages || []).filter((l) => l && l.name);

      const widgets = [];
      groups.forEach((g, i) => widgets.push({ id: 'g' + i, kind: 'group', size: (g.items || []).length > 5 ? 'lg' : 'wide', data: g, label: g.category }));
      tops.forEach((t, i) => widgets.push({ id: 't' + i, kind: 'top', size: 'sm', data: t, rank: i + 1, label: t.name + ' ' + t.level + '%' }));
      if (langs.length) widgets.push({ id: 'lang', kind: 'lang', size: 'sm', data: langs, label: 'Languages' });

      const g = widgets.filter((w) => w.kind === 'group'), s = widgets.filter((w) => w.kind !== 'group');
      let order = [];
      if (g[0]) order.push(g[0]); order.push(...s.slice(0, 2));
      if (g[1]) order.push(g[1]); if (g[2]) order.push(g[2]);
      order.push(...s.slice(2)); order.push(...g.slice(3));
      order = order.filter(Boolean);

      try {
        const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (Array.isArray(saved) && saved.length === order.length && saved.every((id) => order.some((w) => w.id === id))) {
          order = saved.map((id) => order.find((w) => w.id === id));
        }
      } catch {  }
      items = order;

      grid.classList.add('bento');
      grid.setAttribute('role', 'list');
      grid.innerHTML = '';
      els = new Map();
      items.forEach((w, i) => {
        const n = document.createElement('div');
        n.className = 'bw bw-' + w.kind;
        n.dataset.id = w.id;
        n.setAttribute('role', 'listitem');
        n.tabIndex = 0;
        n.setAttribute('aria-label', w.label);
        n.setAttribute('aria-describedby', 'bentoHint');
        n.style.setProperty('--delay', (i * 0.05) + 's');
        n.innerHTML = `<div class="bw-face">${widgetHTML(w)}</div>`;
        grid.appendChild(n);
        els.set(w.id, n);
        bind(n, w.id);
      });
      const hint = $('#bentoHint');
      if (hint) {
        const touch = matchMedia('(pointer: coarse)').matches;
        hint.innerHTML = touch
          ? '<span class="scroll-cue-inline">Press and hold a card, then drag to rearrange</span>'
          : '<span class="scroll-cue-inline">Drag the cards to rearrange them · Alt + arrows with a keyboard</span>';
      }
      measure(true);
      new IntersectionObserver((es, o) => {
        es.forEach((e) => { if (e.isIntersecting) { grid.classList.add('in'); o.disconnect(); } });
      }, { threshold: 0.15 }).observe(grid);
    }

    function measure(force) {
      if (!grid || !grid.offsetParent) return;
      const width = grid.getBoundingClientRect().width;
      if (width < 1) return;
      const cols = clamp(Math.round(width / CELL), 2, 4);
      const u = (width - GAP * (cols - 1)) / cols;
      const rh = Math.max(Math.round(u * 0.92), 236);
      if (!force && cols === columns && Math.abs(u - unit) < 0.5) return;
      columns = cols; unit = u; rowH = rh;
      grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
      grid.style.gridAutoRows = rowH + 'px';
      grid.style.gap = GAP + 'px';
      apply(false);
    }

    function apply(animate, skip) {
      const before = new Map();
      if (animate) els.forEach((n, id) => { if (id !== skip) before.set(id, n.getBoundingClientRect()); });
      layout(items, columns).forEach((p) => {
        const n = els.get(p.id);
        n.style.gridColumn = `${p.col + 1} / span ${p.w}`;
        n.style.gridRow = `${p.row + 1} / span ${p.h}`;
        n.classList.toggle('is-wide', p.w > 1);
        n.classList.toggle('is-tall', p.h > 1);
      });
      const posOrder = layout(items, columns).sort((a, b) => a.row - b.row || a.col - b.col);
      posOrder.forEach((p, i) => { const n = els.get(p.id); n.setAttribute('aria-posinset', i + 1); n.setAttribute('aria-setsize', posOrder.length); });
      if (!animate || reduced()) return;
      before.forEach((r0, id) => {
        const n = els.get(id);
        const r1 = n.getBoundingClientRect();
        const dx = r0.left - r1.left, dy = r0.top - r1.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        n.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
          { duration: 420, easing: 'cubic-bezier(.2,1.1,.3,1)' });
      });
    }

    const toSlot = (box) => {
      const r = grid.getBoundingClientRect();
      const left = r.left + box.col * (unit + GAP);
      const top = r.top + box.row * (rowH + GAP);
      return { left, top, right: left + box.w * (unit + GAP) - GAP, bottom: top + box.h * (rowH + GAP) - GAP };
    };

    function commit(next, skip) {
      items = next;
      apply(true, skip);
    }
    function save() { try { localStorage.setItem(KEY, JSON.stringify(items.map((w) => w.id))); } catch {  } }

    function follow() {
      if (!drag) return;
      const n = drag.el;
      const gr = grid.getBoundingClientRect();
      const bx = gr.left + n.offsetLeft, by = gr.top + n.offsetTop;
      const x = drag.px - drag.gx - bx, y = drag.py - drag.gy - by;
      n.style.transform = `translate(${x}px, ${y}px) scale(1.05)`;
    }

    function stepDrag(force) {
      frame = 0;
      if (!drag) return;
      const now = performance.now();
      if (!force && now - lastMove < 40) { frame = requestAnimationFrame(() => stepDrag()); return; }
      const me = layout(items, columns).find((p) => p.id === drag.id);
      if (!me) return;
      const cx = drag.px - drag.gx + drag.w / 2, cy = drag.py - drag.gy + drag.h / 2;
      const order = choose(toSlot(me), candidatesFor(items, drag.id, columns, toSlot), cx, cy);
      if (!order) return;
      lastMove = now;
      commit(canonical(order, columns), drag.id);
      follow();
    }

    function bind(n, id) {
      let press = null;
      const start = (e) => {
        const r = n.getBoundingClientRect();
        drag = { id, el: n, px: e.clientX, py: e.clientY, gx: e.clientX - r.left, gy: e.clientY - r.top, w: r.width, h: r.height, pid: e.pointerId, before: items };
        n.classList.add('lifted');
        grid.classList.add('dragging');
        try { n.setPointerCapture(e.pointerId); } catch {  }
        follow();
      };
      n.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || !e.isPrimary) return;
        if (e.pointerType !== 'touch') { e.preventDefault(); start(e); return; }
        n.classList.add('holding');
        press = { x: e.clientX, y: e.clientY, e, timer: setTimeout(() => { press = null; n.classList.remove('holding'); navigator.vibrate?.(10); start(e); }, 350) };
      });
      n.addEventListener('pointermove', (e) => {
        if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) { clearTimeout(press.timer); press = null; n.classList.remove('holding'); }
        if (!drag || drag.pid !== e.pointerId) return;
        drag.px = e.clientX; drag.py = e.clientY;
        follow();
        if (!frame) frame = requestAnimationFrame(() => stepDrag());
      });
      const end = (e) => {
        if (press) { clearTimeout(press.timer); press = null; n.classList.remove('holding'); }
        if (!drag || drag.pid !== e.pointerId) return;
        cancelAnimationFrame(frame); stepDrag(true); frame = 0;
        const d = drag; drag = null;
        grid.classList.remove('dragging');
        const from = d.el.style.transform;
        d.el.style.transform = '';
        d.el.classList.remove('lifted');
        if (!reduced() && from) d.el.animate([{ transform: from }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,1.2,.3,1)' });
        d.el.classList.add('landed');
        setTimeout(() => d.el.classList.remove('landed'), 620);
        if (!sameOrder(d.before, items)) save();
      };
      n.addEventListener('pointerup', end);
      n.addEventListener('pointercancel', end);
      n.addEventListener('touchmove', (e) => { if (drag && drag.el === n) e.preventDefault(); }, { passive: false });
      n.addEventListener('contextmenu', (e) => { if (drag || press) e.preventDefault(); });
      n.addEventListener('keydown', (e) => {
        if (!e.altKey) return;
        const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!delta) return;
        e.preventDefault(); e.stopPropagation();
        const from = items.findIndex((w) => w.id === id);
        for (let to = from + delta; to >= 0 && to < items.length; to += delta) {
          const next = canonical(moveTo(items, id, to), columns);
          if (sameOrder(next, items)) continue;
          commit(next);
          save();
          n.focus();
          return;
        }
      });
    }

    new ResizeObserver(() => measure(false)).observe(document.documentElement);
    return { build, measure: () => measure(true) };
  })();

  const LENS_FRAG = `
precision highp float;
#define PI 3.14159265
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uCenter;
uniform float uSizeX, uSizeY, uAspect, uDispersion, uGlow, uWhiteGlow, uNovaSize, uBlueRing,
  uRingRadius, uRingWidth, uShimmer, uTime, uRimStart, uRimTangential, uRimFreq1, uRimFreq2,
  uRimLine, uRimLinePos, uRimLineWidth, uRotation, uFx;
uniform vec3 uRingColor;
float sq(float x){ return x * x; }
vec3 lens(vec2 center, out float outA){
  vec2 p = vUv - center;
  p.x *= uAspect;
  float ca = cos(uRotation), sa = sin(uRotation);
  p = mat2(ca, -sa, sa, ca) * p;
  vec2 halfSize = vec2(uSizeX, uSizeY);
  float dist = length(p / halfSize);
  outA = 0.0;
  if (dist > 1.0) return vec3(0.0);
  float nd = clamp(dist, 0.0, 1.0);
  vec2 offset = vUv - center;
  vec2 radialDir = normalize(offset + 1e-6);
  vec2 tangentDir = vec2(-radialDir.y, radialDir.x);
  float angle = atan(p.y, p.x);
  float rimStrength = smoothstep(uRimStart, 1.0, nd);
  float fluidWave = sin(angle * uRimFreq1) * 0.55 + sin(angle * uRimFreq2) * 0.25;
  float rScreen = (uSizeX + uSizeY) * 0.5;
  vec2 rimOff = tangentDir * fluidWave * rimStrength * rScreen * uRimTangential * uFx;
  vec2 baseUV = center + offset + rimOff;
  float rimMask = smoothstep(0.55, 1.0, nd);
  vec2 dispDir = offset * uDispersion * uFx * 0.004 * rimMask;
  vec3 col = vec3(0.0); vec3 caW = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    float t = float(i) / 11.0;
    vec3 s = texture2D(uTex, baseUV + dispDir * (t - 0.5)).rgb;
    vec3 w = vec3(exp(-sq((t - 0.0) / 0.38)), exp(-sq((t - 0.5) / 0.38)), exp(-sq((t - 1.0) / 0.38)));
    col += s * w; caW += w;
  }
  col /= max(caW, vec3(0.001));
  col *= mix(0.91, 1.0, smoothstep(0.0, 0.38, nd));
  float r2 = nd * nd * 0.25;
  float gs = max(uNovaSize * uGlow * 0.003, 0.004);
  float nova = (exp(-r2 / gs) + exp(-r2 / (gs * 7.0)) * 0.18) * uWhiteGlow * (uGlow / 17.0) * 1.15;
  col += vec3(nova);
  float dC = nd * 0.5;
  float tR = clamp(uRingRadius, 0.1, 0.49);
  float rW = max(uRingWidth, 0.003);
  float ring = exp(-sq((dC - tR) / rW)) * uBlueRing * uFx * (uGlow / 17.0) * 1.8;
  ring *= sin(angle * 12.0 + uTime * 3.5) * 0.12 * uShimmer + (1.0 - 0.12 * uShimmer);
  float aura = exp(-sq((dC - tR) / (rW * 6.0))) * 0.28 * uBlueRing * uFx * (uGlow / 17.0);
  col += uRingColor * (ring + aura);
  col += vec3(exp(-sq((dC - uRimLinePos) / max(uRimLineWidth, 0.0001))) * uRimLine * uFx);
  outA = smoothstep(1.0, 0.93, dist);
  return col;
}
void main(){
  vec3 base = texture2D(uTex, vUv).rgb;
  float a = 0.0;
  vec3 c = lens(uCenter, a);
  gl_FragColor = vec4(mix(base, c, a), 1.0);
}`;
  const LENS_VERT = 'attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }';

  const glass = (() => {
    let host, stage, row, rctx, gl, prog, tex, U = {}, raf = 0, visible = false;
    let items = [], cards = [], W = 0, H = 0, dpr = 1, PANEL = 400, GAP = 14, ASPECT = 3 / 4;
    let scroll = 0, target = 0, vel = 0, lastInput = 0, snapped = true, energy = 0, prev = 0;
    let focus = { on: false, idx: -1, amt: 0, fx: 1 }, active = -1;
    let dragging = null, suppress = false;

    const slotW = () => ASPECT * PANEL + GAP;
    const total = () => slotW() * items.length;
    const centerFor = (i) => i * slotW();
    const nearest = (v) => Math.round(v / slotW());
    const mod = (a, n) => ((a % n) + n) % n;

    function drawCard(e, i, img) {
      const cw = 600, ch = 800;
      const c = document.createElement('canvas');
      c.width = cw; c.height = ch;
      const x = c.getContext('2d');
      const hues = ['#C3E41D', '#ffb829', '#15846e', '#e05cff', '#4f8bff'];
      const a = hues[i % hues.length];
      x.fillStyle = '#0b0a10'; x.fillRect(0, 0, cw, ch);
      let g = x.createRadialGradient(cw * 0.85, ch * 0.1, 10, cw * 0.85, ch * 0.1, cw * 0.9);
      g.addColorStop(0, a + '66'); g.addColorStop(1, a + '00');
      x.fillStyle = g; x.fillRect(0, 0, cw, ch);
      g = x.createRadialGradient(0, ch, 10, 0, ch, cw);
      g.addColorStop(0, 'rgba(195,228,29,.30)'); g.addColorStop(1, 'rgba(195,228,29,0)');
      x.fillStyle = g; x.fillRect(0, 0, cw, ch);
      x.strokeStyle = 'rgba(255,255,255,.14)'; x.lineWidth = 2;
      x.strokeRect(22, 22, cw - 44, ch - 44);
      if (img) {
        const s = Math.min(260 / img.width, 220 / img.height);
        const iw = img.width * s, ih = img.height * s;
        x.fillStyle = '#fff';
        x.beginPath(); x.roundRect ? x.roundRect(cw / 2 - iw / 2 - 18, 70, iw + 36, ih + 36, 18) : x.rect(cw / 2 - iw / 2 - 18, 70, iw + 36, ih + 36); x.fill();
        x.drawImage(img, cw / 2 - iw / 2, 88, iw, ih);
      } else {
        x.fillStyle = a;
        x.font = document.documentElement.lang === 'ar' ? "700 230px 'Amiri', serif" : "400 300px 'Italianno', 'Caveat', cursive";
        x.textAlign = 'center';
        const nm = String(e.school || e.degree || '?').trim();
        const glyph = document.documentElement.lang === 'ar' && /^جامعة\s/.test(nm) ? nm.split(/\s+/).pop().charAt(0) : nm.charAt(0).toUpperCase();
        x.fillText(glyph, cw / 2, 290);
      }
      const AR = document.documentElement.lang === 'ar';
      const edge = AR ? cw - 56 : 56;
      if (AR) x.direction = 'rtl';
      x.textAlign = AR ? 'right' : 'left';
      x.fillStyle = a;
      x.font = AR ? "500 22px 'JetBrains Mono', 'Noto Kufi Arabic', monospace" : "500 22px 'JetBrains Mono', monospace";
      x.fillText(String(e.period || '').toUpperCase(), edge, 440);
      x.fillStyle = '#ffffff';
      x.font = AR ? "700 62px 'Amiri', serif" : "400 96px 'Italianno', 'Caveat', cursive";
      const words = String(e.degree || '').split(/\s+/);
      const lines = [''];
      words.forEach((w) => {
        const t = (lines[lines.length - 1] + ' ' + w).trim();
        if (x.measureText(t).width > cw - 112 && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = t;
      });
      const step = AR ? 92 : 70;
      lines.slice(0, AR ? 3 : 4).forEach((l, k) => x.fillText(l, edge, (AR ? 530 : 516) + k * step));
      x.fillStyle = '#bdbdbd';
      x.font = AR ? "400 30px 'Amiri', serif" : "400 28px 'Bodoni Moda', Georgia, serif";
      x.fillText(String(e.school || ''), edge, ch - 70);
      return c;
    }

    function initGL() {
      const cv = document.createElement('canvas');
      cv.className = 'lg-gl';
      cv.setAttribute('aria-hidden', 'true');
      const g = cv.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false });
      if (!g) return null;
      const sh = (type, src) => {
        const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s);
        if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s));
        return s;
      };
      try {
        prog = g.createProgram();
        g.attachShader(prog, sh(g.VERTEX_SHADER, LENS_VERT));
        g.attachShader(prog, sh(g.FRAGMENT_SHADER, LENS_FRAG));
        g.linkProgram(prog);
        if (!g.getProgramParameter(prog, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(prog));
      } catch (err) { console.warn('Glass lens unavailable:', err); return null; }
      g.useProgram(prog);
      const buf = g.createBuffer();
      g.bindBuffer(g.ARRAY_BUFFER, buf);
      g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
      const loc = g.getAttribLocation(prog, 'aPos');
      g.enableVertexAttribArray(loc);
      g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
      tex = g.createTexture();
      g.bindTexture(g.TEXTURE_2D, tex);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
      g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
      ['uTex', 'uCenter', 'uSizeX', 'uSizeY', 'uAspect', 'uDispersion', 'uGlow', 'uWhiteGlow', 'uNovaSize', 'uBlueRing',
        'uRingRadius', 'uRingWidth', 'uShimmer', 'uTime', 'uRimStart', 'uRimTangential', 'uRimFreq1', 'uRimFreq2',
        'uRimLine', 'uRimLinePos', 'uRimLineWidth', 'uRotation', 'uFx', 'uRingColor'].forEach((n) => { U[n] = g.getUniformLocation(prog, n); });
      g.uniform1i(U.uTex, 0);
      g.uniform2f(U.uCenter, 0.5, 0.5);
      g.uniform1f(U.uSizeX, 0.565); g.uniform1f(U.uSizeY, 1);
      g.uniform1f(U.uDispersion, 11); g.uniform1f(U.uGlow, 4.2); g.uniform1f(U.uWhiteGlow, 0.24);
      g.uniform1f(U.uNovaSize, 12); g.uniform1f(U.uBlueRing, 6); g.uniform1f(U.uRingRadius, 0.49);
      g.uniform1f(U.uRingWidth, 0.014); g.uniform1f(U.uShimmer, reduced() ? 0 : 1);
      g.uniform1f(U.uRimStart, 0.578); g.uniform1f(U.uRimTangential, 0.6);
      g.uniform1f(U.uRimFreq1, 2); g.uniform1f(U.uRimFreq2, 1);
      g.uniform1f(U.uRimLine, 1.4); g.uniform1f(U.uRimLinePos, 0.488); g.uniform1f(U.uRimLineWidth, 0.003);
      g.uniform1f(U.uRotation, (65 * Math.PI) / 180);
      g.uniform3f(U.uRingColor, 0x80 / 255, 0x52 / 255, 1);
      gl = g;
      return cv;
    }

    function size() {
      if (!stage) return;
      dpr = Math.min(devicePixelRatio || 1, low() ? 1 : 1.5);
      W = stage.clientWidth; H = stage.clientHeight;
      PANEL = clamp(Math.round(H * 0.56), 180, 470);
      row.width = W * dpr; row.height = H * dpr;
      rctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (gl) {
        gl.canvas.width = W * dpr; gl.canvas.height = H * dpr;
        gl.viewport(0, 0, W * dpr, H * dpr);
        gl.uniform1f(U.uAspect, W / H);
      }
    }

    async function build(c) {
      host = $('#glass');
      const list = (c.education || []).filter((e) => e && (e.degree || e.school));
      if (!host || !list.length) return;
      items = list;
      host.innerHTML = `
        <div class="lg-stage" tabindex="0" role="region" aria-roledescription="carousel" aria-label="Education">
          <p class="lg-title" aria-live="polite"></p>
          <p class="lg-count"></p>
          <div class="lg-cursor" aria-hidden="true">View</div>
          <div class="lg-detail" hidden>
            <button type="button" class="lg-close">Close</button>
            <p class="lg-period"></p><h3></h3><p class="lg-school"></p><p class="lg-note"></p>
          </div>
          <div class="scroll-cue lg-cue" aria-hidden="true"><span>${matchMedia('(pointer: coarse)').matches ? 'Swipe sideways · tap the middle card' : 'Drag or scroll sideways · click the card in the lens'}</span></div>
        </div>`;
      stage = $('.lg-stage', host);
      row = document.createElement('canvas');
      rctx = row.getContext('2d');
      const glCanvas = window.WebGLRenderingContext ? initGL() : null;
      const shown = glCanvas || row;
      shown.classList.add('lg-canvas');
      stage.insertBefore(shown, stage.firstChild);
      host.classList.toggle('no-gl', !glCanvas);
      $('#eduGrid')?.classList.add('lg-hidden');

      try { await document.fonts?.load("400 96px 'Italianno'"); } catch {  }
      if (document.documentElement.lang === 'ar') {
        try { await Promise.all([document.fonts.load("700 64px 'Amiri'"), document.fonts.load("400 28px 'Amiri'"), document.fonts.load("500 22px 'Noto Kufi Arabic'")]); } catch {  }
      }
      const imgs = await Promise.all(items.map((e) => new Promise((res) => {
        if (!e.image) return res(null);
        const im = new Image();
        im.onload = () => res(im); im.onerror = () => res(null);
        im.src = e.image;
      })));
      cards = items.map((e, i) => drawCard(e, i, imgs[i]));
      bindInput();
      ['pointerdown', 'pointermove', 'wheel', 'keydown', 'click', 'touchstart'].forEach((ev) =>
        stage.addEventListener(ev, kickLens, { passive: true }));
      new ResizeObserver(() => { size(); kickLens(); }).observe(stage);
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(tick); }).observe(stage);
      size();
      scroll = target = 0;
      setActive(0);
    }

    function setActive(i) {
      if (i === active) return;
      active = i;
      $('.lg-title', stage).textContent = items[i].degree || '';
      $('.lg-count', stage).textContent = String(i + 1).padStart(2, '0') + '/' + String(items.length).padStart(2, '0');
    }

    function panelAt(x, y) {
      const sw = slotW(), n = items.length;
      const first = Math.floor((scroll - W / 2) / sw) - 1, last = Math.ceil((scroll + W / 2) / sw) + 1;
      for (let k = first; k <= last; k++) {
        const cx = W / 2 + (k * sw - scroll);
        const w = ASPECT * PANEL, h = PANEL;
        if (x >= cx - w / 2 && x <= cx + w / 2 && y >= H / 2 - h / 2 && y <= H / 2 + h / 2) return { k, i: mod(k, n) };
      }
      return null;
    }

    function openFocus() {
      const i = mod(nearest(scroll), items.length);
      const e = items[i];
      focus.on = true; focus.idx = i;
      const d = $('.lg-detail', stage);
      $('.lg-period', d).textContent = e.period || '';
      $('h3', d).textContent = e.degree || '';
      $('.lg-school', d).textContent = e.school || '';
      $('.lg-note', d).textContent = e.note || '';
      d.hidden = false;
      requestAnimationFrame(() => d.classList.add('on'));
      stage.classList.add('focused');
    }
    function closeFocus() {
      if (!focus.on) return;
      focus.on = false;
      const d = $('.lg-detail', stage);
      d.classList.remove('on');
      setTimeout(() => { if (!focus.on) d.hidden = true; }, 350);
      stage.classList.remove('focused');
    }

    function bindInput() {
      const cursor = $('.lg-cursor', stage);
      stage.addEventListener('wheel', (e) => {
        if (focus.on) return;
        const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        e.preventDefault();
        target += d * 1.2; lastInput = performance.now(); snapped = false;
      }, { passive: false });
      stage.addEventListener('pointerdown', (e) => {
        if (focus.on || e.target.closest('.lg-detail')) return;
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        dragging = { id: e.pointerId, x: e.clientX, dist: 0, vel: 0, t: performance.now(), type: e.pointerType };
        try { stage.setPointerCapture(e.pointerId); } catch {  }
        vel = 0; snapped = false; suppress = false;
      });
      stage.addEventListener('pointermove', (e) => {
        const r = stage.getBoundingClientRect();
        if (e.pointerType === 'mouse') {
          cursor.style.transform = `translate(${e.clientX - r.left + 14}px, ${e.clientY - r.top + 14}px)`;
          const over = !focus.on && !dragging && panelAt(e.clientX - r.left, e.clientY - r.top);
          cursor.classList.toggle('on', !!over);
          stage.style.cursor = dragging ? 'grabbing' : over ? 'grab' : '';
        }
        if (!dragging || dragging.id !== e.pointerId) return;
        const dx = e.clientX - dragging.x;
        dragging.x = e.clientX; dragging.dist += Math.abs(dx);
        const k = dragging.type === 'mouse' ? 1.6 : 1;
        target -= dx * k;
        dragging.vel = dragging.vel * 0.6 - dx * k * 0.4;
        dragging.t = performance.now(); lastInput = dragging.t;
      });
      const up = (e) => {
        if (!dragging || dragging.id !== e.pointerId) return;
        vel = performance.now() - dragging.t > 90 ? 0 : dragging.vel;
        suppress = dragging.dist > (dragging.type === 'mouse' ? 6 : 12);
        dragging = null; lastInput = performance.now(); snapped = false;
      };
      stage.addEventListener('pointerup', up);
      stage.addEventListener('pointercancel', up);
      stage.addEventListener('pointerleave', () => cursor.classList.remove('on'));
      stage.addEventListener('click', (e) => {
        if (e.target.closest('.lg-close')) { closeFocus(); return; }
        if (e.target.closest('.lg-detail')) return;
        if (suppress) { suppress = false; return; }
        if (focus.on) { closeFocus(); return; }
        const r = stage.getBoundingClientRect();
        const hit = panelAt(e.clientX - r.left, e.clientY - r.top);
        if (!hit) return;
        if (hit.k === nearest(scroll) && Math.abs(target - scroll) < 4) openFocus();
        else { target = centerFor(hit.k); snapped = true; vel = 0; }
      });
      stage.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault(); e.stopPropagation();
          if (focus.on) return;
          target = centerFor(nearest(scroll) + (e.key === 'ArrowRight' ? 1 : -1)); snapped = true;
        } else if (e.key === 'Escape') { closeFocus(); }
        else if (e.key === 'Enter' && !focus.on) { openFocus(); }
      });
    }

    function paintRow() {
      const light = document.documentElement.dataset.theme === 'light';
      rctx.fillStyle = light ? '#f6f5f9' : '#000000';
      rctx.fillRect(0, 0, W, H);
      const sw = slotW(), n = items.length;
      const shrink = 1 - 0.22 * energy;
      const first = Math.floor((scroll - W / 2) / sw) - 1, last = Math.ceil((scroll + W / 2) / sw) + 1;
      const centreK = nearest(scroll);
      for (let k = first; k <= last; k++) {
        const i = mod(k, n);
        const img = cards[i];
        if (!img) continue;
        let h = PANEL * shrink, w = h * ASPECT, y = H / 2;
        const cx = W / 2 + (k * sw - scroll);
        if (k === centreK) { h *= 1 + 0.16 * focus.amt; w = h * ASPECT; }
        else {
          const rank = Math.abs(k - centreK);
          y += focus.amt * H * 1.2 * Math.min(1, 0.6 + rank * 0.25);
        }
        rctx.save();
        rctx.beginPath();
        if (rctx.roundRect) rctx.roundRect(cx - w / 2, y - h / 2, w, h, 10); else rctx.rect(cx - w / 2, y - h / 2, w, h);
        rctx.clip();
        rctx.drawImage(img, cx - w / 2, y - h / 2, w, h);
        rctx.restore();
      }
    }

    function tick(now) {
      raf = 0;
      if (!visible || !stage || !stage.offsetParent || document.hidden) return;
      if (!dragging) {
        target += vel; vel *= 0.865;
        if (Math.abs(vel) < 0.05) vel = 0;
        if (!snapped && !focus.on && now - lastInput > 120) { target = centerFor(nearest(scroll)); snapped = true; }
      }
      const ease = reduced() ? 0.3 : dragging && dragging.type !== 'mouse' ? 0.22 : snapped ? 0.07 : 0.1;
      scroll += (target - scroll) * ease;
      const speed = Math.abs(scroll - prev); prev = scroll;
      const norm = Math.min(1, speed / 60);
      energy += (norm - energy) * (norm > energy ? 0.25 : 0.06);
      focus.amt = lerp(focus.amt, focus.on ? 1 : 0, reduced() ? 1 : 0.09);
      focus.fx = lerp(focus.fx, focus.on ? 0 : 1, reduced() ? 1 : 0.08);
      setActive(mod(nearest(scroll), items.length));
      paintRow();
      if (gl) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, row);
        gl.uniform1f(U.uTime, now * 0.001);
        gl.uniform1f(U.uFx, focus.fx);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      const still = !dragging && vel === 0 && Math.abs(target - scroll) < 0.05 && energy < 0.002 &&
        Math.abs(focus.amt - (focus.on ? 1 : 0)) < 0.002 && Math.abs(focus.fx - (focus.on ? 0 : 1)) < 0.002;
      if (!still) raf = requestAnimationFrame(tick);
    }
    const kickLens = () => { if (!raf && visible) raf = requestAnimationFrame(tick); };

    return {
      build,
      wake() { if (stage) { size(); if (!raf) raf = requestAnimationFrame(tick); } },
      back() { if (focus.on) { closeFocus(); kickLens(); return true; } return false; }
    };
  })();

  const back = (() => {
    const handlers = [() => glass.back()];
    let trail = [];
    function run() {
      for (const h of handlers) { try { if (h()) return; } catch {  } }
      const here = window.PRESS?.current?.() || '';
      if (!here) return;
      trail = trail.filter((v) => v !== here);
      const prev = trail.pop() || '';
      window.PRESS?.show(prev);
    }
    document.addEventListener('view:changed', (e) => {
      const v = (e.detail && e.detail.view) || '';
      if (trail[trail.length - 1] !== v) trail.push(v);
      if (trail.length > 20) trail = trail.slice(-20);
      const b = document.getElementById('pressBack');
      if (b) b.innerHTML = '<span aria-hidden="true">←</span> Back';
    });
    window.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('#pressBack');
      if (!b) return;
      e.preventDefault(); e.stopPropagation();
      run();
    }, true);
    addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('.cmdk:not([hidden]), #chatPanel:not([hidden]), #newsPop:not([hidden]), #loginModal:not([hidden])')) return;
      if (!window.PRESS?.current?.() && !glass.back()) return;
      run();
    });
    return { run };
  })();

  const ticker = (() => {
    let band, raf = 0;
    const fmt = (d) => {
      const t = Date.parse(d);
      return Number.isFinite(t) ? new Date(t).toLocaleDateString((window.I18N && window.I18N.locale) || 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
    };
    function build(c) {
      const list = (c.announcements || [])
        .filter((a) => a && a.published !== false && (a.title || a.body))
        .sort((a, b) => (!!b.pinned !== !!a.pinned) ? (b.pinned ? 1 : -1) : String(b.date || '').localeCompare(String(a.date || '')));
      cancelAnimationFrame(raf);
      band?.remove();
      band = null;
      if (!list.length) return;

      const card = (a) => `<a class="lb-card${a.image ? ' has-img' : ''}" href="#news" data-id="${esc(a.id || '')}" title="${esc(a.title || '')}">
          ${a.image
            ? `<img src="${esc(a.image)}" alt="${esc(a.title || '')}" decoding="async" draggable="false">`
            : `<span class="lb-text">${a.tag ? `<b>${esc(a.tag)}</b>` : ''}<span>${esc(a.title || '')}</span></span>`}
          <span class="lb-cap"><span>${esc(a.title || '')}</span>${a.date ? `<time>${esc(fmt(a.date))}</time>` : ''}</span>
        </a>`;
      let items = list.slice();
      while (items.length < 8) items = items.concat(list);
      const run = items.map(card).join('');

      band = document.createElement('section');
      band.className = 'logo-band';
      band.id = 'logoBand';
      band.setAttribute('aria-label', 'Announcements');
      band.innerHTML = `
        <div class="lb-head">
          <p class="lb-kicker"><i aria-hidden="true"></i>Announcements</p>
          <div class="lb-nav">
            <button type="button" class="lb-btn" data-dir="-1" aria-label="Previous">‹</button>
            <button type="button" class="lb-btn lb-pause" aria-label="Pause the announcements" aria-pressed="false">
              <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path class="pz" d="M3.5 2v8M8.5 2v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path class="pl" d="M3 1.8 10 6 3 10.2Z" fill="currentColor"/></svg>
            </button>
            <button type="button" class="lb-btn" data-dir="1" aria-label="Next">›</button>
          </div>
        </div>
        <div class="lb-window"><div class="lb-track">
          <div class="lb-run">${run}</div><div class="lb-run" aria-hidden="true">${run}</div>
        </div></div>`;
      const footer = document.getElementById('footer');
      if (footer) footer.parentNode.insertBefore(band, footer); else document.body.appendChild(band);
      const track = $('.lb-track', band);
      const win = $('.lb-window', band);
      let period = 0;
      const fill = () => {
        const first = $('.lb-run', track);
        period = first ? first.getBoundingClientRect().width : 0;
        if (!period) return;
        const need = Math.max(2, Math.ceil(win.clientWidth / period) + 1);
        let runs = $$('.lb-run', track);
        while (runs.length < need) { track.appendChild(first.cloneNode(true)).setAttribute('aria-hidden', 'true'); runs = $$('.lb-run', track); }
        while (runs.length > need) { runs.pop().remove(); }
        $$('.lb-run[aria-hidden] a', track).forEach((a) => { a.tabIndex = -1; });
      };
      fill();
      const ro = new ResizeObserver(fill);
      ro.observe(win);
      ro.observe($('.lb-run', track));
      const SPEED = 38, SLOW = 14;
      let x = 0, v = SPEED, want = SPEED, lastT = 0, kick = 0;
      const wrap = () => {
        if (!period) return;
        while (x <= -period) x += period;
        while (x > 0) x -= period;
      };
      let onScreen = false;
      const loop = (t) => {
        raf = 0;
        if (document.hidden || !band || !band.isConnected || !onScreen) { lastT = 0; return; }
        raf = requestAnimationFrame(loop);
        const dt = Math.min(0.05, (t - (lastT || t)) / 1000); lastT = t;
        v += (want - v) * Math.min(1, dt * 5);
        const step = kick * Math.min(1, dt * 9);
        kick -= step;
        x -= v * dt + step;
        wrap();
        track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
      };
      if (reduced()) want = v = 0;
      new IntersectionObserver((es) => {
        onScreen = es.some((e) => e.isIntersecting);
        if (onScreen && !raf) raf = requestAnimationFrame(loop);
      }).observe(band);
      document.addEventListener('visibilitychange', () => { if (!document.hidden && onScreen && !raf) raf = requestAnimationFrame(loop); });
      let paused = reduced();
      const pauseBtn = $('.lb-pause', band);
      const showPause = () => {
        pauseBtn.setAttribute('aria-pressed', String(paused));
        pauseBtn.setAttribute('aria-label', paused ? 'Play the announcements' : 'Pause the announcements');
        pauseBtn.classList.toggle('is-paused', paused);
      };
      showPause();
      const cruise = () => (paused ? 0 : SPEED);
      win.addEventListener('pointerenter', () => { if (!paused) want = SLOW; });
      win.addEventListener('pointerleave', () => { want = cruise(); });
      win.addEventListener('focusin', (e) => { if (e.target.matches && e.target.matches(':focus-visible')) want = 0; });
      win.addEventListener('focusout', () => { want = cruise(); });
      pauseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        paused = !paused; want = cruise(); showPause();
        if (!raf && onScreen) raf = requestAnimationFrame(loop);
      });
      band.addEventListener('click', (e) => {
        const btn = e.target.closest('.lb-btn');
        if (btn) { kick += Number(btn.dataset.dir) * 200; return; }
        const a = e.target.closest('.lb-card');
        if (!a) return;
        e.preventDefault(); e.stopPropagation();
        a.blur(); want = cruise();
        openNews(a.dataset.id);
      });
    }

    function openNews(id) {
      const go = () => {
        const target = id && document.querySelector(`#newsGrid .news-card[data-id="${CSS.escape(id)}"]`);
        if (!target) return;
        setTimeout(() => {
          target.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
          target.classList.remove('lb-flash'); void target.offsetWidth; target.classList.add('lb-flash');
        }, 900);
      };
      if (window.PRESS) {
        if (window.PRESS.current() === '#news') newsIntro.play(); else window.PRESS.show('#news');
      } else {
        document.getElementById('news')?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' });
        newsIntro.play();
      }
      go();
    }
    return { build };
  })();

  const newsIntro = (() => {
    let last = 0;
    function play() {
      const sec = document.getElementById('news');
      if (!sec || sec.hidden || reduced()) return;
      const now = performance.now();
      if (now - last < 900) return;
      last = now;
      $$('.news-card', sec).forEach((c, i) => c.style.setProperty('--ni', Math.min(i, 10)));
      sec.classList.remove('news-enter');
      void sec.offsetWidth;
      sec.classList.add('news-enter');
      clearTimeout(play.t);
      play.t = setTimeout(() => sec.classList.remove('news-enter'), 2600);
    }
    document.addEventListener('view:changed', (e) => {
      if (((e.detail && e.detail.view) || '') === '#news') setTimeout(play, 380);
    });
    return { play };
  })();

  (() => {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const glow = document.createElement('div');
    glow.id = 'cursorGlow';
    glow.setAttribute('aria-hidden', 'true');
    document.body.appendChild(glow);
    let tx = innerWidth / 2, ty = innerHeight / 2, x = tx, y = ty, raf = 0;
    const step = () => {
      const k = reduced() ? 1 : 0.18;
      x += (tx - x) * k; y += (ty - y) * k;
      glow.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(step) : 0;
    };
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      tx = e.clientX; ty = e.clientY;
      glow.classList.add('on');
      if (!raf) raf = requestAnimationFrame(step);
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => glow.classList.remove('on'));
  })();

  const { planet } = window.SHOWCASE2;
  document.addEventListener('content:rendered', (e) => {
    const c = e.detail || {};
    try { planet.render(c); } catch (err) { console.error(err); }
    try { bento.build(c); } catch (err) { console.error(err); }
    glass.build(c).catch((err) => console.error(err));
    try { ticker.build(c); } catch (err) { console.error(err); }
  });
  document.addEventListener('view:changed', () => requestAnimationFrame(() => {
    planet.wake(); bento.measure(); glass.wake();
  }));
})();
