const pool = require('../config/db');
const PAGE_SIZE = 5;

function trendPercent(current, previous) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

async function getDashboard() {
  const [statsResult, communityResult] = await Promise.all([
    pool.query(`
      WITH pending_items AS (
        SELECT created_at FROM post WHERE status = 'pending'
        UNION ALL
        SELECT created_at FROM report WHERE status = 'pending'
      )
      SELECT
        (SELECT count(*)::int FROM post WHERE status = 'pending') AS post,
        (SELECT count(*)::int FROM report WHERE status = 'pending') AS report,
        0::int AS appeals,
        (SELECT count(*)::int FROM pending_items
          WHERE created_at < NOW() - INTERVAL '48 hours') AS stale,
        COALESCE((
          SELECT FLOOR(EXTRACT(EPOCH FROM (NOW() - MIN(created_at))) / 86400)::int
          FROM pending_items
          WHERE created_at < NOW() - INTERVAL '48 hours'
        ), 0) AS "staleOldestDays"
    `),
    pool.query(`
      SELECT
        (SELECT count(*)::int FROM account WHERE created_at >= NOW() - INTERVAL '7 days') AS "newMembers",
        (SELECT count(*)::int FROM account WHERE created_at >= NOW() - INTERVAL '14 days'
          AND created_at < NOW() - INTERVAL '7 days') AS "newMembersPrevious",
        (SELECT count(*)::int FROM account WHERE last_login_at >= NOW() - INTERVAL '7 days') AS "activeUsers",
        (SELECT count(*)::int FROM account WHERE last_login_at >= NOW() - INTERVAL '14 days'
          AND last_login_at < NOW() - INTERVAL '7 days') AS "activeUsersPrevious",
        (SELECT count(*)::int FROM post WHERE created_at >= NOW() - INTERVAL '7 days') AS "newPosts",
        (SELECT count(*)::int FROM post WHERE created_at >= NOW() - INTERVAL '14 days'
          AND created_at < NOW() - INTERVAL '7 days') AS "newPostsPrevious",
        (SELECT count(*)::int FROM comment WHERE created_at >= NOW() - INTERVAL '7 days') AS comments,
        (SELECT count(*)::int FROM comment WHERE created_at >= NOW() - INTERVAL '14 days'
          AND created_at < NOW() - INTERVAL '7 days') AS "commentsPrevious",
        (SELECT count(*)::int FROM report WHERE created_at >= NOW() - INTERVAL '7 days') AS reports,
        (SELECT count(*)::int FROM report WHERE created_at >= NOW() - INTERVAL '14 days'
          AND created_at < NOW() - INTERVAL '7 days') AS "reportsPrevious"
    `),
  ]);

  const stats = statsResult.rows[0];
  const current = communityResult.rows[0];
  const community = [
    ['newMembers', 'Thành viên mới', 'người'],
    ['activeUsers', 'Đang hoạt động', 'người'],
    ['newPosts', 'Bài viết mới', 'bài'],
    ['comments', 'Bình luận', 'bình luận'],
    ['reports', 'Báo cáo', 'báo cáo'],
  ].map(([key, label, unit]) => ({
    key,
    label,
    value: current[key],
    unit,
    trend: trendPercent(current[key], current[`${key}Previous`]),
  }));

  return {
    pendingStats: {
      post: stats.post,
      report: stats.report,
      appeals: 0,
      stale: stats.stale,
      staleOldestDays: stats.staleOldestDays,
    },
    community,
  };
}

function pagination(page, totalItems) {
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  return { page: Math.min(page, totalPages), pageSize: PAGE_SIZE, totalPages, totalItems };
}

