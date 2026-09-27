// các hàm gọi API khu quản trị: getDashboardStats() getRecentQueue()
// BE CHƯA CÓ endpoint admin → đang chạy mock. Khi BE xong thì đổi USE_MOCK = false.
import { apiFetch } from './api';

const USE_MOCK = true;        // TODO: tắt khi BE có endpoint admin (chốt lại với BE)
const MOCK_DELAY_MS = 400;    // độ trễ giả để thấy trạng thái loading khi dev

// ---------------------------------------------------------------------
// DỮ LIỆU MOCK (chuyển từ pages/AdminDashboardPage.jsx)
// ---------------------------------------------------------------------

/** 4 ô Dashboard — BE trả về theo đúng `key` này */
const MOCK_STATS = [
  { key: 'post', value: 8 },
  { key: 'dish', value: 5 },
  { key: 'shop', value: 3 },
  { key: 'report', value: 4 },
];

/** Hàng chờ gần đây — mỗi dòng khớp bảng đang chờ duyệt */
const MOCK_QUEUE = [
  { id: 1, entity: 'post', title: 'Bún riêu chay nấm rơm — công thức của mẹ', createdAt: '2026-09-27T08:35:00', status: 'pending' },
  { id: 2, entity: 'dish', title: 'Đậu hũ sốt nấm đông cô', createdAt: '2026-09-27T07:10:00', status: 'pending' },
  { id: 3, entity: 'shop', title: 'Quán chay An Nhiên (Q.1)', createdAt: '2026-09-26T19:40:00', status: 'pending' },
  { id: 4, entity: 'report', title: "Báo cáo bình luận quảng cáo trong bài 'Gỏi cuốn chay'", createdAt: '2026-09-26T15:05:00', status: 'pending' },
  { id: 5, entity: 'dish', title: 'Gỏi cuốn chay chấm tương đậu', createdAt: '2026-09-25T21:20:00', status: 'pending' },
];

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const clone = (rows) => rows.map((row) => ({ ...row }));

const adminService = {
  /** Số liệu 4 ô đầu Dashboard. GET /admin/stats — endpoint GIẢ ĐỊNH, chốt lại với BE. */
  async getDashboardStats() {
    if (USE_MOCK) {
      await wait(MOCK_DELAY_MS);
      return clone(MOCK_STATS);
    }
    // Giả định BE trả mảng [{ key, value }]. Nếu BE bọc trong { data } thì sửa ngay tại đây.
    return apiFetch('/admin/stats');
  },

  /** Hàng chờ gần đây. GET /admin/moderation?limit=n — endpoint GIẢ ĐỊNH, chốt lại với BE. */
  async getRecentQueue(limit = 5) {
    if (USE_MOCK) {
      await wait(MOCK_DELAY_MS);
      return clone(MOCK_QUEUE).slice(0, limit);
    }
    return apiFetch(`/admin/moderation?limit=${limit}`);
  },
};

export default adminService;
