/**
 * Portfolio server — zero npm packages, Node's built-ins only.
 *
 *   node server.js
 *
 * Public site : http://localhost:3000
 * Admin panel : http://localhost:3000/admin
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// tiny .env loader (so we don't need the dotenv package)
(function loadEnv() {
  const file = path.join(__dirname, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/g, '');
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
})();

const { createApp } = require('./src/http');
const auth = require('./src/crypto');
const store = require('./src/db');

const PORT = Number(process.env.PORT) || 3000;
const COOKIE = 'rp_session';
const MAX_FAILURES = 8;
const PUBLIC_DIR = path.join(__dirname, 'public');

store.bootstrap();
const SECRET = store.getJwtSecret();
const SECURE = process.env.NODE_ENV === 'production';

/* The panel sends files as base64 inside a JSON body, and base64 costs
   about a third more bytes than the file it encodes. So the request limit
   has to sit comfortably above MAX_UPLOAD or a 25 MB deck would be cut off
   by the transport before the upload handler ever got to judge it — and the
   error you would see would be "payload too large", not "file too large",
   which sends you looking in the wrong place. */
const app = createApp({ bodyLimit: 36 * 1024 * 1024 });
app.staticDir = PUBLIC_DIR;

/* Log API traffic so problems are visible in the terminal window. */
function logApi(req, status, note = '') {
  const stamp = new Date().toTimeString().slice(0, 8);
  const how = req.cookies[COOKIE] ? 'cookie' : (req.headers.authorization ? 'header' : 'none');
  console.log(`  ${stamp}  ${String(status).padEnd(3)} ${req.method.padEnd(4)} ${req.url.padEnd(24)} session:${how} ${note}`);
}

/* ------------------------------------------------------------ helpers */

/**
 * The session token normally travels in an HttpOnly cookie. Some browsers
 * (and strict privacy settings) refuse cookies on localhost, so we also
 * accept the same token in an Authorization header as a fallback.
 */
function currentUser(req) {
  let token = req.cookies[COOKIE];
  if (!token) {
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) token = header.slice(7).trim();
  }
  const payload = auth.verifyToken(token, SECRET);
  return payload ? store.findUserById(payload.uid) : null;
}

function requireAuth(req, res) {
  const user = currentUser(req);
  if (!user) {
    res.json(401, { error: 'Not authenticated.' });
    return null;
  }
  return user;
}

/* --------------------------------------------------------------- auth */

app.post('/api/auth/login', (req, res) => {
  const ip = req.ip;
  const { username, password } = req.body || {};

  if (store.recentFailures(ip) >= MAX_FAILURES) {
    return res.json(429, { error: 'Too many attempts. Try again in 15 minutes.' });
  }
  if (!username || !password) {
    store.recordAttempt(ip, username, false);
    return res.json(400, { error: 'Username and password are required.' });
  }

  const user = store.findUser(username);
  // always run a hash comparison so timing does not reveal whether the user exists
  const stored = user ? user.password_hash : auth.hashPassword('placeholder-value');
  const ok = auth.verifyPassword(String(password), stored) && !!user;

  store.recordAttempt(ip, username, ok);
  logApi(req, ok ? 200 : 401, ok ? '→ LOGIN OK' : '→ wrong password');
  if (!ok) {
    const left = Math.max(0, MAX_FAILURES - store.recentFailures(ip));
    return res.json(401, { error: `Wrong credentials. ${left} attempt(s) left.` });
  }

  const token = auth.signToken({ uid: user.id, u: user.username }, SECRET);
  res.setCookie(COOKIE, token, { maxAge: 8 * 60 * 60, secure: SECURE });
  // `token` is the cookie fallback described above — it is a short-lived
  // session key, never the password.
  res.json(200, { ok: true, username: user.username, token });
});

