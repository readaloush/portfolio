function open(file) {
  try {
    const Database = require('better-sqlite3');
    const db = new Database(file);
    try { db.pragma('journal_mode = WAL'); } catch {  }
    db.__driver = 'better-sqlite3';
    return db;
  } catch (err) {
  }

  let sqlite;
  try {
    sqlite = require('node:sqlite');
  } catch {
    throw new Error(
      'No SQLite driver available.\n' +
        'Either run `npm install better-sqlite3`, or use Node.js 22.5 or newer\n' +
        '(which ships with a built-in SQLite module).'
    );
  }

  const raw = new sqlite.DatabaseSync(file);
  try { raw.exec('PRAGMA journal_mode = WAL'); } catch {  }

  const plain = (row) => (row == null ? row : Object.assign({}, row));

  return {
    __driver: 'node:sqlite',
    exec: (sql) => raw.exec(sql),
    pragma: (p) => raw.exec('PRAGMA ' + p),
    prepare(sql) {
      const st = raw.prepare(sql);
      return {
        get: (...a) => plain(st.get(...a)),
        all: (...a) => st.all(...a).map(plain),
        run: (...a) => st.run(...a)
      };
    },
    close: () => raw.close()
  };
}

module.exports = { open };
