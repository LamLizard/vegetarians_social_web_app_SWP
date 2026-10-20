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

/* Lam's code: Quy ước ngày đồng nhất với shop_schedule và SHOP_DAY_LABELS. */
const WEEKDAY_LABELS = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'];

/** Ngày hiện tại theo quy ước DB: 1 = Thứ hai … 7 = Chủ nhật. */
export function todayDayOfWeek(now = new Date()) {
  const day = now.getDay();
  return day === 0 ? 7 : day;
}

/** Giờ mở cửa của một thứ bất kỳ (1 = Thứ hai … 7 = Chủ nhật). Nghỉ/thiếu → "--:--". */
export function getHoursForDay(schedule = [], dayOfWeek) {
  const day = schedule.find((item) => item.dayOfWeek === dayOfWeek) || null;
  const slots = (!day || day.isClosed ? [] : (day.slots || []))
    .filter((slot) => slot && slot.openTime && slot.closeTime)
    .sort((a, b) => a.openTime.localeCompare(b.openTime));
  const hoursText = slots.length
    ? slots.map((slot) => `${slot.openTime.slice(0, 5)} - ${slot.closeTime.slice(0, 5)}`).join(', ')
    : '--:--';
  return {
    dayOfWeek,
    dayLabel: WEEKDAY_LABELS[dayOfWeek - 1],
    hoursText,
    isClosed: slots.length === 0,
    slots,
  };
}

/** Lấy các ca mở cửa hôm nay; nghỉ hoặc thiếu giờ trả về "--:--". */
export function getTodayHours(schedule = [], now = new Date()) {
  return getHoursForDay(schedule, todayDayOfWeek(now));
}

/**
 * Trạng thái mở/đóng THEO THỜI GIAN THỰC từ các ca hôm nay.
 * @param {Array<{openTime:string, closeTime:string}>} slots
 * @returns {'open'|'closingSoon'|'closed'|null}  null = không có ca nào / thiếu giờ
 */
export function getOpenStateFromSlots(slots = [], now = new Date(), soonMinutes = 30) {
  const cur = now.getHours() * 60 + now.getMinutes();
  const ranges = (slots || [])
    .map((s) => [toMinutes(s?.openTime), toMinutes(s?.closeTime)])
    .filter(([o, c]) => o != null && c != null);
  if (!ranges.length) return null;
  for (const [o, c] of ranges) {
    if (cur >= o && cur < c) return (c - cur <= soonMinutes) ? 'closingSoon' : 'open';
  }
  return 'closed';
}
