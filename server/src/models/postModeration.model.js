const { ModerationError, getPostDecision, canRestorePost } = require('../utils/postModeration');

const POST_FIELDS = `
  p.post_id AS id, p.account_id AS "accountId", p.post_type AS "postType",
  p.title, p.content, p.thumbnail_url AS "thumbnailUrl", p.youtube_url AS "youtubeUrl",
  p.status, p.moderation_note AS "moderationNote", p.moderated_by AS "moderatedBy",
  p.moderated_at AS "moderatedAt", p.published_at AS "publishedAt",
  p.deleted_at AS "deletedAt", p.created_at AS "createdAt", p.updated_at AS "updatedAt",
  p.view_count AS "viewCount", p.vote_count AS "voteCount", p.comment_count AS "commentCount"
`;
const REPORT_FIELDS = `
  r.report_id AS id, r.reporter_id AS "reporterId", r.target_type AS "targetType",
  r.target_id AS "targetId", r.reason_code AS "reasonCode", r.reason_text AS "reasonText",
  r.status, r.handled_by AS "handledBy", r.handled_at AS "handledAt",
  r.resolution_note AS "resolutionNote", r.created_at AS "createdAt"
`;

function createPostModerationModel(database) {
  const pool = database || require('../config/db');

  async function transaction(work) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      // Giữ lỗi gốc nếu kết nối đã hỏng và ROLLBACK cũng thất bại.
      try { await client.query('ROLLBACK'); } catch { /* pg release bên dưới */ }
      throw error;
    } finally {
      client.release();
    }
  }

  async function audit(client, admin, action, entity, id, before, after, note) {
    await client.query(`
      INSERT INTO admin_log
        (admin_id, action, target_type, target_id, before_value, after_value, reason, ip_address)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
    `, [admin.id, action, entity, id, JSON.stringify(before), JSON.stringify(after), note, admin.ip]);
  }

  async function notify(client, accountId, type, title, content, refType, refId) {
    await client.query(`
      INSERT INTO notification (account_id, type, title, content, ref_type, ref_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [accountId, type, title, content, refType, refId]);
  }

  async function lockPost(client, id, allowMissing = false) {
    const { rows } = await client.query(`SELECT ${POST_FIELDS} FROM post p WHERE p.post_id = $1 FOR UPDATE`, [id]);
    if (!rows[0] && !allowMissing) throw new ModerationError(404, 'Không tìm thấy bài viết.');
    return rows[0] || null;
  }

  async function updatePost(client, id, status, note, admin) {
    const { rows } = await client.query(`
      UPDATE post p SET status = $1::post_status_enum, moderation_note = $2,
        moderated_by = $3, moderated_at = now(),
        published_at = CASE WHEN $1::text = 'public' THEN COALESCE(p.published_at, now()) ELSE p.published_at END,
        deleted_at = CASE WHEN $1::text = 'deleted' THEN now() ELSE p.deleted_at END
      WHERE p.post_id = $4 RETURNING ${POST_FIELDS}
    `, [status, note, admin.id, id]);
    return rows[0];
  }

  async function decidePost(id, decision, admin) {
    return transaction(async (client) => {
      const before = await lockPost(client, id);
      const rule = getPostDecision(before.status, decision.action);
      const after = await updatePost(client, id, rule.status, decision.note, admin);
      await audit(client, admin, rule.logAction, 'post', id, before, after, decision.note);
      await notify(client, before.accountId, rule.notificationType,
        decision.action === 'approve' ? 'Bài viết đã được duyệt' : 'Bài viết bị từ chối',
        decision.note || `Bài “${before.title}” đã được công khai.`, 'post', id);
      return after;
    });
  }

  async function decideReport(id, decision, admin) {
    return transaction(async (client) => {
      // target_id bất biến trong module. Khóa Post trước Report để hai Admin
      // xử lý nhiều report của cùng bài không deadlock hoặc khôi phục sai bài.
      const target = await client.query(`
        SELECT target_id AS "targetId" FROM report WHERE report_id = $1 AND target_type = 'post'
      `, [id]);
      if (!target.rows[0]) throw new ModerationError(404, 'Không tìm thấy báo cáo bài viết.');
      const beforePost = await lockPost(client, target.rows[0].targetId, true);
      if (!beforePost && decision.action === 'accept') {
        throw new ModerationError(404, 'Bài viết không còn tồn tại. Chỉ có thể từ chối gỡ bài theo báo cáo này.');
      }
      const locked = await client.query(`
        SELECT ${REPORT_FIELDS} FROM report r
        WHERE r.report_id = $1 AND r.target_type = 'post' FOR UPDATE
      `, [id]);
      const before = locked.rows[0];
      if (!before || before.targetId !== target.rows[0].targetId) {
        throw new ModerationError(409, 'Đối tượng báo cáo đã thay đổi. Hãy tải lại dữ liệu.');
      }
      if (before.status !== 'pending') {
        throw new ModerationError(409, 'Báo cáo đã được xử lý. Hãy tải lại dữ liệu.');
      }
      if (decision.action === 'accept' && !['public', 'reported', 'deleted'].includes(beforePost.status)) {
        throw new ModerationError(409, 'Bài viết chưa xuất bản. Không thể gỡ bài theo báo cáo này.');
      }
      const status = decision.action === 'accept' ? 'accepted' : 'rejected';
      const updated = await client.query(`
        UPDATE report r SET status = $1::report_status_enum, resolution_note = $2,
          handled_by = $3, handled_at = now()
        WHERE r.report_id = $4 RETURNING ${REPORT_FIELDS}
      `, [status, decision.note, admin.id, id]);
      const after = updated.rows[0];
      let afterPost = beforePost;
      if (decision.action === 'accept' && beforePost.status !== 'deleted') {
        afterPost = await updatePost(client, beforePost.id, 'deleted', decision.note, admin);
        await audit(client, admin, 'REMOVE', 'post', beforePost.id, beforePost, afterPost, decision.note);
        await notify(client, beforePost.accountId, 'post_removed', 'Bài viết đã bị gỡ', decision.note, 'post', beforePost.id);
      } else if (decision.action === 'reject' && beforePost?.status === 'reported' && beforePost.publishedAt) {
        const blockers = await client.query(`
          SELECT EXISTS (
            SELECT 1 FROM report WHERE target_type = 'post' AND target_id = $1
              AND status IN ('pending', 'accepted')
          ) AS "hasBlockingReport", EXISTS (
            SELECT 1 FROM admin_log WHERE target_type = 'post' AND target_id = $1
              AND action IN ('REJECT', 'REMOVE', 'DELETE', 'HIDE')
          ) AS "hasBlockingDecision"
        `, [beforePost.id]);
        const { hasBlockingReport, hasBlockingDecision } = blockers.rows[0];
        if (canRestorePost(beforePost, hasBlockingReport, hasBlockingDecision)) {
          afterPost = await updatePost(client, beforePost.id, 'public', decision.note, admin);
          await audit(client, admin, 'RESTORE', 'post', beforePost.id, beforePost, afterPost, decision.note);
          // reported vẫn công khai: đổi về public chỉ kết thúc trạng thái có báo cáo.
          await notify(client, beforePost.accountId, 'report_result', 'Đã kết thúc xem xét báo cáo bài viết',
            'Không gỡ bài theo các báo cáo đã xử lý. Bài tiếp tục công khai và đã chuyển về trạng thái Công khai.', 'post', beforePost.id);
        }
      }
      await audit(client, admin, decision.action === 'accept' ? 'ACCEPT' : 'REJECT', 'report', id, before, after, decision.note);
      await notify(client, before.reporterId, 'report_result', 'Kết quả xử lý báo cáo',
        `${status === 'accepted' ? 'Đã chấp nhận gỡ bài' : 'Đã từ chối gỡ bài'} theo báo cáo của bạn: ${decision.note}`, 'report', id);
      return { ...after, postStatus: afterPost?.status || null };
    });
  }

  function filters(query, entity) {
    const values = [];
    const clauses = entity === 'report' ? ["r.target_type = 'post'"] : [];
    const alias = entity === 'report' ? 'r' : 'p';
    const param = (value) => { values.push(value); return `$${values.length}`; };
    if (query.status !== 'all') clauses.push(`${alias}.status = ${param(query.status)}`);
    if (query.postType !== 'all') clauses.push(`p.post_type = ${param(query.postType)}`);
    if (query.search) {
      const pattern = `%${query.search.replace(/[\\%_]/g, '\\$&')}%`;
      const placeholder = param(pattern);
      clauses.push(`(p.title ILIKE ${placeholder} OR a.full_name ILIKE ${placeholder} OR a.email ILIKE ${placeholder})`);
    }
    if (query.stale) clauses.push(`${alias}.status = 'pending' AND ${alias}.created_at < now() - interval '48 hours'`);
    return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', values };
  }

  async function list(query, entity) {
    const { where, values } = filters(query, entity);
    const from = entity === 'post'
      ? 'FROM post p JOIN account a ON a.account_id = p.account_id'
      : 'FROM report r LEFT JOIN post p ON p.post_id = r.target_id JOIN account a ON a.account_id = r.reporter_id';
    const counted = await pool.query(`SELECT count(*) AS total ${from} ${where}`, values);
    const totalItems = Number(counted.rows[0].total);
    const totalPages = Math.max(1, Math.ceil(totalItems / query.limit));
    const page = Math.min(query.page, totalPages);
    const fields = entity === 'post'
      ? `${POST_FIELDS}, a.full_name AS "authorName", a.email AS "authorEmail", a.avatar_url AS "authorAvatarUrl"`
      : `${REPORT_FIELDS}, p.title AS "postTitle", p.status AS "postStatus", p.post_type AS "postType",
          a.full_name AS "reporterName", a.email AS "reporterEmail"`;
    const alias = entity === 'post' ? 'p' : 'r';
    const key = entity === 'post' ? 'post_id' : 'report_id';
    const { rows } = await pool.query(`
      SELECT ${fields} ${from} ${where}
      ORDER BY ${alias}.created_at ASC, ${alias}.${key} ASC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `, [...values, query.limit, (page - 1) * query.limit]);
    return { items: rows, page, pageSize: query.limit, totalItems, totalPages };
  }

  async function history(entity, id) {
    const { rows } = await pool.query(`
      SELECT l.admin_log_id AS id, l.action, l.reason, l.created_at AS "createdAt",
        a.full_name AS "adminName", a.email AS "adminEmail",
        l.before_value AS "beforeValue", l.after_value AS "afterValue"
      FROM admin_log l JOIN account a ON a.account_id = l.admin_id
      WHERE l.target_type = $1 AND l.target_id = $2
      ORDER BY l.created_at DESC, l.admin_log_id DESC LIMIT 20
    `, [entity, id]);
    return rows;
  }

  async function getPost(id) {
    const { rows } = await pool.query(`
      SELECT ${POST_FIELDS}, a.full_name AS "authorName", a.email AS "authorEmail",
        a.avatar_url AS "authorAvatarUrl", m.full_name AS "moderatorName", m.email AS "moderatorEmail"
      FROM post p JOIN account a ON a.account_id = p.account_id
      LEFT JOIN account m ON m.account_id = p.moderated_by WHERE p.post_id = $1
    `, [id]);
    if (!rows[0]) throw new ModerationError(404, 'Không tìm thấy bài viết.');
    const [categories, reports, events] = await Promise.all([
      pool.query(`SELECT c.category_id AS id, c.name FROM post_category pc
        JOIN category c ON c.category_id = pc.category_id WHERE pc.post_id = $1 ORDER BY c.name`, [id]),
      pool.query(`SELECT status, count(*)::int AS count FROM report
        WHERE target_type = 'post' AND target_id = $1 GROUP BY status`, [id]),
      history('post', id),
    ]);
    return { ...rows[0], categories: categories.rows, reportCounts: reports.rows, history: events };
  }

  async function getReport(id) {
    const { rows } = await pool.query(`
      SELECT ${REPORT_FIELDS}, a.full_name AS "reporterName", a.email AS "reporterEmail",
        h.full_name AS "handlerName", h.email AS "handlerEmail"
      FROM report r JOIN account a ON a.account_id = r.reporter_id
      LEFT JOIN account h ON h.account_id = r.handled_by
      WHERE r.report_id = $1 AND r.target_type = 'post'
    `, [id]);
    if (!rows[0]) throw new ModerationError(404, 'Không tìm thấy báo cáo bài viết.');
    const postDetail = getPost(rows[0].targetId).catch(error => {
      // Report có target đa hình, không có FK: vẫn xem và từ chối gỡ bài được khi target thiếu.
      if (error instanceof ModerationError && error.status === 404) return null;
      throw error;
    });
    const [post, events] = await Promise.all([postDetail, history('report', id)]);
    return { report: { ...rows[0], history: events }, post };
  }

  return { listPosts: (query) => list(query, 'post'), listReports: (query) => list(query, 'report'), getPost, getReport, decidePost, decideReport };
}

module.exports = { createPostModerationModel };
