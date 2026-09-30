// Truy vấn cho trang Bảng tin (User Post Page · ID01) — NƠI DUY NHẤT của tính năng này nói chuyện với DB.
// Mọi câu SQL đều tham số hoá $1, $2... (chống SQL injection).
//
// Quy tắc nghiệp vụ (nhóm chốt 28/09):
//  - Feed chỉ hiện post.status IN ('public', 'reported').
//  - Khách: 3 bài cố định = 3 bài tạo SỚM NHẤT của ngày gần nhất trước hôm nay (theo created_at, giờ VN);
//    ngày đó chưa đủ 3 thì lấy tiếp ngày trước nữa.
//  - Feed thành viên: bài mới ĐĂNG nhất trước = published_at (lúc Admin duyệt), không phải created_at.
//  - Báo cáo 1 bài 'public' → bài chuyển 'reported' (vẫn hiện). Admin xử lý ở module của Tùng.
const pool = require('../config/db');

const VISIBLE = `p.status IN ('public', 'reported')`;
// Lúc bài lên feed. Bài nhập tay/seed có thể thiếu published_at → lấy created_at cho khỏi mất bài.
const PUBLISHED = 'COALESCE(p.published_at, p.created_at)';
const TZ = `'Asia/Ho_Chi_Minh'`; // DB lưu giờ UTC → mọi mốc "ngày" phải đổi sang giờ VN

/** Lỗi nghiệp vụ có sẵn mã HTTP → controller trả thẳng status + message */
class PostError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'PostError';
    this.status = status;
  }
}

// Cột trả về cho FE — đúng dạng Post trong client/src/services/post.service.js.
// $1 luôn là id người xem (NULL = khách) để tính isVoted và hasReported.
const POST_FIELDS = `
  p.post_id::text      AS id,
  p.post_type          AS type,
  p.title,
  p.content,
  p.thumbnail_url      AS "thumbnailUrl",
  p.youtube_url        AS "youtubeUrl",
  p.status,
  p.vote_count         AS "voteCount",
  p.comment_count      AS "commentCount",
  p.created_at         AS "createdAt",
  ${PUBLISHED}         AS "publishedAt",
  json_build_object('id', a.account_id::text, 'fullName', a.full_name, 'avatarUrl', a.avatar_url) AS author,
  COALESCE((
    SELECT json_agg(json_build_object('id', c.category_id::text, 'name', c.name) ORDER BY c.name)
    FROM post_category pc JOIN category c ON c.category_id = pc.category_id
    WHERE pc.post_id = p.post_id AND c.is_active
  ), '[]'::json)       AS categories,
  EXISTS (SELECT 1 FROM post_vote v WHERE v.post_id = p.post_id AND v.account_id = $1::bigint) AS "isVoted",
  -- Người xem đã báo cáo bài này và Admin chưa xử lý → FE hiện "Đã báo cáo" (khách: luôn false)
  EXISTS (
    SELECT 1 FROM report r
    WHERE r.target_type = 'post' AND r.target_id = p.post_id
      AND r.reporter_id = $1::bigint AND r.status = 'pending'
  ) AS "hasReported"
`;
const FROM_POST = 'FROM post p JOIN account a ON a.account_id = p.account_id';

const COMMENT_FIELDS = `
  c.comment_id::text AS id,
  c.content,
  c.created_at       AS "createdAt",
  json_build_object('id', a.account_id::text, 'fullName', a.full_name, 'avatarUrl', a.avatar_url) AS author,
  (c.author_id = $2::bigint) IS TRUE AS "isOwner"
`;

/** Chạy nhiều câu SQL "tất cả hoặc không" (vd thêm vote + tăng vote_count) */
async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* kết nối hỏng — giữ lỗi gốc */ }
    throw error;
  } finally {
    client.release();
  }
}

/** Khoá dòng bài (FOR UPDATE) để 2 request cùng lúc không đếm sai. Bài không hiện → 404 */
async function lockVisiblePost(client, postId) {
  const { rows } = await client.query(
    `SELECT p.post_id, p.account_id::text AS "authorId", p.status FROM post p WHERE p.post_id = $1 AND ${VISIBLE} FOR UPDATE`,
    [postId],
  );
  if (!rows[0]) throw new PostError(404, 'Bài viết không tồn tại hoặc đã bị gỡ.');
  return rows[0];
}