async function getAlerts(requestedPage) {
  const countQuery = `
    SELECT count(*)::int AS total FROM (
      SELECT r.target_id
      FROM report r
      WHERE r.target_type = 'post' AND r.status = 'pending'
      GROUP BY r.target_id
      HAVING count(*) >= 3
    ) alerts
  `;
  const countResult = await pool.query(countQuery);
  const totalItems = countResult.rows[0].total;
  const page = pagination(requestedPage, totalItems);
  const { rows } = await pool.query(`
    SELECT 'reports-post-' || r.target_id::text AS id, 'alert'::text AS tone,
      CASE WHEN p.title IS NOT NULL
        THEN 'Bài viết “' || p.title || '” có ' || r.report_count::text || ' báo cáo đang chờ xử lý'
        ELSE 'Bài #' || r.target_id::text || ' có ' || r.report_count::text || ' báo cáo đang chờ xử lý'
      END AS title
    FROM (
      SELECT target_id, count(*)::int AS report_count
      FROM report
      WHERE target_type = 'post' AND status = 'pending'
      GROUP BY target_id
      HAVING count(*) >= 3
    ) r
    LEFT JOIN post p ON p.post_id = r.target_id
    ORDER BY r.report_count DESC, r.target_id DESC
    LIMIT $1 OFFSET $2
  `, [PAGE_SIZE, (page.page - 1) * PAGE_SIZE]);
  return { items: rows, ...page };
}

async function getQueue(requestedPage) {
  const from = `
    SELECT p.post_id AS id, 'post'::text AS entity, p.title AS excerpt,
      COALESCE(a.full_name, a.email) AS author, 'Bài mới chờ duyệt'::text AS reason,
      p.created_at AS "createdAt"
    FROM post p JOIN account a ON a.account_id = p.account_id
    WHERE p.status = 'pending'
    UNION ALL
    SELECT r.report_id AS id, 'report'::text AS entity,
      COALESCE(p.title, 'Bài #' || r.target_id::text || ' không còn tồn tại') AS excerpt,
      COALESCE(a.full_name, a.email) AS author, 'Bị báo cáo'::text AS reason,
      r.created_at AS "createdAt"
    FROM report r
    JOIN account a ON a.account_id = r.reporter_id
    LEFT JOIN post p ON p.post_id = r.target_id
    WHERE r.target_type = 'post' AND r.status = 'pending'
  `;
  const countResult = await pool.query(`SELECT count(*)::int AS total FROM (${from}) queue`);
  const totalItems = countResult.rows[0].total;
  const page = pagination(requestedPage, totalItems);
  const { rows } = await pool.query(`
    SELECT * FROM (${from}) queue
    ORDER BY "createdAt" DESC, id DESC
    LIMIT $1 OFFSET $2
  `, [PAGE_SIZE, (page.page - 1) * PAGE_SIZE]);
  return { items: rows, ...page };
}

async function getAudit(requestedPage) {
  const countResult = await pool.query('SELECT count(*)::int AS total FROM admin_log');
  const totalItems = countResult.rows[0].total;
  const page = pagination(requestedPage, totalItems);
  const { rows } = await pool.query(`
    SELECT l.admin_log_id AS id, COALESCE(admin.full_name, admin.email) AS admin,
      l.action, l.target_type AS "targetType",
      COALESCE(target_account.email, post_author.email, comment_author.email,
        reported_post_author.email, reported_comment_author.email, reporter.email) AS "targetEmail",
      l.created_at AS at, l.reason
    FROM admin_log l
    LEFT JOIN account admin ON admin.account_id = l.admin_id
    LEFT JOIN account target_account ON l.target_type::text = 'account' AND target_account.account_id = l.target_id
    LEFT JOIN post target_post ON l.target_type::text = 'post' AND target_post.post_id = l.target_id
    LEFT JOIN account post_author ON post_author.account_id = target_post.account_id
    LEFT JOIN comment target_comment ON l.target_type::text = 'comment' AND target_comment.comment_id = l.target_id
    LEFT JOIN account comment_author ON comment_author.account_id = target_comment.author_id
    LEFT JOIN report target_report ON l.target_type::text = 'report' AND target_report.report_id = l.target_id
    LEFT JOIN post reported_post ON target_report.target_type::text = 'post' AND reported_post.post_id = target_report.target_id
    LEFT JOIN account reported_post_author ON reported_post_author.account_id = reported_post.account_id
    LEFT JOIN comment reported_comment ON target_report.target_type::text = 'comment' AND reported_comment.comment_id = target_report.target_id
    LEFT JOIN account reported_comment_author ON reported_comment_author.account_id = reported_comment.author_id
    LEFT JOIN account reporter ON reporter.account_id = target_report.reporter_id
    ORDER BY l.created_at DESC, l.admin_log_id DESC
    LIMIT $1 OFFSET $2
  `, [PAGE_SIZE, (page.page - 1) * PAGE_SIZE]);
  return { items: rows, ...page };
}

module.exports = { getDashboard, getAlerts, getQueue, getAudit };