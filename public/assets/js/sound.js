/* ==================================================================
   Interface sounds. No audio files — every tone is generated live by
   the Web Audio API, so the site downloads nothing extra.

   There is deliberately NO background drone. A sound that never stops
   is the thing people end up muting; the site stays completely silent
   until you actually touch something, and then answers with one short
   note. Short, tuned, and in a small room.
   ================================================================== */
(() => {
  const STORAGE_KEY = 'rp_sound';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let ctx = null;
  let master = null;
  let space = null;

  let enabled = (() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) return saved === '1';
    } catch { /* ignore */ }
    return !reduced;
  })();

  const MASTER_VOLUME = 0.2;

  /* short generated room, so single notes do not sound bare */
  function makeImpulse(seconds = 1.6, decay = 3.4) {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        lp += (white - lp) * 0.2;
        d[i] = lp * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  function ensureContext() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = 0;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 26;
    comp.ratio.value = 10;
    comp.attack.value = 0.004;
    comp.release.value = 0.3;

    const convolver = ctx.createConvolver();
    convolver.buffer = makeImpulse();
    const wet = ctx.createGain();
    wet.gain.value = 0.4;
    space = ctx.createGain();
    space.gain.value = 1;
    space.connect(convolver).connect(wet).connect(master);

    master.connect(comp).connect(ctx.destination);
    master.gain.setTargetAtTime(enabled ? MASTER_VOLUME : 0, ctx.currentTime, 0.2);
    return ctx;
  }

  const now = () => ctx.currentTime;
  const live = () => enabled && ctx && ctx.state === 'running';

  function tone({ freq = 440, dur = 0.12, gain = 0.2, attack = 0.006, glide = 0, delay = 0, send = 0.3, type = 'sine' }) {
    if (!live()) return;
    const t = now() + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + glide), t + dur);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(g);
    g.connect(master);
    if (send > 0) {
      const s = ctx.createGain();
      s.gain.value = send;
      g.connect(s).connect(space);
    }
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /* the only mechanical sound on the site: the light switch */
  function tick({ dur = 0.03, gain = 0.2, freq = 2200, Q = 2 }) {
    if (!live()) return;
    const t = now();
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = Q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(f).connect(g);
    g.connect(master);
    const s = ctx.createGain();
    s.gain.value = 0.2;
    g.connect(s).connect(space);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  const SFX = {
    get enabled() { return enabled; },

    /** Browsers stay silent until the visitor interacts with the page. */
    unlockAudio() {
      const c = ensureContext();
      if (!c) return;
      if (c.state === 'suspended') c.resume().catch(() => {});
    },

    setEnabled(v) {
      enabled = !!v;
      try { localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0'); } catch { /* ignore */ }
      const c = ensureContext();
      if (!c) return;
      if (enabled && c.state === 'suspended') c.resume().catch(() => {});
      master.gain.setTargetAtTime(enabled ? MASTER_VOLUME : 0, c.currentTime, 0.15);
      if (enabled) this.chime();
      document.dispatchEvent(new CustomEvent('sound:changed', { detail: { enabled } }));
    },

    toggle() { this.setEnabled(!enabled); },

    /* barely there — a breath, not a beep */
    hover() { tone({ freq: 1567.98, dur: 0.07, gain: 0.02, attack: 0.004, send: 0.45 }); },

    /* one clean note down an octave */
    click() {
      tone({ freq: 1046.5, dur: 0.1, gain: 0.045, send: 0.35 });
      tone({ freq: 523.25, dur: 0.16, gain: 0.03, delay: 0.02, send: 0.35 });
    },

    flip(on) {
      tick({ gain: 0.18 });
      tone({ freq: on ? 523.25 : 392.0, dur: 0.2, gain: 0.045, send: 0.55 });
    },

    knock(step) {
      const scale = [329.63, 392.0, 440.0, 523.25, 587.33];
      tone({ freq: scale[Math.max(0, Math.min(step, scale.length) - 1)], dur: 0.35, gain: 0.055, send: 0.6 });
    },

    unlock() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone({ freq: f, dur: 1.1 - i * 0.12, gain: 0.055, delay: i * 0.07, send: 0.75 })
      );
    },

    error() {
      tone({ freq: 233.08, dur: 0.2, gain: 0.06, send: 0.35 });
      tone({ freq: 174.61, dur: 0.28, gain: 0.05, delay: 0.11, send: 0.35 });
    },

    /* the one moment with any weight: the signature finishes drawing */
    chime() {
      [783.99, 1174.66, 1567.98].forEach((f, i) =>
        tone({ freq: f, dur: 1.8 - i * 0.35, gain: 0.042, attack: 0.012, delay: i * 0.085, send: 0.8 })
      );
    },

    powerDown() {
      [392.0, 293.66, 196.0].forEach((f, i) =>
        tone({ freq: f, dur: 0.9, gain: 0.05, glide: -f * 0.3, delay: i * 0.1, send: 0.6 })
      );
    }
  };

  ['pointerdown', 'keydown', 'touchstart'].forEach((evt) =>
    addEventListener(evt, () => SFX.unlockAudio(), { passive: true })
  );

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else if (enabled) ctx.resume().catch(() => {});
  });

  window.SFX = SFX;
})();
