/**
 * THE GITHUB STORE
 * ===============================================================
 * Where the site's content actually lives.
 *
 * The problem this solves: the host runs the site on a free plan, which
 * has no persistent disk. The container is thrown away after fifteen
 * idle minutes and rebuilt on the next visit, taking the SQLite file
 * with it — so every announcement written in the admin panel survived
 * only until the next quiet quarter of an hour. Measured on the live
 * site: the content row's timestamp was always within a second of the
 * server's start time, on every deploy.
 *
 * Free hosting with a real disk has essentially disappeared, so instead
 * of moving hosts this moves the *data*. The repository the site is
 * already deployed from is durable, free, versioned, and needs no new
 * account — so it becomes the database.
 *
 * How it fits together:
 *
 *   - Content and uploads are written to a branch of their own,
 *     `data` by default. That branch is never built, so saving an
 *     announcement does not redeploy the site.
 *   - SQLite stays exactly where it was and does exactly what it did.
 *     It is now a cache in front of this, not the source of truth:
 *     fast, synchronous, and free to disappear.
 *   - On boot the server pulls content.json from the branch and puts
 *     it into SQLite. On every save it writes both.
 *
 * Everything here is optional. With no token in the environment every
 * function returns null and the site behaves precisely as it did
 * before — which is what keeps the test suite honest, since the tests
 * run unconfigured.
 *
 * No npm packages: Node's own fetch, and the GitHub Contents API.
 */
const CFG = {
  token: process.env.GITHUB_TOKEN || '',
  repo: process.env.GITHUB_REPO || '',            // "owner/name"
  branch: process.env.GITHUB_DATA_BRANCH || 'data',
  base: process.env.GITHUB_API || 'https://api.github.com'
};

const CONTENT_PATH = 'content.json';
const UPLOAD_DIR = 'uploads';

/* The sha of every blob we have seen. The Contents API refuses to
   overwrite a file unless you hand back the sha you are replacing —
   that is its concurrency check, and it is a good one. Caching them
   saves a round trip per save; a stale one is detected and refreshed
   rather than guessed at. */
const shas = new Map();

const state = {
  lastError: null,
  lastWriteAt: null,
  lastReadAt: null,
  writes: 0
};

const enabled = () => Boolean(CFG.token && CFG.repo);

function headers(extra = {}) {
  return {
    Authorization: 'Bearer ' + CFG.token,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'read-alallos-portfolio',
    ...extra
  };
}

async function api(path, options = {}) {
  const res = await fetch(CFG.base + path, { ...options, headers: headers(options.headers) });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  return { ok: res.ok, status: res.status, body };
}

/* ------------------------------------------------------------ branch */

/**
 * Make sure the data branch exists, creating it from the default branch
 * if it does not. Called once, lazily, before the first write.
 *
 * Branching from the default branch means the data branch starts as a
 * copy of the site. That is untidy but harmless, and it is the only way
 * to create a ref through this API without hand-assembling an empty
 * tree and a root commit — three more calls, three more things to get
 * wrong, for a tidiness nobody will ever look at.
 */
let branchChecked = false;
async function ensureBranch() {
  if (branchChecked) return true;

  const have = await api(`/repos/${CFG.repo}/git/ref/heads/${CFG.branch}`);
  if (have.ok) { branchChecked = true; return true; }
  if (have.status !== 404) {
    state.lastError = `checking branch: ${have.status}`;
    return false;
  }

  const repo = await api(`/repos/${CFG.repo}`);
  if (!repo.ok) { state.lastError = `reading repo: ${repo.status}`; return false; }

  const head = await api(`/repos/${CFG.repo}/git/ref/heads/${repo.body.default_branch}`);
  if (!head.ok) { state.lastError = `reading default branch: ${head.status}`; return false; }

  const made = await api(`/repos/${CFG.repo}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${CFG.branch}`, sha: head.body.object.sha })
  });
  if (!made.ok && made.status !== 422) {   // 422 = someone else just made it
    state.lastError = `creating branch: ${made.status}`;
    return false;
  }
  branchChecked = true;
  return true;
}

/* -------------------------------------------------------------- files */

