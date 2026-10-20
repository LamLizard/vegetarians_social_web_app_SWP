const pool = require('../config/db');

/** Gom rows shop_schedule thành [{ dayOfWeek, isClosed, slots:[{openTime, closeTime}] }] (chỉ đọc — lỗi/thiếu thì trả phần đọc được). */
function groupScheduleRows(rows = []) {
  const byDay = new Map();
  for (const row of rows) {
    const dayOfWeek = Number(row.dayOfWeek);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) continue;
    if (!byDay.has(dayOfWeek)) {
      byDay.set(dayOfWeek, { dayOfWeek, isClosed: false, slots: [] });
    }
    const day = byDay.get(dayOfWeek);
    if (row.isClosed) {
      day.isClosed = true;
      day.slots = [];
    } else if (!day.isClosed && row.openTime && row.closeTime) {
      day.slots.push({ openTime: row.openTime, closeTime: row.closeTime });
    }
  }
  return [...byDay.values()]
    .map((day) => ({
      ...day,
      slots: day.slots.sort((a, b) => a.openTime.localeCompare(b.openTime)),
    }))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

async function findVerifiedShops({ q = null, page = 1, pageSize = 8 }) {
  const effectivePage = Number(page) > 0 ? Number(page) : 1;
  const effectivePageSize = Number(pageSize) > 0 ? Number(pageSize) : 8;
  const offset = (effectivePage - 1) * effectivePageSize;

  const itemsQuery = `
    SELECT s.shop_id, s.name, s.address, s.phone, s.status, s.open_days, s.avt_shop_url,
           (SELECT count(*) FROM shop_dish sd
              JOIN dish d ON d.dish_id = sd.dish_id AND d.status = 'active'
             WHERE sd.shop_id = s.shop_id)::int AS dish_count
    FROM shop s
    WHERE s.verification_status = 'verified'
      AND ($1::text IS NULL OR s.name ILIKE $1 OR s.address ILIKE $1 OR EXISTS (
            SELECT 1 FROM shop_dish sd
              JOIN dish d ON d.dish_id = sd.dish_id AND d.status = 'active'
             WHERE sd.shop_id = s.shop_id
               AND (d.name ILIKE $1 OR sd.display_name ILIKE $1 OR sd.dish_category ILIKE $1)))
    ORDER BY s.created_at DESC, s.shop_id DESC
    LIMIT $2 OFFSET $3
  `;

  const totalQuery = `
    SELECT COUNT(*)::int AS total
    FROM shop s
    WHERE s.verification_status = 'verified'
      AND ($1::text IS NULL OR s.name ILIKE $1 OR s.address ILIKE $1 OR EXISTS (
            SELECT 1 FROM shop_dish sd
              JOIN dish d ON d.dish_id = sd.dish_id AND d.status = 'active'
             WHERE sd.shop_id = s.shop_id
               AND (d.name ILIKE $1 OR sd.display_name ILIKE $1 OR sd.dish_category ILIKE $1)))
  `;

  const params = [q ?? null, effectivePageSize, offset];
  const totalResult = await pool.query(totalQuery, [q ?? null]);
  const itemsResult = await pool.query(itemsQuery, params);

  const ids = itemsResult.rows.map((row) => row.shop_id);
  let scheduleByShop = new Map();
  if (ids.length) {
    const scRes = await pool.query(`
      SELECT shop_id, day_of_week AS "dayOfWeek", slot_no AS "slotNo", is_closed AS "isClosed",
             to_char(open_time,  'HH24:MI') AS "openTime",
             to_char(close_time, 'HH24:MI') AS "closeTime"
      FROM shop_schedule WHERE shop_id = ANY($1::bigint[]) ORDER BY shop_id, day_of_week, slot_no
    `, [ids]);
    const mapped = new Map();
    for (const row of scRes.rows) {
      const shopId = Number(row.shop_id);
      if (!mapped.has(shopId)) mapped.set(shopId, []);
      mapped.get(shopId).push(row);
    }
    scheduleByShop = new Map(
      [...mapped.entries()].map(([shopId, rows]) => [shopId, groupScheduleRows(rows)])
    );
  }

  return {
    items: itemsResult.rows.map((row) => ({
      ...row,
      schedule: scheduleByShop.get(Number(row.shop_id)) ?? [],
    })),
    total: Number(totalResult.rows[0]?.total ?? 0),
  };
}

async function findShopDetail(shopId) {
  const shopResult = await pool.query(`
    SELECT s.shop_id, s.name, s.address, s.phone, s.status,
           s.open_days, s.avt_shop_url,
           (SELECT count(*) FROM shop_dish sd
              JOIN dish d ON d.dish_id = sd.dish_id AND d.status = 'active'
             WHERE sd.shop_id = s.shop_id)::int AS dish_count
    FROM shop s
    WHERE s.shop_id = $1 AND s.verification_status = 'verified'
    LIMIT 1
  `, [shopId]);

  if (shopResult.rows.length === 0) {
    return null;
  }

  const menuResult = await pool.query(`
    SELECT sd.shop_dish_id, sd.dish_id, COALESCE(sd.display_name, d.name) AS name, sd.price,
           sd.ingredient_note, sd.is_available, sd.dish_category, sd.img_url
    FROM shop_dish sd
    JOIN dish d ON d.dish_id = sd.dish_id AND d.status = 'active'
    WHERE sd.shop_id = $1
    ORDER BY sd.dish_category NULLS LAST, sd.is_available DESC, d.name
  `, [shopId]);

  let schedule = [];
  try {
    const scheduleResult = await pool.query(`
      SELECT day_of_week AS "dayOfWeek", slot_no AS "slotNo", is_closed AS "isClosed",
             to_char(open_time,  'HH24:MI') AS "openTime",
             to_char(close_time, 'HH24:MI') AS "closeTime"
      FROM shop_schedule WHERE shop_id = $1 ORDER BY day_of_week, slot_no
    `, [shopId]);
    schedule = groupScheduleRows(scheduleResult.rows);
  } catch {
    schedule = [];
  }

  return {
    shop: shopResult.rows[0],
    menu: menuResult.rows,
    schedule,
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
  findShopDetail,
  findFilterCategories,
};
