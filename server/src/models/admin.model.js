const pool = require('../config/db');

function trendPercent(current, previous) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

async function getDashboard() {
  const [statsResult, alertResult, queueResult, communityResult, auditResult] = await Promise.all([
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
      SELECT r.target_id AS "postId", p.title, count(*)::int AS "reportCount"
      FROM report r
      LEFT JOIN post p ON p.post_id = r.target_id
      WHERE r.target_type = 'post' AND r.status = 'pending'
      GROUP BY r.target_id, p.title
      HAVING count(*) >= 3
      ORDER BY count(*) DESC, r.target_id
    `),
    pool.query(`
      SELECT * FROM (
        SELECT p.post_id AS id, 'post'::text AS entity, p.title AS excerpt,
          COALESCE(a.full_name, a.email) AS author, 'Bài mới chờ duyệt'::text AS reason,
          p.created_at AS "createdAt", NULL::text AS assignee
        FROM post p JOIN account a ON a.account_id = p.account_id
        WHERE p.status = 'pending'
        UNION ALL
        SELECT r.report_id AS id, 'report'::text AS entity,
          COALESCE(p.title, 'Bài #' || r.target_id::text || ' không còn tồn tại') AS excerpt,
          COALESCE(a.full_name, a.email) AS author, 'Bị báo cáo'::text AS reason,
          r.created_at AS "createdAt", NULL::text AS assignee
        FROM report r
        JOIN account a ON a.account_id = r.reporter_id
        LEFT JOIN post p ON p.post_id = r.target_id
        WHERE r.target_type = 'post' AND r.status = 'pending'
      ) queue
      ORDER BY "createdAt" DESC, id DESC
      LIMIT 10
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
    pool.query(`
      SELECT l.admin_log_id AS id, COALESCE(a.full_name, a.email) AS admin, l.action,
        COALESCE(l.target_type::text || ' #' || l.target_id::text, '') AS target,
        l.created_at AS at, l.reason
      FROM admin_log l
      JOIN account a ON a.account_id = l.admin_id
      ORDER BY l.created_at DESC, l.admin_log_id DESC
      LIMIT 10
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
    alerts: alertResult.rows.map((row) => ({
      id: `reports-post-${row.postId}`,
      tone: 'alert',
      title: row.title
        ? `Bài viết “${row.title}” có ${row.reportCount} báo cáo đang chờ xử lý`
        : `Bài #${row.postId} có ${row.reportCount} báo cáo đang chờ xử lý`,
      description: 'Đạt ngưỡng 3 báo cáo chờ xử lý.',
      actionLabel: 'Xem báo cáo',
      href: '/admin/moderation?type=report',
    })),
    reviewQueue: queueResult.rows,
    community,
    auditLog: auditResult.rows,
  };
}

module.exports = { getDashboard };