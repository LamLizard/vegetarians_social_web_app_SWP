// Khoi's code (05/11/2026): test trạng thái mở cửa phía server, cùng các mốc giờ với
// client/src/components/FeedRails/shopStatus.test.js nhưng tính theo giờ Việt Nam (UTC+7).
const test = require('node:test');
const assert = require('node:assert/strict');
const { shopOpenInfo, shopStatusText, vietnamClock } = require('./shopOpen');

// 06/11/2026 là Thứ sáu (dayOfWeek = 5); 08/11/2026 là Chủ nhật (7).
const vn = (day, hour, minute) => new Date(Date.UTC(2026, 10, day, hour - 7, minute));
const daily = (slots) => [1, 2, 3, 4, 5, 6, 7].map((d) => ({ dayOfWeek: d, isClosed: false, slots }));
const text = (schedule, now) => shopStatusText(shopOpenInfo(schedule, now));

test('giờ Việt Nam: 01:00 UTC là 08:00 cùng ngày ở VN', () => {
  assert.deepEqual(vietnamClock(new Date('2026-11-06T01:00:00.000Z')), { minutes: 8 * 60, dayOfWeek: 5 });
  // 17:30 UTC ngày 05/11 = 00:30 ngày 06/11 ở VN (vẫn là Thứ sáu)
  assert.deepEqual(vietnamClock(new Date('2026-11-05T17:30:00.000Z')), { minutes: 30, dayOfWeek: 5 });
});

test('đang trong ca → Mở đến giờ đóng của ca hiện tại', () => {
  const two = daily([{ openTime: '06:00', closeTime: '10:00' }, { openTime: '17:00', closeTime: '22:00' }]);
  assert.equal(text(two, vn(6, 8, 0)), 'Mở đến 10:00');
  assert.equal(text(two, vn(6, 18, 0)), 'Mở đến 22:00');
});

test('còn ≤ 30 phút → Sắp đóng', () => {
  assert.equal(text(daily([{ openTime: '06:00', closeTime: '14:00' }]), vn(6, 13, 43)), 'Sắp đóng · 14:00');
});

test('nghỉ giữa 2 ca → giờ mở của CA KẾ TIẾP, không phải ca đầu ngày', () => {
  const two = daily([{ openTime: '06:00', closeTime: '10:00' }, { openTime: '17:00', closeTime: '22:00' }]);
  const info = shopOpenInfo(two, vn(6, 13, 43));
  assert.equal(shopStatusText(info), 'Đóng cửa · mở lúc 17:00');
  assert.equal(info.minutesToOpen, 17 * 60 - (13 * 60 + 43));
});

test('trước giờ mở trong ngày → mở lúc', () => {
  assert.equal(text(daily([{ openTime: '07:00', closeTime: '21:00' }]), vn(6, 5, 30)), 'Đóng cửa · mở lúc 07:00');
});

test('hết ca hôm nay → mai mở', () => {
  assert.equal(text(daily([{ openTime: '07:00', closeTime: '21:00' }]), vn(6, 22, 0)), 'Đóng cửa · mai mở 07:00');
});

test('hôm nay (Chủ nhật) nghỉ → báo ngày mở lại', () => {
  const weekdays = [1, 2, 3, 4, 5].map((d) => ({ dayOfWeek: d, isClosed: false, slots: [{ openTime: '08:00', closeTime: '20:00' }] }));
  assert.equal(text(weekdays, vn(8, 13, 43)), 'Nghỉ · mai mở 08:00'); // Chủ nhật
  assert.equal(text(weekdays, vn(7, 10, 0)), 'Nghỉ · mở Thứ hai 08:00'); // Thứ bảy
});

test('không có lịch → Chưa cập nhật giờ (xếp cuối)', () => {
  const info = shopOpenInfo([], vn(6, 12, 0));
  assert.equal(shopStatusText(info), 'Chưa cập nhật giờ');
  assert.equal(info.minutesToOpen, Infinity);
});
