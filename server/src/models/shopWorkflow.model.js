// Tùng — Sprint 2: storage helpers riêng của Shop, không tạo/sửa schema hoặc catalog.
const { ShopError, requireActor, conflict } = require('../utils/shopWorkflow');

const SHOP_FIELDS = `s.shop_id::text AS "shopId", s.owner_account_id::text AS "ownerAccountId",
  s.name, s.address, s.phone, s.status, s.verification_status AS "verificationStatus",
  s.verification_note AS "verificationNote", s.verified_at AS "verifiedAt",
  s.verified_by::text AS "verifiedBy", s.row_version::text AS version,
  s.created_at AS "createdAt", s.updated_at AS "updatedAt"`;
const SUBMISSION_FIELDS = `ss.shop_submission_id::text AS "submissionId", ss.shop_id::text AS "shopId",
  ss.submission_type AS "submissionType", ss.status, ss.before_value AS "beforeValue",
  ss.after_value AS "afterValue", ss.submitted_by::text AS "submittedBy", ss.submitted_at AS "submittedAt",
  ss.reviewed_by::text AS "reviewedBy", ss.reviewed_at AS "reviewedAt", ss.review_note AS "reviewNote"`;
const MENU_FIELDS = `sd.shop_dish_id::text AS "shopDishId", sd.shop_id::text AS "shopId",
  sd.dish_id::text AS "dishId", d.name AS "dishName", d.status AS "dishStatus",
  sd.price::text AS price, sd.ingredient_note AS "ingredientNote", sd.is_available AS "isAvailable",
  sd.row_version::text AS version`;

