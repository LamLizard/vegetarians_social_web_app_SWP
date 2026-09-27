const pool = require('../config/db');

async function findAccountByEmail(email) {
  const { rows } = await pool.query(
    `SELECT a.account_id, a.email, a.password_hash, a.full_name,
          a.avatar_url, a.status, r.name AS role
     FROM public.account a
     JOIN public.role r ON r.role_id = a.role_id
     WHERE lower(a.email) = lower($1)
     LIMIT 1`,
    [email],
  );

  return rows[0] ?? null;
}

module.exports = { findAccountByEmail };