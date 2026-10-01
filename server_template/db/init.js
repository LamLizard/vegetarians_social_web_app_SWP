// npm run db:init → tạo bảng account + auth_session (nếu chưa có) và 2 tài khoản demo.
import 'dotenv/config';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';

// Trùng với DEMO_ACCOUNTS ở client/src/app/store/mockData.js (nút "Vào nhanh" trên trang đăng nhập)
const DEMO = [
  { email: 'khoi@anchay.vn', password: 'anchay123', fullName: 'Lâm Anh Khôi', role: 'member' },
  { email: 'admin@anchay.vn', password: 'admin123', fullName: 'Trần Minh Thư', role: 'admin' },
];

try {
  await pool.query(fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  console.log('✓ Đã có bảng account, auth_session');

  for (const d of DEMO) {
    const { rowCount } = await pool.query(
      `INSERT INTO account (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [d.email, await bcrypt.hash(d.password, 10), d.fullName, d.role],
    );
    console.log(rowCount ? `✓ Tạo tài khoản demo ${d.email}` : `· ${d.email} đã có, bỏ qua`);
  }
} catch (err) {
  console.error('✗ Lỗi:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