app.post('/api/auth/logout', (req, res) => {
  res.setCookie(COOKIE, '', { maxAge: 0, secure: SECURE });
  res.json(200, { ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const user = currentUser(req);
  logApi(req, user ? 200 : 401, user ? '→ panel opens' : '→ shows login form');
  if (!user) return res.json(401, { error: 'Not authenticated.' });
  res.json(200, { username: user.username, updatedAt: user.updated_at });
});

app.post('/api/auth/credentials', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { currentPassword, newUsername, newPassword } = req.body || {};
  if (!auth.verifyPassword(String(currentPassword || ''), user.password_hash)) {
    return res.json(403, { error: 'Current password is incorrect.' });
  }
  if (newUsername && newUsername.trim().length >= 3) {
    const clash = store.findUser(newUsername);
    if (clash && clash.id !== user.id) return res.json(409, { error: 'That username is taken.' });
    store.updateUsername(user.id, newUsername);
  }
  if (newPassword) {
    if (String(newPassword).length < 8) return res.json(400, { error: 'New password must be at least 8 characters.' });
    store.updatePassword(user.id, String(newPassword));
  }
  res.setCookie(COOKIE, '', { maxAge: 0, secure: SECURE });
  res.json(200, { ok: true, message: 'Credentials updated. Please sign in again.' });
});

/* --------------------------------------------------------------- chat
   Answers are assembled from the CV in the database — there is no model
   and no API key, so this endpoint cannot cost anything or leak data.
--------------------------------------------------------------------- */

const chat = require('./src/chat');
const chatHits = new Map(); // ip -> [timestamps]

function chatAllowed(ip) {
  const t = Date.now();
  const hits = (chatHits.get(ip) || []).filter((x) => t - x < 60_000);
  hits.push(t);
  chatHits.set(ip, hits);
  if (chatHits.size > 500) chatHits.clear();
  return hits.length <= 25; // 25 questions a minute is plenty for a human
}

app.get('/api/chat', (req, res) => res.json(200, chat.greeting(store.getContent())));

app.post('/api/chat', (req, res) => {
  if (!chatAllowed(req.ip)) return res.json(429, { text: 'One moment — that was a lot of questions at once.', chips: [] });
  const message = req.body && req.body.message;
  if (typeof message !== 'string') return res.json(400, { error: 'Invalid message.' });
  res.json(200, chat.answer(message, store.getContent()));
});

/* ------------------------------------------------------------ content */

app.get('/api/content', (req, res) => res.json(200, { content: store.getContent(), ...store.getContentMeta() }));

app.put('/api/content', (req, res) => {
  if (!requireAuth(req, res)) return;
  const content = req.body && req.body.content;
  if (!content || typeof content !== 'object') return res.json(400, { error: 'Invalid payload.' });
  res.json(200, { ok: true, ...store.saveContent(content) });
});

app.get('/api/revisions', (req, res) => {
  if (!requireAuth(req, res)) return;
  res.json(200, { revisions: store.listRevisions() });
});

app.get('/api/revisions/:id', (req, res) => {
  if (!requireAuth(req, res)) return;
  const data = store.getRevision(Number(req.params.id));
  if (!data) return res.json(404, { error: 'Revision not found.' });
  res.json(200, { content: data });
});

/* ------------------------------------------------------------- upload
   The admin panel sends files as base64 JSON, which avoids needing a
   multipart parser (and therefore avoids an npm dependency).
--------------------------------------------------------------------- */

/**
 * What may be uploaded.
 *
 * This is an allow-list, not a block-list, and that direction is the whole
 * point: anything not named here is refused, so a type nobody thought about
 * is refused by default rather than accepted by default.
 *
 * What is deliberately NOT here, and why:
 *
 *   .html, .htm, .xhtml, .svg-as-document — a file served from this origin
 *     that the browser will execute is a stored cross-site scripting hole.
 *     Anyone who could get such a file onto the site could read the admin
 *     session of whoever opened it. SVG is the awkward case: it can carry
 *     script, so it stays allowed for images but is served as an attachment
 *     rather than rendered (see sendFile below).
 *   .js, .mjs, .wasm, .php — same reason, more obviously.
 *   .exe, .msi, .dmg, .sh, .bat — nothing good comes of hosting these from
 *     a portfolio, and a link to one is what a malware distributor wants.
 *
 * The Office types are safe to host because the browser downloads them; it
 * does not execute them in this origin.
 */
const ALLOWED = {
  // images
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  // documents
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/rtf': '.rtf',
  'text/csv': '.csv',
  'text/plain': '.txt',
  'application/zip': '.zip'
};

/* Office files are large. A 12 MB ceiling stops a slide deck with photos
   in it, which is exactly the thing you would want to attach. */
const MAX_UPLOAD = 25 * 1024 * 1024;

app.post('/api/upload', (req, res) => {
  if (!requireAuth(req, res)) return;

  const { filename, mimetype, data } = req.body || {};
  if (!data || !mimetype) return res.json(400, { error: 'No file received.' });
  if (!ALLOWED[mimetype]) return res.json(400, { error: 'That file type is not allowed. Images, PDF, Word, Excel, PowerPoint, CSV, TXT and ZIP are.' });

  const buf = Buffer.from(String(data).replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (!buf.length) return res.json(400, { error: 'The file is empty.' });
  if (buf.length > MAX_UPLOAD) return res.json(400, { error: `Files must be ${MAX_UPLOAD / 1024 / 1024} MB or smaller.` });

  const base =
    path
      .basename(String(filename || 'file'), path.extname(String(filename || '')))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'file';
  const name = `${base}-${crypto.randomBytes(4).toString('hex')}${ALLOWED[mimetype]}`;

  fs.writeFileSync(path.join(store.UPLOAD_DIR, name), buf);

  const url = `/assets/uploads/${name}`;
  store.recordMedia({ filename: name, url, size: buf.length, mimetype });
  res.json(200, { ok: true, url, filename: name });
});

app.get('/api/media', (req, res) => {
  if (!requireAuth(req, res)) return;
  res.json(200, { media: store.listMedia() });
});

/* ------------------------------------------------------------- pages */

/**
 * Uploaded files.
 * In production the upload folder lives on a persistent disk outside the
 * repository, so it is served explicitly here. Files that shipped with the
 * repo (your original photo, for example) are still found as a fallback.
 */
app.get('/assets/uploads/:file', (req, res) => {
  const name = path.basename(req.params.file); // strips any path trickery
  const onDisk = path.join(store.UPLOAD_DIR, name);
  const inRepo = path.join(PUBLIC_DIR, 'assets', 'uploads', name);

  /* Uploaded files are the one place on this site where the bytes did not
     come from the repository, so they are served under a policy of their
     own — even though only a signed-in admin can put them here.

     `sandbox` is the line that matters. An SVG is a document: open one
     directly in a tab and any <script> inside it runs *in this origin*,
     which would let it read the session of whoever opened it. Embedded in
     an <img> tag it is inert, and that is how the site uses them — but a
     link to the file is one right-click away, and the browser has no way
     to know the difference. The sandbox removes the origin entirely, so
     the file renders and cannot act.

     `nosniff` stops the other half of the trick: a file uploaded as a .txt
     whose contents look like HTML, which some browsers would helpfully
     decide to render. */
  const guard = {
    'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    'X-Content-Type-Options': 'nosniff'
  };

  if (fs.existsSync(onDisk)) return res.sendFile(onDisk, guard);
  if (fs.existsSync(inRepo)) return res.sendFile(inRepo, guard);
  res.json(404, { error: 'File not found.' });
});

/** Render (and every other host) pings this to check the app is alive. */
app.get('/healthz', (req, res) =>
  res.json(200, { ok: true, driver: store.db.__driver, uptime: Math.round(process.uptime()) })
);

function serveAdminPage(req, res) {
  // never let a search engine index or cache the control room
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
}
app.get('/admin', serveAdminPage);
app.get('/console', serveAdminPage);

app.notFound = (req, res) => {
  if (req.url.startsWith('/api/')) return res.json(404, { error: 'Not found.' });
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
};

/* -------------------------------------------------------------- boot */

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  ▸ Portfolio      http://localhost:${PORT}`);
    console.log(`  ▸ Hidden admin   http://localhost:${PORT}/admin`);
    console.log(`    (or click your profile photo 5 times on the homepage)`);
    console.log(`  ▸ SQLite driver  ${store.db.__driver}\n`);
  });
}

module.exports = app;
