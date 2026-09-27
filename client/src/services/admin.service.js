// các hàm gọi API khu quản trị: getDashboard()
// BE CHƯA CÓ endpoint admin → đang chạy mock. Khi BE xong thì đổi USE_MOCK = false.
import { apiFetch } from './api';

const USE_MOCK = true;        // TODO: tắt khi BE có endpoint admin (chốt lại với BE)
const MOCK_DELAY_MS = 400;    // độ trễ giả để thấy trạng thái loading khi dev

// ---------------------------------------------------------------------
// DỮ LIỆU MOCK — tên field đặt GIỐNG response API tương lai:
//   pendingStats · alerts · reviewQueue · community · auditLog (+ admins)
// ---------------------------------------------------------------------

/** ISO cách đây n giờ — để cột "Chờ bao lâu" luôn đúng, không bị lỗi thời theo ngày */
const hoursAgo = (h) => new Date(Date.now() - h * 3600_000).toISOString();

const MOCK_DASHBOARD = {
  /** 4 ô "Việc cần xử lý": stale = mục chờ quá 48h · staleOldestDays = lâu nhất mấy ngày */
  pendingStats: { post: 12, report: 7, appeals: 3, stale: 5, staleOldestDays: 6 },

  /** Cảnh báo nổi bật — tone theo Notice của kit (alert = cần hành động, info = để biết) */
  alerts: [
    {
      id: 'al-1',
      tone: 'alert',
      title: "Bài viết 'Bún riêu chay nấm rơm' bị 7 người báo cáo",
      description: 'Vượt ngưỡng 5 báo cáo — nên xem và xử lý trong hôm nay.',
      actionLabel: 'Xem',
      href: '/admin/moderation?type=report',
    },
    {
      id: 'al-2',
      tone: 'alert',
      title: 'Tài khoản “chay_sieuthi_88” có dấu hiệu spam',
      description: '5 bài bị report trong 24h, cùng trỏ về một shop quảng cáo.',
      actionLabel: 'Xem tài khoản',
      href: '/admin/accounts?q=chay_sieuthi_88',
    },
    {
      id: 'al-3',
      tone: 'info',
      title: 'Hàng đợi kiểm duyệt tăng 40% so với hôm qua',
      description: 'Hôm nay 19 mục mới, hôm qua 14 mục — nên dọn hàng đợi sớm.',
      actionLabel: 'Xem hàng đợi',
      href: '/admin/moderation',
    },
  ],

  /** Hàng đợi kiểm duyệt — entity: post | comment · assignee = null là chưa có người phụ trách */
  reviewQueue: [
    { id: 101, entity: 'post', excerpt: 'Bún riêu chay nấm rơm — công thức của mẹ', author: 'Lan Anh', reason: 'Bài mới chờ duyệt', createdAt: hoursAgo(3), assignee: 'Admin Minh' },
    { id: 102, entity: 'comment', excerpt: 'Shop này bán mặn lắm, ghé chỗ khác đi...', author: 'chay_sieuthi_88', reason: 'Bị 5 người báo cáo', createdAt: hoursAgo(9), assignee: 'Admin Minh' },
    { id: 103, entity: 'post', excerpt: 'Gỏi cuốn chay chấm tương đậu', author: 'Bảo Trân', reason: 'Bài mới chờ duyệt', createdAt: hoursAgo(52), assignee: null },
    { id: 104, entity: 'comment', excerpt: 'Cho mình xin địa chỉ quán chay ở Q.7', author: 'Hoài Nam', reason: 'Có từ khoá nhạy cảm', createdAt: hoursAgo(30), assignee: 'Admin Nhi' },
    { id: 105, entity: 'post', excerpt: 'Thực đơn 7 ngày cho người mới ăn chay', author: 'Minh Thư', reason: 'Gửi lại sau khi bị từ chối', createdAt: hoursAgo(60), assignee: null },
    { id: 106, entity: 'post', excerpt: 'Đậu hũ sốt nấm đông cô', author: 'Quốc Huy', reason: 'Bài mới chờ duyệt', createdAt: hoursAgo(1), assignee: 'Admin Khoa' },
  ],

  /** Chỉ số cộng đồng hôm nay · trend = % so kỳ trước (số âm = giảm) */
  community: [
    { key: 'newMembers', label: 'Thành viên mới', value: 24, unit: 'người', trend: 12 },
    { key: 'activeUsers', label: 'Đang hoạt động', value: 318, unit: 'người', trend: 5 },
    { key: 'newPosts', label: 'Bài viết mới', value: 41, unit: 'bài', trend: -8 },
    { key: 'comments', label: 'Bình luận', value: 156, unit: 'bình luận', trend: 18 },
    { key: 'reports', label: 'Báo cáo', value: 9, unit: 'báo cáo', trend: 40 },
  ],

  /** Nhật ký quản trị (admin_log) */
  auditLog: [
    { id: 9001, admin: 'Admin Minh', action: 'APPROVE', target: 'dish #12', at: hoursAgo(2), reason: 'Đúng chủ đề' },
    { id: 9002, admin: 'Admin Minh', action: 'REJECT', target: 'post #87', at: hoursAgo(5), reason: 'Ảnh không liên quan' },
    { id: 9003, admin: 'Admin Nhi', action: 'LOCK', target: 'account #33', at: hoursAgo(21), reason: 'Spam 5 bài trong 24h' },
    { id: 9004, admin: 'Admin Khoa', action: 'APPROVE', target: 'shop #7', at: hoursAgo(26), reason: 'Đã xác minh giấy phép' },
    { id: 9005, admin: 'Admin Nhi', action: 'REJECT', target: 'comment #512', at: hoursAgo(30), reason: 'Từ ngữ không phù hợp' },
    { id: 9006, admin: 'Admin Minh', action: 'APPROVE', target: 'post #92', at: hoursAgo(48), reason: 'Đã sửa theo góp ý' },
  ],

  /** Người có thể nhận phụ trách — nguồn cho menu "Chuyển người khác" */
  admins: ['Admin Minh', 'Admin Nhi', 'Admin Khoa'],
};

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

const cloneBoard = (board) => ({
  pendingStats: { ...board.pendingStats },
  alerts: board.alerts.map((item) => ({ ...item })),
  reviewQueue: board.reviewQueue.map((item) => ({ ...item })),
  community: board.community.map((item) => ({ ...item })),
  auditLog: board.auditLog.map((item) => ({ ...item })),
  admins: [...board.admins],
});

const adminService = {
  /** Toàn bộ dữ liệu Dashboard. GET /admin/dashboard — endpoint GIẢ ĐỊNH, chốt lại với BE. */
  async getDashboard() {
    if (USE_MOCK) {
      await wait(MOCK_DELAY_MS);
      return cloneBoard(MOCK_DASHBOARD);
    }
    // Giả định BE trả 1 object { pendingStats, alerts, reviewQueue, community, auditLog, admins }.
    // Nếu BE tách endpoint riêng thì Promise.all([...]) ngay tại đây, page không phải sửa.
    return apiFetch('/admin/dashboard');
  },
};

export default adminService;
