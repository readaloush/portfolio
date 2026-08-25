/* ==================================================================
   THE COMMAND LINE
   ------------------------------------------------------------------
   A command palette over the whole site. Backtick or ⌘K opens it,
   typing filters, the arrows move, enter runs, escape closes.

   It is not a fourth mode: it sits on top of all three, so whichever
   presentation you are looking at, the same keystroke gets you to any
   section, any project, any setting.

   Two decisions worth stating.

   First, nothing here reimplements anything. ":notebook" does not
   know how notebook mode works — it clicks the tab. ":dark" clicks the
   wall switch. Every command drives the control a visitor would have
   used, so the sound, the animation and the saved preference all
   happen exactly as they otherwise would, and there is only ever one
   copy of that logic to keep correct.

   Second, the search matches Turkish as well as English. The person
   whose site this is thinks in Turkish; typing "projeler" should find
   the projects just as "projects" does.
   ================================================================== */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /** Fold accents and case so "Eğitim" and "egitim" are the same word. */
  const fold = (s) => (s || '')
    .toLowerCase()
    .replace(/ı/g, 'i').replace(/İ/g, 'i')
    .replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .normalize('NFD').replace(/[̀-ͯ]/g, '');

  /* In press mode the sections are separate views, so "go to projects"
     means show that view, not scroll to it. Everywhere else the page is
     one scroll and scrolling is the right answer. */
  const goTo = (sel) => {
    if (window.PRESS) { window.PRESS.show(sel === '#top' ? '' : sel); return; }
    const el = $(sel);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const press = (sel) => { const el = $(sel); if (el) el.click(); };
  const mode = (name) => {
    const b = $$('.mode-tab').find((x) => x.dataset.mode === name);
    if (b) b.click();
  };

  /* ------------------------------------------------ what it can do */
  function commands() {
    const list = [
      { g: 'go', label: ':top', hint: 'back to the top', keys: 'home basa yukari start', run: () => goTo('#top') },
      { g: 'go', label: ':about', hint: 'who is behind the signature', keys: 'hakkimda kim about', run: () => goTo('#about') },
      { g: 'go', label: ':skills', hint: 'languages, frameworks, hardware', keys: 'yetenekler beceri skills', run: () => goTo('#skills') },
      { g: 'go', label: ':experience', hint: 'internships and roles', keys: 'deneyim is tecrube staj work', run: () => goTo('#experience') },
      { g: 'go', label: ':projects', hint: 'what he has built', keys: 'projeler proje work', run: () => goTo('#projects') },
      { g: 'go', label: ':education', hint: 'degrees and coursework', keys: 'egitim okul universite school', run: () => goTo('#education') },
      { g: 'go', label: ':contact', hint: 'book a slot, or just write', keys: 'iletisim contact mail', run: () => goTo('#contact') },
      { g: 'go', label: ':contents', hint: 'back to the contents page', keys: 'icindekiler kapak index son', run: () => goTo('#top') },

      { g: 'mode', label: ':modern', hint: 'the site as built', keys: 'modern normal varsayilan', run: () => mode('modern') },
      { g: 'mode', label: ':notebook', hint: 'ruled paper, turning pages', keys: 'defter kagit notebook paper', run: () => mode('paper') },
      { g: 'mode', label: ':neural', hint: 'the robot, in three dimensions', keys: 'neural robot 3d sinir', run: () => mode('neural') },
      { g: 'mode', label: ':press', hint: 'the site as a printed quarterly', keys: 'dergi gazete press editorial matbaa', run: () => mode('press') },

      { g: 'set', label: ':theme', hint: 'flip the light switch', keys: 'tema isik dark light koyu acik', run: () => press('#themeSwitch') },
      { g: 'set', label: ':sound', hint: 'sound on or off', keys: 'ses sessiz mute audio', run: () => press('#soundBtn') },

      { g: 'do', label: ':cv', hint: 'open the CV in a new tab', keys: 'ozgecmis resume pdf', run: () => press('#cvButton') },
      { g: 'do', label: ':book', hint: 'pick a slot in the calendar', keys: 'randevu takvim meeting calendar', run: () => { const a = $('#calendarBox a'); if (a) a.click(); else goTo('#contact'); } },
      { g: 'do', label: ':ask', hint: 'ask the assistant a question', keys: 'sor sohbet chat bot', run: () => press('#chatOrb') },
      { g: 'play', label: ':snake', hint: 'eat, grow, do not turn into yourself', keys: 'yilan oyun game', run: () => window.openArcade('snake') },
      { g: 'play', label: ':tetris', hint: 'stack them, clear the lines', keys: 'tetris oyun game blok', run: () => window.openArcade('tetris') },
      { g: 'play', label: ':breakout', hint: 'bat, ball, bricks', keys: 'breakout arkanoid oyun game tugla', run: () => window.openArcade('breakout') },

      { g: 'do', label: ':random', hint: 'open a project at random', keys: 'rastgele surprise', run: () => {
        const all = $$('.project');
        if (!all.length) return goTo('#projects');
        all[Math.floor(Math.random() * all.length)].scrollIntoView({ behavior: 'smooth', block: 'center' });
      } }
    ];

    // The social links come from the database, so read them off the
    // page rather than hard-coding a list that will go stale.
    $$('#socialList a, #socialList2 a').forEach((a) => {
      const name = (a.getAttribute('aria-label') || a.title || '').trim();
      if (!name) return;
      const slug = fold(name).replace(/[^a-z0-9]/g, '');
      if (!slug || list.some((c) => c.label === ':' + slug)) return;
      list.push({
        g: 'open', label: ':' + slug, hint: 'open ' + name, keys: name + ' link ac',
        run: () => window.open(a.href, a.target || '_blank', 'noopener')
      });
    });

    // and every project by its own title
    $$('.project').forEach((p) => {
      const h = p.querySelector('h3');
      if (!h) return;
      const title = h.textContent.trim();
      list.push({
        g: 'project', label: title, hint: 'jump to this project', keys: title,
        run: () => p.scrollIntoView({ behavior: 'smooth', block: 'center' })
      });
    });

    return list;
  }

  /* ------------------------------------------------------ the sheet */
  const root = document.createElement('div');
  root.className = 'cmdk';
  root.hidden = true;
  root.innerHTML = `
    <div class="cmdk-veil" data-close></div>
    <div class="cmdk-box" role="dialog" aria-modal="true" aria-label="Command palette">
      <div class="cmdk-line">
        <span class="cmdk-caret">&rsaquo;</span>
        <input class="cmdk-input" id="cmdkInput" type="text" autocomplete="off" spellcheck="false"
               placeholder="type a command, or a project" aria-label="Command">
      </div>
      <div class="cmdk-list" id="cmdkList" role="listbox"></div>
      <div class="cmdk-foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
        <span><kbd>enter</kbd> run</span>
        <span><kbd>esc</kbd> close</span>
        <span class="cmdk-count" id="cmdkCount"></span>
      </div>
    </div>`;
  document.body.appendChild(root);

  const input = $('#cmdkInput', root);
  const listEl = $('#cmdkList', root);
  const countEl = $('#cmdkCount', root);

  const GROUPS = { go: 'GO', mode: 'MODE', set: 'SETTINGS', do: 'DO', play: 'PLAY', open: 'OPEN', project: 'PROJECTS' };

  let all = [];
  let shown = [];
  let cursor = 0;
  let open = false;

  /**
   * Matching, in two passes.
   *
   * The first pass is plain substring, which is what people expect:
   * "pro" finds ":projects". The second is a scattered-letter match,
   * which catches typos and abbreviations — but it is far too generous
   * to run alongside the first. Measured on the live site, "pro" under
   * a scattered match alone returned sixteen of twenty-eight commands,
   * including TikTok and YouTube, because p, r and o appear in that
   * order somewhere in almost any sentence. So the scattered pass only
   * runs when the strict one found nothing at all.
   */
  function strictScore(cmd, q) {
    const hay = fold(cmd.label + ' ' + cmd.hint + ' ' + (cmd.keys || ''));
    const at = hay.indexOf(q);
    if (at === -1) return 0;
    // earlier in the text, and in the label rather than the hint, wins
    const inLabel = fold(cmd.label).includes(q) ? 60 : 0;
    return 100 - Math.min(40, at) + inLabel;
  }

  function looseScore(cmd, q) {
    if (q.length < 3) return 0;
    const hay = fold(cmd.label + ' ' + (cmd.keys || ''));
    let i = 0;
    for (const ch of q) {
      i = hay.indexOf(ch, i);
      if (i === -1) return 0;
      i++;
    }
    return 1;
  }

  function render() {
    const q = fold(input.value.replace(/^:+/, '').trim());
    if (!q) {
      shown = all.slice();
    } else {
      const rank = (fn) => all
        .map((c) => ({ c, s: fn(c, q) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.c);
      shown = rank(strictScore);
      if (!shown.length) shown = rank(looseScore);
    }

    if (cursor >= shown.length) cursor = Math.max(0, shown.length - 1);

    let html = '';
    let last = null;
    shown.forEach((c, i) => {
      if (c.g !== last) {
        last = c.g;
        html += `<p class="cmdk-group">${GROUPS[c.g] || c.g}</p>`;
      }
      html += `<button class="cmdk-row${i === cursor ? ' on' : ''}" data-i="${i}" role="option"
                 aria-selected="${i === cursor}"><b>${c.label}</b><i>${c.hint}</i></button>`;
    });
    listEl.innerHTML = html || '<p class="cmdk-empty">nothing matches that</p>';
    countEl.textContent = `${shown.length}/${all.length}`;

    const on = listEl.querySelector('.cmdk-row.on');
    if (on) on.scrollIntoView({ block: 'nearest' });
  }

  function show() {
    if (open) return;
    all = commands();
    open = true;
    root.hidden = false;
    input.value = '';
    cursor = 0;
    render();
    requestAnimationFrame(() => {
      root.classList.add('on');
      input.focus();
    });
    window.SFX?.hover?.();
  }

  function hide() {
    if (!open) return;
    open = false;
    root.classList.remove('on');
    setTimeout(() => { root.hidden = true; }, 200);
  }

  function run(i) {
    const c = shown[i];
    if (!c) return;
    hide();
    // let the sheet finish closing before the page starts moving
    setTimeout(() => { try { c.run(); } catch { /* a bad command must not break the key */ } }, 120);
    window.SFX?.click?.();
  }

  /* --------------------------------------------------------- input */
  input.addEventListener('input', () => { cursor = 0; render(); });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); cursor = Math.min(cursor + 1, shown.length - 1); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); cursor = Math.max(cursor - 1, 0); render(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(cursor); }
    else if (e.key === 'Escape') { e.preventDefault(); hide(); }
    else if (e.key === 'Home') { e.preventDefault(); cursor = 0; render(); }
    else if (e.key === 'End') { e.preventDefault(); cursor = shown.length - 1; render(); }
  });

  listEl.addEventListener('click', (e) => {
    const b = e.target.closest('.cmdk-row');
    if (b) run(Number(b.dataset.i));
  });
  listEl.addEventListener('mousemove', (e) => {
    const b = e.target.closest('.cmdk-row');
    if (!b) return;
    const i = Number(b.dataset.i);
    if (i !== cursor) { cursor = i; render(); }
  });
  root.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close')) hide(); });

  /* ------------------------------------------------- the shortcut
     A backtick is a fine trigger right up until someone is typing one
     into the assistant, so the plain key is ignored inside any field.
     ⌘K has no such problem and works anywhere. */
  const typing = () => {
    const a = document.activeElement;
    return !!a && a !== input && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
  };

  addEventListener('keydown', (e) => {
    const meta = (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K');
    if (meta) { e.preventDefault(); open ? hide() : show(); return; }
    if (open) return;
    if (typing()) return;
    if (e.key === '`' || e.key === ':') { e.preventDefault(); show(); }
  });

  // a quiet way in for anyone who never touches a keyboard
  const tip = document.createElement('button');
  tip.className = 'cmdk-tip';
  tip.type = 'button';
  tip.innerHTML = '<kbd>⌘K</kbd><span>commands</span>';
  tip.addEventListener('click', show);
  document.body.appendChild(tip);

  window.CMDK = { show, hide };
})();
