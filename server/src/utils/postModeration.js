// Quy tắc dùng riêng cho module quản trị Post, khớp schema PostgreSQL.
class ModerationError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ModerationError';
    this.status = status;
  }
}

function parseId(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,18}$/.test(value)
    || BigInt(value) > 9223372036854775807n) {
    throw new ModerationError(400, 'ID không hợp lệ.');
  }
  return value;
}

function option(value, allowed, fallback, label) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new ModerationError(400, `${label} không hợp lệ.`);
  }
  return value;
}

function integer(value, fallback, maximum, label) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)
    || !Number.isSafeInteger(Number(value)) || Number(value) > maximum) {
    throw new ModerationError(400, `${label} không hợp lệ.`);
  }
  return Number(value);
}

function parseListQuery(query, entity) {
  const statuses = entity === 'post'
    ? ['all', 'pending', 'public', 'reported', 'deleted']
    : ['all', 'pending', 'accepted', 'rejected'];
  if (query.search !== undefined && (typeof query.search !== 'string' || query.search.length > 255)) {
    throw new ModerationError(400, 'Từ khóa tối đa 255 ký tự.');
  }
  return {
    status: option(query.status, statuses, 'pending', 'Trạng thái'),
    postType: option(query.postType, ['all', 'blog', 'video'], 'all', 'Loại bài'),
    search: query.search?.trim() || '',
    // Giới hạn tránh OFFSET quá lớn và phép nhân vượt precision Number.
    page: integer(query.page, 1, 1000000, 'Trang'),
    limit: integer(query.limit, 20, 100, 'Số mục mỗi trang'),
    stale: option(query.stale, ['0', '1'], '0', 'Bộ lọc tồn đọng') === '1',
  };
}

function parseDecision(body, entity) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ModerationError(400, 'Dữ liệu quyết định không hợp lệ.');
  }
  const actions = entity === 'post' ? ['approve', 'reject'] : ['accept', 'reject'];
  if (!actions.includes(body.action)) throw new ModerationError(400, 'Thao tác không hợp lệ.');
  if (body.note !== undefined && typeof body.note !== 'string') {
    throw new ModerationError(400, 'Lý do phải là chuỗi ký tự.');
  }
  const note = body.note?.trim() || null;
  if ((body.action !== 'approve' && !note) || (note && [...note].length > 255)) {
    throw new ModerationError(400, 'Nhập lý do từ 1 đến 255 ký tự.');
  }
  return { action: body.action, note };
}

function getPostDecision(status, action) {
  if (status !== 'pending') throw new ModerationError(409, 'Bài viết đã được xử lý. Hãy tải lại dữ liệu.');
  if (action === 'approve') {
    return { status: 'public', logAction: 'APPROVE', notificationType: 'post_approved' };
  }
  if (action === 'reject') {
    return { status: 'deleted', logAction: 'REJECT', notificationType: 'post_rejected' };
  }
  throw new ModerationError(400, 'Thao tác không hợp lệ.');
}

function canRestorePost(post, hasBlockingReport, hasBlockingDecision) {
  return post.status === 'reported' && Boolean(post.publishedAt)
    && !hasBlockingReport && !hasBlockingDecision;
}

module.exports = { ModerationError, parseId, parseListQuery, parseDecision, getPostDecision, canRestorePost };
