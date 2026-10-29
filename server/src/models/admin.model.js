const pool = require('../config/db');
const ingredientProposalModel = require('./ingredientProposal.model');
const PAGE_SIZE = 5;

// Khoi's code 30/10: khoảng thời gian của trang Tổng quan (Hôm nay · 7 ngày · 30 ngày)
//   days = độ dài kỳ để so với kỳ ngay trước đó · chartDays = số cột của biểu đồ theo ngày
const RANGES = {
  today: { days: 1, chartDays: 7 },
  '7d': { days: 7, chartDays: 7 },
  '30d': { days: 30, chartDays: 30 },
};
const TZ = 'Asia/Ho_Chi_Minh';

function trendPercent(current, previous) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * @param {'today'|'7d'|'30d'} [range='7d']  Khoi's code 30/10: kỳ của chỉ số cộng đồng (so với kỳ trước cùng độ dài)
 * @returns {{ range, pendingStats, community, series, topReported }}
 *   pendingStats thêm recipe · ingredient · shop · total · age{under24, from24to48, over48} (age chỉ tính bài + báo cáo)
 *   series = [{ date: 'YYYY-MM-DD', posts, reports }] theo ngày giờ VN · topReported = 5 bài có nhiều báo cáo chờ nhất
 */
async function getDashboard(range = '7d') {
  const { days, chartDays } = RANGES[range] ?? RANGES['7d'];
  const span = `${days} days`;
  const twice = `${days * 2} days`;
  const [statsResult, communityResult, extraResult, seriesResult, topResult, ingredientPending] = await Promise.all([
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
        (SELECT count(*)::int FROM account WHERE created_at >= NOW() - $1::interval) AS "newMembers",
        (SELECT count(*)::int FROM account WHERE created_at >= NOW() - $2::interval
          AND created_at < NOW() - $1::interval) AS "newMembersPrevious",
        (SELECT count(*)::int FROM account WHERE last_login_at >= NOW() - $1::interval) AS "activeUsers",
        (SELECT count(*)::int FROM account WHERE last_login_at >= NOW() - $2::interval
          AND last_login_at < NOW() - $1::interval) AS "activeUsersPrevious",
        (SELECT count(*)::int FROM post WHERE created_at >= NOW() - $1::interval) AS "newPosts",
        (SELECT count(*)::int FROM post WHERE created_at >= NOW() - $2::interval
          AND created_at < NOW() - $1::interval) AS "newPostsPrevious",
        (SELECT count(*)::int FROM comment WHERE created_at >= NOW() - $1::interval) AS comments,
        (SELECT count(*)::int FROM comment WHERE created_at >= NOW() - $2::interval
          AND created_at < NOW() - $1::interval) AS "commentsPrevious",
        (SELECT count(*)::int FROM report WHERE created_at >= NOW() - $1::interval) AS reports,
        (SELECT count(*)::int FROM report WHERE created_at >= NOW() - $2::interval
          AND created_at < NOW() - $1::interval) AS "reportsPrevious"
    `, [span, twice]),
    // Khoi's code 30/10: việc chờ ở các trang duyệt khác + chia hàng đợi (bài + báo cáo) theo thời gian chờ
    pool.query(`
      WITH pending_items AS (
        SELECT created_at FROM post WHERE status = 'pending'
        UNION ALL
        SELECT created_at FROM report WHERE status = 'pending'
      )
      SELECT
        (SELECT count(*)::int FROM recipe WHERE status = 'pending') AS recipe,
        (SELECT count(*)::int FROM shop WHERE verification_status::text = 'pending') AS shop,
        (SELECT count(*)::int FROM pending_items WHERE created_at >= NOW() - INTERVAL '24 hours') AS under24,
        (SELECT count(*)::int FROM pending_items WHERE created_at < NOW() - INTERVAL '24 hours'
          AND created_at >= NOW() - INTERVAL '48 hours') AS "from24to48"
    `),
    // Khoi's code 30/10: bài viết mới và báo cáo mới theo từng ngày (giờ Việt Nam), đủ ngày kể cả ngày bằng 0
    pool.query(`
      WITH d AS (
        SELECT generate_series((NOW() AT TIME ZONE '${TZ}')::date - ($1::int - 1), (NOW() AT TIME ZONE '${TZ}')::date, '1 day')::date AS day
      )
      SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
        (SELECT count(*)::int FROM post p WHERE (p.created_at AT TIME ZONE '${TZ}')::date = d.day) AS posts,
        (SELECT count(*)::int FROM report r WHERE (r.created_at AT TIME ZONE '${TZ}')::date = d.day) AS reports
      FROM d ORDER BY d.day
    `, [chartDays]),
    // Khoi's code 30/10: 5 bài có nhiều báo cáo đang chờ nhất (thay khối 5 cảnh báo đỏ)
    pool.query(`
      SELECT r.target_id::text AS "postId", COALESCE(p.title, 'Bài #' || r.target_id::text || ' không còn tồn tại') AS title,
        count(*)::int AS reports, max(r.created_at) AS "lastReportAt"
      FROM report r LEFT JOIN post p ON p.post_id = r.target_id
      WHERE r.target_type = 'post' AND r.status = 'pending'
      GROUP BY r.target_id, p.title
      ORDER BY reports DESC, "lastReportAt" DESC
      LIMIT 5
    `),
    ingredientProposalModel.listPending().then((rows) => rows.length),
  ]);

  const stats = statsResult.rows[0];
  const current = communityResult.rows[0];
  const extra = extraResult.rows[0];
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
    previous: current[`${key}Previous`],
    trend: trendPercent(current[key], current[`${key}Previous`]),
  }));

  return {
    range: RANGES[range] ? range : '7d',
    pendingStats: {
      post: stats.post,
      report: stats.report,
      appeals: 0,
      stale: stats.stale,
      staleOldestDays: stats.staleOldestDays,
      // Khoi's code 30/10
      recipe: extra.recipe,
      ingredient: ingredientPending,
      shop: extra.shop,
      total: stats.post + stats.report + extra.recipe + ingredientPending + extra.shop,
      age: { under24: extra.under24, from24to48: extra.from24to48, over48: stats.stale },
    },
    community,
    series: seriesResult.rows,
    topReported: topResult.rows,
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

module.exports = { RANGES, getDashboard, getAlerts, getQueue, getAudit };