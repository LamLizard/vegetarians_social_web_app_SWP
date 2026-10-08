// Tùng — Sprint 2: quyết định gắn hồ sơ đang xem, không gửi reviewer từ client.
import { apiFetch } from './api';
const ROOT = '/admin/shops/submissions';

const shopVerificationService = {
  list: (page = 1, signal) => apiFetch(`${ROOT}?${new URLSearchParams({ status: 'pending', page: String(page), pageSize: '20' })}`, { signal }),
  detail: (id, signal) => apiFetch(`${ROOT}/${encodeURIComponent(id)}`, { signal }),
  decide: (id, action, reason) => apiFetch(`${ROOT}/${encodeURIComponent(id)}/decision`, {
    method: 'POST', body: JSON.stringify({ action, expectedSubmissionId: id, ...(action === 'reject' ? { reason } : {}) }),
  }),
};
export default shopVerificationService;
