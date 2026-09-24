// =====================================================================
//  GIỜ MỞ CỬA CỦA QUÁN
//  shop lưu giờ dạng "HH:mm" (vd open_time "07:00", close_time "21:30").
//  Quán mở qua đêm (18:00 → 02:00) vẫn tính đúng.
// =====================================================================

const toMinutes = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/**
 * Trạng thái mở cửa lúc `now`. Dùng với <StatusBadge entity="shopOpen" status={...} />.
 * @param {string} openTime   "07:00"
 * @param {string} closeTime  "21:30"
 * @param {Date} [now=new Date()]
 * @param {number} [soonMinutes=30]  còn ít hơn số phút này thì báo "Sắp đóng cửa"
 * @returns {'open'|'closingSoon'|'closed'|null}  null khi thiếu giờ
 */
export function getOpenState(openTime, closeTime, now = new Date(), soonMinutes = 30) {
  const open = toMinutes(openTime);
  const close = toMinutes(closeTime);
  if (open == null || close == null) return null;
  if (open === close) return 'open'; // mở cả ngày
  const cur = now.getHours() * 60 + now.getMinutes();
  const overnight = close < open;
  const isOpen = overnight ? cur >= open || cur < close : cur >= open && cur < close;
  if (!isOpen) return 'closed';
  const left = (close - cur + 1440) % 1440;
  return left <= soonMinutes ? 'closingSoon' : 'open';
}

/** "07:00" + "21:30" → "07:00 - 21:30"; mở cả ngày → "Mở cả ngày"; thiếu → "Chưa cập nhật giờ". */
export function formatHours(openTime, closeTime) {
  if (!openTime || !closeTime) return 'Chưa cập nhật giờ';
  if (toMinutes(openTime) === toMinutes(closeTime)) return 'Mở cả ngày';
  return `${openTime.slice(0, 5)} - ${closeTime.slice(0, 5)}`;
}

/** 45 → "45 phút" · 90 → "1 giờ 30 phút" · 120 → "2 giờ". */
export function formatDuration(minutes) {
  const m = Math.round(Number(minutes) || 0);
  if (m <= 0) return '';
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} phút`;
  return r ? `${h} giờ ${r} phút` : `${h} giờ`;
}
