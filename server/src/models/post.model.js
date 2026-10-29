// Truy vấn cho trang Bảng tin (User Post Page · ID01) — NƠI DUY NHẤT của tính năng này nói chuyện với DB.
// Mọi câu SQL đều tham số hoá $1, $2... (chống SQL injection).
//
// Quy tắc nghiệp vụ (nhóm chốt 28/09):
//  - Feed chỉ hiện post.status IN ('public', 'reported').
//  - Khách: 3 bài = 3 bài có nhiều lượt thả tim (vote_count) nhất.
//  - Feed thành viên: bài mới ĐĂNG nhất trước = published_at (lúc Admin duyệt), không phải created_at.
//  - Báo cáo 1 bài 'public' → bài chuyển 'reported' (vẫn hiện). Admin xử lý ở module của Tùng.
const pool = require('../config/db');
const { buildSearch, searchWhere } = require('../utils/postSearch'); // Khoi's code 28/10: tìm theo phạm vi, không dấu
// Tung's code: Điểm nối Bảng tin của Khôi với module gom báo cáo theo case.
const { getOrCreatePendingCase } = require('./reportCase.model');

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

/** 3 bài cho khách = 3 bài nhiều lượt thả tim nhất (bằng nhau thì bài đăng mới hơn trước). */
async function findPreview() {
  const { rows } = await pool.query(`
    SELECT ${POST_FIELDS}
    ${FROM_POST}
    WHERE ${VISIBLE}
    ORDER BY p.vote_count DESC, ${PUBLISHED} DESC, p.post_id DESC
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
// Khoi's code: categoryId (Sprint 2) — lọc bài có gắn danh mục đó (hàng nút lọc trên Bảng tin)
// Khoi's code 28/10: scope = phạm vi tìm (all · title · author · topic), không phân biệt dấu — xem utils/postSearch.js
async function findFeed({ viewerId, cursor = null, q = '', scope = 'all', categoryId = null, limit = 10 }) {
  const { titleLike, authorLike, topicLike } = buildSearch(q, scope);
  const { rows } = await pool.query(`
    SELECT ${POST_FIELDS}, ${SORT_KEY}::text AS "sortKey"
    ${FROM_POST}
    WHERE ${VISIBLE}
      AND ($2::bigint IS NULL OR (${SORT_KEY}, p.post_id) < ($2::bigint, $3::bigint))
      AND ${searchWhere(4, 7, 8)}
      AND ($6::bigint IS NULL OR EXISTS (
        SELECT 1 FROM post_category pc WHERE pc.post_id = p.post_id AND pc.category_id = $6::bigint
      ))
    ORDER BY ${PUBLISHED} DESC, p.post_id DESC
    LIMIT $5
  `, [viewerId, cursor?.time ?? null, cursor?.id ?? null, titleLike, limit + 1, categoryId, authorLike, topicLike]);
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

//BIÊN BẢN : POST.KHOILA.1
// Code cũ của Khôi — tạm ngưng vì schema banned_keyword hiện chỉ có
// keyword_id, keyword, normalized_keyword. Các cột is_active, severity, scope
// và enum banned_keyword_scope_enum không còn tồn tại; truy vấn cũ gây lỗi SQL
// ở bước lọc từ cấm, khiến gửi bình luận trả 500 trước khi INSERT comment.
// Giữ lại nguyên hàm để đối chiếu với cách xử lý theo schema cũ.
// async function findBlockedKeyword(text, scope) {
//   const { rows } = await pool.query(`
//     SELECT keyword FROM banned_keyword
//     WHERE is_active AND severity = 'block' AND scope IN ($2::banned_keyword_scope_enum, 'both')
//       AND strpos(lower($1), lower(keyword)) > 0
//     LIMIT 1
//   `, [text, scope]);
//   return rows[0]?.keyword ?? null;
// }

// Fix cho Khôi: Lọc từ cấm theo cột keyword của schema hiện tại, giữ cách tìm
// chuỗi con không phân biệt hoa/thường và trả keyword hoặc null như trước.
// Chưa có quy ước chuẩn hóa chung nên không suy đoán cách dùng normalized_keyword.
// Schema không còn mức độ/phạm vi/bật tắt: mọi keyword trong bảng đều áp dụng
// cho bình luận. Giữ tham số _scope để controller vẫn gọi (content, 'comment').
// Khoi's code (12/10/2026): chỉ lấy category = 'spam'. Từ 'animal' (cá, gà…) chỉ để cảnh báo, không chặn bình luận.
async function findBlockedKeyword(text, _scope) {
  const { rows } = await pool.query(`
    SELECT keyword FROM banned_keyword
    WHERE category = 'spam' AND btrim(keyword) <> ''
      AND strpos(lower($1::text), lower(keyword)) > 0
    ORDER BY keyword_id
    LIMIT 1
  `, [text]);
  // Fix cho Khôi: Bỏ keyword rỗng để tránh khớp mọi bình luận; tham số hóa
  // nội dung bằng $1. Controller vẫn trả 422 khi tìm thấy từ cấm.
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
//BIÊN BẢN POST.LAK.2
async function createReport({ reporterId, targetType, targetId, reasonCode, reasonText }) {
  return transaction(async (client) => {
    if (targetType === 'post') {
      const post = await lockVisiblePost(client, targetId);
      if (post.authorId === String(reporterId)) throw new PostError(400, 'Bạn không thể báo cáo bài viết của chính mình.');
    } else {
      // Tung's code: Khóa bài cha trước, rồi mới khóa comment và case. Admin
      // cũng dùng thứ tự này khi xóa comment và giảm comment_count, tránh
      // deadlock và tránh nhận report khi bài cha vừa bị gỡ đồng thời.
      const parent = await client.query('SELECT post_id FROM comment WHERE comment_id = $1', [targetId]);
      if (!parent.rows[0]) throw new PostError(404, 'Bình luận không tồn tại hoặc đã bị gỡ.');
      await lockVisiblePost(client, parent.rows[0].post_id);
      const { rows } = await client.query(`
        SELECT c.author_id::text AS "authorId" FROM comment c JOIN post p ON p.post_id = c.post_id
        WHERE c.comment_id = $1 AND c.post_id = $2 AND c.status = 'public' AND ${VISIBLE}
        FOR UPDATE OF c
      `, [targetId, parent.rows[0].post_id]);
      if (!rows[0]) throw new PostError(404, 'Bình luận không tồn tại hoặc đã bị gỡ.');
      if (rows[0].authorId === String(reporterId)) throw new PostError(400, 'Bạn không thể báo cáo bình luận của chính mình.');
    }

    // Tung's code: Case phải có trước INSERT vì report.case_id là NOT NULL.
    // Kiểm tra target/tự báo cáo phía trên vẫn giữ trách nhiệm của Bảng tin.
    const caseId = await getOrCreatePendingCase(client, targetType, targetId);
    const dup = await client.query(`
      SELECT 1 FROM report
      WHERE reporter_id = $1 AND case_id = $2
    `, [reporterId, caseId]);
    if (dup.rows[0]) throw new PostError(409, 'Bạn đã báo cáo nội dung này rồi, Admin đang xem xét.');

    const { rows } = await client.query(`
      INSERT INTO report (reporter_id, target_type, target_id, reason_code, reason_text, case_id)
      VALUES ($1, $2::report_target_type_enum, $3, $4::report_reason_code_enum, $5, $6)
      RETURNING report_id::text AS id
    `, [reporterId, targetType, targetId, reasonCode, reasonText, caseId]);

    // Tung's code: Giữ hành vi cũ của Khôi: reported vẫn hiện trên feed;
    // không cập nhật post lần thứ hai, không đổi trạng thái comment khi gửi report.
    if (targetType === 'post') {
      await client.query(`UPDATE post SET status = 'reported', updated_at = now() WHERE post_id = $1 AND status = 'public'`, [targetId]);
    }
    // Tung's code: id vẫn là report ID để giữ hợp đồng cũ; caseId là thông tin bổ sung.
    return { ...rows[0], caseId };
  }).catch(error => {
    // Tung's code: Transaction đã rollback trước khi đổi lỗi unique thành 409.
    // Chỉ bắt index gửi trùng trong case; lỗi SQL khác vẫn được báo như trước.
    if (error.code === '23505' && error.constraint === 'uq_report_case_reporter') {
      throw new PostError(409, 'Bạn đã báo cáo nội dung này rồi, Admin đang xem xét.');
    }
    throw error;
  });
}

// Khoi's code: Đăng bài mới (Sprint 2). Bài luôn vào 'pending' chờ Admin duyệt, published_at để NULL
// (Admin duyệt mới gán). Lưu post + các dòng post_category trong MỘT transaction: lỗi giữa chừng thì không còn bài "mồ côi" thiếu tag.
async function createPost({ authorId, postType, title, content, thumbnailUrl, youtubeUrl, categoryIds }) {
  return transaction(async (client) => {
    const { rows: found } = await client.query(
      'SELECT category_id FROM category WHERE category_id = ANY($1::bigint[]) AND is_active',
      [categoryIds],
    );
    if (found.length !== categoryIds.length) throw new PostError(400, 'Có tag không tồn tại hoặc đã bị tắt, vui lòng chọn lại.');

    const { rows: [post] } = await client.query(
      `INSERT INTO post (account_id, post_type, title, content, thumbnail_url, youtube_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING post_id::text AS id, status, created_at AS "createdAt"`,
      [authorId, postType, title, content, thumbnailUrl, youtubeUrl],
    );
    await client.query(
      'INSERT INTO post_category (post_id, category_id) SELECT $1, unnest($2::bigint[])',
      [post.id, categoryIds],
    );
    return post;
  });
}

// Duy's Code: Member xem danh sách bài của chính mình; trạng thái deleted vẫn hiện để giữ lịch sử.
async function findMyPosts({ accountId, status = 'all', postType = 'all', page = 1, limit = 20, postId = null }) {
  const values = [accountId];
  const filters = ['p.account_id = $1'];
  if (status !== 'all') { values.push(status); filters.push(`p.status = $${values.length}`); }
  if (postType !== 'all') { values.push(postType); filters.push(`p.post_type = $${values.length}`); }
  // Duy's Code: ID chỉ là filter bổ sung; ownership vẫn luôn khóa theo account_id.
  if (postId) { values.push(postId); filters.push(`p.post_id = $${values.length}`); }
  const where = filters.join(' AND ');
  const countResult = await pool.query(`SELECT count(*)::int AS total FROM post p WHERE ${where}`, values);
  const totalItems = countResult.rows[0].total;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * limit;
  const { rows } = await pool.query(`
    SELECT p.post_id::text AS id, p.post_type AS "postType", p.title, p.content,
      p.thumbnail_url AS "thumbnailUrl", p.youtube_url AS "youtubeUrl", p.status,
      CASE WHEN p.status = 'deleted' THEN
        CASE WHEN latest_admin_log.action IN ('REJECT', 'REMOVE') THEN latest_admin_log.reason ELSE NULL END
        ELSE p.moderation_note END AS "moderationNote", p.created_at AS "createdAt",
      p.updated_at AS "updatedAt", p.published_at AS "publishedAt", p.deleted_at AS "deletedAt",
      p.vote_count AS "voteCount", p.comment_count AS "commentCount", p.view_count AS "viewCount",
      json_build_object('id', a.account_id::text, 'fullName', a.full_name, 'avatarUrl', a.avatar_url) AS author,
      EXISTS (SELECT 1 FROM post_vote v WHERE v.post_id = p.post_id AND v.account_id = $1::bigint) AS "isVoted",
      latest_admin_log.action AS "moderationAction",
      COALESCE((SELECT json_agg(json_build_object('id', c.category_id::text, 'name', c.name) ORDER BY c.name)
        FROM post_category pc JOIN category c ON c.category_id = pc.category_id WHERE pc.post_id = p.post_id), '[]'::json) AS categories
    FROM post p JOIN account a ON a.account_id = p.account_id
    LEFT JOIN LATERAL (
      SELECT al.action, al.reason
      FROM admin_log al
      WHERE al.target_type = 'post' AND al.target_id = p.post_id
        AND (p.deleted_at IS NULL OR al.created_at <= p.deleted_at)
      ORDER BY al.created_at DESC, al.admin_log_id DESC
      LIMIT 1
    ) latest_admin_log ON true
    WHERE ${where}
    ORDER BY p.created_at DESC, p.post_id DESC
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}
  `, [...values, limit, offset]);
  return { items: rows, page: currentPage, pageSize: limit, totalItems, totalPages };
}

// Duy's Code: Bảo đảm đọc bài sửa theo accountId; bài đang kiểm duyệt báo cáo không cho thay đổi.
async function findMyPost(accountId, postId) {
  const { rows } = await pool.query(`
    SELECT p.post_id::text AS id, p.post_type AS "postType", p.title, p.content,
      p.thumbnail_url AS "thumbnailUrl", p.youtube_url AS "youtubeUrl", p.status,
      p.moderation_note AS "moderationNote",
      COALESCE((SELECT json_agg(json_build_object('id', c.category_id::text, 'name', c.name) ORDER BY c.name)
        FROM post_category pc JOIN category c ON c.category_id = pc.category_id WHERE pc.post_id = p.post_id), '[]'::json) AS categories
    FROM post p WHERE p.account_id = $1 AND p.post_id = $2
  `, [accountId, postId]);
  if (!rows[0]) throw new PostError(404, 'Không tìm thấy bài viết của bạn.');
  if (rows[0].status !== 'pending') throw new PostError(409, 'Chỉ có thể sửa bài đang chờ duyệt.');
  return rows[0];
}

// Duy's Code: Cập nhật nội dung và tag trong một transaction; quyền sở hữu/trạng thái được khóa lại trước khi ghi.
async function updateMyPost({ accountId, postId, postType, title, content, thumbnailUrl, youtubeUrl, categoryIds }) {
  return transaction(async (client) => {
    const { rows: owned } = await client.query(
      'SELECT post_id FROM post WHERE post_id = $1 AND account_id = $2 AND status = \'pending\' FOR UPDATE',
      [postId, accountId],
    );
    if (!owned[0]) {
      const exists = await client.query('SELECT 1 FROM post WHERE post_id = $1 AND account_id = $2', [postId, accountId]);
      if (!exists.rows[0]) throw new PostError(404, 'Không tìm thấy bài viết của bạn.');
      throw new PostError(409, 'Chỉ có thể sửa bài đang chờ duyệt.');
    }
    const { rows: categories } = await client.query(
      'SELECT category_id FROM category WHERE category_id = ANY($1::bigint[]) AND is_active', [categoryIds],
    );
    if (categories.length !== categoryIds.length) throw new PostError(400, 'Có tag không tồn tại hoặc đã bị tắt, vui lòng chọn lại.');
    const { rows: [post] } = await client.query(`
      UPDATE post SET post_type = $1, title = $2, content = $3, thumbnail_url = $4, youtube_url = $5,
        moderation_note = NULL, updated_at = now()
      WHERE post_id = $6 RETURNING post_id::text AS id, status, updated_at AS "updatedAt"
    `, [postType, title, content, thumbnailUrl, youtubeUrl, postId]);
    await client.query('DELETE FROM post_category WHERE post_id = $1', [postId]);
    await client.query('INSERT INTO post_category (post_id, category_id) SELECT $1, unnest($2::bigint[])', [postId, categoryIds]);
    return post;
  });
}

// Duy's Code: Xóa mềm bài do chủ bài yêu cầu; không can thiệp bài đang có report hoặc đã được gỡ.
async function deleteMyPost(accountId, postId) {
  const { rows } = await pool.query(`
    UPDATE post SET status = 'deleted', deleted_at = now(), updated_at = now()
    WHERE post_id = $1 AND account_id = $2 AND status IN ('pending', 'public')
    RETURNING post_id::text AS id, status
  `, [postId, accountId]);
  if (rows[0]) return rows[0];
  const { rows: owned } = await pool.query('SELECT status FROM post WHERE post_id = $1 AND account_id = $2', [postId, accountId]);
  if (!owned[0]) throw new PostError(404, 'Không tìm thấy bài viết của bạn.');
  throw new PostError(409, 'Bài đang bị báo cáo hoặc đã được gỡ nên không thể xóa từ trang này.');
}

module.exports = {
  PostError, findPreview, findFeed, findComments, findBlockedKeyword, toggleVote, createComment, createReport,
  createPost, findMyPosts, findMyPost, updateMyPost, deleteMyPost,
};
