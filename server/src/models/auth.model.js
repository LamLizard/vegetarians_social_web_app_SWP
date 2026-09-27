// server/src/models/auth.model.js

const pool = require('../config/db');

/**
 * Tìm phiên đăng nhập còn hiệu lực bằng hash của JWT.
 *
 * Không trả password_hash hoặc token_hash cho middleware.
 * Role được đọc từ database để phản ánh quyền hiện tại.
 */
async function findActiveSessionByTokenHash(tokenHash) {
  const sql = `
    SELECT
      auth_session.session_id,
      auth_session.account_id,
      auth_session.expires_at,
      account.status AS account_status,
      account.full_name,
      role.name AS role_name
    FROM auth_session
    INNER JOIN account
      ON account.account_id = auth_session.account_id
    INNER JOIN role
      ON role.role_id = account.role_id
    WHERE auth_session.token_hash = $1
      AND auth_session.revoked_at IS NULL
      AND auth_session.expires_at > NOW()
  `;

  const result = await pool.query(sql, [tokenHash]);

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

module.exports = {
  findActiveSessionByTokenHash,
};