// =====================================================================
//  ĐỌC
// =====================================================================

/**
 * 3 bài cho khách. Ví dụ hôm nay 28/09: hôm qua (27/09) có 1 bài lúc 0h30, hôm kia (26/09) có bài 7h, 9h, 12h
 * → lấy [27/09 0h30, 26/09 7h, 26/09 9h]. Bài hôm nay không bao giờ lọt vào.
 */
async function findPreview() {
  const { rows } = await pool.query(`
    SELECT ${POST_FIELDS}
    ${FROM_POST}
    WHERE ${VISIBLE}
      AND p.created_at < (date_trunc('day', now() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ})  -- trước 0h hôm nay (giờ VN)
    ORDER BY (p.created_at AT TIME ZONE ${TZ})::date DESC,  -- ngày gần nhất trước
             p.created_at ASC, p.post_id ASC                -- trong ngày: bài sớm nhất trước
    LIMIT 3
  `, [null]);
  return rows;
}

// Mốc thời gian đổi ra số micro giây (số nguyên) → đưa vào cursor không bị làm tròn như Date của JS
const SORT_KEY = `(extract(epoch FROM ${PUBLISHED}) * 1000000)::bigint`;

/**
 * Feed thành viên: bài mới đăng nhất trước (published_at DESC, trùng giờ thì post_id DESC).
 * Phân trang bằng cursor "<micro giây>_<post_id>" của bài cuối trang trước.
 * Ví dụ trang 1 kết thúc ở bài 12 đăng lúc 1790650000000000 → cursor "1790650000000000_12",
 * trang 2 lấy các bài có (mốc, id) nhỏ hơn cặp đó. Lấy dư 1 bài để biết còn trang sau hay không.
 * @param {{ time: string, id: string } | null} cursor
 */
async function findFeed({ viewerId, cursor = null, q = '', limit = 10 }) {
  const keyword = q ? `%${q.replace(/[\\%_]/g, '\\$&')}%` : null; // gõ "%" hay "_" không bị hiểu là ký tự đại diện
  const { rows } = await pool.query(`
    SELECT ${POST_FIELDS}, ${SORT_KEY}::text AS "sortKey"
    ${FROM_POST}
    WHERE ${VISIBLE}
      AND ($2::bigint IS NULL OR (${SORT_KEY}, p.post_id) < ($2::bigint, $3::bigint))
      AND ($4::text IS NULL OR p.title ILIKE $4::text)
    ORDER BY ${PUBLISHED} DESC, p.post_id DESC
    LIMIT $5
  `, [viewerId, cursor?.time ?? null, cursor?.id ?? null, keyword, limit + 1]);
  const items = rows.slice(0, limit).map(({ sortKey, ...post }) => post); // sortKey chỉ dùng làm cursor
  const last = rows[limit - 1];
  return { items, nextCursor: rows.length > limit ? `${last.sortKey}_${last.id}` : null };
}

/** Bình luận public của 1 bài, mới nhất trước. viewerId để đánh dấu isOwner. */
async function findComments(postId, viewerId) {
  const exists = await pool.query(`SELECT 1 FROM post p WHERE p.post_id = $1 AND ${VISIBLE}`, [postId]);
  if (!exists.rows[0]) throw new PostError(404, 'Bài viết không tồn tại hoặc đã bị gỡ.');
  const { rows } = await pool.query(`
    SELECT ${COMMENT_FIELDS}
    FROM comment c JOIN account a ON a.account_id = c.author_id
    WHERE c.post_id = $1 AND c.status = 'public'
    ORDER BY c.created_at DESC, c.comment_id DESC
    LIMIT 200
  `, [postId, viewerId]);
  return rows;
}

/** Từ khoá cấm mức 'block' đầu tiên có trong nội dung (không có → null) */
async function findBlockedKeyword(text, scope) {
  const { rows } = await pool.query(`
    SELECT keyword FROM banned_keyword
    WHERE is_active AND severity = 'block' AND scope IN ($2::banned_keyword_scope_enum, 'both')
      AND strpos(lower($1), lower(keyword)) > 0
    LIMIT 1
  `, [text, scope]);
  return rows[0]?.keyword ?? null;
}

