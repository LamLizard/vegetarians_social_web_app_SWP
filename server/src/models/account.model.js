// Truy vấn bảng `account` (Postgres/Neon) — mọi câu SQL đều tham số hoá $1, $2...
const pool = require('../config/db');

// Cột dùng chung, alias camelCase cho khớp field FE.
// passwordHash CHỈ để controller so mật khẩu — không bao giờ trả thẳng ra API.
const SELECT_FIELDS = `
  a.account_id    AS id,
  a.email,
  a.password_hash AS "passwordHash",
  a.full_name     AS "fullName",
  a.avatar_url    AS "avatarUrl",
  a.bio,
  a.role_id       AS "roleId",
  a.status,
  r.name          AS role
`;

const FROM_JOIN = 'FROM account a JOIN role r ON r.role_id = a.role_id';

/** Tìm theo email (controller đã lowercase trước khi gọi) */
async function findByEmail(email) {
  const { rows } = await pool.query(`SELECT ${SELECT_FIELDS} ${FROM_JOIN} WHERE a.email = $1`, [email]);
  return rows[0] ?? null;
}

/** Tìm theo account_id — BIGINT nhưng truyền string vẫn khớp */
async function findById(id) {
  const { rows } = await pool.query(`SELECT ${SELECT_FIELDS} ${FROM_JOIN} WHERE a.account_id = $1`, [id]);
  return rows[0] ?? null;
}

/** Tạo tài khoản mới: luôn role_id = 1 (member) và status = 'active' (cột này không có default) */
async function create({ email, passwordHash, fullName }) {
  const { rows } = await pool.query(
    `INSERT INTO account (email, password_hash, full_name, role_id, status)
     VALUES ($1, $2, $3, 1, 'active')
     RETURNING account_id AS id`,
    [email, passwordHash, fullName],
  );
  return rows[0];
}

async function updatePassword(accountId, passwordHash) {
  await pool.query(
    'UPDATE account SET password_hash = $1, updated_at = NOW() WHERE account_id = $2',
    [passwordHash, accountId],
  );
}

async function touchLastLogin(accountId) {
  await pool.query('UPDATE account SET last_login_at = NOW() WHERE account_id = $1', [accountId]);
}

/** Bản ghi → user trả cho FE: đúng 7 field, KHÔNG bao giờ có password_hash */
function toPublicAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    avatarUrl: row.avatarUrl ?? null,
    bio: row.bio ?? null,
    role: row.role,
    status: row.status,
  };
}

module.exports = { findByEmail, findById, create, updatePassword, touchLastLogin, toPublicAccount };