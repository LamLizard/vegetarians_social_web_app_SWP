const pool = require('../config/db');

async function findProfileById(accountId) {
  const { rows } = await pool.query(
    `SELECT account_id AS id, email, full_name AS "displayName",
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

async function updateProfile(accountId, { displayName, passwordHash }) {
  const { rows } = await pool.query(
    `UPDATE public.account
     SET full_name = $2,
         password_hash = COALESCE($3, password_hash),
         updated_at = NOW()
     WHERE account_id = $1 AND status = 'active'
    RETURNING account_id AS id, email, full_name AS "displayName",
      avatar_url AS avatar, status`,
    [accountId, displayName, passwordHash],
  );

  return rows[0] ?? null;
}

module.exports = { findProfileById, findPasswordHashById, updateProfile };