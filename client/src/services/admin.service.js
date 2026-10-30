// Các hàm gọi API khu quản trị.
import { apiFetch } from './api';

const adminService = {
  /** Khoi's code 30/10: range = 'today' | '7d' | '30d' */
  getDashboard(range = '7d') {
    return apiFetch(`/admin/dashboard?range=${encodeURIComponent(range)}`);
  },
  getAlerts(page = 1) {
    return apiFetch(`/admin/dashboard/alerts?page=${page}`);
  },
  getQueue(page = 1) {
    return apiFetch(`/admin/dashboard/queue?page=${page}`);
  },
  getAudit(page = 1) {
    return apiFetch(`/admin/dashboard/audit?page=${page}`);
  },
};

export default adminService;
