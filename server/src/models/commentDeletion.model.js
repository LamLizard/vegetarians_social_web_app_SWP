const pool = require('../config/db');

class CommentDeletionError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function removeComment(commentId, actor) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const located = await db.query('SELECT post_id::text AS "postId" FROM public.comment WHERE comment_id = $1', [commentId]);
    if (!located.rows[0]) throw new CommentDeletionError(404, 'COMMENT_NOT_FOUND', 'Không tìm thấy bình luận.');
    const post = await db.query('SELECT comment_count AS count FROM public.post WHERE post_id = $1 FOR UPDATE',
      [located.rows[0].postId]);
    if (!post.rows[0]) throw new CommentDeletionError(404, 'COMMENT_NOT_FOUND', 'Không tìm thấy bình luận.');
    const comments = await db.query(`
      SELECT comment_id::text AS id, post_id::text AS "postId", author_id::text AS "authorId", status::text AS status
      FROM public.comment WHERE comment_id = $1 FOR UPDATE
    `, [commentId]);
    const comment = comments.rows[0];
    if (!comment || comment.postId !== located.rows[0].postId) {
      throw new CommentDeletionError(404, 'COMMENT_NOT_FOUND', 'Không tìm thấy bình luận.');
    }
    if (actor.role !== 'admin' && String(actor.id) !== comment.authorId) {
      throw new CommentDeletionError(403, 'FORBIDDEN', 'Bạn không có quyền xóa bình luận này.');
    }
    if (comment.status === 'deleted') {
      await db.query('COMMIT');
      return { deleted: true, publicCommentCount: Number(post.rows[0].count) };
    }
    if (!['public', 'hidden'].includes(comment.status)) {
      throw new CommentDeletionError(409, 'COMMENT_CHANGED', 'Trạng thái bình luận đã thay đổi.');
    }
    const cases = await db.query(`
      SELECT case_id::text AS id FROM public.report_case
      WHERE target_type = 'comment' AND target_id = $1 AND status = 'pending'
      ORDER BY case_id FOR UPDATE
    `, [commentId]);
    for (const reportCase of cases.rows) {
      const reports = await db.query(`
        SELECT report_id FROM public.report WHERE case_id = $1 ORDER BY report_id FOR UPDATE
      `, [reportCase.id]);
      if (!reports.rows.length) throw new CommentDeletionError(409, 'REPORT_CHANGED', 'Nhóm báo cáo không hợp lệ.');
      const updated = await db.query(`
        UPDATE public.report SET status = 'auto_closed_deleted'::report_status_enum,
          handled_by = NULL, handled_at = now(), resolution_note = 'Báo cáo tự đóng do bình luận đã bị xóa'
        WHERE case_id = $1 AND status = 'pending'
      `, [reportCase.id]);
      if (updated.rowCount !== reports.rows.length) {
        throw new CommentDeletionError(409, 'REPORT_CHANGED', 'Nhóm báo cáo đã thay đổi.');
      }
      const closed = await db.query(`
        UPDATE public.report_case SET status = 'auto_closed_deleted'::report_status_enum,
          handled_by = NULL, handled_at = now(), resolution_note = 'Báo cáo tự đóng do bình luận đã bị xóa'
        WHERE case_id = $1 AND status = 'pending'
      `, [reportCase.id]);
      if (closed.rowCount !== 1) throw new CommentDeletionError(409, 'REPORT_CHANGED', 'Nhóm báo cáo đã thay đổi.');
    }
    await db.query("UPDATE public.comment SET status = 'deleted', updated_at = now() WHERE comment_id = $1", [commentId]);
    await db.query(`
      INSERT INTO public.comment_delete_audit (comment_id, actor_id, actor_role)
      VALUES ($1, $2, $3)
    `, [commentId, actor.id, actor.role]);
    let count = Number(post.rows[0].count);
    if (comment.status === 'public') {
      const changed = await db.query(`
        UPDATE public.post SET comment_count = GREATEST(comment_count - 1, 0)
        WHERE post_id = $1 RETURNING comment_count
      `, [comment.postId]);
      count = Number(changed.rows[0].comment_count);
    }
    await db.query('COMMIT');
    return { deleted: true, publicCommentCount: count };
  } catch (error) {
    try { await db.query('ROLLBACK'); } catch { /* Preserve the original failure. */ }
    throw error;
  } finally {
    db.release();
  }
}

module.exports = { CommentDeletionError, removeComment };
