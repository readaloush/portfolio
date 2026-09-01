/* ==================================================================
   Admin panel — edits every piece of content in the SQLite database.
   Nothing here contains credentials; the session is an httpOnly cookie.
   ================================================================== */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let state = null;
  let tab = 'profile';
  let dirty = false;

  /* --------------------------------------------------------- utils */
  const get = (path) => path.split('.').reduce((o, k) => (o == null ? o : o[/^\d+$/.test(k) ? Number(k) : k]), state);
  function set(path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    let o = state;
    for (let i = 0; i < keys.length; i++) {
      const raw = keys[i];
      const key = /^\d+$/.test(raw) ? Number(raw) : raw;
      const nextRaw = i + 1 < keys.length ? keys[i + 1] : last;
      if (o[key] == null) o[key] = /^\d+$/.test(nextRaw) ? [] : {};
      o = o[key];
    }
    o[/^\d+$/.test(last) ? Number(last) : last] = value;
    dirty = true;
    markDirty();
  }

  let toastTimer;
  function toast(msg, bad = false) {
    const t = $('#toast');
    $('#toastText').textContent = msg;
    t.hidden = false;
    t.classList.toggle('bad', bad);
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => (t.hidden = true), 350);
    }, 3200);
  }

  const markDirty = () => { $('#savedAt').textContent = dirty ? 'unsaved changes' : ''; };

  /* Session token: the HttpOnly cookie is the primary mechanism; this is the
     fallback for browsers that refuse cookies on localhost. */
  const TOKEN_KEY = 'rp_token';
  const getToken = () => {
    try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
  };
  const setToken = (t) => {
    try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  };

  const api = async (url, opts = {}) => {
    const headers = { ...(opts.headers || {}) };
    if (opts.body) headers['Content-Type'] = 'application/json';
    const token = getToken();
    if (token) headers.Authorization = 'Bearer ' + token;

    const res = await fetch(url, { credentials: 'same-origin', ...opts, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
    return data;
  };

  /* ------------------------------------------------------- fields */
  const text = (label, path, ph = '') =>
    `<label>${esc(label)}<input type="text" data-path="${path}" value="${esc(get(path) ?? '')}" placeholder="${esc(ph)}"></label>`;

  const num = (label, path, ph = '') =>
    `<label>${esc(label)}<input type="number" step="any" data-path="${path}" data-num="1" value="${esc(get(path) ?? '')}" placeholder="${esc(ph)}"></label>`;

  const area = (label, path, rows = 4, ph = '') =>
    `<label>${esc(label)}<textarea rows="${rows}" data-path="${path}" placeholder="${esc(ph)}">${esc(get(path) ?? '')}</textarea></label>`;

  const date = (label, path) =>
    `<label>${esc(label)}<input type="date" data-path="${path}" value="${esc(String(get(path) || '').slice(0, 10))}"></label>`;

  /** A real checkbox. The input handler reads .checked for these, not
      .value — a checkbox's value is the string "on" whether it is ticked
      or not, which would have saved `published: "on"` forever. */
  const bool = (label, path, hint = '') =>
    `<label class="check"><input type="checkbox" data-path="${path}" data-bool="1"${get(path) ? ' checked' : ''}>
      <span>${esc(label)}${hint ? `<em>${esc(hint)}</em>` : ''}</span></label>`;

  const csv = (label, path, ph = '') =>
    `<label>${esc(label)}<input type="text" data-path="${path}" data-csv="1" value="${esc((get(path) || []).join(', '))}" placeholder="${esc(ph)}"></label>`;

  const head = (i, title, arrPath) => `<div class="item-head">
      <b>${esc(title)} ${String(i + 1).padStart(2, '0')}</b>
      <div class="item-tools">
        <button class="icon-btn" data-move="${arrPath}" data-i="${i}" data-dir="-1" title="Move up">↑</button>
        <button class="icon-btn" data-move="${arrPath}" data-i="${i}" data-dir="1" title="Move down">↓</button>
        <button class="icon-btn del" data-del="${arrPath}" data-i="${i}" title="Delete">✕</button>
      </div>
    </div>`;

  const addBtn = (arrPath, label, tpl) =>
    `<div class="row-actions"><button class="btn ghost tiny" data-add="${arrPath}" data-tpl="${esc(tpl)}">+ ${esc(label)}</button></div>`;

  /** editable list of plain strings (bullets, roles) */
  const lines = (label, arrPath) => {
    const arr = get(arrPath) || [];
    return `<label>${esc(label)}</label><div class="lines">
      ${arr
        .map(
          (v, i) => `<div class="line-row">
            <textarea rows="2" data-path="${arrPath}.${i}">${esc(v)}</textarea>
            <button class="icon-btn del" data-del="${arrPath}" data-i="${i}" title="Delete">✕</button>
          </div>`
        )
        .join('')}
      </div>${addBtn(arrPath, 'Add line', 'string')}`;
  };

  /** image picker with upload */
  const image = (label, path) => {
    const v = get(path) || '';
    return `<div class="thumb-row">
      <div class="thumb">${v ? `<img src="${esc(v)}" alt="">` : ''}</div>
      <div class="grid">
        ${text(label, path, '/assets/img/...')}
        <div class="row-actions">
          <button class="btn ghost tiny" data-upload="${path}">Upload file…</button>
        </div>
      </div>
    </div>`;
  };

  /** Like the image row, but for a document: no thumbnail, a link instead. */
  const file = (label, path) => {
    const v = get(path) || '';
    return `<div class="thumb-row">
      <div class="thumb doc">${v ? '<span>PDF</span>' : ''}</div>
      <div class="grid">
        ${text(label, path, '/assets/uploads/report.pdf')}
        <div class="row-actions">
          <button class="btn ghost tiny" data-upload="${path}">Upload PDF…</button>
          ${v ? `<a class="btn ghost tiny" href="${esc(v)}" target="_blank" rel="noopener">Open</a>` : ''}
        </div>
      </div>
    </div>`;
  };

  /** A list of attachments: any number of files, each with its own label. */
  const attachments = (arrPath) => {
    const arr = get(arrPath) || [];
    return `<label>Attachments — reports, spreadsheets, slides, links</label>
      <div class="lines">
        ${arr.map((f, i) => `<div class="attach-row">
          <input type="text" data-path="${arrPath}.${i}.label" value="${esc(f.label || '')}" placeholder="What it is called">
          <input type="text" data-path="${arrPath}.${i}.url" value="${esc(f.url || '')}" placeholder="/assets/uploads/… or https://…">
          <button class="btn ghost tiny" data-upload="${arrPath}.${i}.url">Upload…</button>
          ${f.url ? `<a class="btn ghost tiny" href="${esc(f.url)}" target="_blank" rel="noopener">Open</a>` : ''}
          <button class="icon-btn del" data-del="${arrPath}" data-i="${i}" title="Delete">✕</button>
        </div>`).join('')}
      </div>
      ${addBtn(arrPath, 'Attach a file or link', 'attachment')}`;
  };

  /* --------------------------------------------------------- tabs */
  const TABS = {
    profile: () => `
      <section class="panel">
        <h2>Profile</h2>
        <p class="desc">The hero section, the photo and the buttons.</p>
        <div class="grid two">
          ${text('Full name', 'profile.name')}
          ${text('Short name', 'profile.shortName')}
          ${text('Job title', 'profile.title')}
          ${text('Availability chip', 'profile.availability')}
          ${text('Location', 'profile.location')}
          ${text('Email', 'profile.email')}
          ${text('Phone', 'profile.phone')}
          ${text('CV link (opens in a new tab)', 'profile.cvUrl', '/assets/files/cv.pdf')}
        </div>
        <div class="grid" style="margin-top:14px">
          ${text('Tagline under the title', 'profile.tagline')}
          ${area('Summary / about text', 'profile.summary', 6)}
        </div>
      </section>

      <section class="panel">
        <h2>Rotating job titles</h2>
        <p class="desc">These type themselves out one after another under your name.</p>
        ${lines('Titles', 'profile.roles')}
      </section>

      <section class="panel">
        <h2>Profile photo</h2>
        <p class="desc">This is also the secret door: 5 clicks on it opens the login box.</p>
        ${image('Photo URL', 'profile.photo')}
      </section>

      <section class="panel">
        <h2>Booking page</h2>
        <p class="desc">Replaces the contact form. Any provider works.</p>
        <div class="note">
          <b>Google Calendar:</b> Create → <b>Appointment schedule</b> → click the block on your calendar → Share → Copy link.
          The link must contain <code>/appointments/schedules/</code>. A <code>?cid=</code> link is a
          "subscribe to my calendar" link and will not work.<br><br>
          <b>Option missing?</b> It is hidden on school and work accounts. Switch to your personal
          Gmail account, or just use <b>Calendly</b> or <b>Cal.com</b> — both are free and both work here.
        </div>
        <div class="grid" style="margin-top:14px">
          ${text('Booking page URL', 'profile.calendarUrl', 'https://calendar.google.com/calendar/appointments/schedules/… or https://calendly.com/…')}
          ${area('Text next to the calendar', 'profile.calendarNote', 3)}
        </div>
      </section>`,

    news: () => `
      <section class="panel">
        <h2>Announcements</h2>
        <p class="desc">
          These appear in their own section on the site and behind the bell in the menu.
          Untick <b>Published</b> to keep one as a draft nobody can see.
        </p>
        <div class="note">
          <b>The ID matters.</b> A visitor's browser remembers which IDs it has already
          opened, and that is how the little "new" dot decides. So fixing a typo in an
          announcement does <b>not</b> ring the bell again for people who already read it —
          and if you want it to, change the ID.
          <br><br>
          Newest date first. A <b>pinned</b> announcement sits above everything regardless of its date.
        </div>
        ${(state.announcements || [])
          .map(
            (a, i) => `<div class="item${a.published === false ? ' muted' : ''}">
              ${head(i, 'ANNOUNCEMENT', 'announcements')}
              ${text('Title', `announcements.${i}.title`)}
              ${area('Text', `announcements.${i}.body`, 4)}
              ${image('Picture (shown beside the text)', `announcements.${i}.image`)}
              ${attachments(`announcements.${i}.files`)}
              <div class="grid three">
                ${date('Date', `announcements.${i}.date`)}
                ${text('Tag', `announcements.${i}.tag`, 'Milestone, Project, Award…')}
                ${text('Link (optional)', `announcements.${i}.link`, '#projects or https://…')}
              </div>
              <div class="grid three">
                ${bool('Published', `announcements.${i}.published`, 'visible on the site')}
                ${bool('Pinned', `announcements.${i}.pinned`, 'always at the top')}
                ${text('ID', `announcements.${i}.id`, 'a-2026-09-01')}
              </div>
            </div>`
          )
          .join('') || '<p class="desc">Nothing yet. The section stays hidden on the site until you publish one.</p>'}
        ${addBtn('announcements', 'Write an announcement', 'announcement')}
      </section>`,

    stats: () => `
      <section class="panel">
        <h2>Highlight numbers</h2>
        <p class="desc">The four counters that animate under the hero.</p>
        ${(state.stats || [])
          .map(
            (s, i) => `<div class="item">
              ${head(i, 'STAT', 'stats')}
              <div class="grid three">
                ${num('Value', `stats.${i}.value`)}
                ${text('Suffix', `stats.${i}.suffix`, '%')}
                ${num('Decimals', `stats.${i}.decimals`, '0')}
              </div>
              <div class="grid two">
                ${text('Label', `stats.${i}.label`)}
                ${text('Detail', `stats.${i}.detail`)}
              </div>
            </div>`
          )
          .join('')}
        ${addBtn('stats', 'Add stat', 'stat')}
      </section>`,

    socials: () => `
      <section class="panel">
        <h2>Social links</h2>
        <p class="desc">Instagram, Facebook, TikTok, LinkedIn, GitHub, X, YouTube, email — paste your real URLs here.</p>
        ${(state.socials || [])
          .map(
            (s, i) => `<div class="item">
              ${head(i, 'LINK', 'socials')}
              <div class="grid three">
                ${text('Label', `socials.${i}.label`)}
                `+`<label>Icon<select data-path="socials.${i}.icon">
                  ${['github', 'linkedin', 'instagram', 'facebook', 'tiktok', 'x', 'youtube', 'mail', 'web']
                    .map((o) => `<option value="${o}"${(state.socials[i].icon || '') === o ? ' selected' : ''}>${o}</option>`)
                    .join('')}
                </select></label>`+`
                ${text('URL', `socials.${i}.url`)}
              </div>
            </div>`
          )
          .join('')}
        ${addBtn('socials', 'Add social link', 'social')}
      </section>`,

    skills: () => `
      <section class="panel">
        <h2>Skills</h2>
        <p class="desc">Each group becomes a card; each level fills an animated bar (0–100).</p>
        ${(state.skills || [])
          .map(
            (g, i) => `<div class="item">
              ${head(i, 'GROUP', 'skills')}
              ${text('Category name', `skills.${i}.category`)}
              ${(g.items || [])
                .map(
                  (it, j) => `<div class="grid two" style="align-items:end">
                    ${text('Skill', `skills.${i}.items.${j}.name`)}
                    <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end">
                      ${num('Level %', `skills.${i}.items.${j}.level`)}
                      <button class="icon-btn del" data-del="skills.${i}.items" data-i="${j}" title="Delete">✕</button>
                    </div>
                  </div>`
                )
                .join('')}
              ${addBtn(`skills.${i}.items`, 'Add skill', 'skill')}
            </div>`
          )
          .join('')}
        ${addBtn('skills', 'Add skill group', 'skillgroup')}
      </section>`,

    languages: () => `
      <section class="panel">
        <h2>Languages</h2>
        ${(state.languages || [])
          .map(
            (l, i) => `<div class="item">
              ${head(i, 'LANG', 'languages')}
              <div class="grid two">
                ${text('Language', `languages.${i}.name`)}
                ${text('Level', `languages.${i}.level`)}
              </div>
            </div>`
          )
          .join('')}
        ${addBtn('languages', 'Add language', 'language')}
      </section>`,

    experience: () => `
      <section class="panel">
        <h2>Experience</h2>
        <p class="desc">Shown as an animated timeline that fills as the visitor scrolls.</p>
        ${(state.experience || [])
          .map(
            (x, i) => `<div class="item">
              ${head(i, 'ROLE', 'experience')}
              <div class="grid two">
                ${text('Job title', `experience.${i}.role`)}
                ${text('Company', `experience.${i}.company`)}
                ${text('Period', `experience.${i}.period`)}
                ${text('Tools used', `experience.${i}.tools`)}
              </div>
              ${lines('Bullet points', `experience.${i}.bullets`)}
            </div>`
          )
          .join('')}
        ${addBtn('experience', 'Add experience', 'experience')}
      </section>`,

    projects: () => `
      <section class="panel">
        <h2>Projects</h2>
        <p class="desc">A photo, the code, and the report. The repository is the one a recruiter actually clicks \u2014 fill it in.</p>
        ${(state.projects || [])
          .map(
            (p, i) => `<div class="item">
              ${head(i, 'PROJECT', 'projects')}
              <div class="grid two">
                ${text('Title', `projects.${i}.title`)}
                ${text('Period', `projects.${i}.period`)}
              </div>
              ${image('Project image', `projects.${i}.image`)}
              ${csv('Tags (comma separated)', `projects.${i}.tags`)}
              <div class="grid two">
                ${text('Code — GitHub repository', `projects.${i}.repo`, 'https://github.com/readaloush/...')}
                ${text('Demo or write-up (optional)', `projects.${i}.link`, 'https://...')}
              </div>
              ${file('Report — PDF', `projects.${i}.report`)}
              ${lines('Bullet points', `projects.${i}.bullets`)}
            </div>`
          )
          .join('')}
        ${addBtn('projects', 'Add project', 'project')}
      </section>`,

    education: () => `
      <section class="panel">
        <h2>Education</h2>
        ${(state.education || [])
          .map(
            (e, i) => `<div class="item">
              ${head(i, 'DEGREE', 'education')}
              <div class="grid two">
                ${text('Degree', `education.${i}.degree`)}
                ${text('School', `education.${i}.school`)}
                ${text('Period', `education.${i}.period`)}
              </div>
              ${area('Note', `education.${i}.note`, 3)}
            </div>`
          )
          .join('')}
        ${addBtn('education', 'Add education', 'education')}
      </section>`,

    sections: () => `
      <section class="panel">
        <h2>Section titles</h2>
        <p class="desc">Rename any heading on the site.</p>
        <div class="grid two">
          ${text('Announcements — small line', 'sections.newsKicker')}
          ${text('Announcements — title', 'sections.newsTitle')}
          ${text('About — small line', 'sections.aboutKicker')}
          ${text('About — title', 'sections.aboutTitle')}
          ${text('Skills — small line', 'sections.skillsKicker')}
          ${text('Skills — title', 'sections.skillsTitle')}
          ${text('Experience — small line', 'sections.experienceKicker')}
          ${text('Experience — title', 'sections.experienceTitle')}
          ${text('Projects — small line', 'sections.projectsKicker')}
          ${text('Projects — title', 'sections.projectsTitle')}
          ${text('Education — small line', 'sections.educationKicker')}
          ${text('Education — title', 'sections.educationTitle')}
          ${text('Contact — small line', 'sections.contactKicker')}
          ${text('Contact — title', 'sections.contactTitle')}
        </div>
      </section>`,

    meta: () => `
      <section class="panel">
        <h2>Theme &amp; SEO</h2>
        <p class="desc">The two accent colours drive every glow, gradient and line on the site.</p>
        <div class="grid two">
          ${text('Accent colour 1', 'meta.accent', '#00e5ff')}
          ${text('Accent colour 2', 'meta.accent2', '#7c5cff')}
          ${text('Browser tab title', 'meta.siteTitle')}
          ${text('Footer note', 'meta.footerNote')}
        </div>
        <div class="grid" style="margin-top:14px">
          ${area('Meta description', 'meta.metaDescription', 3)}
        </div>
      </section>`,

    media: () => `
      <section class="panel">
        <h2>Media library</h2>
        <p class="desc">Everything you have uploaded. Click a file to copy its URL.</p>
        <div class="row-actions" style="margin-bottom:16px">
          <button class="btn primary tiny" data-upload="__library__">Upload a file</button>
        </div>
        <div class="media-grid" id="mediaGrid"><p class="desc">Loading…</p></div>
      </section>`,

    security: () => `
      <section class="panel">
        <h2>Security</h2>
        <div class="note">
          Your password is stored only as a <b>scrypt hash</b> inside <code>data/portfolio.db</code>.
          It is never written into any HTML or JavaScript file, so nobody can read it from the page source.
          Forgot it? Run <code>npm run reset-password</code> in the project folder.
        </div>
        <form id="credForm" class="grid" style="margin-top:18px;max-width:460px">
          <label>Current password<input type="password" name="currentPassword" required autocomplete="current-password"></label>
          <label>New username (optional)<input type="text" name="newUsername" autocomplete="username"></label>
          <label>New password (optional, min 8 chars)<input type="password" name="newPassword" autocomplete="new-password"></label>
          <button class="btn primary" type="submit">Update credentials</button>
        </form>
      </section>`
  };

  const TEMPLATES = {
    string: () => '',
    /* Dated today and given an id derived from today, because the two
       fields people forget to fill in are the two that decide the order
       and the unread dot. A new one starts published — you opened this
       panel to say something, not to file a draft. */
    announcement: () => {
      const today = new Date().toISOString().slice(0, 10);
      const existing = new Set((state.announcements || []).map((a) => a.id));
      let id = 'a-' + today, n = 2;
      while (existing.has(id)) id = `a-${today}-${n++}`;
      return { id, title: 'New announcement', body: '', date: today, tag: '', link: '', image: '', files: [], pinned: false, published: true };
    },
    stat: () => ({ value: 0, suffix: '', decimals: 0, label: 'New stat', detail: '' }),
    social: () => ({ label: 'New link', icon: 'web', url: 'https://' }),
    skill: () => ({ name: 'New skill', level: 70 }),
    skillgroup: () => ({ category: 'New group', items: [{ name: 'New skill', level: 70 }] }),
    language: () => ({ name: 'Language', level: 'Level' }),
    experience: () => ({ role: 'New role', company: '', period: '', tools: '', bullets: [''] }),
    project: () => ({ title: 'New project', period: '', image: '/assets/img/project-waste.svg', tags: [], repo: '', link: '', report: '', bullets: [''] }),
    education: () => ({ degree: 'New degree', school: '', period: '', note: '' }),
    attachment: () => ({ label: '', url: '' })
  };

  function renderTab() {
    $('#pane').innerHTML = TABS[tab] ? TABS[tab]() : '';
    $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    if (tab === 'media') loadMedia();
    if (tab === 'security') bindCredForm();
  }

  /* ------------------------------------------------------ binding */
  $('#pane').addEventListener('input', (e) => {
    const el = e.target;
    const path = el.dataset.path;
    if (!path) return;
    // Checkboxes fire input *and* change. This handler would read .value,
    // which for a checkbox is the string "on" no matter what state it is
    // in, so `published` would be saved as "on" and could never be turned
    // off. They are handled in the change listener below instead.
    if (el.dataset.bool) return;
    let v = el.value;
    if (el.dataset.num) v = v === '' ? 0 : Number(v);
    if (el.dataset.csv) v = v.split(',').map((s) => s.trim()).filter(Boolean);
    set(path, v);
    if (path.endsWith('.image') || path === 'profile.photo') {
      const thumb = el.closest('.thumb-row')?.querySelector('.thumb');
      if (thumb) thumb.innerHTML = v ? `<img src="${esc(v)}" alt="">` : '';
    }
  });

  $('#pane').addEventListener('change', (e) => {
    const el = e.target;
    if (!el.dataset.path) return;
    if (el.tagName === 'SELECT') return set(el.dataset.path, el.value);

    // A checkbox reports value "on" whether or not it is ticked, so it has
    // to be read from .checked. Ticking Published is also the one edit
    // that changes how the row *looks*, so redraw the tab for it.
    if (el.dataset.bool) {
      set(el.dataset.path, el.checked);
      if (el.dataset.path.endsWith('.published')) renderTab();
    }
  });

  $('#pane').addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    const del = e.target.closest('[data-del]');
    const move = e.target.closest('[data-move]');
    const up = e.target.closest('[data-upload]');

    if (add) {
      e.preventDefault();
      const arr = get(add.dataset.add) || [];
      arr.push(TEMPLATES[add.dataset.tpl] ? TEMPLATES[add.dataset.tpl]() : '');
      set(add.dataset.add, arr);
      renderTab();
    }
    if (del) {
      e.preventDefault();
      const arr = get(del.dataset.del) || [];
      arr.splice(Number(del.dataset.i), 1);
      set(del.dataset.del, arr);
      renderTab();
    }
    if (move) {
      e.preventDefault();
      const arr = get(move.dataset.move) || [];
      const i = Number(move.dataset.i);
      const j = i + Number(move.dataset.dir);
      if (j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      set(move.dataset.move, arr);
      renderTab();
    }
    if (up) {
      e.preventDefault();
      pickFile(up.dataset.upload);
    }
  });

  /* -------------------------------------------------------- upload */
  let uploadTarget = null;
  function pickFile(path) {
    uploadTarget = path;
    const input = $('#hiddenFile');
    input.value = '';
    input.click();
  }
  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result).split(',')[1]);
      fr.onerror = () => reject(new Error('Could not read the file.'));
      fr.readAsDataURL(file);
    });

  /* The browser is the one that decides `file.type`, and it is not always
     right or even present. Windows reports an empty string for Office
     files when the registry entry is missing, and .csv is regularly
     announced as application/vnd.ms-excel. The server judges by MIME, so
     an empty or surprising type means a rejection the person cannot act
     on — "that file type is not allowed" about a perfectly normal .docx.

     The extension is the thing the person can actually see, so it is what
     we fall back to. The server still decides; this only stops us sending
     it a blank. */
  const BY_EXTENSION = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    rtf: 'application/rtf',
    csv: 'text/csv',
    txt: 'text/plain',
    zip: 'application/zip',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml'
  };

  const mimeOf = (file) => {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    // The extension wins whenever we recognise it: a .csv announced as
    // vnd.ms-excel would be saved with an .xls extension and then refuse
    // to open in Excel, which is a worse outcome than trusting the name.
    return BY_EXTENSION[ext] || file.type || '';
  };

  $('#hiddenFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      toast('Uploading…');
      const data = await api('/api/upload', {
        method: 'POST',
        body: JSON.stringify({
          filename: file.name,
          mimetype: mimeOf(file),
          data: await toBase64(file)
        })
      });
      if (uploadTarget && uploadTarget !== '__library__') {
        set(uploadTarget, data.url);
        renderTab();
        toast('Uploaded and linked. Do not forget to save.');
      } else {
        toast('Uploaded: ' + data.url);
        if (tab === 'media') loadMedia();
      }
    } catch (err) {
      toast(err.message, true);
    }
  });

  /* The media grid used to test for exactly one non-image type, PDF, and
     put an <img> tag on everything else. A spreadsheet rendered as a
     broken image icon. The extension is the honest label. */
  const docLabel = (m) => {
    const ext = (String(m.filename || m.url).split('.').pop() || '').toUpperCase();
    return ext.length <= 5 ? ext : 'FILE';
  };

  async function loadMedia() {
    try {
      const { media } = await api('/api/media');
      const grid = $('#mediaGrid');
      if (!media.length) { grid.innerHTML = '<p class="desc">Nothing uploaded yet.</p>'; return; }
      grid.innerHTML = media
        .map(
          (m) => `<div class="media-cell" data-url="${esc(m.url)}" title="Click to copy">
            ${/^image\//.test(m.mimetype) ? `<img src="${esc(m.url)}" alt="">` : `<div class="media-doc">${esc(docLabel(m))}</div>`}
            <p>${esc(m.filename)}</p>
          </div>`
        )
        .join('');
      $$('.media-cell', grid).forEach((c) =>
        c.addEventListener('click', () => {
          navigator.clipboard?.writeText(c.dataset.url);
          toast('URL copied: ' + c.dataset.url);
        })
      );
    } catch (err) {
      $('#mediaGrid').innerHTML = `<p class="desc">${esc(err.message)}</p>`;
    }
  }

  /* --------------------------------------------------------- save */
  async function save() {
    try {
      const data = await api('/api/content', { method: 'PUT', body: JSON.stringify({ content: state }) });
      dirty = false;
      $('#savedAt').textContent = 'saved ' + new Date().toLocaleTimeString();
      toast('Saved to the database.');
      return data;
    } catch (err) {
      toast(err.message, true);
    }
  }

  $('#saveBtn').addEventListener('click', save);
  addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
  });
  addEventListener('beforeunload', (e) => {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  $('#logoutBtn').addEventListener('click', async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    setToken('');
    location.href = '/';
  });

  $$('#tabs button').forEach((b) =>
    b.addEventListener('click', () => { tab = b.dataset.tab; renderTab(); })
  );

  function bindCredForm() {
    $('#credForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        const data = await api('/api/auth/credentials', {
          method: 'POST',
          body: JSON.stringify({
            currentPassword: f.currentPassword.value,
            newUsername: f.newUsername.value,
            newPassword: f.newPassword.value
          })
        });
        setToken('');
        toast(data.message);
        setTimeout(() => location.reload(), 1400);
      } catch (err) {
        toast(err.message, true);
      }
    });
  }

  /* --------------------------------------------------------- gate */
  $('#gateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const errorEl = $('#gateError');
    errorEl.hidden = true;
    try {
      const out = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: f.username.value, password: f.password.value })
      });
      if (out.token) setToken(out.token);
      await start();          // awaited, so any later failure is actually reported
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
      const card = $('.gate-card');
      card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
    }
  });

  async function start() {
    const me = await api('/api/auth/me');
    const { content } = await api('/api/content');
    state = content;
    $('#whoami').textContent = me.username;
    $('#gate').hidden = true;
    $('#app').hidden = false;

    // /admin#news opens straight on that tab. The admin bar on the site
    // links here, so "Announcement" is one click from anywhere.
    const wanted = location.hash.replace('#', '');
    if (wanted && TABS[wanted]) tab = wanted;

    renderTab();
  }

  (async () => {
    try { await start(); } catch { $('#gate').hidden = false; }
  })();
})();