/** Fetch one file. Returns a Buffer, or null if it is not there. */
async function getFile(path) {
  if (!enabled()) return null;
  const res = await api(`/repos/${CFG.repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(CFG.branch)}`);
  if (res.status === 404) return null;
  if (!res.ok) { state.lastError = `reading ${path}: ${res.status}`; return null; }

  shas.set(path, res.body.sha);
  state.lastReadAt = new Date().toISOString();

  // Files over 1 MB come back with an empty content field and have to be
  // fetched as a blob instead. Uploads are routinely over 1 MB.
  if (res.body.content) return Buffer.from(res.body.content, 'base64');

  const blob = await api(`/repos/${CFG.repo}/git/blobs/${res.body.sha}`);
  if (!blob.ok) { state.lastError = `reading blob ${path}: ${blob.status}`; return null; }
  return Buffer.from(blob.body.content, 'base64');
}

/** Write one file. Returns true on success. */
async function putFile(path, buffer, message) {
  if (!enabled()) return false;
  if (!(await ensureBranch())) return false;

  const send = (sha) => api(`/repos/${CFG.repo}/contents/${encodeURI(path)}`, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: Buffer.from(buffer).toString('base64'),
      branch: CFG.branch,
      ...(sha ? { sha } : {})
    })
  });

  let res = await send(shas.get(path));

  /* 409 and 422 both mean "your sha is not the current one" — either we
     never had it, or someone (another instance of this same server, on
     a redeploy) wrote after we last looked. Re-read and try once more.
     Retrying forever would be a way to hammer the API during an outage. */
  if (res.status === 409 || res.status === 422) {
    const current = await api(`/repos/${CFG.repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(CFG.branch)}`);
    res = await send(current.ok ? current.body.sha : undefined);
  }

  if (!res.ok) {
    state.lastError = `writing ${path}: ${res.status} ${JSON.stringify(res.body && res.body.message)}`;
    return false;
  }

  if (res.body && res.body.content) shas.set(path, res.body.content.sha);
  state.lastWriteAt = new Date().toISOString();
  state.writes++;
  state.lastError = null;
  return true;
}

/* ------------------------------------------------------------ content */

/* The file is an envelope, not the bare content:
 *
 *     { "savedAt": "2026-09-01T13:20:11.402Z", "content": { … } }
 *
 * because the moment somebody last edited the site is information the
 * database cannot reconstruct after it has been thrown away. Without
 * this, "last updated" in the panel would read as the time the server
 * happened to boot — which is not a lie anyone would catch, and that is
 * exactly what makes it worth avoiding.
 *
 * Reading tolerates a bare object too, so a file written by hand still
 * loads.
 */
async function readContent() {
  const buf = await getFile(CONTENT_PATH);
  if (!buf) return null;
  try {
    const parsed = JSON.parse(buf.toString('utf8'));
    if (parsed && typeof parsed === 'object' && parsed.content && typeof parsed.content === 'object') {
      return { content: parsed.content, savedAt: parsed.savedAt || null };
    }
    return { content: parsed, savedAt: null };
  } catch (err) {
    // A corrupt file must not wipe the site: fall through to whatever
    // the database already has.
    state.lastError = 'content.json is not valid JSON: ' + err.message;
    return null;
  }
}

const writeContent = (obj) => {
  const savedAt = new Date().toISOString();
  return putFile(
    CONTENT_PATH,
    JSON.stringify({ savedAt, content: obj }, null, 2),
    `content: edited ${savedAt}`
  );
};

/* ------------------------------------------------------------ uploads */

const readUpload = (name) => getFile(`${UPLOAD_DIR}/${name}`);
const writeUpload = (name, buffer) => putFile(`${UPLOAD_DIR}/${name}`, buffer, `upload: ${name}`);

/* ------------------------------------------------------------- status */

/** What the admin panel shows. Deliberately says nothing secret: the
    repository name, not the token. */
const status = () => ({
  enabled: enabled(),
  repo: CFG.repo || null,
  branch: CFG.branch,
  lastWriteAt: state.lastWriteAt,
  lastReadAt: state.lastReadAt,
  writes: state.writes,
  lastError: state.lastError
});

module.exports = {
  enabled,
  readContent,
  writeContent,
  readUpload,
  writeUpload,
  getFile,
  putFile,
  status,
  CONFIG: CFG
};
