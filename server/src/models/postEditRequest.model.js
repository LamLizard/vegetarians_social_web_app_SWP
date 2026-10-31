const { createHash } = require('node:crypto');
const pool = require('../config/db');
const { PostError } = require('./post.model');

const failure = (status, code, message) => Object.assign(new PostError(status, message), { code });

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

function requestResponse(postId, editRequestId, replayed) {
  // `post.status` is the operation result expected by the existing post service;
  // the persisted post itself stays public until an administrator approves the edit.
  return { post: { id: String(postId), status: 'pending' }, editRequest: { id: String(editRequestId), status: 'edited' }, replayed };
}

async function priorRequest(db, accountId, requestId, fingerprint) {
  if (!requestId) return null;
  const { rows } = await db.query(`
    SELECT request_fingerprint AS fingerprint,
      post_edit_request_id::text AS "editRequestId", post_id::text AS "postId"
    FROM public.post_edit_requests
    WHERE account_id = $1 AND request_id = $2::uuid AND status = 'edited'
  `, [accountId, requestId]);
  const prior = rows[0];
  if (!prior) return null;
  if (prior.fingerprint !== fingerprint) {
    throw failure(409, 'REQUEST_ID_REUSED', 'Mã gửi đã được dùng cho nội dung khác. Hãy chỉnh sửa nội dung rồi gửi lại.');
  }
  return requestResponse(prior.postId, prior.editRequestId, true);
}

async function precheckMyPostEdit({ accountId, postId, categoryIds, requestId, fingerprint }) {
  const replay = await priorRequest(pool, accountId, requestId, fingerprint);
  if (replay) return { replay };
  const { rows } = await pool.query(`
    SELECT p.post_id::text AS id, p.status, p.updated_at::text AS revision
    FROM public.post p WHERE p.post_id = $1 AND p.account_id = $2
  `, [postId, accountId]);
  const post = rows[0];
  if (!post) throw new PostError(404, 'Không tìm thấy bài viết của bạn.');
  if (post.status !== 'public') throw failure(409, 'POST_NOT_EDITABLE', 'Bài viết này hiện không thể sửa.');
  const pending = await pool.query("SELECT 1 FROM public.post_edit_requests WHERE post_id = $1 AND status = 'edited'", [postId]);
  if (pending.rows[0]) throw failure(409, 'PENDING_EDIT_EXISTS', 'Bài viết đã có một bản sửa đang chờ duyệt. Hãy chờ quản trị viên xử lý.');
  const categories = await pool.query(
    'SELECT category_id FROM public.category WHERE category_id = ANY($1::bigint[]) AND is_active', [categoryIds],
  );
  if (categories.rows.length !== categoryIds.length) {
    throw new PostError(400, 'Có chủ đề không còn hoạt động. Vui lòng tải lại danh sách và chọn lại.');
  }
  return { revision: post.revision };
}

async function submitMyPostEdit({ accountId, postId, postType, title, content, thumbnailUrl, youtubeUrl,
  categoryIds, requestId, fingerprint, moderation, revision }) {
  return transaction(async (client) => {
    // Serialize retries by actor/request key as well as edits by post row.
    const lockKey = createHash('sha256').update(`${accountId}:${requestId}`).digest().readBigInt64BE(0).toString();
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [lockKey]);
    const replay = await priorRequest(client, accountId, requestId, fingerprint);
    if (replay) return replay;

    const { rows: owned } = await client.query(`
      SELECT p.post_id::text AS id, p.status, p.updated_at::text AS revision
      FROM public.post p WHERE p.post_id = $1 AND p.account_id = $2 FOR UPDATE
    `, [postId, accountId]);
    const post = owned[0];
    if (!post) throw new PostError(404, 'Không tìm thấy bài viết của bạn.');
    if (post.status !== 'public' || String(post.revision) !== String(revision)) {
      throw failure(409, 'POST_NOT_EDITABLE', 'Bài viết đã thay đổi hoặc hiện không thể sửa. Hãy tải lại.');
    }
    const { rows: categories } = await client.query(`
      SELECT category_id FROM public.category
      WHERE category_id = ANY($1::bigint[]) AND is_active FOR SHARE
    `, [categoryIds]);
    if (categories.length !== categoryIds.length) {
      throw new PostError(400, 'Có chủ đề không còn hoạt động. Vui lòng tải lại danh sách và chọn lại.');
    }
    const pending = await client.query("SELECT 1 FROM public.post_edit_requests WHERE post_id = $1 AND status = 'edited'", [postId]);
    if (pending.rows[0]) throw failure(409, 'PENDING_EDIT_EXISTS', 'Bài viết đã có một bản sửa đang chờ duyệt. Hãy chờ quản trị viên xử lý.');

    if (moderation?.decision === 'reject') {
      throw Object.assign(new PostError(422, moderation.reason || 'Nội dung chưa phù hợp. Vui lòng chỉnh sửa rồi gửi lại.'), { code: 'POST_EDIT_REJECTED' });
    }
    const inserted = await client.query(`
      INSERT INTO public.post_edit_requests
        (post_id, account_id, request_id, request_fingerprint, base_updated_at, status,
         post_type, title, content, thumbnail_url, youtube_url, category_ids, moderation_receipt)
      VALUES ($1, $2, $3::uuid, $4, $5, 'edited', $6::post_type_enum, $7, $8, $9, $10, $11::bigint[], $12::jsonb)
      ON CONFLICT DO NOTHING
      RETURNING post_edit_request_id::text AS id
    `, [postId, accountId, requestId, fingerprint, revision, postType, title, content,
      thumbnailUrl, youtubeUrl, categoryIds, JSON.stringify(moderation.receipt)]);
    if (!inserted.rows[0]) {
      throw failure(409, 'PENDING_EDIT_EXISTS', 'Bài viết đã có một bản sửa đang chờ duyệt. Hãy chờ quản trị viên xử lý.');
    }
    const requestRowId = inserted.rows[0].id;
    return requestResponse(postId, requestRowId, false);
  });
}

module.exports = { precheckMyPostEdit, submitMyPostEdit };
