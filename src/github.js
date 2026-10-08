const CFG = {
  token: process.env.GITHUB_TOKEN || '',
  repo: process.env.GITHUB_REPO || '',
  branch: process.env.GITHUB_DATA_BRANCH || 'data',
  base: process.env.GITHUB_API || 'https://api.github.com'
};

const CONTENT_PATH = 'content.json';
const UPLOAD_DIR = 'uploads';

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
  if (!made.ok && made.status !== 422) {
    state.lastError = `creating branch: ${made.status}`;
    return false;
  }
  branchChecked = true;
  return true;
}

async function getFile(path) {
  if (!enabled()) return null;
  const res = await api(`/repos/${CFG.repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(CFG.branch)}`);
  if (res.status === 404) return null;
  if (!res.ok) { state.lastError = `reading ${path}: ${res.status}`; return null; }

  shas.set(path, res.body.sha);
  state.lastReadAt = new Date().toISOString();

  if (res.body.content) return Buffer.from(res.body.content, 'base64');

  const blob = await api(`/repos/${CFG.repo}/git/blobs/${res.body.sha}`);
  if (!blob.ok) { state.lastError = `reading blob ${path}: ${blob.status}`; return null; }
  return Buffer.from(blob.body.content, 'base64');
}

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

const readUpload = (name) => getFile(`${UPLOAD_DIR}/${name}`);
const writeUpload = (name, buffer) => putFile(`${UPLOAD_DIR}/${name}`, buffer, `upload: ${name}`);

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
