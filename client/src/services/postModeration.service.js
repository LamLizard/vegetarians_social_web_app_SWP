import { apiFetch } from './api';

const ROOT = '/admin/moderation';

function listPath(entity, filters) {
  const query = new URLSearchParams({
    status: filters.status,
    postType: filters.postType,
    search: filters.search || '',
    page: String(filters.page),
    limit: String(filters.limit || 20),
    stale: filters.stale ? '1' : '0',
  });
  return `${ROOT}/${entity}?${query}`;
}

function decide(entity, id, action, note) {
  return apiFetch(`${ROOT}/${entity}/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify({ action, ...(note ? { note } : {}) }),
  });
}

// Tung's code: Hai tab report truyền targetType để phân trang/lọc trên case.
// Comment không có bộ lọc loại bài; không mang postType từ tab post sang.
function caseListPath(filters) {
  const query = new URLSearchParams({
    targetType: filters.targetType,
    status: filters.status,
    search: filters.search || '',
    page: String(filters.page),
    limit: String(filters.limit || 20),
    stale: filters.stale ? '1' : '0',
  });
  if (filters.targetType === 'post') query.set('postType', filters.postType || 'all');
  return `${ROOT}/cases?${query}`;
}

// Gọi API thật. Không dùng dữ liệu mẫu hoặc cập nhật state thay cho việc lưu DB.
const postModerationService = {
  listPosts: (filters, signal) => apiFetch(listPath('posts', filters), { signal }),
  getPost: (id, signal) => apiFetch(`${ROOT}/posts/${encodeURIComponent(id)}`, { signal }),
  decidePost: (id, action, note) => decide('posts', id, action, note),
  // Tung's code: id của ba hàm dưới là caseId. Bỏ API reportId cũ để tránh
  // gửi quyết định cho một report riêng lẻ trong khi UI đang hiển thị cả nhóm.
  listCases: (filters, signal) => apiFetch(caseListPath(filters), { signal }),
  getCase: (id, signal) => apiFetch(`${ROOT}/cases/${encodeURIComponent(id)}`, { signal }),
  decideCase: (id, action, note) => decide('cases', id, action, note),
};

export default postModerationService;
