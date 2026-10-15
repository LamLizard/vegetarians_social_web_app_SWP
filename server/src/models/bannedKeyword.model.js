// Khoi's code: Đọc bảng banned_keyword theo category (12/10/2026).
//   'spam'   → chặn bình luận (post.model findBlockedKeyword)
//   'animal' → chỉ cảnh báo đồ động vật (công thức, bài viết) — xem utils/animalWords.js
// Danh sách nhỏ, ít đổi → giữ trong bộ nhớ 60 giây để không truy vấn mỗi lần gõ phím.
// Admin sửa bảng trên Neon thì tối đa 60 giây sau server mới thấy (hoặc restart server).
const defaultPool = require('../config/db');

const TTL_MS = 60 * 1000;
const cache = new Map(); // category → { at, words }

/**
 * @param {'spam'|'animal'} category
 * @param {import('pg').Pool|import('pg').PoolClient} [db]
 * @returns {Promise<string[]>} keyword (chữ gốc, có dấu), dài trước
 */
async function getKeywords(category, db = defaultPool) {
  const hit = cache.get(category);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.words;
  const { rows } = await db.query(`
    SELECT keyword FROM banned_keyword
    WHERE category = $1 AND btrim(keyword) <> ''
    ORDER BY char_length(keyword) DESC, keyword_id
  `, [category]);
  const words = rows.map((r) => r.keyword);
  cache.set(category, { at: Date.now(), words });
  return words;
}

/** Xoá bộ nhớ tạm (dùng trong test hoặc khi Admin có trang sửa từ khoá sau này) */
const clearKeywordCache = () => cache.clear();

module.exports = { getKeywords, clearKeywordCache };
