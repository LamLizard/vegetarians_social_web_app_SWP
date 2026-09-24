// =====================================================================
//  ĐỊNH DẠNG HIỂN THỊ – dùng chung để cả app hiện số, ngày, giá giống nhau
// =====================================================================

const toDate = (v) => (v instanceof Date ? v : new Date(v));

/**
 * "Vừa xong", "5 phút trước", "3 giờ trước", "Hôm qua", "4 ngày trước", rồi tới ngày cụ thể "12/09/2026".
 * @param {string|number|Date} value  created_at từ API (ISO string)
 */
export function timeAgo(value, now = Date.now()) {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return '';
  const s = Math.max(0, Math.round((now - d.getTime()) / 1000));
  if (s < 60) return 'Vừa xong';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'Hôm qua';
  if (days < 7) return `${days} ngày trước`;
  return formatDate(d);
}

/** "24/09/2026" · withTime → "24/09/2026 14:05" */
export function formatDate(value, { withTime = false } = {}) {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  return withTime ? `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
}

/** Số ngắn gọn: 950 → "950" · 1250 → "1,3 N" · 2400000 → "2,4 Tr" */
export function formatCount(n) {
  const v = Number(n) || 0;
  const short = (x, digits) => Number(x.toFixed(digits)).toLocaleString('vi-VN', { maximumFractionDigits: digits });
  if (v < 1000) return String(v);
  const k = v / 1000;
  if (Math.round(k) < 1000) return `${short(k, k < 10 ? 1 : 0)} N`;
  const m = v / 1_000_000;
  return `${short(m, 1)} Tr`;
}

/** Số đầy đủ có dấu chấm: 1250000 → "1.250.000" */
export const formatNumber = (n) => (Number(n) || 0).toLocaleString('vi-VN');

/** Giá: 45000 → "45.000đ" · null → "Liên hệ" */
export const formatPrice = (n) => (n == null || n === '' ? 'Liên hệ' : `${formatNumber(n)}đ`);
