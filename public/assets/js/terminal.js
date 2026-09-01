/* ==================================================================
   TERMINAL MODE
   ------------------------------------------------------------------
   The fifth presentation: the site as a shell. The sections are files,
   the projects are a directory, and you read them with cat.

   Everything printed here comes from the same database the other four
   modes read. Nothing is retyped into this file — if he edits a bullet
   in the admin panel, `cat projects/drone` says the new bullet. A
   terminal that lied about the content would be a screensaver.

   The jokes are real where they can be. `kill 102` does not print a
   message about killing the sound; it mutes the site. `sudo` refuses,
   the way sudo does.
   ================================================================== */
(() => {
  'use strict';

  const HOST = 'read@alallos';
  const HISTORY_KEY = 'rp_sh_history';

  let content = null;
  let cwd = '~';
  let history = [];
  let hIndex = -1;
  let booted = false;

  /* ------------------------------------------------------ the DOM */
  const root = document.createElement('section');
  root.id = 'shell';
  root.className = 'sh';
  root.hidden = true;
  root.innerHTML = `
    <div class="sh-bar">
      <span class="sh-dot r"></span><span class="sh-dot y"></span><span class="sh-dot g"></span>
      <b id="shTitle">read@alallos: ~</b>
    </div>
    <div class="sh-screen" id="shScreen" tabindex="-1">
      <div id="shOut"></div>
      <form class="sh-line" id="shForm" autocomplete="off">
        <label class="sh-ps1" id="shPs1" for="shIn">${HOST}:~$</label>
        <input class="sh-in" id="shIn" type="text" spellcheck="false"
               autocapitalize="off" autocorrect="off" aria-label="Command">
      </form>
    </div>`;
  document.body.appendChild(root);

  const out = root.querySelector('#shOut');
  const input = root.querySelector('#shIn');
  const ps1 = root.querySelector('#shPs1');
  const screen = root.querySelector('#shScreen');
  const title = root.querySelector('#shTitle');

  /* ----------------------------------------------------- printing */
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function print(html, cls) {
    const p = document.createElement('div');
    p.className = 'sh-row' + (cls ? ' ' + cls : '');
    p.innerHTML = html;
    out.appendChild(p);
    screen.scrollTop = screen.scrollHeight;
    return p;
  }
  const say = (text, cls) => print(esc(text), cls);
  const blank = () => print('&nbsp;');

  /** Print a line a character at a time — used only for the boot. */
  function type(text, speed = 12) {
    return new Promise((res) => {
      const row = print('');
      let i = 0;
      const tick = () => {
        row.textContent = text.slice(0, ++i);
        screen.scrollTop = screen.scrollHeight;
        if (i < text.length) setTimeout(tick, speed);
        else res();
      };
      tick();
    });
  }

  const setPrompt = () => {
    ps1.textContent = `${HOST}:${cwd}$`;
    title.textContent = `${HOST}: ${cwd}`;
  };

  /* -------------------------------------------------- the content
     Read once from the same endpoint the site itself uses. */
  async function load() {
    if (content) return content;
    try {
      const r = await fetch('/api/content', { cache: 'no-store' });
      const payload = await r.json();
      /* The endpoint wraps the content and adds metadata alongside it:
         { content: {...}, updatedAt, revision }. app.js has always
         unwrapped it — `render(data.content)` — and this file did not,
         so every command that touched the database printed undefined
         while `ls`, which reads a fixed list, looked fine. */
      content = payload.content || payload;
    } catch {
      content = { profile: {}, projects: [], skills: [], experience: [], education: [] };
    }
    return content;
  }

  const slug = (s) => String(s || '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28);

  const projectBySlug = (name) =>
    (content.projects || []).find((p) => slug(p.title) === name || slug(p.title).startsWith(name));

  /* ------------------------------------------------- the file tree */
  const FILES = {
    '~': ['about.md', 'news.log', 'skills.json', 'experience.log', 'projects/', 'education.md', 'contact.vcf', 'cv.pdf'],
    '~/projects': () => (content.projects || []).map((p) => slug(p.title))
  };

  /* ----------------------------------------------- the running jobs
     Real handles where a real handle exists. */
  const JOBS = [
    { pid: 101, cmd: 'signature.js', note: 'draws the mark', kill: () => 'signature.js: cannot kill — it is the whole point' },
    { pid: 102, cmd: 'sound.js', note: 'synthesised interface audio',
      kill: () => {
        if (window.SFX && window.SFX.enabled === false) return 'sound.js: already stopped';
        document.getElementById('soundBtn')?.click();
        return 'sound.js: terminated';
      } },
    { pid: 103, cmd: 'robot3d.js', note: 'the figure in neural mode',
      kill: () => { window.NEURO?.stop?.(); return 'robot3d.js: terminated'; } },
    { pid: 104, cmd: 'arcade.js', note: 'snake, tetris, breakout',
      kill: () => { window.ARCADE?.close?.(); return 'arcade.js: terminated'; } },
    { pid: 105, cmd: 'chat.js', note: 'the assistant',
      kill: () => {
        const p = document.getElementById('chatPanel');
        if (p && !p.hidden) { document.querySelector('.chat-x')?.click(); return 'chat.js: terminated'; }
        return 'chat.js: not running';
      } }
  ];

  /* ------------------------------------------------- the commands */
  const CMD = {};
  const define = (name, help, run) => { CMD[name] = { help, run }; };

  define('help', 'this list', () => {
    const rows = Object.keys(CMD).sort().map((k) => `  ${k.padEnd(12)}${CMD[k].help}`);
    say('Commands:');
    rows.forEach((r) => say(r));
    blank();
    say('Tab completes. Up and down walk the history. Ctrl-L clears.');
  });

  define('ls', 'list what is here', (args) => {
    const where = args[0] ? resolve(args[0]) : cwd;
    const list = typeof FILES[where] === 'function' ? FILES[where]() : FILES[where];
    if (!list) return say(`ls: ${args[0]}: no such directory`, 'sh-err');
    print(list.map((f) => `<span class="sh-f">${esc(f)}</span>`).join('   '));
  });

  define('pwd', 'where you are', () => say(cwd.replace('~', '/home/read')));

  define('cd', 'change directory', (args) => {
    const to = args[0];
    if (!to || to === '~' || to === '/') { cwd = '~'; return setPrompt(); }
    if (to === '..') { cwd = '~'; return setPrompt(); }
    const target = resolve(to);
    if (FILES[target]) { cwd = target; return setPrompt(); }
    say(`cd: ${to}: no such directory`, 'sh-err');
  });

  function resolve(p) {
    const clean = p.replace(/\/$/, '');
    if (clean.startsWith('~')) return clean;
    if (cwd === '~') return '~/' + clean;
    return cwd + '/' + clean;
  }

  define('cat', 'read a file', (args) => {
    const f = (args[0] || '').replace(/^\.\//, '');
    if (!f) return say('cat: which file?', 'sh-err');
    const c = content;

    if (f === 'about.md' || f === '~/about.md') {
      say('# ' + (c.profile.name || ''));
      say(c.profile.title || '');
      blank();
      wrap(c.profile.summary || '');
      return;
    }
    if (f === 'news.log') {
      /* Same rules as every other mode: drafts stay unpublished, pinned
         first, then newest. A shell that quietly showed the drafts would
         be a hole in the admin panel, not a joke. */
      const live = (c.announcements || [])
        .filter((a) => a && a.published !== false && (a.title || a.body))
        .sort((a, b) => (!!b.pinned !== !!a.pinned)
          ? (b.pinned ? 1 : -1)
          : String(b.date || '').localeCompare(String(a.date || '')));
      if (!live.length) return say('news.log: empty');
      live.forEach((a) => {
        say(`${a.date || '          '}  ${a.pinned ? '[pinned] ' : ''}${a.title}`);
        if (a.body) wrap('    ' + a.body);
        if (a.link) say('    ' + a.link);
        (a.files || []).filter((f) => f && f.url).forEach((f) => {
          const ext = (String(f.url).split(/[?#]/)[0].split('.').pop() || '').toLowerCase();
          say(`    [${ext.slice(0, 4) || 'link'}] ${f.label || f.url}  ${f.url}`);
        });
        blank();
      });
      say(`-- ${live.length} entr${live.length === 1 ? 'y' : 'ies'}`);
      return;
    }
    if (f === 'skills.json') {
      say('{');
      (c.skills || []).forEach((g) => {
        say(`  "${g.category}": [`);
        (g.items || []).forEach((i) => say(`    { "name": "${i.name}", "level": ${i.level} },`));
        say('  ],');
      });
      say('}');
      return;
    }
    if (f === 'experience.log') {
      (c.experience || []).forEach((x) => {
        say(`[${x.period}] ${x.role} — ${x.company}`);
        (x.bullets || []).forEach((b) => wrap('    ' + b));
        blank();
      });
      return;
    }
    if (f === 'education.md') {
      (c.education || []).forEach((e) => {
        say(`## ${e.degree}`);
        say(`${e.school} · ${e.period}`);
        if (e.note) wrap(e.note);
        blank();
      });
      return;
    }
    if (f === 'contact.vcf') {
      say('BEGIN:VCARD');
      say('FN:' + (c.profile.name || ''));
      say('EMAIL:' + (c.profile.email || ''));
      say('TEL:' + (c.profile.phone || ''));
      say('ADR:' + (c.profile.location || ''));
      (c.socials || []).forEach((s) => say('URL;' + s.label + ':' + s.url));
      say('END:VCARD');
      return;
    }
    if (f === 'cv.pdf') return say('cat: cv.pdf: binary file — try `cv` to open it', 'sh-err');

    const name = f.replace(/^projects\//, '').replace(/^~\/projects\//, '');
    const pr = projectBySlug(name);
    if (pr) return showProject(pr);

    say(`cat: ${f}: no such file`, 'sh-err');
  });

  function wrap(text, width = 76) {
    const words = String(text).split(/\s+/);
    let line = '';
    words.forEach((w) => {
      if ((line + ' ' + w).trim().length > width) { say(line); line = w; }
      else line = (line ? line + ' ' : '') + w;
    });
    if (line) say(line);
  }

  function showProject(pr) {
    say('## ' + pr.title);
    say(pr.period || '');
    blank();
    (pr.bullets || []).forEach((b) => wrap('  · ' + b));
    blank();
    if (pr.tags?.length) say('  tags: ' + pr.tags.join(', '));
    const link = (label, url) => {
      if (!url) return;
      print(`  ${esc(label)}: <a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a>`);
    };
    link('code', pr.repo);
    link('report', pr.report);
    link('demo', pr.link);
    if (!pr.repo && !pr.report && !pr.link) say('  (no links published yet)', 'sh-dim');
  }

  define('open', 'open a project repository', (args) => {
    const pr = projectBySlug(args[0] || '');
    if (!pr) return say(`open: ${args[0] || ''}: no such project`, 'sh-err');
    const url = pr.repo || pr.link || pr.report;
    if (!url) return say('open: nothing published for that one yet', 'sh-err');
    window.open(url, '_blank', 'noopener');
    say('opening ' + url);
  });

  define('whoami', 'who is this', () => {
    const p = content.profile || {};
    say(`${p.name} — ${p.title}`);
    say(`${p.location} · ${p.availability || ''}`);
  });

  define('neofetch', 'the system, such as it is', () => {
    const p = content.profile || {};
    const stats = content.stats || [];
    const left = [
      '        ▄▄▄▄▄▄▄        ',
      '     ▄█████████▄     ',
      '    ███  ███  ███    ',
      '    ███████████████  ',
      '     ▀███████████▀   ',
      '       ▀▀█████▀▀     '
    ];
    const right = [
      `${p.name || ''}`,
      '─'.repeat(28),
      `Role     ${p.title || ''}`,
      `Base     ${p.location || ''}`,
      `Shell    portfolio-sh 1.0`,
      `Modes    modern notebook neural press terminal`,
      ...stats.slice(0, 3).map((s) => `Stat     ${s.value}${s.suffix || ''} ${s.label}`)
    ];
    const n = Math.max(left.length, right.length);
    for (let i = 0; i < n; i++) {
      print(`<span class="sh-art">${esc(left[i] || ' '.repeat(22))}</span>  ${esc(right[i] || '')}`);
    }
  });

  define('ps', 'what is running', () => {
    say('  PID  COMMAND        DESCRIPTION');
    JOBS.forEach((j) => say(`  ${String(j.pid).padEnd(5)}${j.cmd.padEnd(15)}${j.note}`));
  });

  define('kill', 'stop one of them', (args) => {
    const pid = Number(args[0]);
    const job = JOBS.find((j) => j.pid === pid);
    if (!job) return say(`kill: ${args[0] || ''}: no such process`, 'sh-err');
    say(job.kill());
  });

  define('git', 'log, remote', (args) => {
    const sub = args[0];
    if (sub === 'remote') {
      const gh = (content.socials || []).find((s) => /github/i.test(s.label));
      const url = gh ? gh.url + '.git' : 'origin not configured';
      say(`origin  ${url} (fetch)`);
      say(`origin  ${url} (push)`);
      return;
    }
    if (sub === 'log' || !sub) {
      // the history is real: it is his own, newest first
      const items = [
        ...(content.projects || []).map((p) => ({ when: p.period, what: p.title, type: 'feat' })),
        ...(content.experience || []).map((x) => ({ when: x.period, what: `${x.role} at ${x.company}`, type: 'work' })),
        ...(content.education || []).map((e) => ({ when: e.period, what: e.degree, type: 'edu' }))
      ];
      items.forEach((it, i) => {
        const sha = Math.abs(hash(it.what)).toString(16).padStart(7, '0').slice(0, 7);
        print(`<span class="sh-sha">commit ${sha}</span>`);
        say(`Date:   ${it.when || ''}`);
        say('');
        say(`    ${it.type}: ${it.what}`);
        if (i < items.length - 1) blank();
      });
      return;
    }
    say(`git: '${sub}' is not a command this shell knows`, 'sh-err');
  });

  const hash = (s) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
  };

  define('cv', 'open the CV', () => {
    document.getElementById('cvButton')?.click();
    say('opening cv.pdf in a new tab');
  });
  define('book', 'book a meeting', () => {
    const a = document.querySelector('#calendarBox a');
    if (a) { a.click(); say('opening the calendar'); }
    else say('book: the calendar is not on this page', 'sh-err');
  });
  define('play', 'play snake, tetris or breakout', (args) => {
    const g = (args[0] || 'snake').toLowerCase();
    if (!['snake', 'tetris', 'breakout'].includes(g)) return say(`play: no game called ${g}`, 'sh-err');
    window.openArcade?.(g);
    say('starting ' + g + ' — esc to come back');
  });
  define('mode', 'switch presentation', (args) => {
    const m = { modern: 'modern', notebook: 'paper', paper: 'paper', neural: 'neural',
                press: 'press', terminal: 'shell', shell: 'shell' }[(args[0] || '').toLowerCase()];
    if (!m) return say('mode: modern | notebook | neural | press | terminal', 'sh-err');
    document.querySelector(`.mode-tab[data-mode="${m}"]`)?.click();
  });
  define('theme', 'light or dark', () => {
    document.getElementById('themeSwitch')?.click();
    say('theme: flipped');
  });
  define('clear', 'wipe the screen', () => { out.innerHTML = ''; });
  define('exit', 'back to the main site', () => {
    say('logout');
    setTimeout(() => document.querySelector('.mode-tab[data-mode="modern"]')?.click(), 300);
  });
  define('echo', 'say it back', (args) => say(args.join(' ')));
  define('date', 'today', () => say(new Date().toString()));
  define('uname', 'the system', () => say('portfolio-sh 1.0 (read@alallos) — no dependencies, no build step'));
  define('sudo', 'no', (args) => {
    say(`read is not in the sudoers file. This incident will be reported.`, 'sh-err');
    if (args.length) say('(it was not reported.)', 'sh-dim');
  });
  define('man', 'read about a command', (args) => {
    const c = CMD[args[0]];
    if (!c) return say(`man: no entry for ${args[0] || ''}`, 'sh-err');
    say(`${args[0].toUpperCase()}(1)`);
    say('');
    say('    ' + c.help);
  });

  /* --------------------------------------------------- the parser */
  async function run(line) {
    const trimmed = line.trim();
    print(`<span class="sh-ps1">${esc(HOST)}:${esc(cwd)}$</span> ${esc(trimmed)}`, 'sh-echo');
    if (!trimmed) return;

    history.unshift(trimmed);
    history = history.slice(0, 60);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch { /* ignore */ }
    hIndex = -1;

    const [name, ...args] = trimmed.split(/\s+/);
    const cmd = CMD[name];
    if (!cmd) {
      say(`${name}: command not found — try \`help\``, 'sh-err');
      return;
    }
    await load();
    try { cmd.run(args); } catch (err) { say(String(err && err.message || err), 'sh-err'); }
  }

  /* ---------------------------------------------------- the input */
  root.querySelector('#shForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value;
    input.value = '';
    run(v);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (hIndex < history.length - 1) input.value = history[++hIndex] || '';
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (hIndex > 0) input.value = history[--hIndex] || '';
      else { hIndex = -1; input.value = ''; }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const parts = input.value.split(/\s+/);
      const last = parts[parts.length - 1] || '';
      const pool = parts.length === 1
        ? Object.keys(CMD)
        : (typeof FILES[cwd] === 'function' ? FILES[cwd]() : FILES[cwd] || []);
      const hits = pool.filter((c) => c.startsWith(last));
      if (hits.length === 1) {
        parts[parts.length - 1] = hits[0];
        input.value = parts.join(' ');
      } else if (hits.length > 1) {
        print(hits.map((h) => `<span class="sh-f">${esc(h)}</span>`).join('   '));
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      out.innerHTML = '';
    }
  });

  screen.addEventListener('click', (e) => {
    if (!e.target.closest('a')) input.focus();
  });

  /* ----------------------------------------------------- the boot */
  async function boot() {
    if (booted) { input.focus(); return; }
    booted = true;
    await load();
    const p = content.profile || {};
    out.innerHTML = '';
    await type('portfolio-sh 1.0 — no dependencies, no build step', 9);
    await type(`last login: ${new Date().toDateString()} on ttys001`, 9);
    blank();
    await type(`${p.name || ''} · ${p.title || ''}`, 14);
    say('Type `help` for the commands, or `ls` to look around.');
    blank();
    input.focus();
  }

  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    if (Array.isArray(saved)) history = saved;
  } catch { /* ignore */ }

  setPrompt();

  window.TERMINAL = {
    mount() {
      root.hidden = false;
      document.body.classList.add('sh-on');
      boot();
    },
    unmount() {
      root.hidden = true;
      document.body.classList.remove('sh-on');
    }
  };
  document.dispatchEvent(new CustomEvent('terminal:ready'));
})();
