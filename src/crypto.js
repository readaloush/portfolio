const crypto = require('crypto');

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(String(plain), salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: 256 * 1024 * 1024
  });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('hex'), key.toString('hex')].join('$');
}

function verifyPassword(plain, stored) {
  try {
    const [tag, N, r, p, saltHex, hashHex] = String(stored || '').split('$');
    if (tag !== 'scrypt') return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const key = crypto.scryptSync(String(plain), salt, expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
      maxmem: 256 * 1024 * 1024
    });
    return crypto.timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

const b64u = (buf) => Buffer.from(buf).toString('base64url');

function signToken(payload, secret, ttlSeconds = 8 * 60 * 60) {
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(
    JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttlSeconds })
  );
  const sig = b64u(crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

function verifyToken(token, secret) {
  try {
    const [header, body, sig] = String(token || '').split('.');
    if (!header || !body || !sig) return null;
    const expected = b64u(crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest());
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

const randomSecret = (bytes = 48) => crypto.randomBytes(bytes).toString('hex');
const randomPassword = (bytes = 9) => crypto.randomBytes(bytes).toString('base64url');

module.exports = { hashPassword, verifyPassword, signToken, verifyToken, randomSecret, randomPassword };
