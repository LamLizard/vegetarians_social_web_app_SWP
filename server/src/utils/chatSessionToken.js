const { createHmac, randomUUID, timingSafeEqual } = require('node:crypto');

const TTL_MS = 10 * 60 * 1000;
const SIMPLE_TTL_MS = 30 * 60 * 1000;

function signingKey() {
  const key = process.env.CHATBOT_REQUEST_HMAC_KEY?.trim();
  if (!key) throw Object.assign(new Error('SESSION_UNAVAILABLE'), { code: 'SESSION_UNAVAILABLE' });
  return key;
}

function actorScope(account, deviceId, key) {
  const identity = account ? `account:${account.id}` : `device:${deviceId}`;
  return createHmac('sha256', key).update(`chat-session-actor:${identity}`).digest('hex');
}

function issueSession(account, deviceId) {
  const key = signingKey();
  const serverTime = Date.now();
  const expiresAt = serverTime + TTL_MS;
  const payload = Buffer.from(JSON.stringify({
    scope: actorScope(account, deviceId, key), session: randomUUID(), expiresAt,
  })).toString('base64url');
  const signature = createHmac('sha256', key).update(`chat-session-token:${payload}`).digest('base64url');
  return { token: `${payload}.${signature}`, expiresAt, serverTime };
}

function verifySession(token, account, deviceId) {
  const key = signingKey();
  if (typeof token !== 'string' || token.length > 1024) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) return null;
  const expected = createHmac('sha256', key).update(`chat-session-token:${parts[0]}`).digest();
  const supplied = Buffer.from(parts[1], 'base64url');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const serverTime = Date.now();
    if (payload.scope !== actorScope(account, deviceId, key)
      || !Number.isSafeInteger(payload.expiresAt) || payload.expiresAt <= serverTime) return null;
    return { expiresAt: payload.expiresAt, serverTime };
  } catch {
    return null;
  }
}

// A separate token version keeps the legacy planner/session contract intact.
function issueSimpleSession(account, deviceId) {
  const key = signingKey();
  const serverTime = Date.now();
  const expiresAt = serverTime + SIMPLE_TTL_MS;
  const payload = Buffer.from(JSON.stringify({
    scope: actorScope(account, deviceId, key), session: randomUUID(), version: 2, expiresAt,
  })).toString('base64url');
  const signature = createHmac('sha256', key).update(`chat-session-token:${payload}`).digest('base64url');
  return { token: `${payload}.${signature}`, expiresAt, serverTime };
}

function verifySimpleSession(token, account, deviceId) {
  const key = signingKey();
  if (typeof token !== 'string' || token.length > 1024) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) return null;
  const expected = createHmac('sha256', key).update(`chat-session-token:${parts[0]}`).digest();
  const supplied = Buffer.from(parts[1], 'base64url');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    if (payload.scope !== actorScope(account, deviceId, key) || !Number.isSafeInteger(payload.expiresAt)
      || (payload.version !== undefined && payload.version !== 2)) return null;
    const serverTime = Date.now();
    // An unversioned signed token was issued for ten minutes. Preserve its
    // original activity time without extending its window on every reload.
    const expiresAt = payload.version === 2 ? payload.expiresAt : payload.expiresAt - TTL_MS + SIMPLE_TTL_MS;
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= serverTime) return null;
    return { expiresAt, serverTime };
  } catch {
    return null;
  }
}

module.exports = { issueSession, verifySession, issueSimpleSession, verifySimpleSession };
