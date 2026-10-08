#!/usr/bin/env node
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

let passed = 0;
const ok = (m) => { console.log('  \x1b[32m✓\x1b[0m ' + m); passed++; };

function fakeGitHub() {
  const files = new Map();
  const branches = new Set(['main']);
  let nextSha = 1;
  const calls = [];
  let forceConflictOnce = false;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const p = decodeURIComponent(url.pathname);
    calls.push(req.method + ' ' + p);

    const send = (code, obj) => {
      const body = JSON.stringify(obj);
      res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
      res.end(body);
    };

    if (!(req.headers.authorization || '').startsWith('Bearer ')) return send(401, { message: 'Bad credentials' });

    let m;
    if ((m = p.match(/^\/repos\/[^/]+\/[^/]+\/git\/ref\/heads\/(.+)$/))) {
      return branches.has(m[1])
        ? send(200, { object: { sha: 'branchsha' } })
        : send(404, { message: 'Not Found' });
    }
    if (p.match(/^\/repos\/[^/]+\/[^/]+$/)) return send(200, { default_branch: 'main' });

    if (p.match(/^\/repos\/[^/]+\/[^/]+\/git\/refs$/) && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      return req.on('end', () => {
        branches.add(JSON.parse(body).ref.replace('refs/heads/', ''));
        send(201, {});
      });
    }

    if ((m = p.match(/^\/repos\/[^/]+\/[^/]+\/git\/blobs\/(.+)$/))) {
      for (const f of files.values()) if (f.sha === m[1]) return send(200, { content: f.content });
      return send(404, { message: 'Not Found' });
    }

    if ((m = p.match(/^\/repos\/[^/]+\/[^/]+\/contents\/(.+)$/))) {
      const file = m[1];
      if (req.method === 'GET') {
        const f = files.get(file);
        if (!f) return send(404, { message: 'Not Found' });
        const big = Buffer.from(f.content, 'base64').length > 1024 * 1024;
        return send(200, { sha: f.sha, content: big ? '' : f.content });
      }
      if (req.method === 'PUT') {
        let body = '';
        req.on('data', (c) => (body += c));
        return req.on('end', () => {
          const sent = JSON.parse(body);
          const existing = files.get(file);
          if (forceConflictOnce) { forceConflictOnce = false; return send(409, { message: 'sha mismatch' }); }
          if (existing && sent.sha !== existing.sha) return send(409, { message: 'sha mismatch' });
          if (!existing && sent.sha) return send(422, { message: 'no such file' });
          const sha = 'sha' + nextSha++;
          files.set(file, { content: sent.content, sha });
          return send(200, { content: { sha } });
        });
      }
    }
    send(404, { message: 'Not Found' });
  });

  return { server, files, calls, conflictNext: () => (forceConflictOnce = true) };
}

(async () => {
  console.log('\n  GITHUB STORE\n');

  const fake = fakeGitHub();
  await new Promise((r) => fake.server.listen(0, r));
  const base = 'http://127.0.0.1:' + fake.server.address().port;

  {
    const store = require('../src/github');
    assert.strictEqual(store.enabled(), false, 'must be off with no token');
    assert.strictEqual(await store.readContent(), null);
    assert.strictEqual(await store.writeContent({ a: 1 }), false);
    assert.strictEqual(await store.readUpload('x.png'), null);
    assert.strictEqual(store.status().enabled, false);
    ok('with no token: reads return null, writes return false, nothing throws');
  }

  process.env.GITHUB_TOKEN = 'test-token';
  process.env.GITHUB_REPO = 'readaloush/portfolio';
  process.env.GITHUB_DATA_BRANCH = 'data';
  process.env.GITHUB_API = base;
  delete require.cache[require.resolve('../src/github')];
  const gh = require('../src/github');

  assert.strictEqual(gh.enabled(), true);
  ok('with a token and a repo: enabled');

  const wrote = await gh.writeContent({ profile: { name: 'READ' }, announcements: [{ id: 'a1' }] });
  assert.strictEqual(wrote, true, 'the write should succeed');
  assert.ok(fake.calls.some((c) => c.startsWith('POST /repos/readaloush/portfolio/git/refs')),
    'the data branch should have been created');
  ok('the first save creates the data branch and writes content.json');

  const back = await gh.readContent();
  assert.strictEqual(back.content.profile.name, 'READ');
  assert.ok(back.savedAt, 'the envelope should carry the save time');
  ok('content reads back, with the time it was saved');

  assert.strictEqual(await gh.writeContent({ profile: { name: 'CHANGED' } }), true);
  assert.strictEqual((await gh.readContent()).content.profile.name, 'CHANGED');
  ok('a second save overwrites the first');

  fake.conflictNext();
  assert.strictEqual(await gh.writeContent({ profile: { name: 'AFTER CONFLICT' } }), true,
    'a 409 should be retried with a fresh sha, not given up on');
  assert.strictEqual((await gh.readContent()).content.profile.name, 'AFTER CONFLICT');
  ok('a stale sha is refreshed and the write retried once');

  const small = Buffer.from('hello');
  assert.strictEqual(await gh.writeUpload('note.txt', small), true);
  assert.strictEqual((await gh.readUpload('note.txt')).toString(), 'hello');

  const big = Buffer.alloc(1024 * 1024 + 10, 7);
  assert.strictEqual(await gh.writeUpload('big.bin', big), true);
  const bigBack = await gh.readUpload('big.bin');
  assert.strictEqual(bigBack.length, big.length, 'a file over 1 MB must come back whole');
  assert.ok(bigBack.equals(big), 'and byte for byte');
  ok('uploads round-trip, including one over 1 MB via the blob endpoint');

  assert.strictEqual(await gh.readUpload('nope.png'), null);
  ok('a file that is not there reads as null');

  fake.files.set('content.json', { content: Buffer.from('{ not json').toString('base64'), sha: 'bad' });
  assert.strictEqual(await gh.readContent(), null, 'a corrupt file must read as null, not throw');
  assert.ok(gh.status().lastError, 'and it must be recorded');
  ok('a corrupt content.json reads as null and is reported, not thrown');

  {
    await gh.writeContent({ profile: { name: 'RESTORED' }, projects: [] });

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-'));
    process.env.PORTFOLIO_DATA_DIR = dir;
    process.env.PORTFOLIO_UPLOAD_DIR = path.join(dir, 'uploads');
    delete require.cache[require.resolve('../src/db')];
    const db = require('../src/db');
    db.bootstrap();

    assert.notStrictEqual(db.getContent().profile.name, 'RESTORED');

    const result = await db.hydrate();
    assert.strictEqual(result.hydrated, true, 'hydrate should report success');
    assert.strictEqual(db.getContent().profile.name, 'RESTORED',
      'a fresh database must come back holding the durable content');
    assert.ok(db.getContentMeta().updatedAt, 'updatedAt should be set from the envelope');
    ok('a fresh, empty database is restored from the durable copy on boot');

    db.saveContent({ profile: { name: 'SAVED THROUGH DB' } });
    await new Promise((r) => setTimeout(r, 150));
    assert.strictEqual((await gh.readContent()).content.profile.name, 'SAVED THROUGH DB');
    ok('an admin save is mirrored to the durable copy');
  }

  fake.server.close();
  console.log(`\n  \x1b[32m${passed} passed, 0 failed\x1b[0m\n`);
})().catch((err) => {
  console.error('\n  \x1b[31mTEST FAILED:\x1b[0m ' + err.message + '\n');
  console.error(err);
  process.exit(1);
});
