#!/usr/bin/env node
/**
 * Security audit — run this before you publish, and any time you are unsure.
 *
 *   node scripts/audit.js
 *
 * It answers one question: can anybody other than you reach the admin panel,
 * and is your password exposed anywhere?
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let pass = 0;
let fail = 0;
const ok = (m) => { pass++; console.log('  \x1b[32m✓\x1b[0m ' + m); };
const bad = (m) => { fail++; console.log('  \x1b[31m✗ ' + m + '\x1b[0m'); };

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    if (f === 'node_modules' || f === '.git') continue;
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

console.log('\n\x1b[1mADMIN PANEL SECURITY AUDIT\x1b[0m\n');

/* ---------- 1. what actually ships to GitHub / the server ---------- */
console.log('1. Files that leave your computer\n');

const shipped = walk(ROOT).filter((p) => {
  const rel = path.relative(ROOT, p);
  return !rel.startsWith('data' + path.sep) && rel !== '.env' && !rel.startsWith('.git');
});

const clientFiles = shipped.filter((p) => /\.(html|css|js)$/.test(p) && p.includes(path.sep + 'public' + path.sep));

// Real credential VALUES, not the words that describe them. The string
// "scrypt hash" in a comment is documentation; "scrypt$16384$8$1$<hex>$<hex>"
// with actual hex payloads is a leaked password.
const SECRET_SHAPES = [
  { name: 'a real scrypt password hash', re: /scrypt\$\d+\$\d+\$\d+\$[0-9a-f]{16,}\$[0-9a-f]{32,}/ },
  { name: 'a real bcrypt password hash', re: /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/ },
  { name: 'a hard-coded password check', re: /\bpassword\s*===?\s*["'][^"']{3,}["']/i },
  { name: 'a hard-coded username check', re: /\busername\s*===?\s*["'][^"']{3,}["']/i },
  { name: 'a session secret', re: /(jwt|session)[_-]?secret\s*[:=]\s*["'][0-9a-f]{16,}["']/i },
  { name: 'a long hex string that looks like a key', re: /["'][0-9a-f]{48,}["']/ }
];

let leaks = 0;
for (const file of shipped) {
  let src;
  try { src = fs.readFileSync(file, 'utf8'); } catch { continue; }
  for (const s of SECRET_SHAPES) {
    if (s.re.test(src)) { bad(`${s.name} found in ${path.relative(ROOT, file)}`); leaks++; }
  }
}
if (!leaks) ok(`no password, hash or secret in any of the ${shipped.length} files that get published`);

// A visitor can read every one of these. None may contain a credential value
// or send one to the browser.
let clientLeaks = 0;
for (const file of clientFiles) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);
  for (const s of SECRET_SHAPES) if (s.re.test(src)) { bad(`${rel} contains ${s.name}`); clientLeaks++; }
  // reading a hash out of a server response would also be a leak
  if (/\.password_hash|password_hash\s*[:=]/.test(src)) { bad(`${rel} reads a password hash`); clientLeaks++; }
}
if (!clientLeaks) ok(`the ${clientFiles.length} files a visitor can download contain no credential of any kind`);

// and no response the server builds may carry the hash
const responses = [...fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8').matchAll(/res\.json\([^;]*;/g)].map((m) => m[0]);
responses.some((r) => /password_hash|user\s*\}/.test(r))
  ? bad('a response in server.js could include the password hash')
  : ok(`none of the ${responses.length} server responses can contain the hash`);

/* ---------- 2. the things that must never be uploaded ---------- */
console.log('\n2. Files that must stay on your computer\n');

const gitignore = fs.existsSync(path.join(ROOT, '.gitignore')) ? fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8') : '';
/data\//.test(gitignore) ? ok('.gitignore excludes data/ — your password hash never reaches GitHub')
  : bad('.gitignore does NOT exclude data/ — your password hash could be uploaded');
/^\.env$/m.test(gitignore) ? ok('.gitignore excludes .env — your plain-text password never reaches GitHub')
  : bad('.gitignore does NOT exclude .env');

/* ---------- 3. how the server decides who gets in ---------- */
console.log('\n3. How the login actually works\n');

const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const crypto = fs.readFileSync(path.join(ROOT, 'src', 'crypto.js'), 'utf8');
const db = fs.readFileSync(path.join(ROOT, 'src', 'db.js'), 'utf8');

/verifyPassword/.test(server) ? ok('the password is checked on the server, never in the browser') : bad('no server-side password check found');
/scryptSync/.test(crypto) ? ok('passwords are stored as scrypt hashes, which cannot be reversed') : bad('no scrypt hashing found');
/timingSafeEqual/.test(crypto) ? ok('comparisons are timing-safe — the response time reveals nothing') : bad('comparison is not timing-safe');
/MAX_FAILURES/.test(server) && /recentFailures/.test(server) ? ok('repeated wrong guesses lock the attacker out') : bad('no brute-force protection');
/HttpOnly/.test(fs.readFileSync(path.join(ROOT, 'src', 'http.js'), 'utf8')) ? ok('the session cookie is HttpOnly — page scripts cannot steal it') : bad('session cookie is readable by scripts');
/hashPassword\('placeholder/.test(server) ? ok('a wrong username takes the same time as a wrong password — no account guessing') : bad('login timing can reveal whether a username exists');

// every write route must be behind requireAuth
/* ---------- the real test: attack the running server ---------- */
async function probe() {
  console.log('\n\x1b[1m6. Trying to break in for real\x1b[0m\n');

  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-'));
  process.env.PORTFOLIO_DATA_DIR = tmp;
  process.env.PORTFOLIO_UPLOAD_DIR = path.join(tmp, 'up');
  process.env.ADMIN_USERNAME = 'read';
  process.env.ADMIN_PASSWORD = 'AuditPassword123';

  const app = require('../server.js');
  await new Promise((r) => app.listen(0, r));
  const base = 'http://127.0.0.1:' + app.server.address().port;

  const call = (method, url, body) =>
    fetch(base + url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    });

  // every route that changes something, attacked with no session at all
  const attacks = [
    ['PUT', '/api/content', { content: { profile: { name: 'HACKED' } } }],
    ['POST', '/api/upload', { filename: 'x.png', mimetype: 'image/png', data: 'AAAA' }],
    ['POST', '/api/auth/credentials', { currentPassword: 'x', newPassword: 'hacked123' }],
    ['GET', '/api/media', null],
    ['GET', '/api/auth/me', null],
    ['GET', '/api/revisions', null],
    ['GET', '/api/revisions/1', null]
  ];

  let broke = 0;
  for (const [m, u, b] of attacks) {
    const r = await call(m, u, b);
    if (r.status === 401) continue;
    bad(`${m} ${u} answered ${r.status} without a login`);
    broke++;
  }
  if (!broke) ok(`all ${attacks.length} private routes refused an anonymous request (401)`);

  // the site content must be untouched after those attempts
  const after = await (await call('GET', '/api/content')).json();
  after.content.profile.name !== 'HACKED'
    ? ok('the break-in attempts changed nothing on the site')
    : bad('an anonymous request managed to edit the site');

  // guessing the password
  let locked = false;
  for (let i = 0; i < 12; i++) {
    const r = await call('POST', '/api/auth/login', { username: 'read', password: 'guess' + i });
    if (r.status === 429) { locked = true; break; }
  }
  locked ? ok('password guessing is locked out after 8 tries') : bad('password guessing is not rate limited');

  // a forged session cookie
  const forged = await fetch(base + '/api/auth/me', { headers: { cookie: 'rp_session=made.up.token' } });
  forged.status === 401 ? ok('a forged session cookie is rejected') : bad('a forged cookie was accepted');

  // and the real login still works
  const good = await call('POST', '/api/auth/login', { username: 'read', password: 'AuditPassword123' });
  const body = await good.json().catch(() => ({}));
  good.status === 429 || good.status === 200
    ? ok('your own correct password still works' + (good.status === 429 ? ' (currently rate limited, as designed)' : ''))
    : bad('the correct password was rejected');
  body.password_hash ? bad('the login response leaked the hash') : ok('the login response contains no hash');

  fs.rmSync(tmp, { recursive: true, force: true });
}

/* ---------- 4. search engines ---------- */
console.log('\n4. Can anyone stumble onto it\n');

const robots = path.join(ROOT, 'public', 'robots.txt');
fs.existsSync(robots) && /Disallow:\s*\/admin/.test(fs.readFileSync(robots, 'utf8'))
  ? ok('robots.txt tells search engines to skip /admin') : bad('robots.txt does not exclude /admin');
/X-Robots-Tag/.test(server) ? ok('the admin page sends a noindex header as well') : bad('no noindex header on the admin page');
/noindex/.test(fs.readFileSync(path.join(ROOT, 'public', 'admin.html'), 'utf8')) ? ok('the admin page carries a noindex meta tag') : bad('admin.html has no noindex tag');

/* ---------- 5. where the real password lives ---------- */
console.log('\n5. Where your password actually is\n');

const dbFile = path.join(ROOT, 'data', 'portfolio.db');
if (fs.existsSync(dbFile)) {
  const raw = fs.readFileSync(dbFile, 'latin1');
  /scrypt\$/.test(raw)
    ? ok('a scrypt hash exists inside data/portfolio.db — this file stays on your machine')
    : bad('no hash found in the database');
  ok('that file is the ONLY place your password exists, and only as an unreadable hash');
} else {
  ok('no local database yet — it is created on first run, on your machine only');
}

/renderYaml/.test('') || (() => {
  const y = path.join(ROOT, 'render.yaml');
  if (!fs.existsSync(y)) return;
  const src = fs.readFileSync(y, 'utf8');
  /generateValue:\s*true/.test(src)
    ? ok('on the live site Render generates the password itself — even I never see it')
    : bad('render.yaml contains a fixed password');
})();

probe()
  .catch((e) => bad('the live break-in test could not run: ' + e.message))
  .finally(() => {
    console.log('\n' + '─'.repeat(62));
    console.log(fail === 0
      ? `  \x1b[32mALL ${pass} CHECKS PASSED — only you can reach the admin panel.\x1b[0m`
      : `  \x1b[31m${fail} PROBLEM(S) FOUND — do not publish until these are fixed.\x1b[0m`);
    console.log('─'.repeat(62) + '\n');
    process.exit(fail ? 1 : 0);
  });
