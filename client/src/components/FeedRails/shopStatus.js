// Khoi's code (01/11/2026): trạng thái mở cửa của 1 quán cho khối "Quán chay đang mở" (cột phải Bảng tin).
// Dùng lại getOpenStateFromSlots/getHoursForDay của utils/time.js (Lam) để khớp với trang Quán chay.
//  - Đang mở: "Mở đến <giờ đóng của ca hiện tại>" / "Sắp đóng · <giờ>" (còn ≤ 30 phút).
//  - Đang đóng: giờ mở của CA KẾ TIẾP (không phải ca đầu ngày); hết ca hôm nay thì tìm tới 7 ngày sau.
import { getHoursForDay, getOpenStateFromSlots, todayDayOfWeek } from '../../utils/time.js';

const toMinutes = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const hhmm = (t) => (t ?? '').slice(0, 5);
const WEEKDAY = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'];

/**
 * @param {Array} schedule  shop.schedule từ GET /api/shops ({dayOfWeek, isClosed, slots:[{openTime, closeTime}]})
 * @param {Date} [now]
 * @returns {{ state: 'open'|'closingSoon'|'closed', isOpen: boolean, closeAt: string|null,
 *             next: { time: string, dayOffset: number, dayLabel: string }|null, minutesToOpen: number, closedToday: boolean }}
 *   next.dayOffset: 0 = hôm nay, 1 = ngày mai, … · minutesToOpen dùng để xếp quán sắp mở lên trước (Infinity = không có giờ)
 */
export function shopOpenInfo(schedule = [], now = new Date()) {
  const cur = now.getHours() * 60 + now.getMinutes();
  const todayDow = todayDayOfWeek(now);
  const today = getHoursForDay(schedule, todayDow);
  const state = today.isClosed ? 'closed' : (getOpenStateFromSlots(today.slots, now) ?? 'closed');
  const isOpen = state === 'open' || state === 'closingSoon';

  if (isOpen) {
    const current = today.slots.find((sl) => cur >= toMinutes(sl.openTime) && cur < toMinutes(sl.closeTime));
    return { state, isOpen, closeAt: hhmm(current?.closeTime) || null, next: null, minutesToOpen: 0, closedToday: false };
  }

  // Đang đóng → ca kế tiếp: còn ca nào hôm nay mở sau giờ hiện tại không, không thì xét các ngày sau
  let next = null;
  for (let offset = 0; offset <= 7 && !next; offset += 1) {
    const dow = ((todayDow - 1 + offset) % 7) + 1;
    const { slots } = offset === 0 ? today : getHoursForDay(schedule, dow);
    const slot = slots.find((sl) => offset > 0 || toMinutes(sl.openTime) > cur);
    if (slot) {
      next = {
        time: hhmm(slot.openTime),
        dayOffset: offset,
        dayLabel: WEEKDAY[dow - 1],
        minutes: offset * 1440 + toMinutes(slot.openTime) - cur,
      };
    }
  }
  const { minutes = Infinity, ...rest } = next ?? {};
  return { state: 'closed', isOpen, closeAt: null, next: next ? rest : null, minutesToOpen: minutes, closedToday: today.isClosed };
}

/** Câu hiển thị dưới tên quán. */
export function shopStatusText(info) {
  if (info.state === 'closingSoon') return `Sắp đóng · ${info.closeAt ?? ''}`;
  if (info.isOpen) return info.closeAt ? `Mở đến ${info.closeAt}` : 'Đang mở';
  const head = info.closedToday ? 'Nghỉ' : 'Đóng cửa'; // ngắn để vừa 1 dòng ở cột phải 296px
  if (!info.next) return 'Chưa cập nhật giờ'; // cả tuần không có ca nào
  const { time, dayOffset, dayLabel } = info.next;
  if (dayOffset === 0) return `${head} · mở lúc ${time}`;
  if (dayOffset === 1) return `${head} · mai mở ${time}`;
  return `${head} · mở ${dayLabel} ${time}`;
}
