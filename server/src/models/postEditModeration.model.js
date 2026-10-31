const pool = require('../config/db');
const { ModerationError } = require('../utils/postModeration');

const failure = (status, code, message) => Object.assign(new ModerationError(status, message), { code });

async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* Preserve the original failure. */ }
    throw error;
  } finally {
    client.release();
  }
}

async function listPending({ page = 1, limit = 20 } = {}) {
  const total = await pool.query("SELECT count(*)::int AS total FROM public.post_edit_requests WHERE status = 'edited'");
  const totalItems = total.rows[0].total;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const currentPage = Math.min(page, totalPages);
  const { rows } = await pool.query(`
    SELECT er.post_edit_request_id::text AS id, er.post_id::text AS "postId",
      er.account_id::text AS "accountId", er.post_type AS "postType", er.title,
      er.submitted_at AS "submittedAt", a.full_name AS "authorName", a.email AS "authorEmail"
    FROM public.post_edit_requests er JOIN public.account a ON a.account_id = er.account_id
    WHERE er.status = 'edited'
    ORDER BY er.submitted_at, er.post_edit_request_id
    LIMIT $1 OFFSET $2
  `, [limit, (currentPage - 1) * limit]);
  return { items: rows, page: currentPage, pageSize: limit, totalItems, totalPages };
}

async function getPending(id) {
  const { rows } = await pool.query(`
    SELECT er.post_edit_request_id::text AS id, er.post_id::text AS "postId",
      er.account_id::text AS "accountId", er.post_type AS "postType", er.title,
      er.content, er.thumbnail_url AS "thumbnailUrl", er.youtube_url AS "youtubeUrl",
      er.category_ids AS "categoryIds", er.moderation_receipt AS "moderationReceipt",
      er.submitted_at AS "submittedAt", a.full_name AS "authorName", a.email AS "authorEmail"
    FROM public.post_edit_requests er JOIN public.account a ON a.account_id = er.account_id
    WHERE er.post_edit_request_id = $1 AND er.status = 'edited'
  `, [id]);
  if (!rows[0]) throw new ModerationError(404, 'Không tìm thấy bản sửa đang chờ duyệt.');
  const request = rows[0];
  const { rows: categories } = await pool.query(`
    SELECT c.category_id::text AS id, c.name FROM public.category c
    WHERE c.category_id = ANY($1::bigint[]) ORDER BY c.name
  `, [request.categoryIds]);
  request.categories = categories;
  delete request.categoryIds;
  return request;
}

async function decide(id, decision, admin) {
  const located = await pool.query(`
    SELECT post_id::text AS "postId" FROM public.post_edit_requests
    WHERE post_edit_request_id = $1 AND status = 'edited'
  `, [id]);
  if (!located.rows[0]) throw failure(409, 'EDIT_REQUEST_NOT_PENDING', 'Bản sửa đã được xử lý hoặc không còn chờ duyệt.');
  const postId = located.rows[0].postId;

  return transaction(async (client) => {
    const posts = await client.query(`
      SELECT p.post_id::text AS id, p.account_id::text AS "accountId", p.status,
        p.published_at AS "publishedAt", p.title
      FROM public.post p WHERE p.post_id = $1 FOR UPDATE
    `, [postId]);
    const post = posts.rows[0];
    if (!post) throw failure(409, 'EDIT_REQUEST_NOT_PENDING', 'Bài gốc không còn tồn tại; bản sửa không thể được áp dụng.');

    const requests = await client.query(`
      SELECT er.* FROM public.post_edit_requests er
      WHERE er.post_edit_request_id = $1 AND er.post_id = $2 AND er.status = 'edited' FOR UPDATE
    `, [id, postId]);
    const request = requests.rows[0];
    if (!request) throw failure(409, 'EDIT_REQUEST_NOT_PENDING', 'Bản sửa đã được xử lý hoặc không còn chờ duyệt.');
    // Assumption pending confirmation from Tùng: report resolution blocks both edit decisions.
    if (post.status === 'reported') {
      throw failure(409, 'POST_REPORTED', 'Bài gốc đang được xử lý báo cáo. Hãy giải quyết báo cáo trước khi quyết định bản sửa.');
    }
    if (post.status !== 'public') {
      throw failure(409, 'POST_NOT_EDITABLE', 'Bài gốc không còn ở trạng thái cho phép áp dụng bản sửa.');
    }

    const before = { postId, postStatus: post.status, editRequestId: String(request.post_edit_request_id) };
    if (decision.action === 'approve') {
      const updated = await client.query(`
        UPDATE public.post SET post_type = $1::post_type_enum, title = $2, content = $3,
          thumbnail_url = $4, youtube_url = $5, updated_at = now()
        WHERE post_id = $6 AND status = 'public'
        RETURNING post_id::text AS id, status, published_at AS "publishedAt"
      `, [request.post_type, request.title, request.content, request.thumbnail_url, request.youtube_url, postId]);
      if (!updated.rows[0]) throw failure(409, 'POST_NOT_EDITABLE', 'Trạng thái bài gốc đã thay đổi; không áp dụng bản sửa.');
      await client.query('DELETE FROM public.post_category WHERE post_id = $1', [postId]);
      await client.query(`
        INSERT INTO public.post_category (post_id, category_id)
        SELECT $1, unnest($2::bigint[])
      `, [postId, request.category_ids]);
    }

    const outcome = decision.action === 'approve' ? 'approved' : 'rejected';
    await client.query('DELETE FROM public.post_edit_requests WHERE post_edit_request_id = $1', [id]);

    if (decision.action === 'reject') {
      await client.query(`
        INSERT INTO public.notification (account_id, type, title, content, ref_type, ref_id)
        VALUES ($1, 'post_edit_rejected'::notification_type_enum,
          'Yêu cầu sửa bài không được duyệt', $2, 'post'::notification_ref_type_enum, $3)
      `, [request.account_id, decision.note, postId]);
    }

    if (decision.action === 'approve') {
      await client.query(`
        INSERT INTO public.notification (account_id, type, title, content, ref_type, ref_id)
        VALUES ($1, 'post_edit_approved'::notification_type_enum,
          'Bản sửa đã được duyệt', 'Bản sửa của bạn đã được duyệt và cập nhật lên bài viết',
          'post'::notification_ref_type_enum, $2)
      `, [request.account_id, postId]);
    }

    await client.query(`
      INSERT INTO public.admin_log
        (admin_id, action, target_type, target_id, before_value, after_value, reason, ip_address)
      VALUES ($1, $2, 'post', $3, $4::jsonb, $5::jsonb, $6, $7)
    `, [admin.id, decision.action === 'approve' ? 'EDIT_APPROVE' : 'EDIT_REJECT', postId,
      JSON.stringify(before), JSON.stringify({ postId, postStatus: post.status, editRequestId: String(id), outcome }),
      decision.note, admin.ip]);

    return { id: String(id), postId, outcome, postStatus: post.status };
  });
}

module.exports = { listPending, getPending, decide };
