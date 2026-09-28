import pg from 'pg';

// Postgres trả BIGINT dưới dạng chuỗi (tránh mất chính xác) → account_id sẽ là "1", "2"...
// Một Pool dùng chung cho cả app; Neon yêu cầu SSL (đã có sslmode=require trong DATABASE_URL).
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

pool.on('error', (err) => {
  console.error('[db] Lỗi kết nối Postgres:', err.message);
});

/** Chạy 1 câu SQL có tham số: query('SELECT ... WHERE id = $1', [id]) */
export const query = (text, params) => pool.query(text, params);
