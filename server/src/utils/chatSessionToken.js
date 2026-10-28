const { createHmac, randomUUID, timingSafeEqual } = require('node:crypto');

const TTL_MS = 10 * 60 * 1000;

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

module.exports = { issueSession, verifySession };
