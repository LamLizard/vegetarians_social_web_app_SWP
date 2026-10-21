// Khoi's code: Truy vấn category cho form Post/Dish và khu quản trị.
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

class CategoryModelError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'CategoryModelError';
    this.status = status;
  }
}

async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function findCategoryWithUsage(client, id) {
  const { rows } = await client.query(
    `SELECT c.category_id::text AS id, c.name, c.is_active AS "isActive",
            (SELECT count(*)::int FROM public.post_category pc WHERE pc.category_id = c.category_id) AS "postCount",
            (SELECT count(*)::int FROM public.dish_category dc WHERE dc.category_id = c.category_id) AS "dishCount"
     FROM public.category c
     WHERE c.category_id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

async function findAllWithUsage() {
  const { rows } = await pool.query(
    `SELECT c.category_id::text AS id, c.name, c.is_active AS "isActive",
            (SELECT count(*)::int FROM public.post_category pc WHERE pc.category_id = c.category_id) AS "postCount",
            (SELECT count(*)::int FROM public.dish_category dc WHERE dc.category_id = c.category_id) AS "dishCount"
     FROM public.category c
     ORDER BY c.is_active DESC, lower(c.name) ASC`,
  );
  return rows;
}

async function lockName(client, name) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext(lower(btrim($1))))', [name]);
}

async function assertNameAvailable(client, name, excludedId = null) {
  const { rows } = await client.query(
    `SELECT 1
     FROM public.category
     WHERE lower(btrim(name)) = lower(btrim($1))
       AND ($2::bigint IS NULL OR category_id <> $2)
     LIMIT 1`,
    [name, excludedId],
  );
  if (rows.length) throw new CategoryModelError(409, `Danh mục “${name}” đã tồn tại.`);
}

async function writeCategoryAudit(client, { admin, id, action, before, after }) {
  await client.query(
    `INSERT INTO public.admin_log
       (admin_id, action, target_type, target_id, before_value, after_value, ip_address)
     VALUES ($1, $2, 'category', $3, $4::jsonb, $5::jsonb, $6)`,
    [admin.id, action, id, JSON.stringify(before), JSON.stringify(after), admin.ip],
  );
}

async function createCategory(name, admin) {
  return withTransaction(async (client) => {
    await lockName(client, name);
    await assertNameAvailable(client, name);
    const { rows } = await client.query(
      `INSERT INTO public.category (name)
       VALUES ($1)
       RETURNING category_id::text AS id, name, is_active AS "isActive"`,
      [name],
    );
    const category = rows[0];
    await writeCategoryAudit(client, {
      admin,
      id: category.id,
      action: 'category_created',
      before: null,
      after: { name: category.name, isActive: category.isActive },
    });
    return { ...category, postCount: 0, dishCount: 0 };
  });
}

async function renameCategory(id, name, admin) {
  return withTransaction(async (client) => {
    const currentResult = await client.query(
      `SELECT category_id::text AS id, name
       FROM public.category
       WHERE category_id = $1
       FOR UPDATE`,
      [id],
    );
    const before = currentResult.rows[0];
    if (!before) throw new CategoryModelError(404, 'Không tìm thấy danh mục.');

    await lockName(client, name);
    await assertNameAvailable(client, name, id);
    await client.query(
      `UPDATE public.category SET name = $2 WHERE category_id = $1`,
      [id, name],
    );
    await writeCategoryAudit(client, {
      admin,
      id,
      action: 'category_renamed',
      before: { name: before.name },
      after: { name },
    });
    return findCategoryWithUsage(client, id);
  });
}

async function setCategoryStatus(id, isActive, admin) {
  return withTransaction(async (client) => {
    const currentResult = await client.query(
      `SELECT category_id::text AS id, name, is_active AS "isActive"
       FROM public.category
       WHERE category_id = $1
       FOR UPDATE`,
      [id],
    );
    const before = currentResult.rows[0];
    if (!before) throw new CategoryModelError(404, 'Không tìm thấy danh mục.');

    if (before.isActive !== isActive) {
      await client.query(
        `UPDATE public.category SET is_active = $2 WHERE category_id = $1`,
        [id, isActive],
      );
      await writeCategoryAudit(client, {
        admin,
        id,
        action: isActive ? 'category_activated' : 'category_deactivated',
        before: { isActive: before.isActive },
        after: { isActive },
      });
    }
    return findCategoryWithUsage(client, id);
  });
}

module.exports = {
  findActive,
  findAllWithUsage,
  createCategory,
  renameCategory,
  setCategoryStatus,
};
