(() => {
  'use strict';

  const KEY = 'rp_perf';
  const TIERS = ['low', 'mid', 'high'];
  const html = document.documentElement;

  const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, v); } catch {  } };

  function guess() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 'low';
    if (navigator.connection && navigator.connection.saveData) return 'low';

    const cores = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory || 4;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const pixels = innerWidth * innerHeight * dpr * dpr;

    let score = 0;
    if (cores >= 8) score += 2; else if (cores >= 4) score += 1;
    if (mem >= 8) score += 2; else if (mem >= 4) score += 1;

    if (pixels > 4.2e6) score -= 1;
    if (pixels > 8.0e6) score -= 1;

    if (matchMedia('(pointer: coarse)').matches) score -= 1;

    return score >= 4 ? 'high' : score >= 2 ? 'mid' : 'low';
  }

  const saved = read(KEY);
  let pinned = TIERS.includes(saved);
  let tier = pinned ? saved : guess();

  function apply(next, why) {
    if (!TIERS.includes(next) || next === tier) return;
    tier = next;
    html.dataset.perf = tier;
    API.tier = tier;
    API.low = tier === 'low';
    API.high = tier === 'high';
    document.dispatchEvent(new CustomEvent('perf:changed', { detail: { tier, why } }));
  }

  html.dataset.perf = tier;

  let measured = null;

  function measure() {
    if (pinned) return;
    const gaps = [];
    let last = performance.now();
    const t0 = last;

    (function tick(now) {
      if (!document.hidden) gaps.push(now - last);
      last = now;
      if (now - t0 < 1100) return requestAnimationFrame(tick);

      const sample = gaps.slice(5).sort((a, b) => a - b);
      if (sample.length < 20) return;

      const median = sample[Math.floor(sample.length / 2)];
      measured = median;
      API.measured = median;

      const verdict = median > 45 ? 'low' : median > 26 ? 'mid' : 'high';

      const from = TIERS.indexOf(tier);
      const to = TIERS.indexOf(verdict);
      if (to < from) apply(TIERS[Math.max(0, from - 1)], `median frame ${median.toFixed(1)}ms`);
    })(last);
  }

  const start = () => setTimeout(measure, 700);
  if (document.readyState === 'complete') start();
  else addEventListener('load', start, { once: true });
  document.addEventListener('loader:done', start, { once: true });

  const API = {
    tier,
    low: tier === 'low',
    high: tier === 'high',
    measured: null,
    pinned,
    set(next) {
      if (!TIERS.includes(next)) return;
      write(KEY, next);
      pinned = true;
      API.pinned = true;
      apply(next, 'chosen');
    },
    auto() {
      try { localStorage.removeItem(KEY); } catch {  }
      pinned = false;
      API.pinned = false;
      apply(guess(), 'auto');
      measure();
    },
    allows(level) { return TIERS.indexOf(tier) >= TIERS.indexOf(level); }
  };

  window.PERF = API;
})();
