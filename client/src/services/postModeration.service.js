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

// Gọi API thật. Không dùng dữ liệu mẫu hoặc cập nhật state thay cho việc lưu DB.
const postModerationService = {
  listPosts: (filters, signal) => apiFetch(listPath('posts', filters), { signal }),
  listReports: (filters, signal) => apiFetch(listPath('reports', filters), { signal }),
  getPost: (id, signal) => apiFetch(`${ROOT}/posts/${encodeURIComponent(id)}`, { signal }),
  getReport: (id, signal) => apiFetch(`${ROOT}/reports/${encodeURIComponent(id)}`, { signal }),
  decidePost: (id, action, note) => decide('posts', id, action, note),
  decideReport: (id, action, note) => decide('reports', id, action, note),
};

export default postModerationService;
