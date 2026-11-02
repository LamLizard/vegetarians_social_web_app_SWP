// Khoi's code (01/11/2026): test trạng thái mở cửa khối "Quán chay đang mở". Chạy: node --test src/components/FeedRails/shopStatus.test.js
import assert from 'node:assert/strict';
import test from 'node:test';
import { shopOpenInfo, shopStatusText } from './shopStatus.js';

// 01/11/2026 là Chủ nhật (dayOfWeek = 7)
const at = (h, m, day = 1) => new Date(2026, 10, day, h, m);
const daily = (slots) => [1, 2, 3, 4, 5, 6, 7].map((d) => ({ dayOfWeek: d, isClosed: false, slots }));
const text = (schedule, now) => shopStatusText(shopOpenInfo(schedule, now));

test('đang trong ca → Mở đến giờ đóng của ca hiện tại', () => {
  const two = daily([{ openTime: '06:00', closeTime: '10:00' }, { openTime: '17:00', closeTime: '22:00' }]);
  assert.equal(text(two, at(8, 0)), 'Mở đến 10:00');
  assert.equal(text(two, at(18, 0)), 'Mở đến 22:00');
});

test('còn ≤ 30 phút → Sắp đóng', () => {
  assert.equal(text(daily([{ openTime: '06:00', closeTime: '14:00' }]), at(13, 43)), 'Sắp đóng · 14:00');
});

test('nghỉ giữa 2 ca → giờ mở của CA KẾ TIẾP, không phải ca đầu ngày', () => {
  const two = daily([{ openTime: '06:00', closeTime: '10:00' }, { openTime: '17:00', closeTime: '22:00' }]);
  const info = shopOpenInfo(two, at(13, 43));
  assert.equal(shopStatusText(info), 'Đóng cửa · mở lúc 17:00');
  assert.equal(info.minutesToOpen, 17 * 60 - (13 * 60 + 43));
});

test('trước giờ mở trong ngày → mở lúc', () => {
  assert.equal(text(daily([{ openTime: '07:00', closeTime: '21:00' }]), at(5, 30)), 'Đóng cửa · mở lúc 07:00');
});

test('hết ca hôm nay → mai mở', () => {
  assert.equal(text(daily([{ openTime: '07:00', closeTime: '21:00' }]), at(22, 0)), 'Đóng cửa · mai mở 07:00');
});

test('hôm nay (Chủ nhật) nghỉ → báo ngày mở lại', () => {
  const weekdays = [1, 2, 3, 4, 5].map((d) => ({ dayOfWeek: d, isClosed: false, slots: [{ openTime: '08:00', closeTime: '20:00' }] }));
  assert.equal(text(weekdays, at(13, 43)), 'Nghỉ · mai mở 08:00');
  assert.equal(text(weekdays, at(10, 0, 7)), 'Nghỉ · mở Thứ hai 08:00'); // Thứ bảy 07/11
});

test('không có lịch → Chưa cập nhật giờ (xếp cuối)', () => {
  const info = shopOpenInfo([], at(12, 0));
  assert.equal(shopStatusText(info), 'Chưa cập nhật giờ');
  assert.equal(info.minutesToOpen, Infinity);
});
