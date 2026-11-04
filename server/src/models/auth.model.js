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

// ─── Quên mật khẩu: bảng password_reset_otp ────────────────────────────────
// Cùng cơ chế với registration_otp nhưng tách bảng: 1 email có thể vừa đăng ký dở
// vừa yêu cầu đặt lại mật khẩu, ghi chung một bảng sẽ ghi đè lẫn nhau.

/** Tạo/cập nhật OTP đặt lại mật khẩu; xoá luôn reset token cũ (vé cũ không dùng lại được) */
async function upsertPasswordResetOtp({ email, otpHash, expiresAt, lastSentAt }) {
  const { rows } = await pool.query(
    `INSERT INTO password_reset_otp (email, otp_hash, expires_at, attempts, last_sent_at)
     VALUES ($1, $2, $3, 0, $4)
     ON CONFLICT (email) DO UPDATE SET
       otp_hash = EXCLUDED.otp_hash,
       expires_at = EXCLUDED.expires_at,
       attempts = 0,
       last_sent_at = EXCLUDED.last_sent_at,
       reset_token_hash = NULL,
       reset_token_expires_at = NULL,
       updated_at = now()
     RETURNING *`,
    [email, otpHash, expiresAt, lastSentAt],
  );

  return rows[0] ?? null;
}

async function findPasswordResetOtpByEmail(email) {
  const { rows } = await pool.query(
    `SELECT * FROM password_reset_otp WHERE email = $1 LIMIT 1`,
    [email],
  );

  return rows[0] ?? null;
}

/** Gửi lại mã: thay OTP, reset số lần nhập sai, huỷ vé cũ */
async function refreshPasswordResetOtp({ email, otpHash, expiresAt, lastSentAt }) {
  const { rows } = await pool.query(
    `UPDATE password_reset_otp
     SET otp_hash = $2,
         expires_at = $3,
         attempts = 0,
         last_sent_at = $4,
         reset_token_hash = NULL,
         reset_token_expires_at = NULL,
         updated_at = now()
     WHERE email = $1
     RETURNING *`,
    [email, otpHash, expiresAt, lastSentAt],
  );

  return rows[0] ?? null;
}

async function incrementPasswordResetOtpAttempts(email) {
  const { rows } = await pool.query(
    `UPDATE password_reset_otp
     SET attempts = attempts + 1, updated_at = now()
     WHERE email = $1
     RETURNING attempts`,
    [email],
  );

  return rows[0] ?? null;
}

/** Cấp vé đặt lại mật khẩu sau khi OTP đúng (chỉ lưu hash sha256 của vé) */
async function setPasswordResetToken({ email, tokenHash, tokenExpiresAt }) {
  const { rows } = await pool.query(
    `UPDATE password_reset_otp
     SET reset_token_hash = $2,
         reset_token_expires_at = $3,
         updated_at = now()
     WHERE email = $1
     RETURNING *`,
    [email, tokenHash, tokenExpiresAt],
  );

  return rows[0] ?? null;
}

/** Tra vé còn hạn — controller dùng để biết email nào được phép đổi mật khẩu */
async function findPasswordResetByTokenHash(tokenHash) {
  const { rows } = await pool.query(
    `SELECT * FROM password_reset_otp
     WHERE reset_token_hash = $1 AND reset_token_expires_at > now()
     LIMIT 1`,
    [tokenHash],
  );

  return rows[0] ?? null;
}

async function deletePasswordResetOtp(email) {
  const { rows } = await pool.query(
    `DELETE FROM password_reset_otp WHERE email = $1 RETURNING *`,
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
  upsertPasswordResetOtp,
  findPasswordResetOtpByEmail,
  refreshPasswordResetOtp,
  incrementPasswordResetOtpAttempts,
  setPasswordResetToken,
  findPasswordResetByTokenHash,
  deletePasswordResetOtp,
};