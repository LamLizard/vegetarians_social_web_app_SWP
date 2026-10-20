// Tùng — Sprint 2: quyết định gắn hồ sơ đang xem, không gửi reviewer từ client.
import { apiFetch } from './api';
const ROOT = '/admin/shops/submissions';
const SHOPS = '/admin/shops';

const shopVerificationService = {
  list: (page = 1, signal, filters = {}) => apiFetch(`${ROOT}?${new URLSearchParams({ ...filters, status: 'pending', page: String(page), pageSize: '10' })}`, { signal }),
  detail: (id, signal) => apiFetch(`${ROOT}/${encodeURIComponent(id)}`, { signal }),
  decide: (id, action, reason) => apiFetch(`${ROOT}/${encodeURIComponent(id)}/decision`, {
    method: 'POST', body: JSON.stringify({ action, expectedSubmissionId: id, ...(action === 'reject' ? { reason } : {}) }),
  }),
  listShops: (page = 1, signal, filters = {}) => apiFetch(`${SHOPS}?${new URLSearchParams({ ...filters, page: String(page), pageSize: '10' })}`, { signal }),
  shopDetail: (id, signal) => apiFetch(`${SHOPS}/${encodeURIComponent(id)}`, { signal }),
  history: (id, page = 1, signal) => apiFetch(`${SHOPS}/${encodeURIComponent(id)}/history?${new URLSearchParams({ page: String(page), pageSize: '20' })}`, { signal }),
  setStatus: (id, status, expectedVersion, reason) => apiFetch(`${SHOPS}/${encodeURIComponent(id)}/status`, {
    method: 'PATCH', body: JSON.stringify({ status, expectedVersion, reason }),
  }),
};
export default shopVerificationService;
