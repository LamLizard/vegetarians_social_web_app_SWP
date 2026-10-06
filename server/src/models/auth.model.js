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

async function upsertRegistrationOtp({ email, passwordHash, fullName, otpHash, expiresAt, lastSentAt }) {
  const { rows } = await pool.query(
    `INSERT INTO registration_otp (email, password_hash, full_name, otp_hash, expires_at, attempts, last_sent_at)
     VALUES ($1, $2, $3, $4, $5, 0, $6)
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       full_name = EXCLUDED.full_name,
       otp_hash = EXCLUDED.otp_hash,
       expires_at = EXCLUDED.expires_at,
       attempts = 0,
       last_sent_at = EXCLUDED.last_sent_at
     RETURNING *`,
    [email, passwordHash, fullName, otpHash, expiresAt, lastSentAt],
  );

  return rows[0] ?? null;
}

async function findRegistrationOtpByEmail(email) {
  const { rows } = await pool.query(
    `SELECT * FROM registration_otp WHERE email = $1 LIMIT 1`,
    [email],
  );

  return rows[0] ?? null;
}

async function refreshRegistrationOtp({ email, otpHash, expiresAt, lastSentAt }) {
  const { rows } = await pool.query(
    `UPDATE registration_otp
     SET otp_hash = $2,
         expires_at = $3,
         attempts = 0,
         last_sent_at = $4
     WHERE email = $1
     RETURNING *`,
    [email, otpHash, expiresAt, lastSentAt],
  );

  return rows;
}

async function incrementRegistrationOtpAttempts(email) {
  const { rows } = await pool.query(
    `UPDATE registration_otp
     SET attempts = attempts + 1
     WHERE email = $1
     RETURNING attempts`,
    [email],
  );

  return rows[0] ?? null;
}

async function deleteRegistrationOtp(email) {
  const { rows } = await pool.query(
    `DELETE FROM registration_otp WHERE email = $1 RETURNING *`,
    [email],
  );

  return rows[0] ?? null;
}

module.exports = {
  findAccountByEmail,
  upsertRegistrationOtp,
  findRegistrationOtpByEmail,
  refreshRegistrationOtp,
  incrementRegistrationOtpAttempts,
  deleteRegistrationOtp,
};