// Các hàm gọi API khu quản trị: getDashboard().
import { apiFetch } from './api';

const adminService = {
  getDashboard() {
    return apiFetch('/admin/dashboard');
  },
};

export default adminService;
