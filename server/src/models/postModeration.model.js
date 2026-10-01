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

// Tung's code: Case là đơn vị Admin ra quyết định; report vẫn giữ người gửi
// và lý do riêng để ghi lịch sử/thông báo cho từng người.
const CASE_FIELDS = `
  rc.case_id::text AS id, rc.target_type AS "targetType", rc.target_id::text AS "targetId",
  rc.status, rc.created_at AS "createdAt", rc.handled_by::text AS "handledBy",
  rc.handled_at AS "handledAt", rc.resolution_note AS "resolutionNote"
`;
const COMMENT_FIELDS = `
  c.comment_id::text AS id, c.post_id::text AS "postId", c.author_id::text AS "authorId",
  c.content, c.status, c.created_at AS "createdAt", c.updated_at AS "updatedAt"
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

  // Tung's code: Khóa theo thứ tự bài cha -> comment (nếu có) -> case -> report.
  // Luồng gửi report dùng cùng thứ tự, nên report đến đồng thời phải đợi quyết
  // định hoàn tất; case vừa đóng không thể nhận thêm report đang pending.
  async function decideCase(id, decision, admin) {
    return transaction(async (client) => {
      const located = await client.query(`SELECT ${CASE_FIELDS} FROM report_case rc WHERE rc.case_id = $1`, [id]);
      const locatedCase = located.rows[0];
      if (!locatedCase) throw new ModerationError(404, 'Không tìm thấy nhóm báo cáo.');
      const isComment = locatedCase.targetType === 'comment';
      if (!isComment && locatedCase.targetType !== 'post') {
        throw new ModerationError(400, 'Loại đối tượng báo cáo không hợp lệ.');
      }

      let beforePost = null;
      let beforeComment = null;
      if (isComment) {
        const parent = await client.query('SELECT post_id::text AS "postId" FROM comment WHERE comment_id = $1', [locatedCase.targetId]);
        if (parent.rows[0]) {
          beforePost = await lockPost(client, parent.rows[0].postId, true);
          const lockedComment = await client.query(`SELECT ${COMMENT_FIELDS} FROM comment c WHERE c.comment_id = $1 FOR UPDATE`, [locatedCase.targetId]);
          beforeComment = lockedComment.rows[0] || null;
          if (beforeComment && beforeComment.postId !== parent.rows[0].postId) {
            throw new ModerationError(409, 'Bình luận đã thay đổi. Hãy tải lại dữ liệu.');
          }
        }
      } else {
        beforePost = await lockPost(client, locatedCase.targetId, true);
      }

      // Tung's code: Kiểm tra lại sau khi lấy khóa. Hai Admin cùng bấm thì
      // người tới sau thấy case đã đóng và nhận 409, không chạy tác động lần hai.
      const lockedCase = await client.query(`SELECT ${CASE_FIELDS} FROM report_case rc WHERE rc.case_id = $1 FOR UPDATE`, [id]);
      const beforeCase = lockedCase.rows[0];
      if (!beforeCase || beforeCase.status !== 'pending'
        || beforeCase.targetType !== locatedCase.targetType || beforeCase.targetId !== locatedCase.targetId) {
        throw new ModerationError(409, 'Nhóm báo cáo đã được xử lý hoặc thay đổi. Hãy tải lại dữ liệu.');
      }
      const target = isComment ? beforeComment : beforePost;
      if (decision.action === 'accept') {
        if (!target) throw new ModerationError(404, 'Nội dung không còn tồn tại. Có thể từ chối để đóng nhóm báo cáo.');
        const allowed = isComment ? ['public', 'hidden', 'deleted'] : ['public', 'reported', 'deleted'];
        if (!allowed.includes(target.status)) throw new ModerationError(409, 'Trạng thái nội dung không cho phép gỡ. Hãy tải lại dữ liệu.');
      }
      const reports = await client.query(`
        SELECT ${REPORT_FIELDS} FROM report r WHERE r.case_id = $1 ORDER BY r.report_id FOR UPDATE
      `, [id]);
      // Tung's code: Không âm thầm đóng một case có dữ liệu lệch trạng thái.
      // Migration phải gắn report vào đúng case trước khi sử dụng module này.
      if (!reports.rows.length || reports.rows.some(report => report.status !== 'pending'
        || report.targetType !== beforeCase.targetType || String(report.targetId) !== beforeCase.targetId)) {
        throw new ModerationError(409, 'Dữ liệu báo cáo không đồng nhất với nhóm. Cần kiểm tra lại dữ liệu.');
      }

      const status = decision.action === 'accept' ? 'accepted' : 'rejected';
      // Tung's code: Lấy một timestamp từ DB cho cả case và mọi report.
      // Trả text để không mất phần microsecond khi đi qua JavaScript Date.
      const stamp = await client.query('SELECT now()::text AS "handledAt"');
      const values = [status, admin.id, stamp.rows[0].handledAt, decision.note, id];
      const updatedCase = await client.query(`
        UPDATE report_case rc SET status = $1::report_status_enum, handled_by = $2,
          handled_at = $3, resolution_note = $4
        WHERE rc.case_id = $5 AND rc.status = 'pending' RETURNING ${CASE_FIELDS}
      `, values);
      const updatedReports = await client.query(`
        UPDATE report r SET status = $1::report_status_enum, handled_by = $2,
          handled_at = $3, resolution_note = $4
        WHERE r.case_id = $5 RETURNING ${REPORT_FIELDS}
      `, values);
      let afterPost = beforePost;
      let afterComment = beforeComment;

      if (decision.action === 'accept' && isComment && beforeComment.status !== 'deleted') {
        const removed = await client.query(`
          UPDATE comment c SET status = 'deleted', updated_at = now()
          WHERE c.comment_id = $1 AND c.status IN ('public', 'hidden') RETURNING ${COMMENT_FIELDS}
        `, [beforeComment.id]);
        afterComment = removed.rows[0];
        // Tung's code: Chỉ comment public được tính vào counter trước khi xóa.
        // Dùng trạng thái đã khóa TRƯỚC UPDATE; hidden/deleted không trừ lại.
        if (beforeComment.status === 'public') {
          await client.query('UPDATE post SET comment_count = GREATEST(comment_count - 1, 0) WHERE post_id = $1', [beforeComment.postId]);
        }
        await audit(client, admin, 'REMOVE', 'comment', beforeComment.id, beforeComment, afterComment, decision.note);
        await notify(client, beforeComment.authorId, 'comment_removed', 'Bình luận đã bị xóa', decision.note, 'comment', beforeComment.id);
      } else if (decision.action === 'accept' && !isComment && beforePost.status !== 'deleted') {
        afterPost = await updatePost(client, beforePost.id, 'deleted', decision.note, admin);
        await audit(client, admin, 'REMOVE', 'post', beforePost.id, beforePost, afterPost, decision.note);
        await notify(client, beforePost.accountId, 'post_removed', 'Bài viết đã bị gỡ', decision.note, 'post', beforePost.id);
      } else if (decision.action === 'reject' && !isComment && beforePost?.status === 'reported' && beforePost.publishedAt) {
        // Tung's code: Giữ điều kiện khôi phục của luồng cũ sau khi toàn bộ
        // report trong case đã rejected. Không tự phục hồi bài đã bị Admin gỡ.
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
          await notify(client, beforePost.accountId, 'report_result', 'Đã kết thúc xem xét báo cáo bài viết',
            'Bài tiếp tục công khai và đã kết thúc trạng thái có báo cáo.', 'post', beforePost.id);
        }
      }

      // Tung's code: Enum log/ref chưa có report_case, nên vẫn ghi theo report_id.
      // Mỗi reporter nhận một kết quả; lỗi log/notification rollback cả quyết định.
      const previousReports = new Map(reports.rows.map(report => [String(report.id), report]));
      const actionLabel = isComment ? 'xóa bình luận' : 'gỡ bài';
      for (const after of updatedReports.rows) {
        await audit(client, admin, decision.action === 'accept' ? 'ACCEPT' : 'REJECT', 'report', after.id,
          previousReports.get(String(after.id)), after, decision.note);
        await notify(client, after.reporterId, 'report_result', 'Kết quả xử lý báo cáo',
          `${status === 'accepted' ? 'Đã chấp nhận' : 'Đã từ chối'} ${actionLabel} theo báo cáo của bạn: ${decision.note}`, 'report', after.id);
      }
      return { ...updatedCase.rows[0], postStatus: afterPost?.status || null, commentStatus: afterComment?.status || null };
    });
  }

  // Tung's code: Nhánh danh sách này chỉ còn phục vụ tab duyệt bài; report đã
  // chuyển sang listCases bên dưới, không đếm/hiển thị report riêng lẻ nữa.
  function filters(query) {
    const values = [];
    const clauses = [];
    const param = (value) => { values.push(value); return `$${values.length}`; };
    if (query.status !== 'all') clauses.push(`p.status = ${param(query.status)}`);
    if (query.postType !== 'all') clauses.push(`p.post_type = ${param(query.postType)}`);
    if (query.search) {
      const pattern = `%${query.search.replace(/[\\%_]/g, '\\$&')}%`;
      const placeholder = param(pattern);
      clauses.push(`(p.title ILIKE ${placeholder} OR a.full_name ILIKE ${placeholder} OR a.email ILIKE ${placeholder})`);
    }
    if (query.stale) clauses.push("p.status = 'pending' AND p.created_at < now() - interval '48 hours'");
    return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', values };
  }

  async function listPosts(query) {
    const { where, values } = filters(query);
    const from = 'FROM post p JOIN account a ON a.account_id = p.account_id';
    const counted = await pool.query(`SELECT count(*) AS total ${from} ${where}`, values);
    const totalItems = Number(counted.rows[0].total);
    const totalPages = Math.max(1, Math.ceil(totalItems / query.limit));
    const page = Math.min(query.page, totalPages);
    const fields = `${POST_FIELDS}, a.full_name AS "authorName", a.email AS "authorEmail", a.avatar_url AS "authorAvatarUrl"`;
    const { rows } = await pool.query(`
      SELECT ${fields} ${from} ${where}
      ORDER BY p.created_at ASC, p.post_id ASC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `, [...values, query.limit, (page - 1) * query.limit]);
    return { items: rows, page, pageSize: query.limit, totalItems, totalPages };
  }

  // Tung's code: Cho phép chi tiết case dùng cùng connection/snapshot với bài
  // và lịch sử, tránh đọc case trước nhưng report sau một quyết định đồng thời.
  async function history(entity, id, database = pool) {
    const { rows } = await database.query(`
      SELECT l.admin_log_id AS id, l.action, l.reason, l.created_at AS "createdAt",
        a.full_name AS "adminName", a.email AS "adminEmail",
        l.before_value AS "beforeValue", l.after_value AS "afterValue"
      FROM admin_log l JOIN account a ON a.account_id = l.admin_id
      WHERE l.target_type = $1 AND l.target_id = $2
      ORDER BY l.created_at DESC, l.admin_log_id DESC LIMIT 20
    `, [entity, id]);
    return rows;
  }

  async function getPost(id, database = pool) {
    const { rows } = await database.query(`
      SELECT ${POST_FIELDS}, a.full_name AS "authorName", a.email AS "authorEmail",
        a.avatar_url AS "authorAvatarUrl", m.full_name AS "moderatorName", m.email AS "moderatorEmail"
      FROM post p JOIN account a ON a.account_id = p.account_id
      LEFT JOIN account m ON m.account_id = p.moderated_by WHERE p.post_id = $1
    `, [id]);
    if (!rows[0]) throw new ModerationError(404, 'Không tìm thấy bài viết.');
    const [categories, reports, events] = await Promise.all([
      database.query(`SELECT c.category_id AS id, c.name FROM post_category pc
        JOIN category c ON c.category_id = pc.category_id WHERE pc.post_id = $1 ORDER BY c.name`, [id]),
      database.query(`SELECT status, count(*)::int AS count FROM report
        WHERE target_type = 'post' AND target_id = $1 GROUP BY status`, [id]),
      history('post', id, database),
    ]);
    return { ...rows[0], categories: categories.rows, reportCounts: reports.rows, history: events };
  }

  // Tung's code: Một dòng/case. Cùng FROM/WHERE cho count và dữ liệu để bộ lọc,
  // số mục và phân trang không bị lệch. Lấy report mới nhất theo thời gian thật,
  // report_id chỉ phá hòa; tuổi chờ luôn tính từ rc.created_at.
  async function listCases(query) {
    const from = `
      FROM report_case rc
      JOIN LATERAL (
        SELECT r.created_at, r.report_id FROM report r WHERE r.case_id = rc.case_id
        ORDER BY r.created_at DESC, r.report_id DESC LIMIT 1
      ) latest ON true
      JOIN LATERAL (
        SELECT count(*)::int AS report_count FROM report r WHERE r.case_id = rc.case_id
      ) counts ON true
      LEFT JOIN post p ON rc.target_type = 'post' AND p.post_id = rc.target_id
      LEFT JOIN account post_author ON post_author.account_id = p.account_id
      LEFT JOIN comment cm ON rc.target_type = 'comment' AND cm.comment_id = rc.target_id
      LEFT JOIN account comment_author ON comment_author.account_id = cm.author_id
      LEFT JOIN post parent ON parent.post_id = cm.post_id
    `;
    const where = `
      WHERE rc.target_type = $1::report_target_type_enum
        AND ($2::text = 'all' OR rc.status::text = $2)
        AND ($3::boolean = false OR (rc.status = 'pending' AND rc.created_at < now() - interval '48 hours'))
        AND ($4::text = 'all' OR rc.target_type = 'comment' OR p.post_type::text = $4)
        AND ($5::text = '' OR p.title ILIKE $5 OR cm.content ILIKE $5 OR parent.title ILIKE $5
          OR EXISTS (
            SELECT 1 FROM report rr JOIN account reporter ON reporter.account_id = rr.reporter_id
            WHERE rr.case_id = rc.case_id AND (reporter.full_name ILIKE $5 OR reporter.email ILIKE $5)
          ))
    `;
    const pattern = query.search ? `%${query.search.replace(/[\\%_]/g, '\\$&')}%` : '';
    const values = [query.targetType, query.status, query.stale,
      query.targetType === 'comment' ? 'all' : query.postType, pattern];
    // Tung's code: Một snapshot đọc cho count và trang, tránh report mới đến
    // giữa hai SELECT làm tổng số/trang không khớp với các dòng được trả về.
    return transaction(async (client) => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
      const counted = await client.query(`SELECT count(*) AS total ${from} ${where}`, values);
      const totalItems = Number(counted.rows[0].total);
      const totalPages = Math.max(1, Math.ceil(totalItems / query.limit));
      const page = Math.min(query.page, totalPages);
      const { rows } = await client.query(`
        SELECT ${CASE_FIELDS}, latest.created_at AS "latestReportAt", counts.report_count AS "reportCount",
          CASE WHEN rc.target_type = 'post' THEN COALESCE(p.title, 'Bài viết không còn tồn tại')
            ELSE COALESCE(LEFT(cm.content, 160), 'Bình luận không còn tồn tại') END AS "targetLabel",
          parent.title AS "postTitle",
          COALESCE(post_author.full_name, post_author.email, comment_author.full_name, comment_author.email) AS "authorName"
        ${from} ${where}
        ORDER BY latest.created_at DESC, latest.report_id DESC, rc.case_id DESC
        LIMIT $6 OFFSET $7
      `, [...values, query.limit, (page - 1) * query.limit]);
      return { items: rows, page, pageSize: query.limit, totalItems, totalPages };
    });
  }

  // Tung's code: Detail trả đủ case + tất cả reporter/lý do + nội dung bị báo cáo.
  // LEFT JOIN và xử lý 404 riêng cho target giúp vẫn đóng được case khi nội dung
  // đã mất. Chỉ coi 404 là thiếu target, không che lỗi truy vấn/kết nối thật.
  async function getCase(id) {
    return transaction(async (client) => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
      const cases = await client.query(`
        SELECT ${CASE_FIELDS}, h.full_name AS "handlerName", h.email AS "handlerEmail"
        FROM report_case rc LEFT JOIN account h ON h.account_id = rc.handled_by
        WHERE rc.case_id = $1 AND rc.target_type IN ('post', 'comment')
      `, [id]);
      const reportCase = cases.rows[0];
      if (!reportCase) throw new ModerationError(404, 'Không tìm thấy nhóm báo cáo.');
      const reports = await client.query(`
        SELECT ${REPORT_FIELDS}, a.full_name AS "reporterName", a.email AS "reporterEmail"
        FROM report r LEFT JOIN account a ON a.account_id = r.reporter_id
        WHERE r.case_id = $1 ORDER BY r.created_at DESC, r.report_id DESC
      `, [id]);
      let comment = null;
      let postId = reportCase.targetId;
      if (reportCase.targetType === 'comment') {
        const comments = await client.query(`
          SELECT ${COMMENT_FIELDS}, a.full_name AS "authorName", a.email AS "authorEmail"
          FROM comment c LEFT JOIN account a ON a.account_id = c.author_id WHERE c.comment_id = $1
        `, [reportCase.targetId]);
        comment = comments.rows[0] || null;
        postId = comment?.postId;
        if (comment) comment.history = await history('comment', comment.id, client);
      }
      let post = null;
      if (postId) {
        try { post = await getPost(postId, client); }
        catch (error) { if (!(error instanceof ModerationError && error.status === 404)) throw error; }
      }
      // Tung's code: Lịch sử vẫn lưu ở từng report. Đọc chung qua case_id để
      // không tạo N truy vấn lịch sử và không bỏ sót reporter ngoài dòng đầu.
      const events = await client.query(`
        SELECT l.admin_log_id AS id, l.target_id::text AS "reportId", l.action, l.reason,
          l.created_at AS "createdAt", a.full_name AS "adminName", a.email AS "adminEmail"
        FROM admin_log l JOIN report r ON l.target_type = 'report' AND l.target_id = r.report_id
        LEFT JOIN account a ON a.account_id = l.admin_id
        WHERE r.case_id = $1 ORDER BY l.created_at DESC, l.admin_log_id DESC LIMIT 100
      `, [id]);
      return { case: { ...reportCase, reportCount: reports.rows.length, history: events.rows }, reports: reports.rows, post, comment };
    });
  }

  // Tung's code: Chỉ export quyết định theo case; không còn đường ghi theo report_id.
  return { listPosts, getPost, decidePost, listCases, getCase, decideCase };
}

module.exports = { createPostModerationModel };
