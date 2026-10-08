const pool = require('../config/db');

async function findVerifiedShops({ q = null, categoryId = null, page = 1, pageSize = 8 }) {
  const effectivePage = Number(page) > 0 ? Number(page) : 1;
  const effectivePageSize = Number(pageSize) > 0 ? Number(pageSize) : 8;
  const offset = (effectivePage - 1) * effectivePageSize;

  const itemsQuery = `
    SELECT s.shop_id, s.name, s.address, s.phone,
           to_char(s.open_time,  'HH24:MI') AS open_time,
           to_char(s.close_time, 'HH24:MI') AS close_time,
           s.open_days, s.avt_shop_url,
           (SELECT count(*) FROM shop_dish sd
              JOIN dish d ON d.dish_id = sd.dish_id AND d.status = 'active'
             WHERE sd.shop_id = s.shop_id)::int AS dish_count
    FROM shop s
    WHERE s.verification_status = 'verified'
      AND ($1::text IS NULL OR s.name ILIKE $1 OR s.address ILIKE $1)
      AND ($2::bigint IS NULL OR EXISTS (
            SELECT 1 FROM shop_dish sd
              JOIN dish d ON d.dish_id = sd.dish_id AND d.status = 'active'
              JOIN dish_category dc ON dc.dish_id = sd.dish_id
             WHERE sd.shop_id = s.shop_id AND dc.category_id = $2))
    ORDER BY s.name ASC, s.shop_id ASC
    LIMIT $3 OFFSET $4
  `;

  const totalQuery = `
    SELECT COUNT(*)::int AS total
    FROM shop s
    WHERE s.verification_status = 'verified'
      AND ($1::text IS NULL OR s.name ILIKE $1 OR s.address ILIKE $1)
      AND ($2::bigint IS NULL OR EXISTS (
            SELECT 1 FROM shop_dish sd
              JOIN dish d ON d.dish_id = sd.dish_id AND d.status = 'active'
              JOIN dish_category dc ON dc.dish_id = sd.dish_id
             WHERE sd.shop_id = s.shop_id AND dc.category_id = $2))
  `;

  const params = [q ?? null, categoryId ?? null, effectivePageSize, offset];
  const totalResult = await pool.query(totalQuery, [q ?? null, categoryId ?? null]);
  const itemsResult = await pool.query(itemsQuery, params);

  return {
    items: itemsResult.rows,
    total: Number(totalResult.rows[0]?.total ?? 0),
  };
}

async function findFilterCategories() {
  const { rows } = await pool.query(`
    SELECT DISTINCT c.category_id, c.name
    FROM category c
      JOIN dish_category dc ON dc.category_id = c.category_id
      JOIN dish d ON d.dish_id = dc.dish_id AND d.status = 'active'
    WHERE c.is_active
    ORDER BY c.category_id
  `);
  return rows;
}

module.exports = {
  findVerifiedShops,
  findFilterCategories,
};
