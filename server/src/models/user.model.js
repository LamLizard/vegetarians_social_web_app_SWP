const pool = require('../config/db');

async function findProfileById(accountId) {
  const { rows } = await pool.query(
    `SELECT account_id AS id, email, full_name AS "fullName",
          avatar_url AS avatar, status
     FROM public.account
     WHERE account_id = $1 AND status <> 'deleted'`,
    [accountId],
  );

  return rows[0] ?? null;
}

async function findPasswordHashById(accountId) {
  const { rows } = await pool.query(
    'SELECT password_hash FROM public.account WHERE account_id = $1 AND status = $2',
    [accountId, 'active'],
  );

  return rows[0]?.password_hash ?? null;
}

async function updateProfile(accountId, { fullName, email, passwordHash }) { /* Duy's code: Nhận email cùng tên và password hash khi cập nhật hồ sơ. */
  const { rows } = await pool.query(
    `UPDATE public.account
     SET full_name = $2,
       email = $3, /* Duy's code: Lưu email hồ sơ vào cột đăng nhập hiện có. */
       password_hash = COALESCE($4, password_hash),
         updated_at = NOW()
     WHERE account_id = $1 AND status = 'active'
    RETURNING account_id AS id, email, full_name AS "fullName",
      avatar_url AS avatar, status`,
    [accountId, fullName, email, passwordHash], /* Duy's code: Truyền email đã chuẩn hoá theo đúng placeholder. */
  );

  return rows[0] ?? null;
}

async function updateAvatar(accountId, avatarUrl) {
  const { rows } = await pool.query(
    `UPDATE public.account
     SET avatar_url = $2, updated_at = NOW()
     WHERE account_id = $1 AND status = 'active'
     RETURNING account_id AS id, email, full_name AS "fullName",
       avatar_url AS avatar, status`,
    [accountId, avatarUrl],
  );

  return rows[0] ?? null;
}

module.exports = { findProfileById, findPasswordHashById, updateProfile, updateAvatar };