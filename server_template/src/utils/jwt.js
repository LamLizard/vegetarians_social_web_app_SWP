import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const secret = () => {
  if (!process.env.JWT_SECRET) throw new Error('Thiếu JWT_SECRET trong server/.env');
  return process.env.JWT_SECRET;
};

/**
 * Ký token cho 1 phiên đăng nhập.
 * payload: { sub: account_id, sid: session_id, role }
 * @param {boolean} remember  true → hạn dài (JWT_EXPIRES_REMEMBER), false → hạn ngắn
 */
export function signToken({ accountId, sessionId, role }, remember = true) {
  const expiresIn = remember
    ? process.env.JWT_EXPIRES_REMEMBER || '7d'
    : process.env.JWT_EXPIRES_SHORT || '1d';
  return jwt.sign({ sub: String(accountId), sid: sessionId, role }, secret(), { expiresIn });
}

/** Giải mã + kiểm tra chữ ký/hạn. Sai hoặc hết hạn → ném lỗi (JsonWebTokenError / TokenExpiredError). */
export function verifyToken(token) {
  return jwt.verify(token, secret());
}

/** Hạn của token (Date) – để lưu vào auth_session.expires_at cho khớp với JWT. */
export function tokenExpiresAt(token) {
  const { exp } = jwt.decode(token);
  return new Date(exp * 1000);
}

/** DB chỉ lưu hash của token (auth_session.token_hash), không lưu token gốc. */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
