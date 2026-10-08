const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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

const app = createApp({ bodyLimit: 36 * 1024 * 1024 });
app.staticDir = PUBLIC_DIR;

function logApi(req, status, note = '') {
  const stamp = new Date().toTimeString().slice(0, 8);
  const how = req.cookies[COOKIE] ? 'cookie' : (req.headers.authorization ? 'header' : 'none');
  console.log(`  ${stamp}  ${String(status).padEnd(3)} ${req.method.padEnd(4)} ${req.url.padEnd(24)} session:${how} ${note}`);
}

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

const chat = require('./src/chat');
const chatHits = new Map();

function chatAllowed(ip) {
  const t = Date.now();
  const hits = (chatHits.get(ip) || []).filter((x) => t - x < 60_000);
  hits.push(t);
  chatHits.set(ip, hits);
  if (chatHits.size > 500) chatHits.clear();
  return hits.length <= 25;
}

const chatLang = (req) => {
  const l = (req.body && req.body.lang) || (req.query && req.query.lang) || (req.cookies && req.cookies.rp_lang);
  return ['en', 'tr', 'ar'].includes(l) ? l : 'en';
};
const chatContent = (lang) => {
  const raw = store.getContent();
  if (lang === 'en') return raw;
  const i18nCore = require('./public/assets/js/i18n.js');
  let dict = {};
  try { dict = require(`./public/assets/i18n/${lang}.js`).dict; } catch {  }
  return i18nCore.translateContent(raw, lang, dict);
};
app.get('/api/chat', (req, res) => { const l = chatLang(req); res.json(200, chat.greeting(chatContent(l), l)); });

app.post('/api/chat', (req, res) => {
  if (!chatAllowed(req.ip)) return res.json(429, { text: 'One moment — that was a lot of questions at once.', chips: [] });
  const message = req.body && req.body.message;
  if (typeof message !== 'string') return res.json(400, { error: 'Invalid message.' });
  const lang = chatLang(req);
  res.json(200, chat.answer(message, chatContent(lang), lang, store.getContent()));
});

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

const ALLOWED = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
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

