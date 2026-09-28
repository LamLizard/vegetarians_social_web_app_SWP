import { query } from '../config/db.js';

// Bảng `auth_session` theo FINAL ERD: mỗi lần đăng nhập = 1 phiên.
// Đăng xuất = đặt revoked_at → token cũ không dùng được nữa dù JWT chưa hết hạn.

export async function create({ sessionId, accountId, tokenHash, expiresAt, ip, userAgent }) {
  await query(
    `INSERT INTO auth_session (session_id, account_id, token_hash, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [sessionId, accountId, tokenHash, ip?.slice(0, 45) ?? null, userAgent?.slice(0, 255) ?? null, expiresAt],
  );
}

/** Phiên còn hiệu lực: đúng token, chưa thu hồi, chưa hết hạn. */
export async function findActive(sessionId, tokenHash) {
  const { rows } = await query(
    `SELECT session_id, account_id FROM auth_session
     WHERE session_id = $1 AND token_hash = $2 AND revoked_at IS NULL AND expires_at > NOW()`,
    [sessionId, tokenHash],
  );
  return rows[0] ?? null;
}

export async function revoke(sessionId) {
  await query('UPDATE auth_session SET revoked_at = NOW() WHERE session_id = $1 AND revoked_at IS NULL', [sessionId]);
}

/** Thu hồi mọi phiên khác của tài khoản (dùng khi đổi mật khẩu). */
export async function revokeOthers(accountId, keepSessionId) {
  await query(
    'UPDATE auth_session SET revoked_at = NOW() WHERE account_id = $1 AND session_id <> $2 AND revoked_at IS NULL',
    [accountId, keepSessionId],
  );
}
