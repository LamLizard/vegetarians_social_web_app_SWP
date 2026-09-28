import { query } from '../config/db.js';

// Bảng `account` theo FINAL ERD. Đăng nhập bằng email (ERD không có cột username).
const COLUMNS = `account_id, email, password_hash, role, status, full_name, avatar_url, bio,
                 last_login_at, created_at, updated_at`;

/** Tìm tài khoản theo email (không phân biệt hoa/thường). Không thấy → null. */
export async function findByEmail(email) {
  const { rows } = await query(
    `SELECT ${COLUMNS} FROM account WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email.trim()],
  );
  return rows[0] ?? null;
}

export async function findById(accountId) {
  const { rows } = await query(`SELECT ${COLUMNS} FROM account WHERE account_id = $1`, [accountId]);
  return rows[0] ?? null;
}

/** Tạo tài khoản mới – mặc định role member, status active. */
export async function create({ email, passwordHash, fullName, role = 'member' }) {
  const { rows } = await query(
    `INSERT INTO account (email, password_hash, full_name, role, status)
     VALUES ($1, $2, $3, $4, 'active')
     RETURNING ${COLUMNS}`,
    [email.trim(), passwordHash, fullName?.trim() || null, role],
  );
  return rows[0];
}

export async function updatePassword(accountId, passwordHash) {
  await query(
    'UPDATE account SET password_hash = $2, updated_at = NOW() WHERE account_id = $1',
    [accountId, passwordHash],
  );
}

export async function touchLastLogin(accountId) {
  await query('UPDATE account SET last_login_at = NOW() WHERE account_id = $1', [accountId]);
}

/** Dữ liệu trả về cho FE – KHÔNG bao giờ gửi password_hash. */
export function toPublic(acc) {
  return {
    id: acc.account_id,
    email: acc.email,
    fullName: acc.full_name ?? '',
    role: acc.role,
    status: acc.status,
    avatarUrl: acc.avatar_url,
    bio: acc.bio,
    lastLoginAt: acc.last_login_at,
    createdAt: acc.created_at,
  };
}
