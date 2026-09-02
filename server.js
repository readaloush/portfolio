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

app.post('/api/upload', async (req, res) => {
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

  /* The local copy above is a cache on a disk that will be thrown away.
     This is the copy that lasts. Awaited, unlike the content save: an
     upload the person is about to link to is worth the extra second, and
     a silent failure here would mean a broken image tomorrow rather than
     an error today. */
  let durable = null;
  if (store.remote.enabled()) {
    durable = await store.remote.writeUpload(name, buf);
  }

  res.json(200, { ok: true, url, filename: name, durable });
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

  /* Not on this disk — which on a free host means the container has been
     rebuilt since the file was uploaded, so "not on disk" is the normal
     case rather than the exception. Fetch it from the durable copy and
     write it down here on the way past, so the next request for it is
     local again. The disk is a cache; this is the store.

     It is proxied rather than redirected on purpose: a redirect to raw
     GitHub would hand the visitor a different origin with different
     headers, and the sandbox above is the thing keeping an uploaded SVG
     from being able to act. */
  if (store.remote.enabled()) {
    store.remote.readUpload(name).then((buf) => {
      if (!buf) return res.json(404, { error: 'File not found.' });
      try { fs.writeFileSync(onDisk, buf); } catch { /* read-only disk: serve anyway */ }
      res.writeHead(200, {
        'Content-Type': mimeFor(name),
        'Content-Length': buf.length,
        'Cache-Control': 'public, max-age=86400',
        ...guard
      });
      res.end(buf);
    }).catch(() => res.json(404, { error: 'File not found.' }));
    return;
  }

  res.json(404, { error: 'File not found.' });
});

/** Render (and every other host) pings this to check the app is alive. */
app.get('/healthz', (req, res) =>
  res.json(200, { ok: true, driver: store.db.__driver, uptime: Math.round(process.uptime()) })
);

/* The proxy path writes its own headers, so it needs the same extension
   table the static server uses. One table, imported, rather than a second
   copy here that would drift the first time a type is added to one. */
const { MIME } = require('./src/http');
const mimeFor = (name) => MIME[path.extname(name).toLowerCase()] || 'application/octet-stream';

/** Where the content actually lives, and whether that is durable.
    Read by the admin panel so the answer is never a guess. It says the
    repository and branch, never the token. */
app.get('/api/storage', (req, res) => {
  if (!requireAuth(req, res)) return;
  const remote = store.remote.status();
  res.json(200, {
    ...remote,
    dataDir: store.DATA_DIR,
    // A host that hands you a fresh filesystem every restart is the whole
    // reason the remote store exists; say so plainly.
    durable: remote.enabled
  });
});

/* ------------------------------------------------- the site's own address

   index.html carries absolute URLs in its sharing tags — og:url and
   og:image have to be absolute, because WhatsApp and LinkedIn fetch them
   from their own servers and have no page to resolve a relative path
   against. Those URLs were written with the Render address baked in.

   Which means the day a real domain is pointed at this site, pasting a
   link to it would still show the old address and pull the preview image
   from a hostname the visitor never typed. It is the kind of thing nobody
   notices for months.

   So the page now names whatever host the request arrived on. Buy a
   domain, point it here, and the sharing tags are already correct — there
   is no file to remember to edit.

   The Host header is supplied by the client, so it is not trusted blindly:
   it must look like a hostname, and SITE_URL overrides it outright if you
   would rather pin the canonical address. The exposure is small either way
   — the worst a forged Host can do here is make a link preview point
   somewhere odd, for a request the attacker already controls — but a value
   from outside should still be checked before it is echoed into a page. */
const BAKED_ORIGIN = 'https://read-alallos-portfolio.onrender.com';
const HOST_SHAPE = /^[a-z0-9.-]{1,253}(:\d{1,5})?$/i;

