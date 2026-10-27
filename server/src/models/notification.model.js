const pool = require('../config/db');

function parseNotificationId(rawId) {
  const value = String(rawId ?? '');
  if (!/^[1-9]\d{0,18}$/.test(value)) {
    const error = new Error('Mã thông báo không hợp lệ.');
    error.status = 400;
    throw error;
  }
  return value;
}

async function listForAccount(accountId) {
  const [itemsResult, unreadResult] = await Promise.all([
    pool.query(`
      SELECT notification_id::text AS id, type, title, content, is_read AS "isRead",
        created_at AS "createdAt",
        ref_type::text AS "refType", ref_id::text AS "refId", metadata
      FROM public.notification
      WHERE account_id = $1
      ORDER BY created_at DESC, notification_id DESC
      LIMIT 30
    `, [accountId]),
    pool.query('SELECT count(*)::int AS count FROM public.notification WHERE account_id = $1 AND is_read = false', [accountId]),
  ]);
  return { items: itemsResult.rows, unreadCount: unreadResult.rows[0].count };
}

async function markRead(accountId, rawId) {
  const id = parseNotificationId(rawId);
  const { rows } = await pool.query(`
    UPDATE public.notification SET is_read = true
    WHERE account_id = $1 AND notification_id = $2
    RETURNING notification_id::text AS id
  `, [accountId, id]);
  if (!rows[0]) {
    const error = new Error('Không tìm thấy thông báo.');
    error.status = 404;
    throw error;
  }
  return { id: rows[0].id, isRead: true };
}

async function markAllRead(accountId) {
  const { rowCount } = await pool.query(`
    UPDATE public.notification SET is_read = true
    WHERE account_id = $1 AND is_read = false
  `, [accountId]);
  return { updatedCount: rowCount };
}

module.exports = { listForAccount, markRead, markAllRead };
