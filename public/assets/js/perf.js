/* ==================================================================
   HOW MUCH ANIMATION CAN THIS MACHINE AFFORD?
   ------------------------------------------------------------------
   This site was built to be heavy on purpose. On a fast machine that is
   the point. On a five-year-old laptop with integrated graphics it was
   running at roughly one frame a second, which is not a style choice,
   it is a broken page.

   So the site now has three tiers, and this file picks one:

     high   everything. Aurora blur, film grain, live backdrop blur,
            the full particle network.
     mid    the look survives, the expensive parts are faked. The
            aurora becomes a gradient instead of a 110px blur; the
            grain stops moving; fewer particles.
     low    no blur anywhere, no grain, a much smaller network, and
            frosted panels become solid ones.

   Two things decide the tier.

   First, a guess made here in the <head>, before anything paints, from
   what the browser will tell us for free — core count, memory, screen
   area, whether the pointer is coarse. It is crude but it costs nothing
   and it is right most of the time.

   Then, a measurement. Once the page is up we time real frames for a
   second and take the *median* interval. The median matters: a mean is
   destroyed by one 400 ms garbage-collection pause, and that pause is
   not what the machine feels like. If the measurement disagrees with
   the guess, the measurement wins — it is the only number here that
   describes the actual computer rather than a proxy for it.

   A choice the visitor makes by hand beats both, permanently. Their
   laptop, their call.
   ================================================================== */
(() => {
  'use strict';

  const KEY = 'rp_perf';          // a deliberate choice, remembered
  const TIERS = ['low', 'mid', 'high'];
  const html = document.documentElement;

  const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

  /* ------------------------------------------------- the free guess */
  function guess() {
    // Someone who has asked their operating system for less motion is
    // telling us something more important than any benchmark.
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 'low';
    if (navigator.connection && navigator.connection.saveData) return 'low';

    const cores = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory || 4;        // Chromium only; 4 is a fair default
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const pixels = innerWidth * innerHeight * dpr * dpr;

    let score = 0;
    if (cores >= 8) score += 2; else if (cores >= 4) score += 1;
    if (mem >= 8) score += 2; else if (mem >= 4) score += 1;

    // A big panel is not a fast machine. A 4K screen on weak graphics is
    // the exact combination that was crawling, because every one of those
    // blurred surfaces is priced by area.
    if (pixels > 4.2e6) score -= 1;
    if (pixels > 8.0e6) score -= 1;

    // Touch devices get the mid tier at best; the 3D robot already opts
    // out on them separately.
    if (matchMedia('(pointer: coarse)').matches) score -= 1;

    return score >= 4 ? 'high' : score >= 2 ? 'mid' : 'low';
  }

  const saved = read(KEY);
  const pinned = TIERS.includes(saved);           // the visitor chose this
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

  /* ------------------------------------------------ the measurement */
  let measured = null;

  function measure() {
    if (pinned) return;                 // they chose; do not argue
    const gaps = [];
    let last = performance.now();
    const t0 = last;

    (function tick(now) {
      if (!document.hidden) gaps.push(now - last);
      last = now;
      if (now - t0 < 1100) return requestAnimationFrame(tick);

      // Throw away the first few frames — they contain layout, font
      // swap and image decode, none of which repeat.
      const sample = gaps.slice(5).sort((a, b) => a - b);
      if (sample.length < 20) return;   // tab was hidden; no verdict

      const median = sample[Math.floor(sample.length / 2)];
      measured = median;
      API.measured = median;

      // 16.7 ms is 60fps. Anything past 28 ms is under 36fps and visibly
      // stuttering; past 45 ms the page feels broken.
      const verdict = median > 45 ? 'low' : median > 26 ? 'mid' : 'high';

      // Only ever move one step from the guess at a time, and never
      // promote a machine that the free signals called weak — a laptop
      // can hit 60fps on an empty hero and still die on the projects
      // grid. Demotion, on the other hand, is always trusted.
      const from = TIERS.indexOf(tier);
      const to = TIERS.indexOf(verdict);
      if (to < from) apply(TIERS[Math.max(0, from - 1)], `median frame ${median.toFixed(1)}ms`);
    })(last);
  }

  // Wait for the loading screen to finish before timing anything: the
  // signature animation is the heaviest second of the page's life and
  // measuring it would condemn every machine to the low tier.
  const start = () => setTimeout(measure, 700);
  if (document.readyState === 'complete') start();
  else addEventListener('load', start, { once: true });
  document.addEventListener('loader:done', start, { once: true });

  /* ------------------------------------------------------ the API */
  const API = {
    tier,
    low: tier === 'low',
    high: tier === 'high',
    measured: null,
    /** A deliberate choice, remembered on this machine. */
    set(next) {
      if (!TIERS.includes(next)) return;
      write(KEY, next);
      apply(next, 'chosen');
    },
    /** Forget the choice and go back to measuring. */
    auto() {
      try { localStorage.removeItem(KEY); } catch { /* ignore */ }
      apply(guess(), 'auto');
      measure();
    },
    /** True when the effect described is worth paying for. */
    allows(level) { return TIERS.indexOf(tier) >= TIERS.indexOf(level); }
  };

  window.PERF = API;
})();