app.get('/assets/uploads/:file', (req, res) => {
  const name = path.basename(req.params.file);
  const onDisk = path.join(store.UPLOAD_DIR, name);
  const inRepo = path.join(PUBLIC_DIR, 'assets', 'uploads', name);

  const guard = {
    'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    'X-Content-Type-Options': 'nosniff'
  };
  if (path.extname(name).toLowerCase() === '.pdf') {
    delete guard['Content-Security-Policy'];
  }

  if (fs.existsSync(onDisk)) return res.sendFile(onDisk, guard);
  if (fs.existsSync(inRepo)) return res.sendFile(inRepo, guard);

  if (store.remote.enabled()) {
    store.remote.readUpload(name).then((buf) => {
      if (!buf) return res.json(404, { error: 'File not found.' });
      try { fs.writeFileSync(onDisk, buf); } catch {  }
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

app.get('/healthz', (req, res) =>
  res.json(200, { ok: true, driver: store.db.__driver, uptime: Math.round(process.uptime()) })
);

const { MIME } = require('./src/http');
const mimeFor = (name) => MIME[path.extname(name).toLowerCase()] || 'application/octet-stream';

app.get('/api/storage', (req, res) => {
  if (!requireAuth(req, res)) return;
  const remote = store.remote.status();
  res.json(200, {
    ...remote,
    dataDir: store.DATA_DIR,
    durable: remote.enabled
  });
});

const BAKED_ORIGIN = 'https://read-alallos-portfolio.onrender.com';
const HOST_SHAPE = /^[a-z0-9.-]{1,253}(:\d{1,5})?$/i;

function originFor(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  const host = String(req.headers.host || '');
  if (!HOST_SHAPE.test(host)) return BAKED_ORIGIN;
  const proto = /^localhost|^127\.|^\[?::1/.test(host) ? 'http' : 'https';
  return `${proto}://${host}`;
}

const pageCache = new Map();
const seo = require('./src/seo');

const VIEW_PATHS = ['news', 'about', 'skills', 'experience', 'projects', 'certificates', 'education', 'contact'];
const CASE_KINDS = ['projects', 'experience', 'education'];
const viewOf = (pathname) => {
  const m = String(pathname || '').match(/^\/([a-z]+)(?:\/([a-z0-9-]{1,60}))?\/?$/i);
  if (!m || !VIEW_PATHS.includes(m[1].toLowerCase())) return '';
  if (m[2] && !CASE_KINDS.includes(m[1].toLowerCase())) return '';
  return m[1].toLowerCase() + (m[2] ? '/' + m[2].toLowerCase() : '');
};

const i18n = require('./public/assets/js/i18n.js');
const DICTS = {};
for (const l of ['tr', 'ar']) {
  try { DICTS[l] = require(`./public/assets/i18n/${l}.js`).dict; } catch { DICTS[l] = {}; }
}
const langOf = (req) => i18n.pickForRequest({
  query: req.query && req.query.lang,
  cookie: req.cookies && req.cookies.rp_lang,
  acceptLanguage: req.headers['accept-language']
});

app.sendPage = (req, res, filePath, status = 200) => {
  if (!filePath.endsWith('.html')) return false;
  const view = viewOf(req.url.split('?')[0]);
  const lang = path.basename(filePath) === 'index.html' ? langOf(req) : 'en';

  const origin = originFor(req);
  const isIndex = path.basename(filePath) === 'index.html';
  const stamp = isIndex ? (store.getContentMeta().updatedAt || '') : '';
  const key = origin + '|' + filePath + '|' + stamp + '|' + view + '|' + lang;

  let html = pageCache.get(key);
  if (html === undefined) {
    try {
      html = fs.readFileSync(filePath, 'utf8').split(BAKED_ORIGIN).join(origin);
      if (isIndex) {
        const content = i18n.translateContent(store.getContent(), lang, DICTS[lang]);
        html = seo.render(html, content, origin, view, lang);
        const dir = i18n.LANGS[lang].dir;
        html = html.replace(/<html lang="en"/, `<html lang="${lang}" dir="${dir}" data-lang="${lang}"`);
        const own = lang !== 'en' && store.getContent().translations && store.getContent().translations[lang];
        if (own && Object.keys(own).length) {
          const json = JSON.stringify(own).replace(/</g, '\\u003c');
          html = html.replace('<script src="/assets/js/i18n.js', `<script>window.I18N_OVERRIDE=${json};</script>\n<script src="/assets/js/i18n.js`);
        }
        const here = `${origin}/${view}`;
        const alt = i18n.ORDER.map((l) => `<link rel="alternate" hreflang="${l}" href="${here}?lang=${l}">`).join('\n') +
          `\n<link rel="alternate" hreflang="x-default" href="${here}">`;
        html = html.replace(/<\/head>/i, `${alt}\n</head>`);
      }
    } catch {
      return false;
    }
    if (pageCache.size > 20) pageCache.clear();
    pageCache.set(key, html);
  }

  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html),
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Content-Language': lang,
    Vary: 'Accept-Language, Cookie',
    Pragma: 'no-cache',
    Expires: '0'
  });
  res.end(html);
  return true;
};

function serveAdminPage(req, res) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
}
app.get('/admin', serveAdminPage);
app.get('/console', serveAdminPage);

app.get('/sitemap.xml', (req, res) => {
  const origin = originFor(req);
  const content = store.getContent();
  const updated = (store.getContentMeta().updatedAt || new Date().toISOString()).slice(0, 10);

  const paths = ['/'];
  const has = {
    '/news': (content.announcements || []).some((a) => a && a.published !== false),
    '/about': !!(content.profile && content.profile.summary),
    '/skills': (content.skills || []).length > 0,
    '/experience': (content.experience || []).length > 0,
    '/projects': (content.projects || []).length > 0,
    '/certificates': (content.certificates || []).length > 0,
    '/education': (content.education || []).length > 0,
    '/contact': true
  };
  for (const [p, ok] of Object.entries(has)) if (ok) paths.push(p);
  (content.projects || []).filter((x) => x && x.title).forEach((x) => paths.push('/projects/' + seo.slugify(x.slug || x.title)));
  (content.experience || []).filter((x) => x && (x.role || x.company))
    .forEach((x) => paths.push('/experience/' + seo.slugify(x.slug || `${x.company || ''} ${String(x.role || '').trim()}`)));

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${paths.map((p) => {
  const loc = `${origin}${p === '/' ? '/' : p}`;
  const alt = ['en', 'tr', 'ar'].map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${loc}?lang=${l}"/>`).join('\n') +
    `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${loc}"/>`;
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${updated}</lastmod>
    <priority>${p === '/' ? '1.0' : '0.7'}</priority>
${alt}
  </url>`;
}).join('\n')}
</urlset>`;

  res.writeHead(200, {
    'Content-Type': 'application/xml; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'public, max-age=3600'
  });
  res.end(body);
});

app.get('/llms.txt', (req, res) => {
  const origin = originFor(req);
  const c = store.getContent();
  const p = c.profile || {};
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const L = [];
  L.push(`# ${clean(p.name) || 'Portfolio'}`);
  L.push('');
  L.push(`> ${clean(p.title)}${p.location ? ' based in ' + clean(p.location) : ''}. ${clean(p.tagline)}`);
  L.push('');
  if (p.summary) { L.push(clean(p.summary)); L.push(''); }
  const also = (c.meta && c.meta.alternateNames) || [];
  if (also.length) { L.push(`Also written as: ${also.map(clean).join(', ')}.`); L.push(''); }
  L.push('## Facts');
  if (p.title) L.push(`- Role: ${clean(p.title)}`);
  if ((p.roles || []).length) L.push(`- Focus: ${(p.roles || []).map(clean).join('; ')}`);
  if (p.location) L.push(`- Location: ${clean(p.location)}`);
  if ((c.languages || []).length) L.push(`- Languages: ${(c.languages || []).map((l) => `${clean(l.name)} (${clean(l.level)})`).join(', ')}`);
  if (p.email) L.push(`- Email: ${p.email}`);
  L.push(`- Website: ${origin}/`);
  (c.socials || []).filter((s) => /^https?:/i.test(s.url || '')).forEach((s) => L.push(`- ${clean(s.label)}: ${s.url}`));
  L.push('');
  const exp = (c.experience || []).filter((e) => e && (e.role || e.company));
  if (exp.length) {
    L.push('## Experience');
    exp.forEach((e) => {
      L.push(`- **${clean(e.role)}**, ${clean(e.company)} (${clean(e.period)})${e.tools ? ' — ' + clean(e.tools) : ''}`);
      (e.bullets || []).slice(0, 3).forEach((b) => L.push(`  - ${clean(b)}`));
    });
    L.push('');
  }
  const pr = (c.projects || []).filter((x) => x && x.title);
  if (pr.length) {
    L.push('## Projects');
    pr.forEach((x) => {
      L.push(`- [${clean(x.title)}](${origin}/projects/${seo.slugify(x.slug || x.title)}) (${clean(x.period)})${(x.tags || []).length ? ' — ' + x.tags.map(clean).join(', ') : ''}`);
      (x.bullets || []).slice(0, 3).forEach((b) => L.push(`  - ${clean(b)}`));
    });
    L.push('');
  }
  const ed = (c.education || []).filter((e) => e && e.degree);
  if (ed.length) {
    L.push('## Education');
    ed.forEach((e) => L.push(`- ${clean(e.degree)}, ${clean(e.school)} (${clean(e.period)})`));
    L.push('');
  }
  const sk = (c.skills || []).filter((g) => g && (g.items || []).length);
  if (sk.length) {
    L.push('## Skills');
    sk.forEach((g) => L.push(`- ${clean(g.category)}: ${(g.items || []).map((i) => clean(i.name)).join(', ')}`));
    L.push('');
  }
  const ce = (c.certificates || []).filter((x) => x && x.title && !/^sample\b/i.test(x.issuer || ''));
  if (ce.length) {
    L.push('## Certificates');
    ce.forEach((x) => L.push(`- ${clean(x.title)}${x.issuer ? ', ' + clean(x.issuer) : ''}${x.date ? ' (' + clean(x.date) + ')' : ''}`));
    L.push('');
  }
  L.push('## Pages');
  ['about', 'experience', 'projects', 'skills', 'education', 'certificates', 'contact'].forEach((v) => L.push(`- [${v[0].toUpperCase() + v.slice(1)}](${origin}/${v})`));
  L.push(`- The same pages in Turkish: ${origin}/?lang=tr — in Arabic: ${origin}/?lang=ar`);
  if (p.cvUrl) L.push(`- [CV (PDF)](${/^https?:/.test(p.cvUrl) ? p.cvUrl : origin + p.cvUrl})`);
  const body = L.join('\n') + '\n';
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'public, max-age=3600'
  });
  res.end(body);
});

const LOOKS_LIKE_A_FILE = /\.[a-z0-9]{1,8}$/i;

app.notFound = (req, res) => {
  const pathname = req.url.split('?')[0];
  if (pathname.startsWith('/api/')) return res.json(404, { error: 'Not found.' });

  if (LOOKS_LIKE_A_FILE.test(pathname)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Not found');
  }

  const index = path.join(PUBLIC_DIR, 'index.html');
  const v = viewOf(pathname);
  const known = pathname === '/' || (!!v && (!v.includes('/') || !!seo.caseFor(store.getContent(), v)));
  if (app.sendPage(req, res, index, known ? 200 : 404)) return;
  res.sendFile(index);
};

if (require.main === module) {
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
