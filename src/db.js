const path = require('path');
const fs = require('fs');
const sqlite = require('./sqlite');
const pw = require('./crypto');
const defaultContent = require('./defaultContent');
const remote = require('./github');

const DATA_DIR = process.env.PORTFOLIO_DATA_DIR || path.join(__dirname, '..', 'data');
const UPLOAD_DIR = process.env.PORTFOLIO_UPLOAD_DIR || path.join(__dirname, '..', 'public', 'assets', 'uploads');

for (const dir of [DATA_DIR, UPLOAD_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const db = sqlite.open(path.join(DATA_DIR, 'portfolio.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS content (
    id         INTEGER PRIMARY KEY CHECK (id = 1),
    data       TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS revisions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    data       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS login_attempts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ip         TEXT NOT NULL,
    username   TEXT,
    success    INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS media (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    filename   TEXT NOT NULL,
    url        TEXT NOT NULL,
    size       INTEGER NOT NULL,
    mimetype   TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const getSetting = (key) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
};

const setSetting = (key, value) =>
  db
    .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, String(value));

function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  let secret = getSetting('jwt_secret');
  if (!secret) {
    secret = pw.randomSecret();
    setSetting('jwt_secret', secret);
  }
  return secret;
}

function withDefaults(saved) {
  const out = { ...saved };
  for (const key of Object.keys(defaultContent)) {
    if (out[key] === undefined) out[key] = defaultContent[key];
  }
  for (const key of ['sections', 'meta', 'profile']) {
    if (out[key] && typeof out[key] === 'object' && !Array.isArray(out[key])) {
      out[key] = { ...defaultContent[key], ...out[key] };
    }
  }
  return out;
}

const { withCaseDefaults } = require('./caseDefaults');

function getContent() {
  const row = db.prepare('SELECT data, updated_at FROM content WHERE id = 1').get();
  if (!row) return withCaseDefaults({ ...defaultContent });
  try {
    return withCaseDefaults(withDefaults(JSON.parse(row.data)));
  } catch {
    return withCaseDefaults({ ...defaultContent });
  }
}

function getContentMeta() {
  const row = db.prepare('SELECT updated_at FROM content WHERE id = 1').get();
  return { updatedAt: row ? row.updated_at : null };
}

async function hydrate() {
  if (!remote.enabled()) return { hydrated: false, reason: 'not configured' };
  try {
    const found = await remote.readContent();
    if (!found || !found.content || typeof found.content !== 'object') {
      return { hydrated: false, reason: 'nothing stored yet' };
    }

    const when = found.savedAt
      ? new Date(found.savedAt).toISOString().slice(0, 19).replace('T', ' ')
      : null;

    db.prepare(
      `INSERT INTO content (id, data, updated_at) VALUES (1, ?, COALESCE(?, datetime('now')))
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
    ).run(JSON.stringify(found.content), when);

    return { hydrated: true, savedAt: found.savedAt };
  } catch (err) {
    return { hydrated: false, reason: err.message };
  }
}

function saveContent(obj) {
  const json = JSON.stringify(obj);
  const existing = db.prepare('SELECT data FROM content WHERE id = 1').get();
  if (existing) {
    db.prepare('INSERT INTO revisions (data) VALUES (?)').run(existing.data);
    db.prepare(
      'DELETE FROM revisions WHERE id NOT IN (SELECT id FROM revisions ORDER BY id DESC LIMIT 30)'
    ).run();
  }
  db.prepare(
    `INSERT INTO content (id, data, updated_at) VALUES (1, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = datetime('now')`
  ).run(json);

  if (remote.enabled()) {
    remote.writeContent(obj).catch(() => {  });
  }

  return getContentMeta();
}

function listRevisions() {
  return db.prepare('SELECT id, created_at FROM revisions ORDER BY id DESC LIMIT 30').all();
}

function getRevision(id) {
  const row = db.prepare('SELECT data FROM revisions WHERE id = ?').get(id);
  return row ? JSON.parse(row.data) : null;
}

const findUser = (username) =>
  db.prepare('SELECT * FROM users WHERE lower(username) = lower(?)').get(String(username || '').trim());

const findUserById = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);

function updatePassword(id, plain) {
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
    pw.hashPassword(plain),
    id
  );
}

function updateUsername(id, username) {
  db.prepare("UPDATE users SET username = ?, updated_at = datetime('now') WHERE id = ?").run(
    String(username).trim(),
    id
  );
}

function recordAttempt(ip, username, success) {
  db.prepare('INSERT INTO login_attempts (ip, username, success) VALUES (?, ?, ?)').run(
    ip,
    username || null,
    success ? 1 : 0
  );
  db.prepare("DELETE FROM login_attempts WHERE created_at < datetime('now', '-1 day')").run();
}

function recentFailures(ip) {
  const row = db
    .prepare(
      "SELECT COUNT(*) AS c FROM login_attempts WHERE ip = ? AND success = 0 AND created_at > datetime('now', '-15 minutes')"
    )
    .get(ip);
  return row.c;
}

function recordMedia({ filename, url, size, mimetype }) {
  db.prepare('INSERT INTO media (filename, url, size, mimetype) VALUES (?, ?, ?, ?)').run(
    filename,
    url,
    size,
    mimetype
  );
}

const listMedia = () => db.prepare('SELECT * FROM media ORDER BY id DESC LIMIT 200').all();

function bootstrap() {
  if (!db.prepare('SELECT 1 FROM content WHERE id = 1').get()) {
    db.prepare('INSERT INTO content (id, data) VALUES (1, ?)').run(JSON.stringify(defaultContent));
    console.log('  ✔ Portfolio content seeded from CV.');
  }

  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (count === 0) {
    const username = (process.env.ADMIN_USERNAME || 'admin').trim();
    let password = process.env.ADMIN_PASSWORD;
    let generated = false;
    if (!password || password.length < 8) {
      password = pw.randomPassword();
      generated = true;
    }
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, pw.hashPassword(password));

    console.log('\n' + '─'.repeat(64));
    console.log('  ADMIN ACCOUNT CREATED (shown only once)');
    console.log('  username : ' + username);
    console.log('  password : ' + password);
    if (generated) {
      console.log('\n  This password was generated randomly because ADMIN_PASSWORD');
      console.log('  was missing from .env. Copy it now, or run: npm run reset-password');
    }
    console.log('  Stored as a scrypt hash in data/portfolio.db — never in HTML.');
    console.log('─'.repeat(64) + '\n');
  }

  getJwtSecret();
}

module.exports = {
  db,
  bootstrap,
  hydrate,
  remote,
  getSetting,
  setSetting,
  getJwtSecret,
  getContent,
  getContentMeta,
  saveContent,
  listRevisions,
  getRevision,
  findUser,
  findUserById,
  updatePassword,
  updateUsername,
  recordAttempt,
  recentFailures,
  recordMedia,
  listMedia,
  UPLOAD_DIR,
  DATA_DIR
};
