/**
 * A very small HTTP helper: routing, JSON bodies, cookies and static files.
 * Built on node:http so the project needs no npm packages at all.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  // Attachments on announcements and projects. Without these the browser
  // gets application/octet-stream and saves "download" with no extension,
  // instead of a spreadsheet that opens in Excel.
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.rtf': 'application/rtf',
  '.csv': 'text/csv; charset=utf-8',
  '.zip': 'application/zip'
};

function parseCookies(header = '') {
  const out = {};
  header.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i < 0) return;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function readBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limitBytes) {
        reject(Object.assign(new Error('Payload too large.'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function createApp(options = {}) {
  const routes = [];
  const bodyLimit = options.bodyLimit || 24 * 1024 * 1024;

  const add = (method, pattern, handler) => routes.push({ method, pattern, handler });

  const app = {
    get: (p, h) => add('GET', p, h),
    post: (p, h) => add('POST', p, h),
    put: (p, h) => add('PUT', p, h),
    del: (p, h) => add('DELETE', p, h),
    staticDir: null,
    notFound: null
  };

  function match(pattern, pathname) {
    if (pattern === pathname) return {};
    if (!pattern.includes(':')) return null;
    const a = pattern.split('/');
    const b = pathname.split('/');
    if (a.length !== b.length) return null;
    const params = {};
    for (let i = 0; i < a.length; i++) {
      if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
      else if (a[i] !== b[i]) return null;
    }
    return params;
  }

  function sendFile(res, filePath, extraHeaders = {}) {
    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('Not found');
      }
      const ext = path.extname(filePath).toLowerCase();
      // Never let the browser cache the app itself — otherwise an edit to the
      // HTML/JS/CSS silently does nothing until the user clears their cache.
      const noCache = ['.html', '.js', '.mjs', '.css', '.json'].includes(ext);
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': noCache ? 'no-store, no-cache, must-revalidate' : 'public, max-age=86400',
        ...(noCache ? { Pragma: 'no-cache', Expires: '0' } : {}),
        ...extraHeaders
      });
      fs.createReadStream(filePath).pipe(res);
    });
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(url.pathname);

    res.json = (status, obj) => {
      const payload = JSON.stringify(obj);
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(payload) });
      res.end(payload);
    };
    res.setCookie = (name, value, opts = {}) => {
      const bits = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', `SameSite=${opts.sameSite || 'Lax'}`];
      if (opts.maxAge != null) bits.push(`Max-Age=${opts.maxAge}`);
      if (opts.secure) bits.push('Secure');
      const prev = res.getHeader('Set-Cookie');
      res.setHeader('Set-Cookie', prev ? [].concat(prev, bits.join('; ')) : bits.join('; '));
    };
    // sendFile takes extra headers; this wrapper used to swallow them, so a
    // caller passing a Content-Security-Policy got no error and no policy.
    res.sendFile = (p, extraHeaders) => sendFile(res, p, extraHeaders);

    req.query = Object.fromEntries(url.searchParams);
    req.cookies = parseCookies(req.headers.cookie || '');
    req.ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';

    // security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    try {
      for (const route of routes) {
        if (route.method !== req.method) continue;
        const params = match(route.pattern, pathname);
        if (!params) continue;
        req.params = params;
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          const raw = await readBody(req, bodyLimit);
          req.rawBody = raw;
          const type = req.headers['content-type'] || '';
          req.body = type.includes('application/json') && raw.length ? JSON.parse(raw.toString('utf8')) : {};
        }
        return await route.handler(req, res);
      }

      // static files
      if ((req.method === 'GET' || req.method === 'HEAD') && app.staticDir) {
        const safe = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
        let filePath = path.join(app.staticDir, safe);
        if (!filePath.startsWith(app.staticDir)) {
          res.writeHead(403); return res.end('Forbidden');
        }
        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
        if (fs.existsSync(filePath)) return sendFile(res, filePath);
        if (fs.existsSync(filePath + '.html')) return sendFile(res, filePath + '.html');
      }

      if (app.notFound) return app.notFound(req, res);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    } catch (err) {
      const status = err.status || 500;
      if (status === 500) console.error(err);
      if (!res.headersSent) res.json(status, { error: status === 500 ? 'Server error.' : err.message });
      else res.end();
    }
  });

  app.listen = (port, cb) => server.listen(port, cb);
  app.server = server;
  return app;
}

module.exports = { createApp, MIME };
