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
  whitelist(query, ['status', 'page', 'pageSize']);
  if (query.status !== undefined && query.status !== 'pending') invalid('status', 'Trang xác minh chỉ lấy hồ sơ chờ duyệt.');
  return parsePagination(query);
}

module.exports = { parseDecision, parseQueue };
