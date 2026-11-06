// Khoi's code (05/11/2026): bản server của logic mở/đóng quán — port từ client/src/utils/time.js và
// client/src/components/FeedRails/shopStatus.js (không import file client), tính theo giờ Việt Nam.
const TIME_ZONE = 'Asia/Ho_Chi_Minh';
const WEEKDAY = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'];
const DAY_NUMBER = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

const toMinutes = (hhmm) => {
  const match = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? '');
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};
const hhmm = (time) => (time ?? '').slice(0, 5);

/** Giờ và thứ hiện tại ở Việt Nam cho một mốc Date bất kỳ. */
function vietnamClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE,
    weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const part = (type) => parts.find((entry) => entry.type === type)?.value ?? '';
  return { minutes: (Number(part('hour')) % 24) * 60 + Number(part('minute')),
    dayOfWeek: DAY_NUMBER[part('weekday')] ?? 1 };
}

/** Ca mở cửa của một thứ (1 = Thứ hai … 7 = Chủ nhật); nghỉ/thiếu thì không có ca. */
function getHoursForDay(schedule = [], dayOfWeek) {
  const day = schedule.find((item) => Number(item.dayOfWeek) === dayOfWeek) || null;
  const slots = (!day || day.isClosed ? [] : (day.slots || []))
    .filter((slot) => slot && slot.openTime && slot.closeTime)
    .sort((a, b) => String(a.openTime).localeCompare(String(b.openTime)));
  return { dayOfWeek, dayLabel: WEEKDAY[dayOfWeek - 1], isClosed: slots.length === 0, slots };
}

/** 'open' | 'closingSoon' | 'closed' | null (không có ca nào). */
function openStateFromSlots(slots = [], minutes, soonMinutes = 30) {
  const ranges = (slots || [])
    .map((slot) => [toMinutes(slot?.openTime), toMinutes(slot?.closeTime)])
    .filter(([open, close]) => open != null && close != null);
  if (!ranges.length) return null;
  for (const [open, close] of ranges) {
    if (minutes >= open && minutes < close) return (close - minutes <= soonMinutes) ? 'closingSoon' : 'open';
  }
  return 'closed';
}

/**
 * Trạng thái mở cửa của quán lúc `now` (mặc định bây giờ, giờ VN).
 * next.time/next.dayOffset dùng để báo "mở lúc 17:00" / "mai mở 07:00"; minutesToOpen = Infinity khi không có giờ.
 */
function shopOpenInfo(schedule = [], now = new Date()) {
  const { minutes, dayOfWeek: todayDow } = vietnamClock(now);
  const today = getHoursForDay(schedule, todayDow);
  const state = today.isClosed ? 'closed' : (openStateFromSlots(today.slots, minutes) ?? 'closed');
  const isOpen = state === 'open' || state === 'closingSoon';

  if (isOpen) {
    const current = today.slots.find((slot) => minutes >= toMinutes(slot.openTime) && minutes < toMinutes(slot.closeTime));
    return { state, isOpen, closeAt: hhmm(current?.closeTime) || null, next: null, minutesToOpen: 0, closedToday: false };
  }

  let next = null;
  for (let offset = 0; offset <= 7 && !next; offset += 1) {
    const dow = ((todayDow - 1 + offset) % 7) + 1;
    const { slots } = offset === 0 ? today : getHoursForDay(schedule, dow);
    const slot = slots.find((entry) => offset > 0 || toMinutes(entry.openTime) > minutes);
    if (slot) {
      next = { time: hhmm(slot.openTime), dayOffset: offset, dayLabel: WEEKDAY[dow - 1],
        minutes: offset * 1440 + toMinutes(slot.openTime) - minutes };
    }
  }
  const { minutes: toOpen = Infinity, ...rest } = next ?? {};
  return { state: 'closed', isOpen, closeAt: null, next: next ? rest : null, minutesToOpen: toOpen, closedToday: today.isClosed };
}

/** Câu hiển thị dưới tên quán (giống khối "Quán chay đang mở" ở Bảng tin). */
function shopStatusText(info) {
  if (!info) return '';
  if (info.state === 'closingSoon') return `Sắp đóng · ${info.closeAt ?? ''}`;
  if (info.isOpen) return info.closeAt ? `Mở đến ${info.closeAt}` : 'Đang mở';
  const head = info.closedToday ? 'Nghỉ' : 'Đóng cửa';
  if (!info.next) return 'Chưa cập nhật giờ';
  const { time, dayOffset, dayLabel } = info.next;
  if (dayOffset === 0) return `${head} · mở lúc ${time}`;
  if (dayOffset === 1) return `${head} · mai mở ${time}`;
  return `${head} · mở ${dayLabel} ${time}`;
}

module.exports = { shopOpenInfo, shopStatusText, getHoursForDay, vietnamClock };
