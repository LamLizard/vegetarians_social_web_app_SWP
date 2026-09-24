// =====================================================================
//  TRẠNG THÁI THEO TỪNG ĐỐI TƯỢNG — nguồn chuẩn: Final Report v4.0
//
//  Cùng một chữ nhưng mỗi đối tượng hiểu khác nhau:
//    post.pending = "Chờ duyệt"   ·   shop.pending = "Chờ xác minh"
//  → Luôn truyền cả `entity` lẫn `status`:  <StatusBadge entity="shop" status="pending" />
//
//  tone: ok (xanh) · warn (vàng) · bad (đỏ đất) · neutral (xám)
//  Luôn có icon + chữ để người mù màu vẫn đọc được.
// =====================================================================

export const STATUS = {
  /** post.status — Report v4.0 mục B.
   *  LƯU Ý: file ERD trong Project chỉ có public/hidden/deleted (bản cũ). */
  post: {
    pending:  { label: 'Chờ duyệt',   tone: 'warn',    icon: 'hourglass-split' },
    public:   { label: 'Công khai',   tone: 'ok',      icon: 'globe2' },
    rejected: { label: 'Bị từ chối',  tone: 'bad',     icon: 'x-circle' },
    hidden:   { label: 'Đã ẩn',       tone: 'neutral', icon: 'eye-slash' },
    deleted:  { label: 'Đã xoá',      tone: 'neutral', icon: 'trash3' },
  },

  /** comment.status — entity_state_event_reference 3.1 */
  comment: {
    public:  { label: 'Hiển thị', tone: 'ok',      icon: 'chat-left-text' },
    hidden:  { label: 'Đã ẩn',    tone: 'neutral', icon: 'eye-slash' },
    deleted: { label: 'Đã xoá',   tone: 'neutral', icon: 'trash3' },
  },

  /** dish.status — Report v4.0 mục C */
  dish: {
    pending:  { label: 'Chờ duyệt',  tone: 'warn',    icon: 'hourglass-split' },
    active:   { label: 'Đã duyệt',   tone: 'ok',      icon: 'check-circle' },
    rejected: { label: 'Bị từ chối', tone: 'bad',     icon: 'x-circle' },
    hidden:   { label: 'Đã ẩn',      tone: 'neutral', icon: 'eye-slash' },
  },

  /** shop.verification_status — Report v4.0 mục F.
   *  LƯU Ý: file ERD trong Project dùng shop.status active/inactive/renovating (bản cũ). */
  shop: {
    pending:  { label: 'Chờ xác minh', tone: 'warn', icon: 'hourglass-split' },
    verified: { label: 'Đã xác minh',  tone: 'ok',   icon: 'patch-check' },
    rejected: { label: 'Bị từ chối',   tone: 'bad',  icon: 'x-circle' },
  },

  /** shop_dish.is_available (boolean) → dùng key 'available' / 'unavailable' */
  shopDish: {
    available:   { label: 'Đang bán',  tone: 'ok',      icon: 'check2' },
    unavailable: { label: 'Tạm hết',   tone: 'neutral', icon: 'pause-circle' },
  },

  /** chat_message.status: gán 1 lần khi tạo tin, không đổi qua lại */
  chatMessage: {
    ok:       { label: 'Đã gửi',          tone: 'ok',      icon: 'check2' },
    filtered: { label: 'Bị lọc',          tone: 'warn',    icon: 'shield-exclamation' },
    error:    { label: 'Lỗi, chưa trừ lượt', tone: 'bad',  icon: 'exclamation-circle' },
  },

  /** category.is_active (boolean) → 'active' / 'inactive' */
  category: {
    active:   { label: 'Đang dùng', tone: 'ok',      icon: 'check2' },
    inactive: { label: 'Đã tắt',    tone: 'neutral', icon: 'pause-circle' },
  },

  /** Trạng thái mở cửa của quán: KHÔNG lưu database, tính từ giờ mở/đóng bằng getOpenState() (utils/time.js). */
  shopOpen: {
    open:        { label: 'Đang mở cửa', tone: 'ok',      icon: 'door-open' },
    closingSoon: { label: 'Sắp đóng cửa', tone: 'warn',   icon: 'clock-history' },
    closed:      { label: 'Đã đóng cửa', tone: 'neutral', icon: 'door-closed' },
  },

  /** account.status */
  account: {
    active:  { label: 'Hoạt động', tone: 'ok',      icon: 'check-circle' },
    locked:  { label: 'Bị khoá',   tone: 'bad',     icon: 'lock' },
    deleted: { label: 'Đã xoá',    tone: 'neutral', icon: 'person-x' },
  },

  /** report.status */
  report: {
    pending:  { label: 'Chờ xử lý',   tone: 'warn',    icon: 'hourglass-split' },
    accepted: { label: 'Đã xử lý',    tone: 'ok',      icon: 'check-circle' },
    rejected: { label: 'Đã bác bỏ',   tone: 'neutral', icon: 'x-circle' },
  },

  /** meal_plan.status */
  mealPlan: {
    draft:    { label: 'Bản nháp', tone: 'neutral', icon: 'pencil' },
    saved:    { label: 'Đã lưu',   tone: 'ok',      icon: 'bookmark-check' },
    archived: { label: 'Lưu trữ',  tone: 'neutral', icon: 'archive' },
  },
};

/** Tên hiển thị của từng đối tượng (dùng trong Review Kit, tiêu đề bảng admin). */
export const ENTITY_LABEL = {
  post: 'Bài đăng',
  comment: 'Bình luận',
  dish: 'Món ăn',
  shop: 'Quán',
  shopDish: 'Món trong menu quán',
  account: 'Tài khoản',
  report: 'Báo cáo',
  mealPlan: 'Thực đơn',
  shopOpen: 'Giờ mở cửa (tính từ giờ, không lưu DB)',
  chatMessage: 'Tin nhắn chatbot',
  category: 'Danh mục',
};

/** Lấy thông tin 1 trạng thái; không tìm thấy → trả về bản trung tính và cảnh báo khi dev. */
export function getStatus(entity, status) {
  const found = STATUS[entity]?.[status];
  if (!found && import.meta.env?.DEV) {
    console.warn(`[StatusBadge] Không có trạng thái "${status}" cho đối tượng "${entity}". Xem src/constants/status.js`);
  }
  return found ?? { label: status ?? '?', tone: 'neutral', icon: 'dot' };
}