// =====================================================================
//  GHI
// =====================================================================

/** Thích / bỏ thích. post_vote và post.vote_count luôn khớp nhau nhờ transaction. */
async function toggleVote(postId, accountId) {
  return transaction(async (client) => {
    await lockVisiblePost(client, postId);
    const removed = await client.query(
      'DELETE FROM post_vote WHERE post_id = $1 AND account_id = $2 RETURNING 1',
      [postId, accountId],
    );
    const voted = removed.rowCount === 0;
    if (voted) {
      await client.query('INSERT INTO post_vote (post_id, account_id) VALUES ($1, $2)', [postId, accountId]);
    }
    const { rows } = await client.query(
      'UPDATE post SET vote_count = GREATEST(vote_count + $2, 0) WHERE post_id = $1 RETURNING vote_count AS "voteCount"',
      [postId, voted ? 1 : -1],
    );
    return { voted, voteCount: rows[0].voteCount };
  });
}

/** Thêm bình luận + tăng post.comment_count */
async function createComment(postId, authorId, content) {
  return transaction(async (client) => {
    await lockVisiblePost(client, postId);
    const inserted = await client.query(
      'INSERT INTO comment (post_id, author_id, content) VALUES ($1, $2, $3) RETURNING comment_id',
      [postId, authorId, content],
    );
    await client.query('UPDATE post SET comment_count = comment_count + 1 WHERE post_id = $1', [postId]);
    const { rows } = await client.query(`
      SELECT ${COMMENT_FIELDS}
      FROM comment c JOIN account a ON a.account_id = c.author_id
      WHERE c.comment_id = $1
    `, [inserted.rows[0].comment_id, authorId]);
    return rows[0];
  });
}

/**
 * Báo cáo bài / bình luận.
 *  - Không tự báo cáo nội dung của mình · không gửi trùng khi báo cáo cũ còn 'pending'.
 *  - Bài 'public' bị báo cáo → 'reported' (vẫn hiện trong feed).
 */
async function createReport({ reporterId, targetType, targetId, reasonCode, reasonText }) {
  return transaction(async (client) => {
    if (targetType === 'post') {
      const post = await lockVisiblePost(client, targetId);
      if (post.authorId === String(reporterId)) throw new PostError(400, 'Bạn không thể báo cáo bài viết của chính mình.');
    } else {
      const { rows } = await client.query(`
        SELECT c.author_id::text AS "authorId" FROM comment c JOIN post p ON p.post_id = c.post_id
        WHERE c.comment_id = $1 AND c.status = 'public' AND ${VISIBLE}
      `, [targetId]);
      if (!rows[0]) throw new PostError(404, 'Bình luận không tồn tại hoặc đã bị gỡ.');
      if (rows[0].authorId === String(reporterId)) throw new PostError(400, 'Bạn không thể báo cáo bình luận của chính mình.');
    }

    const dup = await client.query(`
      SELECT 1 FROM report
      WHERE reporter_id = $1 AND target_type = $2::report_target_type_enum AND target_id = $3 AND status = 'pending'
    `, [reporterId, targetType, targetId]);
    if (dup.rows[0]) throw new PostError(409, 'Bạn đã báo cáo nội dung này rồi, Admin đang xem xét.');

    const { rows } = await client.query(`
      INSERT INTO report (reporter_id, target_type, target_id, reason_code, reason_text)
      VALUES ($1, $2::report_target_type_enum, $3, $4::report_reason_code_enum, $5)
      RETURNING report_id::text AS id
    `, [reporterId, targetType, targetId, reasonCode, reasonText]);

    if (targetType === 'post') {
      await client.query(`UPDATE post SET status = 'reported', updated_at = now() WHERE post_id = $1 AND status = 'public'`, [targetId]);
    }
    return rows[0];
  });
}

module.exports = {
  PostError, findPreview, findFeed, findComments, findBlockedKeyword, toggleVote, createComment, createReport,
};
