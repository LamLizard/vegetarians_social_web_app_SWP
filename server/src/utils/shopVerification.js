// Tùng — Sprint 2: quyết định gắn đúng hồ sơ, reject có lý do, accept không bắt note.
const { whitelist, parseId, invalid, text, parsePagination } = require('./shopWorkflow');

function parseDecision(value) {
  whitelist(value, ['action', 'expectedSubmissionId', 'reason']);
  if (!['accept', 'reject'].includes(value.action)) invalid('action', 'Quyết định không hợp lệ.');
  const reason = value.action === 'reject' ? text(value.reason, 'reason', 255) : null;
  if (value.action === 'accept' && value.reason !== undefined && value.reason !== null && value.reason !== '') {
    invalid('reason', 'Duyệt hồ sơ không nhận lý do từ chối.');
  }
  return { action: value.action, expectedSubmissionId: parseId(value.expectedSubmissionId, 'expectedSubmissionId'), reason };
}

function parseQueue(query) {
  whitelist(query, ['status', 'page', 'pageSize', 'q', 'submissionType', 'operatingStatus']);
  if (query.status !== undefined && query.status !== 'pending') invalid('status', 'Trang xác minh chỉ lấy hồ sơ chờ duyệt.');
  return { ...parseListPagination(query), q: parseSearch(query.q),
    submissionType: parseFilter(query.submissionType, 'submissionType', ['registration', 'resubmission', 'identity_edit']),
    operatingStatus: parseFilter(query.operatingStatus, 'operatingStatus', ['active', 'inactive']) };
}

function parseShopList(query) {
  whitelist(query, ['page', 'pageSize', 'q', 'verificationStatus', 'operatingStatus']);
  return { ...parseListPagination(query), q: parseSearch(query.q),
    verificationStatus: parseFilter(query.verificationStatus, 'verificationStatus', ['pending', 'verified', 'rejected']),
    operatingStatus: parseFilter(query.operatingStatus, 'operatingStatus', ['active', 'inactive']) };
}

function parseListPagination(query) {
  const { page } = parsePagination({ page: query.page });
  if (query.pageSize !== undefined && (typeof query.pageSize !== 'string' || !/^[1-9]\d*$/.test(query.pageSize))) {
    invalid('pageSize', 'Phân trang không hợp lệ.');
  }
  return { page, pageSize: query.pageSize === undefined ? 10 : Math.min(Number(query.pageSize), 10) };
}

function parseSearch(value) {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.includes('\0')) invalid('q', 'Từ khóa tìm kiếm không hợp lệ.');
  const result = value.trim();
  if (Array.from(result).length > 200) invalid('q', 'Từ khóa tìm kiếm tối đa 200 ký tự.');
  return result;
}

function parseFilter(value, field, allowed) {
  if (value === undefined || value === '') return undefined;
  if (!allowed.includes(value)) invalid(field, 'Bộ lọc không hợp lệ.');
  return value;
}

function parseHistory(query) {
  whitelist(query, ['page', 'pageSize']);
  return parsePagination(query);
}

function parseStatusUpdate(value) {
  whitelist(value, ['status', 'expectedVersion', 'reason']);
  if (!['active', 'inactive'].includes(value.status)) invalid('status', 'Trạng thái quán không hợp lệ.');
  let reason = null;
  if (value.reason !== undefined && value.reason !== null) {
    if (typeof value.reason !== 'string' || value.reason.includes('\0')) invalid('reason', 'Lý do không hợp lệ.');
    const trimmed = value.reason.trim();
    if (Array.from(trimmed).length > 255) invalid('reason', 'Lý do tối đa 255 ký tự.');
    reason = trimmed || null;
  }
  if (value.status === 'inactive' && !reason) invalid('reason', 'Vui lòng nhập lý do tạm ngưng hoạt động.');
  return { status: value.status, expectedVersion: parseId(value.expectedVersion, 'expectedVersion'), reason };
}

module.exports = { parseDecision, parseQueue, parseShopList, parseHistory, parseStatusUpdate };
