'use strict';

const crypto = require('crypto');

const COOKIE_NAME = 'ff_staff';
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function staffPassword() {
  return process.env.STAFF_PASSWORD || 'changeme';
}

function sessionSecret() {
  // Fall back to a secret derived from the password so a single env var is
  // enough for a quick deploy; set SESSION_SECRET for production.
  return process.env.SESSION_SECRET || `session:${staffPassword()}`;
}

function hmac(value) {
  return crypto.createHmac('sha256', sessionSecret()).update(value).digest('base64url');
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function passwordsMatch(submitted) {
  // Hash first so both sides are fixed length, then compare in constant time.
  const hash = (v) => crypto.createHash('sha256').update(String(v)).digest();
  return timingSafeEqual(hash(submitted), hash(staffPassword()));
}

function issueToken() {
  const expiresAt = String(Date.now() + TOKEN_TTL_MS);
  return `${expiresAt}.${hmac(expiresAt)}`;
}

function verifyToken(token) {
  if (!token) return false;
  const [expiresAt, signature] = token.split('.');
  if (!expiresAt || !signature) return false;
  if (!timingSafeEqual(signature, hmac(expiresAt))) return false;
  const expiry = Number(expiresAt);
  return Number.isFinite(expiry) && expiry > Date.now();
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const jar = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    jar[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return jar;
}

function isSecureRequest(req) {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

function setSessionCookie(res, req) {
  const maxAge = Math.floor(TOKEN_TTL_MS / 1000);
  const secure = isSecureRequest(req) ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${issueToken()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
  );
}

function clearSessionCookie(res, req) {
  const secure = isSecureRequest(req) ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

function isLoggedIn(req) {
  return verifyToken(parseCookies(req)[COOKIE_NAME]);
}

// Express middleware guarding every /dashboard route.
function requireStaff(req, res, next) {
  if (isLoggedIn(req)) return next();
  res.redirect('/login');
}

module.exports = {
  COOKIE_NAME,
  passwordsMatch,
  setSessionCookie,
  clearSessionCookie,
  isLoggedIn,
  requireStaff,
};
