// Các hàm gọi API khu quản trị.
import { apiFetch } from './api';

const adminService = {
  getDashboard() {
    return apiFetch('/admin/dashboard');
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
