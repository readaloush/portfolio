/* ==================================================================
   THE ARCADE
   ------------------------------------------------------------------
   Three small games, written from scratch on one canvas: snake,
   tetris, breakout. No engine, no sprites, no download — a robotics
   engineer's site should be able to draw its own rectangles.

   One harness runs all three. A game is an object with update(dt) and
   draw(ctx); the harness owns the loop, the clock, the pause, the
   score, the best-ever, and the keyboard. That means a fourth game is
   forty lines, not four hundred, and none of the three can drift out
   of step with the others on the things that are not about play.

   Two details that matter more than they look:

   - The loop is fixed-step. Bound the update to real time and a slow
     frame makes the snake teleport through its own tail; step at a
     fixed rate and it cannot.
   - The keys are captured. The site itself listens for arrow keys to
     turn pages, so while a game is open its keys are taken before the
     page can see them, or every turn would also flip the section.
   ================================================================== */
(() => {
  'use strict';

  const BEST_KEY = 'rp_arcade_best';

  /* ------------------------------------------------------- storage */
  const bests = (() => {
    try { return JSON.parse(localStorage.getItem(BEST_KEY) || '{}'); }
    catch { return {}; }
  })();
  const saveBest = (game, score) => {
    if (score <= (bests[game] || 0)) return false;
    bests[game] = score;
    try { localStorage.setItem(BEST_KEY, JSON.stringify(bests)); } catch { /* ignore */ }
    return true;
  };

  /* --------------------------------------------------------- sound */
  let actx = null;
  function beep(freq = 660, dur = 0.05, gain = 0.05, type = 'square') {
    if (window.SFX && window.SFX.enabled === false) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!actx) actx = new AC();
      if (actx.state === 'suspended') actx.resume().catch(() => {});
      const t = actx.currentTime;
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(actx.destination);
      o.start(t); o.stop(t + dur + 0.02);
    } catch { /* decoration */ }
  }

  /* -------------------------------------------------------- colours
     Read from the stylesheet, so the games belong to whichever mode
     and theme the visitor is looking at. */
  let C = {};
  function readColours() {
    const s = getComputedStyle(document.documentElement);
    const get = (n, f) => (s.getPropertyValue(n) || '').trim() || f;
    C = {
      accent: get('--accent', '#E0553B'),
      text: get('--text', '#F1EEE7'),
      muted: get('--muted', '#8B8579'),
      line: get('--line', 'rgba(255,255,255,.15)'),
      bg: get('--bg2', '#17140F')
    };
  }

  /* ----------------------------------------------------- the shell */
  const shell = document.createElement('div');
  shell.className = 'arc';
  shell.hidden = true;
  shell.innerHTML = `
    <div class="arc-veil" data-close></div>
    <div class="arc-box" role="dialog" aria-modal="true" aria-label="Arcade">
      <header class="arc-head">
        <b id="arcTitle">Snake</b>
        <nav class="arc-tabs" id="arcTabs"></nav>
        <button class="arc-x" data-close aria-label="Close">&times;</button>
      </header>
      <div class="arc-stage">
        <canvas id="arcCanvas"></canvas>
        <div class="arc-over" id="arcOver" hidden>
          <p id="arcOverText">Game over</p>
          <button class="arc-btn" id="arcAgain">Play again</button>
        </div>
      </div>
      <footer class="arc-foot">
        <span>score <i id="arcScore">0</i></span>
        <span>best <i id="arcBest">0</i></span>
        <span class="arc-keys" id="arcKeys"></span>
      </footer>
    </div>`;
  document.body.appendChild(shell);

  const canvas = shell.querySelector('#arcCanvas');
  const ctx = canvas.getContext('2d');
  const elTitle = shell.querySelector('#arcTitle');
  const elScore = shell.querySelector('#arcScore');
  const elBest = shell.querySelector('#arcBest');
  const elKeys = shell.querySelector('#arcKeys');
  const elOver = shell.querySelector('#arcOver');
  const elOverText = shell.querySelector('#arcOverText');
  const elTabs = shell.querySelector('#arcTabs');

  /* ------------------------------------------------------ the keys */
  const keys = new Set();
  let current = null;
  let open = false;

  const onKey = (e) => {
    if (!open) return;
    // The page turns sections on the arrow keys. While a game is up,
    // the game gets them first and the page never hears about it.
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Spacebar'].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (e.type === 'keydown') {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'p' || e.key === 'P') { paused = !paused; return; }
      if (!keys.has(e.key)) current?.press?.(e.key);
      keys.add(e.key);
    } else {
      keys.delete(e.key);
    }
  };
  addEventListener('keydown', onKey, true);
  addEventListener('keyup', onKey, true);

  /* touch: a swipe is a direction, a tap is the action button */
  let tStart = null;
  canvas.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    tStart = { x: t.clientX, y: t.clientY, at: performance.now() };
  }, { passive: true });
  canvas.addEventListener('touchend', (e) => {
    if (!tStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - tStart.x;
    const dy = t.clientY - tStart.y;
    if (Math.hypot(dx, dy) < 24) current?.press?.(' ');
    else if (Math.abs(dx) > Math.abs(dy)) current?.press?.(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
    else current?.press?.(dy > 0 ? 'ArrowDown' : 'ArrowUp');
    tStart = null;
  }, { passive: true });

  /* ------------------------------------------------------ the loop */
  let raf = 0;
  let acc = 0;
  let last = 0;
  let paused = false;
  let score = 0;
  let dead = false;
  const STEP = 1 / 120;              // fixed simulation step

  function setScore(n) {
    score = n;
    elScore.textContent = String(n);
  }

  function gameOver(msg) {
    if (dead) return;
    dead = true;
    const isBest = saveBest(current.id, score);
    elBest.textContent = String(bests[current.id] || 0);
    elOverText.textContent = isBest ? `New best — ${score}` : (msg || `Game over — ${score}`);
    elOver.hidden = false;
    beep(180, 0.3, 0.05, 'sawtooth');
  }

  function fit() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = current ? current.w : 480;
    const h = current ? current.h : 480;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.aspectRatio = `${w} / ${h}`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!open || !current) return;
    const dt = Math.min(0.25, (now - last) / 1000 || 0);
    last = now;
    if (!paused && !dead) {
      acc += dt;
      let guard = 0;
      while (acc >= STEP && guard++ < 240) {
        current.update(STEP, { keys, setScore, score: () => score, gameOver, beep });
        acc -= STEP;
      }
    }
    ctx.clearRect(0, 0, current.w, current.h);
    current.draw(ctx, C);
    if (paused && !dead) {
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(0, 0, current.w, current.h);
      ctx.fillStyle = C.text;
      ctx.font = '600 20px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', current.w / 2, current.h / 2);
      ctx.textAlign = 'left';
    }
  }

  /* ================================================== 1 — SNAKE */
  function Snake() {
    const N = 20;               // cells per side
    const CELL = 24;
    const g = {
      id: 'snake', name: 'Snake', w: N * CELL, h: N * CELL,
      keys: '↑ ↓ ← →  ·  P pause',
      body: [], dir: { x: 1, y: 0 }, next: { x: 1, y: 0 },
      food: { x: 12, y: 10 }, t: 0, rate: 0.14, grow: 0
    };

    g.reset = () => {
      g.body = [{ x: 6, y: 10 }, { x: 5, y: 10 }, { x: 4, y: 10 }];
      g.dir = { x: 1, y: 0 };
      g.next = { x: 1, y: 0 };
      g.rate = 0.14;
      g.grow = 0;
      g.t = 0;
      g.place();
    };

    g.place = () => {
      let p;
      do {
        p = { x: (Math.random() * N) | 0, y: (Math.random() * N) | 0 };
      } while (g.body.some((s) => s.x === p.x && s.y === p.y));
      g.food = p;
    };

    // A turn is stored, not applied. Applying it at once lets two
    // quick presses reverse the snake into its own neck.
    g.press = (k) => {
      const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
                  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] }[k];
      if (!d) return;
      if (d[0] === -g.dir.x && d[1] === -g.dir.y) return;
      g.next = { x: d[0], y: d[1] };
    };

    g.update = (dt, api) => {
      g.t += dt;
      if (g.t < g.rate) return;
      g.t = 0;
      g.dir = g.next;
      const head = { x: g.body[0].x + g.dir.x, y: g.body[0].y + g.dir.y };
      if (head.x < 0 || head.y < 0 || head.x >= N || head.y >= N) return api.gameOver('Into the wall');
      if (g.body.some((s) => s.x === head.x && s.y === head.y)) return api.gameOver('Into yourself');
      g.body.unshift(head);
      if (head.x === g.food.x && head.y === g.food.y) {
        api.setScore(api.score() + 10);
        g.rate = Math.max(0.055, g.rate * 0.97);
        g.place();
        api.beep(880, 0.05, 0.05);
      } else {
        g.body.pop();
      }
    };

    g.draw = (c, col) => {
      c.fillStyle = col.bg;
      c.fillRect(0, 0, g.w, g.h);
      c.strokeStyle = col.line;
      c.lineWidth = 1;
      for (let i = 1; i < N; i++) {
        c.beginPath(); c.moveTo(i * CELL, 0); c.lineTo(i * CELL, g.h); c.stroke();
        c.beginPath(); c.moveTo(0, i * CELL); c.lineTo(g.w, i * CELL); c.stroke();
      }
      c.fillStyle = col.accent;
      c.beginPath();
      c.arc(g.food.x * CELL + CELL / 2, g.food.y * CELL + CELL / 2, CELL * 0.3, 0, 6.284);
      c.fill();
      g.body.forEach((s, i) => {
        c.fillStyle = i === 0 ? col.text : col.muted;
        const p = i === 0 ? 2 : 3;
        c.fillRect(s.x * CELL + p, s.y * CELL + p, CELL - p * 2, CELL - p * 2);
      });
    };

    return g;
  }

  /* ================================================== 2 — TETRIS */
  function Tetris() {
    const COLS = 10;
    const ROWS = 20;
    const CELL = 26;
    const SHAPES = {
      I: [[1, 1, 1, 1]],
      J: [[1, 0, 0], [1, 1, 1]],
      L: [[0, 0, 1], [1, 1, 1]],
      O: [[1, 1], [1, 1]],
      S: [[0, 1, 1], [1, 1, 0]],
      T: [[0, 1, 0], [1, 1, 1]],
      Z: [[1, 1, 0], [0, 1, 1]]
    };
    const NAMES = Object.keys(SHAPES);

    const g = {
      id: 'tetris', name: 'Tetris', w: COLS * CELL + 130, h: ROWS * CELL,
      keys: '← →  ↑ turn  ↓ soft  space drop',
      grid: [], piece: null, nextName: null, t: 0, fall: 0.55, lines: 0
    };

    const empty = () => Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    const rotate = (m) => m[0].map((_, i) => m.map((r) => r[i]).reverse());

    const spawn = () => {
      const name = g.nextName || NAMES[(Math.random() * NAMES.length) | 0];
      g.nextName = NAMES[(Math.random() * NAMES.length) | 0];
      const shape = SHAPES[name].map((r) => r.slice());
      g.piece = { name, shape, x: ((COLS - shape[0].length) / 2) | 0, y: 0 };
      return !hits(g.piece.shape, g.piece.x, g.piece.y);
    };

    const hits = (shape, px, py) => {
      for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
          if (!shape[y][x]) continue;
          const nx = px + x;
          const ny = py + y;
          if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
          if (ny >= 0 && g.grid[ny][nx]) return true;
        }
      }
      return false;
    };

    const merge = (api) => {
      g.piece.shape.forEach((row, y) => row.forEach((v, x) => {
        if (v && g.piece.y + y >= 0) g.grid[g.piece.y + y][g.piece.x + x] = g.piece.name;
      }));
      let cleared = 0;
      for (let y = ROWS - 1; y >= 0; y--) {
        if (g.grid[y].every((v) => v)) {
          g.grid.splice(y, 1);
          g.grid.unshift(Array(COLS).fill(0));
          cleared++;
          y++;
        }
      }
      if (cleared) {
        g.lines += cleared;
        // the usual curve: four at once is worth far more than four in a row
        api.setScore(api.score() + [0, 40, 100, 300, 1200][cleared]);
        g.fall = Math.max(0.09, 0.55 - Math.floor(g.lines / 8) * 0.05);
        api.beep(cleared === 4 ? 1200 : 720, 0.09, 0.05);
      }
      if (!spawn()) api.gameOver('Stack reached the top');
    };

    g.reset = () => {
      g.grid = empty();
      g.lines = 0;
      g.fall = 0.55;
      g.t = 0;
      g.nextName = null;
      spawn();
    };

    g.press = (k) => {
      if (!g.piece) return;
      const p = g.piece;
      if (k === 'ArrowLeft' || k === 'a') { if (!hits(p.shape, p.x - 1, p.y)) p.x--; }
      else if (k === 'ArrowRight' || k === 'd') { if (!hits(p.shape, p.x + 1, p.y)) p.x++; }
      else if (k === 'ArrowUp' || k === 'w') {
        const r = rotate(p.shape);
        // try the spot, then one either side, then two: a piece against
        // a wall should still be able to turn
        for (const dx of [0, -1, 1, -2, 2]) {
          if (!hits(r, p.x + dx, p.y)) { p.shape = r; p.x += dx; beep(520, 0.03, 0.03); break; }
        }
      } else if (k === ' ' || k === 'Spacebar') {
        while (!hits(p.shape, p.x, p.y + 1)) p.y++;
        g.t = 1e9;                     // land it on the next tick
        beep(300, 0.06, 0.05);
      }
    };

    g.update = (dt, api) => {
      const soft = keys.has('ArrowDown') || keys.has('s');
      g.t += dt * (soft ? 8 : 1);
      if (g.t < g.fall) return;
      g.t = 0;
      const p = g.piece;
      if (!hits(p.shape, p.x, p.y + 1)) p.y++;
      else merge(api);
    };

    g.draw = (c, col) => {
      c.fillStyle = col.bg;
      c.fillRect(0, 0, g.w, g.h);
      const bw = COLS * CELL;

      c.strokeStyle = col.line;
      c.lineWidth = 1;
      for (let x = 1; x < COLS; x++) { c.beginPath(); c.moveTo(x * CELL, 0); c.lineTo(x * CELL, g.h); c.stroke(); }
      for (let y = 1; y < ROWS; y++) { c.beginPath(); c.moveTo(0, y * CELL); c.lineTo(bw, y * CELL); c.stroke(); }

      const block = (x, y, filled) => {
        c.fillStyle = filled ? col.text : col.accent;
        c.fillRect(x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4);
        c.fillStyle = 'rgba(0,0,0,.22)';
        c.fillRect(x * CELL + 2, y * CELL + CELL - 8, CELL - 4, 6);
      };

      g.grid.forEach((row, y) => row.forEach((v, x) => { if (v) block(x, y, true); }));

      if (g.piece) {
        // the shadow of where it will land, which is most of the game
        let gy = g.piece.y;
        while (!hits(g.piece.shape, g.piece.x, gy + 1)) gy++;
        c.globalAlpha = 0.18;
        g.piece.shape.forEach((row, y) => row.forEach((v, x) => { if (v) block(g.piece.x + x, gy + y, false); }));
        c.globalAlpha = 1;
        g.piece.shape.forEach((row, y) => row.forEach((v, x) => { if (v) block(g.piece.x + x, g.piece.y + y, false); }));
      }

      c.strokeStyle = col.line;
      c.beginPath(); c.moveTo(bw + 0.5, 0); c.lineTo(bw + 0.5, g.h); c.stroke();
      c.fillStyle = col.muted;
      c.font = '10px "JetBrains Mono", monospace';
      c.fillText('NEXT', bw + 18, 26);
      c.fillText('LINES', bw + 18, 140);
      c.fillStyle = col.text;
      c.font = '18px "JetBrains Mono", monospace';
      c.fillText(String(g.lines), bw + 18, 164);

      if (g.nextName) {
        const s = SHAPES[g.nextName];
        s.forEach((row, y) => row.forEach((v, x) => {
          if (!v) return;
          c.fillStyle = col.accent;
          c.fillRect(bw + 18 + x * 18, 40 + y * 18, 16, 16);
        }));
      }
    };

    return g;
  }

  /* ================================================ 3 — BREAKOUT */
  function Breakout() {
    const W = 480;
    const H = 380;
    const g = {
      id: 'breakout', name: 'Breakout', w: W, h: H,
      keys: '← →  or mouse  ·  space to launch',
      pad: { x: W / 2 - 40, w: 80, h: 10 },
      ball: { x: W / 2, y: H - 40, vx: 0, vy: 0, r: 6, stuck: true },
      bricks: [], lives: 3
    };

    g.reset = () => {
      g.bricks = [];
      const cols = 10;
      const rows = 5;
      const bw = (W - 40) / cols;
      for (let r = 0; r < rows; r++) {
        for (let cIdx = 0; cIdx < cols; cIdx++) {
          g.bricks.push({ x: 20 + cIdx * bw, y: 46 + r * 20, w: bw - 4, h: 15, hp: rows - r > 3 ? 2 : 1 });
        }
      }
      g.lives = 3;
      g.pad.x = W / 2 - g.pad.w / 2;
      g.ball = { x: W / 2, y: H - 40, vx: 0, vy: 0, r: 6, stuck: true };
    };

    g.press = (k) => {
      if ((k === ' ' || k === 'Spacebar' || k === 'ArrowUp') && g.ball.stuck) {
        g.ball.stuck = false;
        g.ball.vx = 150 * (Math.random() < 0.5 ? -1 : 1);
        g.ball.vy = -210;
        beep(620, 0.05, 0.05);
      }
    };

    canvas.addEventListener('pointermove', (e) => {
      if (current !== g) return;
      const r = canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * W;
      g.pad.x = Math.max(0, Math.min(W - g.pad.w, x - g.pad.w / 2));
    });

    g.update = (dt, api) => {
      const speed = 260;
      if (keys.has('ArrowLeft') || keys.has('a')) g.pad.x -= speed * dt;
      if (keys.has('ArrowRight') || keys.has('d')) g.pad.x += speed * dt;
      g.pad.x = Math.max(0, Math.min(W - g.pad.w, g.pad.x));

      const b = g.ball;
      if (b.stuck) { b.x = g.pad.x + g.pad.w / 2; b.y = H - 30; return; }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x < b.r) { b.x = b.r; b.vx *= -1; }
      if (b.x > W - b.r) { b.x = W - b.r; b.vx *= -1; }
      if (b.y < b.r) { b.y = b.r; b.vy *= -1; }

      // the paddle returns the ball at an angle set by where it hit,
      // which is the only reason the game has any steering in it
      if (b.vy > 0 && b.y + b.r >= H - 20 && b.y < H - 10 &&
          b.x > g.pad.x && b.x < g.pad.x + g.pad.w) {
        const rel = (b.x - (g.pad.x + g.pad.w / 2)) / (g.pad.w / 2);
        const sp = Math.hypot(b.vx, b.vy) * 1.02;
        const ang = rel * 1.05;
        b.vx = Math.sin(ang) * sp;
        b.vy = -Math.cos(ang) * sp;
        api.beep(440, 0.04, 0.05);
      }

      if (b.y > H + 20) {
        g.lives--;
        if (g.lives <= 0) return api.gameOver('Out of balls');
        b.stuck = true;
        api.beep(200, 0.15, 0.05, 'sawtooth');
      }

      for (const br of g.bricks) {
        if (br.hp <= 0) continue;
        if (b.x > br.x && b.x < br.x + br.w && b.y > br.y && b.y < br.y + br.h) {
          br.hp--;
          b.vy *= -1;
          api.setScore(api.score() + 10);
          api.beep(760, 0.03, 0.04);
          break;
        }
      }
      if (g.bricks.every((br) => br.hp <= 0)) api.gameOver('Cleared — ' + api.score());
    };

    g.draw = (c, col) => {
      c.fillStyle = col.bg;
      c.fillRect(0, 0, W, H);
      g.bricks.forEach((br) => {
        if (br.hp <= 0) return;
        c.fillStyle = br.hp > 1 ? col.accent : col.muted;
        c.fillRect(br.x, br.y, br.w, br.h);
      });
      c.fillStyle = col.text;
      c.fillRect(g.pad.x, H - 20, g.pad.w, g.pad.h);
      c.beginPath();
      c.arc(g.ball.x, g.ball.y, g.ball.r, 0, 6.284);
      c.fill();
      c.fillStyle = col.muted;
      c.font = '11px "JetBrains Mono", monospace';
      c.fillText('LIVES ' + g.lives, 20, 26);
      if (g.ball.stuck) {
        c.fillStyle = col.text;
        c.textAlign = 'center';
        c.fillText('press space', W / 2, H - 50);
        c.textAlign = 'left';
      }
    };

    return g;
  }

  /* ------------------------------------------------ the switchboard */
  const MAKE = { snake: Snake, tetris: Tetris, breakout: Breakout };
  const ORDER = ['snake', 'tetris', 'breakout'];

  elTabs.innerHTML = ORDER
    .map((k) => `<button class="arc-tab" data-game="${k}">${k}</button>`)
    .join('');
  elTabs.addEventListener('click', (e) => {
    const b = e.target.closest('.arc-tab');
    if (b) start(b.dataset.game);
  });

  function start(name) {
    readColours();
    current = MAKE[name]();
    current.reset();
    dead = false;
    paused = false;
    acc = 0;
    last = performance.now();
    setScore(0);
    elTitle.textContent = current.name;
    elKeys.textContent = current.keys;
    elBest.textContent = String(bests[name] || 0);
    elOver.hidden = true;
    elTabs.querySelectorAll('.arc-tab').forEach((b) => {
      b.classList.toggle('on', b.dataset.game === name);
    });
    fit();
    beep(880, 0.06, 0.04, 'triangle');
  }

  shell.querySelector('#arcAgain').addEventListener('click', () => start(current.id));
  shell.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) close(); });

  function show(name) {
    if (!open) {
      open = true;
      shell.hidden = false;
      requestAnimationFrame(() => shell.classList.add('on'));
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    }
    start(ORDER.includes(name) ? name : 'snake');
  }

  function close() {
    if (!open) return;
    open = false;
    shell.classList.remove('on');
    setTimeout(() => { shell.hidden = true; }, 200);
    cancelAnimationFrame(raf);
    keys.clear();
  }

  addEventListener('resize', () => { if (open) fit(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) paused = true; });
  new MutationObserver(readColours).observe(document.documentElement, {
    attributes: true, attributeFilter: ['data-theme', 'data-mode']
  });

  window.ARCADE = { show, close, games: ORDER };
})();
