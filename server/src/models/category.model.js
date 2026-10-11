// Khoi's code: Truy vấn bảng category (dùng chung cho Post và Dish theo BR-06).
const pool = require('../config/db');

/** Các tag đang bật, sắp theo tên — cho ô chọn tag ở form Đăng bài */
async function findActive() {
  const { rows } = await pool.query(
    `SELECT category_id::text AS id, name
     FROM category
     WHERE is_active
     ORDER BY name`,
  );
  return rows;
}

module.exports = { findActive };