function originFor(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  const host = String(req.headers.host || '');
  if (!HOST_SHAPE.test(host)) return BAKED_ORIGIN;
  const proto = /^localhost|^127\.|^\[?::1/.test(host) ? 'http' : 'https';
  return `${proto}://${host}`;
}

/* Read once, rewritten per request. The file is ~20 KB and the swap is a
   split/join on a fixed string, which is far cheaper than the disk read it
   replaces. Cached by origin *and* by the content revision, so an edit in
   the admin panel invalidates it immediately — a cache that served the
   previous version of the site to search engines would be worse than no
   cache at all. */
const pageCache = new Map();
const seo = require('./src/seo');

app.sendPage = (req, res, filePath) => {
  if (!filePath.endsWith('.html')) return false;

  const origin = originFor(req);
  const isIndex = path.basename(filePath) === 'index.html';
  const stamp = isIndex ? (store.getContentMeta().updatedAt || '') : '';
  const key = origin + '|' + filePath + '|' + stamp;

  let html = pageCache.get(key);
  if (html === undefined) {
    try {
      html = fs.readFileSync(filePath, 'utf8').split(BAKED_ORIGIN).join(origin);
      // The home page ships with its words in it. Everything else is
      // served as written.
      if (isIndex) html = seo.render(html, store.getContent(), origin);
    } catch {
      return false;                       // unreadable: let sendFile report it
    }
    if (pageCache.size > 20) pageCache.clear();
    pageCache.set(key, html);
  }

  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html),
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0'
  });
  res.end(html);
  return true;
};

function serveAdminPage(req, res) {
  // never let a search engine index or cache the control room
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
}
app.get('/admin', serveAdminPage);
app.get('/console', serveAdminPage);

/* A sitemap, built from the sections that actually exist.

   The previous one was worse than missing. Asking for /sitemap.xml
   returned 200 and a copy of the home page, because the catch-all below
   answered every unknown path with index.html. Google calls that a soft
   404: it asks for a hundred URLs that do not exist, gets a hundred
   successful responses containing the same page, and concludes the site
   is full of duplicates. */
app.get('/sitemap.xml', (req, res) => {
  const origin = originFor(req);
  const content = store.getContent();
  const updated = (store.getContentMeta().updatedAt || new Date().toISOString()).slice(0, 10);

  const paths = ['/'];
  // Only list a section if it has something in it. An empty page in a
  // sitemap is a promise the site does not keep.
  const has = {
    '/#news': (content.announcements || []).some((a) => a && a.published !== false),
    '/#about': !!(content.profile && content.profile.summary),
    '/#skills': (content.skills || []).length > 0,
    '/#experience': (content.experience || []).length > 0,
    '/#projects': (content.projects || []).length > 0,
    '/#education': (content.education || []).length > 0,
    '/#contact': true
  };
  for (const [p, ok] of Object.entries(has)) if (ok) paths.push(p);

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((p) => `  <url>
    <loc>${origin}${p === '/' ? '/' : p}</loc>
    <lastmod>${updated}</lastmod>
    <priority>${p === '/' ? '1.0' : '0.7'}</priority>
  </url>`).join('\n')}
</urlset>`;

  res.writeHead(200, {
    'Content-Type': 'application/xml; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'public, max-age=3600'
  });
  res.end(body);
});

/* Anything that looks like a file and is not there is genuinely missing.
   Only routes without an extension fall through to the app. */
const LOOKS_LIKE_A_FILE = /\.[a-z0-9]{1,8}$/i;

app.notFound = (req, res) => {
  const pathname = req.url.split('?')[0];
  if (pathname.startsWith('/api/')) return res.json(404, { error: 'Not found.' });

  if (LOOKS_LIKE_A_FILE.test(pathname)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Not found');
  }

  // Deep links (/news, /projects) are real page views that get shared, so
  // they get the rewritten sharing tags and the rendered content too.
  const index = path.join(PUBLIC_DIR, 'index.html');
  if (app.sendPage(req, res, index)) return;
  res.sendFile(index);
};

/* -------------------------------------------------------------- boot */

if (require.main === module) {
  /* Pull the durable content in *before* accepting the first request, so
     nobody can be served the seeded defaults during the second and a half
     it takes to ask GitHub. The tests call app.listen() directly and skip
     this, which is correct: they run unconfigured and must see the plain
     local behaviour. */
  (async () => {
    const result = await store.hydrate();
    if (result.hydrated) console.log(`  ✔ Content restored from GitHub (saved ${result.savedAt}).`);
    else if (store.remote.enabled()) console.log(`  … GitHub store: ${result.reason}`);

    app.listen(PORT, () => {
      console.log(`\n  ▸ Portfolio      http://localhost:${PORT}`);
      console.log(`  ▸ Hidden admin   http://localhost:${PORT}/admin`);
      console.log(`    (or click your profile photo 5 times on the homepage)`);
      console.log(`  ▸ SQLite driver  ${store.db.__driver}`);
      console.log(`  ▸ Durable store  ${store.remote.enabled() ? store.remote.CONFIG.repo + ' @ ' + store.remote.CONFIG.branch : 'off — edits are lost on restart'}\n`);
    });
  })();
}

module.exports = app;
