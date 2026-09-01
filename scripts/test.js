#!/usr/bin/env node
/**
 * End-to-end check. Boots the server on a temporary database and exercises
 * every endpoint, then asserts that no credentials leak into the HTML.
 *
 *   npm test
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-test-'));
process.env.PORTFOLIO_DATA_DIR = TMP;
process.env.ADMIN_USERNAME = 'read';
process.env.ADMIN_PASSWORD = 'SuperSecret123';
process.env.PORT = '0';

const app = require('../server');
const store = require('../src/db');

let base, cookie = '';
const ok = (m) => console.log('  ✓ ' + m);

async function call(method, url, body) {
  const headers = { cookie };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of setCookie) cookie = c.split(';')[0];
  const type = res.headers.get('content-type') || '';
  return { status: res.status, body: type.includes('json') ? await res.json() : await res.text(), headers: res.headers };
}

(async () => {
  await new Promise((r) => app.listen(0, r));
  base = 'http://127.0.0.1:' + app.server.address().port;
  console.log('\nTesting ' + base + '  (driver: ' + store.db.__driver + ')\n');

  /* ---------- public content ---------- */
  let r = await call('GET', '/api/content');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.content.profile.name, 'READ LEVA ALALLOŞ');
  assert.strictEqual(r.body.content.projects.length, 3);
  assert.strictEqual(r.body.content.experience.length, 3);
  assert.strictEqual(r.body.content.skills.length, 4);
  ok('GET /api/content serves the CV data from SQLite');

  /* ---------- static pages ---------- */
  r = await call('GET', '/');
  assert.strictEqual(r.status, 200);
  assert.ok(r.body.includes('site-loader'), 'signature loader present');
  assert.ok(r.body.includes('photoSignature'), 'signature under the photo present');
  assert.ok(r.body.includes('themeSwitch'), 'electric switch present');
  assert.ok(r.body.includes('netCanvas'), 'network background present');
  ok('GET / serves the portfolio with loader, switch and network canvas');

  r = await call('GET', '/admin');
  assert.strictEqual(r.status, 200);
  assert.ok(r.body.includes('Control room'));
  ok('GET /admin serves the hidden panel');

  for (const asset of ['/assets/css/style.css', '/assets/js/app.js', '/assets/js/signature.js', '/assets/js/sound.js', '/assets/img/profile.svg', '/assets/files/cv.pdf']) {
    r = await call('GET', asset);
    assert.strictEqual(r.status, 200, asset + ' should exist');
  }
  ok('CSS, JS, images and the CV PDF are all served');

  /* ---------- no credentials in any client file ---------- */
  const clientFiles = [];
  (function walk(dir) {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (/\.(html|js|css)$/.test(f)) clientFiles.push(p);
    }
  })(path.join(__dirname, '..', 'public'));

  for (const f of clientFiles) {
    const src = fs.readFileSync(f, 'utf8');
    assert.ok(!src.includes('SuperSecret123'), 'password leaked into ' + f);
    assert.ok(!/password_hash/.test(src), 'hash referenced in ' + f);
    assert.ok(!/scrypt\$/.test(src), 'hash leaked into ' + f);
  }
  ok('No password or hash appears in any HTML/CSS/JS file (' + clientFiles.length + ' checked)');

  /* ---------- [hidden] must actually hide ----------
     A class rule like `.gate { display: grid }` silently overrides the
     browser's built-in `[hidden] { display: none }`. That once made the
     admin panel look like it never opened, so it is now checked. */
  {
    /* refine.css was missing from this list, and it is now the largest
       stylesheet on the site — the five modes, the tiers and everything
       added since live in it. A guard that does not read the file where
       the rules are is not a guard; it passed for months by not looking.
       It caught .adminbar the moment it was added. */
    const css = ['style.css', 'refine.css', 'admin.css']
      .map((f) => fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'css', f), 'utf8'))
      .join('\n');

    // every id -> the classes on that element, so #gate also implies .gate
    const classesOfId = new Map();
    const htmlFiles = ['index.html', 'admin.html'].map((f) =>
      fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8')
    );
    for (const html of htmlFiles) {
      for (const tag of html.matchAll(/<[a-z]+[^>]*>/gi)) {
        const id = /\bid=["']([^"']+)["']/.exec(tag[0]);
        const cls = /\bclass=["']([^"']+)["']/.exec(tag[0]);
        if (id) classesOfId.set(id[1], cls ? cls[1].split(/\s+/).filter(Boolean) : []);
      }
    }

    const toggled = new Set();
    const addTarget = (sel) => {
      toggled.add(sel);
      if (sel.startsWith('#')) (classesOfId.get(sel.slice(1)) || []).forEach((c) => toggled.add('.' + c));
    };

    for (const html of htmlFiles) {
      // real `hidden` attribute only — not `aria-hidden`, not `data-hidden`
      for (const tag of html.matchAll(/<[a-z]+[^>]*\s(?<![-\w])hidden(?=[\s>])[^>]*>/gi)) {
        const id = /\bid=["']([^"']+)["']/.exec(tag[0]);
        const cls = /\bclass=["']([^"']+)["']/.exec(tag[0]);
        if (id) toggled.add('#' + id[1]);
        if (cls) cls[1].split(/\s+/).filter(Boolean).forEach((c) => toggled.add('.' + c));
      }
    }
    // also anything JS flips via .hidden = true / false
    for (const file of ['app.js', 'admin.js', 'sound.js']) {
      const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'js', file), 'utf8');
      for (const m of js.matchAll(/\$\(['"](#[\w-]+)['"]\)\.hidden\s*=/g)) addTarget(m[1]);
      for (const m of js.matchAll(/\b([a-zA-Z]\w*)\.hidden\s*=\s*(?:true|false)/g)) {
        const varName = m[1];
        const decl = new RegExp(`\\b${varName}\\s*=\\s*\\$\\(['"](#[\\w-]+)['"]\\)`).exec(js);
        if (decl) addTarget(decl[1]);
      }
    }

    for (const sel of toggled) {
      const escaped = sel.replace(/[.#]/g, '\\$&');
      const setsDisplay = new RegExp(`${escaped}\\s*(?:,[^{]*)?\\{[^}]*display\\s*:`, 'i').test(css);
      if (!setsDisplay) continue;
      const hasOverride = new RegExp(`${escaped}\\[hidden\\]`, 'i').test(css);
      assert.ok(hasOverride, `${sel} sets "display" but has no ${sel}[hidden] rule — it would stay visible when hidden`);
    }
    ok(`Every element toggled with [hidden] really disappears (${toggled.size} checked)`);
  }

  /* ---------- auth is required ---------- */
  r = await call('PUT', '/api/content', { content: { hacked: true } });
  assert.strictEqual(r.status, 401);
  r = await call('GET', '/api/media');
  assert.strictEqual(r.status, 401);
  r = await call('POST', '/api/upload', { filename: 'x.png', mimetype: 'image/png', data: 'AAAA' });
  assert.strictEqual(r.status, 401);
  ok('Writing, uploading and the media list all require a session');

  /* ---------- bad login ---------- */
  r = await call('POST', '/api/auth/login', { username: 'read', password: 'wrong' });
  assert.strictEqual(r.status, 401);
  r = await call('POST', '/api/auth/login', { username: 'nobody', password: 'whatever' });
  assert.strictEqual(r.status, 401);
  ok('Wrong credentials are rejected');

  /* ---------- good login ---------- */
  r = await call('POST', '/api/auth/login', { username: 'read', password: 'SuperSecret123' });
  assert.strictEqual(r.status, 200);
  assert.ok(cookie.startsWith('rp_session='), 'session cookie set');
  const rawCookie = r.headers.getSetCookie()[0];
  assert.ok(/HttpOnly/i.test(rawCookie), 'cookie must be HttpOnly');
  assert.ok(/SameSite=Lax/i.test(rawCookie), 'cookie must be SameSite');
  ok('Login works and returns an HttpOnly session cookie');

  r = await call('GET', '/api/auth/me');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.username, 'read');
  assert.ok(!('password_hash' in r.body), 'hash must never be sent to the browser');
  ok('Session identifies the user without exposing the hash');

  /* ---------- editing everything ---------- */
  const { content } = (await call('GET', '/api/content')).body;
  content.profile.name = 'READ ALALLOŞ';
  content.profile.calendarUrl = 'https://calendar.google.com/calendar/appointments/schedules/TEST';
  content.socials[0].url = 'https://github.com/readalallos';
  content.projects[0].title = 'Renamed project';
  content.projects.push({ title: 'Fourth project', period: '2026', tags: ['x'], bullets: ['b'], image: '' });
  content.experience[0].role = 'Senior AI Engineer';
  content.skills[0].items[0].level = 99;
  content.education[0].degree = 'MSc Information Technologies';
  content.meta.accent = '#ff0066';
  r = await call('PUT', '/api/content', { content });
  assert.strictEqual(r.status, 200);

  const after = (await call('GET', '/api/content')).body.content;
  assert.strictEqual(after.profile.name, 'READ ALALLOŞ');
  assert.strictEqual(after.projects.length, 4);
  assert.strictEqual(after.projects[0].title, 'Renamed project');
  assert.strictEqual(after.experience[0].role, 'Senior AI Engineer');
  assert.strictEqual(after.skills[0].items[0].level, 99);
  assert.strictEqual(after.socials[0].url, 'https://github.com/readalallos');
  assert.strictEqual(after.meta.accent, '#ff0066');
  ok('Every section (name, socials, projects, experience, skills, education, colours) is editable');

  r = await call('GET', '/api/revisions');
  assert.strictEqual(r.status, 200);
  assert.ok(r.body.revisions.length >= 1);
  ok('Previous versions are kept as revisions');

  /* ---------- upload ---------- */
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  r = await call('POST', '/api/upload', { filename: 'My Photo!.png', mimetype: 'image/png', data: png.toString('base64') });
  assert.strictEqual(r.status, 200);
  assert.ok(/^\/assets\/uploads\/my-photo-[0-9a-f]{8}\.png$/.test(r.body.url), 'safe filename: ' + r.body.url);
  const served = await call('GET', r.body.url);
  assert.strictEqual(served.status, 200);
  ok('Image upload works and the file is served back');

  r = await call('POST', '/api/upload', { filename: 'evil.exe', mimetype: 'application/x-msdownload', data: 'AAAA' });
  assert.strictEqual(r.status, 400);
  ok('Dangerous file types are rejected');

  r = await call('GET', '/api/media');
  assert.strictEqual(r.body.media.length, 1);
  ok('Media library lists uploads');

  /* ---------- path traversal (raw sockets, so the path is not normalised) ---------- */
  const net = require('net');
  const rawGet = (rawPath) =>
    new Promise((resolve) => {
      const sock = net.connect(app.server.address().port, '127.0.0.1', () => {
        sock.write(`GET ${rawPath} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n`);
      });
      let out = '';
      sock.on('data', (d) => (out += d));
      sock.on('end', () => resolve(out));
      sock.on('error', () => resolve(''));
    });

  for (const attack of ['/../server.js', '/../../../etc/passwd', '/assets/../../server.js', '/%2e%2e%2fserver.js', '/../data/portfolio.db']) {
    const out = await rawGet(attack);
    assert.ok(!out.includes('require(\'./src/db\')'), 'server source leaked via ' + attack);
    assert.ok(!out.includes('root:x:'), '/etc/passwd leaked via ' + attack);
    assert.ok(!out.includes('scrypt$'), 'password hash leaked via ' + attack);
  }
  ok('Path traversal cannot reach the source, the database or system files');

  /* ---------- change credentials ---------- */
  r = await call('POST', '/api/auth/credentials', { currentPassword: 'nope', newPassword: 'Whatever123' });
  assert.strictEqual(r.status, 403);
  r = await call('POST', '/api/auth/credentials', { currentPassword: 'SuperSecret123', newUsername: 'readx', newPassword: 'BrandNewPass1' });
  assert.strictEqual(r.status, 200);

  r = await call('POST', '/api/auth/login', { username: 'readx', password: 'BrandNewPass1' });
  assert.strictEqual(r.status, 200);
  ok('Username and password can be changed from the panel');

  /* ---------- logout ---------- */
  await call('POST', '/api/auth/logout');
  r = await call('GET', '/api/auth/me');
  assert.strictEqual(r.status, 401);
  ok('Logout clears the session');

  /* ---------- brute force ---------- */
  for (let i = 0; i < 10; i++) await call('POST', '/api/auth/login', { username: 'readx', password: 'bad' + i });
  r = await call('POST', '/api/auth/login', { username: 'readx', password: 'BrandNewPass1' });
  assert.strictEqual(r.status, 429, 'should be rate limited');
  ok('Brute-force attempts are locked out after 8 tries');

  console.log('\n  ALL TESTS PASSED\n');
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(0);
})().catch((e) => {
  console.error('\n  TEST FAILED:', e.message);
  console.error(e);
  process.exit(1);
});