function createShopStorage(database) {
  const pool = database || require('../config/db');

  // Tùng — Sprint 2: preflight chỉ metadata; thiếu prerequisite thì dừng trước BEGIN/INSERT.
  async function ensureSchema() {
    const { rows } = await pool.query(`
      WITH required_columns(table_name, column_name) AS (VALUES
        ('shop', 'row_version'), ('shop_dish', 'row_version'), ('notification', 'metadata'),
        ('shop_submission', 'shop_submission_id'), ('shop_submission', 'before_value'),
        ('shop_submission', 'after_value'), ('shop_submission', 'reviewed_by'),
        ('shop_submission', 'reviewed_at'), ('shop_submission', 'review_note'),
        ('shop_schedule', 'day_of_week'), ('shop_schedule', 'is_closed'),
        ('shop_schedule', 'open_time'), ('shop_schedule', 'close_time')),
      missing AS (
        SELECT table_name || '.' || column_name AS requirement FROM required_columns rc
        WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
          WHERE c.table_schema = 'public' AND c.table_name = rc.table_name AND c.column_name = rc.column_name)
        UNION ALL
        SELECT label FROM (VALUES ('shop_identity_edit_pending'), ('shop_identity_edit_accepted'),
          ('shop_identity_edit_rejected')) required_types(label)
        WHERE NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'notification_type_enum' AND e.enumlabel = label)
        UNION ALL
        SELECT name FROM (VALUES ('uq_shop_submission_pending'), ('uq_shop_dish_shop_dish')) required_indexes(name)
        WHERE NOT EXISTS (SELECT 1 FROM pg_indexes i WHERE i.schemaname = 'public' AND i.indexname = name)
        UNION ALL
        SELECT name FROM (VALUES ('trg_shop_row_version'), ('trg_shop_dish_guard_update'),
          ('trg_shop_submission_guard'), ('trg_shop_schedule_guard_write'),
          ('trg_shop_schedule_complete')) required_triggers(name)
        WHERE NOT EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE t.tgname = name AND n.nspname = 'public' AND t.tgenabled <> 'D')
      ) SELECT COALESCE(array_agg(requirement), ARRAY[]::text[]) AS missing FROM missing
    `);
    if (!rows[0] || !Array.isArray(rows[0].missing) || rows[0].missing.length) {
      throw new ShopError(503, 'SHOP_SCHEMA_NOT_READY', 'Chức năng quán chưa sẵn sàng. Vui lòng liên hệ quản trị viên.');
    }
  }

  async function transaction(work, readOnly = false) {
    await ensureSchema();
    const client = await pool.connect();
    try {
      await client.query(readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* Giữ lỗi ban đầu. */ }
      if (error.code === '23505') conflict('Dữ liệu đã tồn tại hoặc có hồ sơ đang chờ. Vui lòng tải lại.');
      if (['23514', '40001', '40P01'].includes(error.code)) conflict();
      throw error;
    } finally { client.release(); }
  }

  async function ownedShop(client, actor, { lock = false, verified = false, allowMissing = false } = {}) {
    const id = requireActor(actor, 'member');
    const { rows } = await client.query(`SELECT ${SHOP_FIELDS} FROM shop s
      WHERE s.owner_account_id = $1 ${lock ? 'FOR UPDATE' : ''}`, [id]);
    const shop = rows[0];
    if (!shop && !allowMissing) throw new ShopError(404, 'SHOP_NOT_FOUND', 'Bạn chưa đăng ký quán.');
    if (verified && shop?.verificationStatus !== 'verified') conflict('Chỉ quán đã xác minh được quản lý thông tin và menu.');
    return shop || null;
  }

  async function getShop(client, shopId, lock = false) {
    const { rows } = await client.query(`SELECT ${SHOP_FIELDS} FROM shop s WHERE s.shop_id = $1 ${lock ? 'FOR UPDATE' : ''}`, [shopId]);
    if (!rows[0]) throw new ShopError(404, 'SHOP_NOT_FOUND', 'Không tìm thấy quán.');
    return rows[0];
  }

  async function schedule(client, shopId) {
    const { rows } = await client.query(`SELECT day_of_week AS "dayOfWeek", is_closed AS "isClosed",
      to_char(open_time, 'HH24:MI') AS "openTime", to_char(close_time, 'HH24:MI') AS "closeTime"
      FROM shop_schedule WHERE shop_id = $1 ORDER BY day_of_week`, [shopId]);
    if (rows.length !== 7 || rows.every(day => day.isClosed)) {
      throw new ShopError(409, 'SHOP_SCHEDULE_INCOMPLETE', 'Lịch quán chưa đầy đủ. Cần hoàn thiện dữ liệu trước khi tiếp tục.');
    }
    return rows;
  }

  async function replaceSchedule(client, shopId, days) {
    await client.query('DELETE FROM shop_schedule WHERE shop_id = $1', [shopId]);
    await client.query(`INSERT INTO shop_schedule (shop_id, day_of_week, is_closed, open_time, close_time)
      SELECT $1, x."dayOfWeek", x."isClosed", x."openTime"::time, x."closeTime"::time
      FROM jsonb_to_recordset($2::jsonb) AS x("dayOfWeek" smallint, "isClosed" boolean, "openTime" text, "closeTime" text)`,
    [shopId, JSON.stringify(days)]);
  }

  async function pending(client, shopId) {
    const { rows } = await client.query(`SELECT ${SUBMISSION_FIELDS} FROM shop_submission ss
      WHERE ss.shop_id = $1 AND ss.status = 'pending'`, [shopId]);
    return rows[0] || null;
  }

  async function view(client, shop) {
    if (!shop) return { shop: null, pendingSubmission: null, latestSubmission: null };
    const days = await schedule(client, shop.shopId);
    const pendingSubmission = await pending(client, shop.shopId);
    const latest = await client.query(`SELECT ${SUBMISSION_FIELDS} FROM shop_submission ss
      WHERE ss.shop_id = $1 ORDER BY ss.submitted_at DESC, ss.shop_submission_id DESC LIMIT 1`, [shop.shopId]);
    return { shop: { ...shop, schedule: days }, pendingSubmission, latestSubmission: latest.rows[0] || null };
  }

  async function insertSubmission(client, shopId, type, before, after, actor) {
    const { rows } = await client.query(`INSERT INTO shop_submission
      (shop_id, submission_type, before_value, after_value, submitted_by)
      VALUES ($1, $2, $3::jsonb, $4::jsonb, $5)
      RETURNING shop_submission_id::text AS "submissionId", shop_id::text AS "shopId",
        submission_type AS "submissionType", status, before_value AS "beforeValue", after_value AS "afterValue",
        submitted_by::text AS "submittedBy", submitted_at AS "submittedAt",
        reviewed_by::text AS "reviewedBy", reviewed_at AS "reviewedAt", review_note AS "reviewNote"`,
    [shopId, type, before === null ? null : JSON.stringify(before), JSON.stringify(after), actor.id]);
    return rows[0];
  }

  async function notifyAdmins(client, submission, name) {
    const identity = submission.submissionType === 'identity_edit';
    await client.query(`INSERT INTO notification (account_id, type, title, content, ref_type, ref_id, metadata)
      SELECT a.account_id, $1::notification_type_enum, $2, $3, 'shop', $4, $5::jsonb
      FROM account a JOIN role r ON r.role_id = a.role_id WHERE r.name = 'admin'`,
    [identity ? 'shop_identity_edit_pending' : 'shop_pending_verification',
      identity ? 'Yêu cầu sửa thông tin quán' : 'Hồ sơ quán chờ xác minh',
      `${name} có ${identity ? 'yêu cầu sửa thông tin' : 'hồ sơ đăng ký'} đang chờ duyệt.`, submission.shopId,
      JSON.stringify({ submissionId: submission.submissionId, submissionType: submission.submissionType })]);
  }

  function checkVersion(actual, expected) { if (actual !== expected) conflict(); }

  return { pool, ensureSchema, transaction, ownedShop, getShop, schedule, replaceSchedule,
    pending, view, insertSubmission, notifyAdmins, checkVersion };
}

module.exports = { createShopStorage, SHOP_FIELDS, SUBMISSION_FIELDS, MENU_FIELDS };
