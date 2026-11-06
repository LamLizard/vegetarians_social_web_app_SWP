// Khoi's code (08/11/2026): ký từng cặp hỏi–đáp server đã trả để lượt sau không tin lịch sử bị sửa tay.
// Không lưu DB: chữ ký đi kèm lịch sử ở trình duyệt và được kiểm lại mỗi lượt.
const { createHmac, timingSafeEqual } = require('node:crypto');
const { signingKey, actorScope, SIMPLE_TTL_MS } = require('./chatSessionToken');

// Tách miền ký để chữ ký lịch sử không dùng lẫn với token phiên.
const DOMAIN = 'chat-history-sig:v1\n';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIGNATURE = /^[A-Za-z0-9_-]{43}$/;
const MAX_FUTURE_MS = 60000;

// Thứ tự phần tử cố định nên chữ ký không phụ thuộc thứ tự khoá của object.
function signingPayload({ scope, turnId, at, userText, botText }) {
  return JSON.stringify([DOMAIN, scope, turnId, at, userText, botText]);
}

function signTurn({ scope, turnId, at, userText, botText }) {
  return createHmac('sha256', signingKey()).update(signingPayload({ scope, turnId, at, userText, botText })).digest('base64url');
}

// Scope actor của lượt: member theo account, khách theo deviceId (giống token phiên).
function historyScopeFor(account, deviceId) {
  return actorScope(account, deviceId, signingKey());
}

const malformed = () => ({ ok: false, reason: 'MALFORMED' });
const badSignature = () => ({ ok: false, reason: 'BAD_SIGNATURE' });

function verifyHistory({ history, scope, now = Date.now() }) {
  if (!Array.isArray(history) || history.length % 2 !== 0) return malformed();
  const seen = new Set();
  for (let index = 0; index < history.length; index += 2) {
    const question = history[index];
    const answer = history[index + 1];
    if (!question || !answer || typeof question !== 'object' || typeof answer !== 'object'
      || question.sender !== 'user' || answer.sender !== 'bot'
      || typeof question.content !== 'string' || typeof answer.content !== 'string') return malformed();
    const { turnId, at, sig } = answer;
    if (typeof turnId !== 'string' || !UUID.test(turnId) || !Number.isSafeInteger(at) || typeof sig !== 'string') {
      return malformed();
    }
    if (seen.has(turnId)) return malformed();
    seen.add(turnId);
    // at ở tương lai quá 60s là dữ liệu dựng, không phải đồng hồ lệch.
    if (at > now + MAX_FUTURE_MS) return malformed();
    let expected;
    try {
      expected = signTurn({ scope, turnId, at, userText: question.content, botText: answer.content });
    } catch {
      return badSignature();
    }
    if (!SIGNATURE.test(sig)) return badSignature();
    const supplied = Buffer.from(sig, 'base64url');
    const wanted = Buffer.from(expected, 'base64url');
    if (supplied.length !== wanted.length || !timingSafeEqual(supplied, wanted)) return badSignature();
    if (at < now - SIMPLE_TTL_MS) return { ok: false, reason: 'EXPIRED' };
  }
  return { ok: true };
}

module.exports = { signTurn, verifyHistory, historyScopeFor, SIGNATURE, MAX_FUTURE_MS };
