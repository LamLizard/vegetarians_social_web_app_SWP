const { createHmac, timingSafeEqual } = require('node:crypto');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/;

function keyForTokens() {
  const key = process.env.CHATBOT_REQUEST_HMAC_KEY?.trim();
  if (!key) throw Object.assign(new Error('STORE_UNAVAILABLE'), { code: 'STORE_UNAVAILABLE' });
  return key;
}

function actorHash(actor, key) {
  if (!actor || !['account', 'device'].includes(actor.type)
    || typeof actor.key !== 'string' || !actor.key || actor.key.length > 128) return null;
  return createHmac('sha256', key).update(`discovery-actor:${actor.type}:${actor.key}`).digest('hex');
}

function isReceipt(value) {
  return value?.v === 1 && value.kind === 'receipt' && HASH.test(value.scope)
    && UUID.test(value.operationId) && UUID.test(value.nonce) && HASH.test(value.payloadHash)
    && Number.isSafeInteger(value.acceptUntil) && Number.isSafeInteger(value.commitBy)
    && value.acceptUntil > 0 && value.commitBy >= value.acceptUntil;
}

function isFlow(value) {
  return value?.v === 1 && value.kind === 'flow' && HASH.test(value.scope)
    && UUID.test(value.flowId) && HASH.test(value.sessionHash) && HASH.test(value.subjectHash)
    && (value.offerPlanner === undefined || typeof value.offerPlanner === 'boolean');
}

function encode(value, key) {
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
  const signature = createHmac('sha256', key).update(`discovery-token:${payload}`).digest('base64url');
  return `${payload}.${signature}`;
}

function decode(token, actor, validator) {
  const key = keyForTokens();
  const scope = actorHash(actor, key);
  if (!scope || typeof token !== 'string' || token.length > 2048) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) return null;
  const expected = createHmac('sha256', key).update(`discovery-token:${parts[0]}`).digest();
  const signature = Buffer.from(parts[1], 'base64url');
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return null;
  try {
    const value = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    return validator(value) && value.scope === scope ? value : null;
  } catch {
    return null;
  }
}

// Call only with server-issued deadlines and a committed operation record.
// Signature validity alone never proves that a request was accepted, completed
// or expired: callers must consult authoritative operation metadata.
function signReceipt(actor, { operationId, nonce, payloadHash, acceptUntil, commitBy }) {
  const key = keyForTokens();
  const value = { v: 1, kind: 'receipt', scope: actorHash(actor, key), operationId,
    nonce, payloadHash, acceptUntil, commitBy };
  if (!isReceipt(value)) throw Object.assign(new Error('INVALID_INPUT'), { code: 'INVALID_INPUT' });
  return encode(value, key);
}

function verifyReceipt(token, actor) {
  return decode(token, actor, isReceipt);
}

function signFlow(actor, { flowId, sessionHash, subjectHash, offerPlanner = false }) {
  const key = keyForTokens();
  const value = { v: 1, kind: 'flow', scope: actorHash(actor, key), flowId, sessionHash, subjectHash, offerPlanner };
  if (!isFlow(value)) throw Object.assign(new Error('INVALID_INPUT'), { code: 'INVALID_INPUT' });
  return encode(value, key);
}

function verifyFlow(token, actor) {
  return decode(token, actor, isFlow);
}

module.exports = { signReceipt, verifyReceipt, signFlow, verifyFlow };
