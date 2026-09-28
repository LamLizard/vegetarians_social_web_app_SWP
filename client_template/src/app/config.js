// Tên & khẩu hiệu của app – đổi ở đây là đổi toàn bộ giao diện.
export const APP_NAME = 'Ăn Chay';
export const APP_TAGLINE = 'Cộng đồng ăn chay, sống lành';

// Mục trên dock trái (desktop) – soon = chưa làm trong phạm vi hiện tại
export const DOCK_NAV = [
  { to: '/', icon: 'house-door', iconOn: 'house-door-fill', label: 'Bảng tin', end: true },
  { to: '/discover', icon: 'compass', iconOn: 'compass-fill', label: 'Khám phá' },
  { to: '/assistant', icon: 'flower1', iconOn: 'flower1', label: 'Mầm AI' },
  { to: '/saved', icon: 'bookmark', iconOn: 'bookmark-fill', label: 'Đã lưu' },
  { to: '/explore/menu', icon: 'calendar-week', iconOn: 'calendar-week-fill', label: 'Thực đơn', soon: true },
  { to: '/explore/restaurants', icon: 'shop', iconOn: 'shop-window', label: 'Quán chay', soon: true },
];
