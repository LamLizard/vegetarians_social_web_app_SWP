const { createHash } = require('node:crypto');

// Khoi's code (05/11/2026): khoá dự phòng khi server chưa cấu hình CHATBOT_REQUEST_HMAC_KEY.
const FALLBACK_SUBJECT_KEY = 'greenbowl-chatbot-guest-ip-fallback';

// Khoi's code (05/11/2026): băm IP + khoá bí mật để chặn đổi deviceId mà không lưu IP gốc.
function ipSubjectKey(ip, hmacKey) {
  const secret = typeof hmacKey === 'string' && hmacKey.trim() ? hmacKey.trim() : FALLBACK_SUBJECT_KEY;
  const address = typeof ip === 'string' ? ip.trim() : '';
  return `ip:${createHash('sha256').update(`${address}${secret}`, 'utf8').digest('hex').slice(0, 32)}`;
}

module.exports = { ipSubjectKey, FALLBACK_SUBJECT_KEY };
