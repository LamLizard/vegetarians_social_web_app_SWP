// Khoi's code (06/11/2026): test "đã ăn" của khối Calo hôm nay. Chạy: node --test src/components/FeedRails/eatenMeals.test.js
import assert from 'node:assert/strict';
import test from 'node:test';
import { EATEN_PREFIX, readEaten, summarizeMeals, toggleEaten, writeEaten } from './eatenMeals.js';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    get length() { return data.size; },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    dump: () => Object.fromEntries(data),
  };
}

const ITEMS = [
  { id: '1', mealSlot: 'lunch', recipeName: 'Chả nấm chay', caloriesKcal: 350 },
  { id: '2', mealSlot: 'breakfast', recipeName: 'Chả nấm chay', caloriesKcal: 350 },
  { id: '3', mealSlot: 'breakfast', recipeName: 'Đậu hũ sốt cà chua', caloriesKcal: 300 },
  { id: '4', mealSlot: 'snack', recipeName: 'Mì Ý', caloriesKcal: null },
];

test('ghi rồi đọc lại đúng ngày; khác ngày → trống', () => {
  const storage = memoryStorage();
  writeEaten(storage, '77', '2026-11-06', ['2']);
  assert.deepEqual(readEaten(storage, '77', '2026-11-06', ['1', '2', '3']), ['2']);
  assert.deepEqual(readEaten(storage, '77', '2026-11-07', ['1', '2', '3']), []);
});

test('bỏ id không còn trong thực đơn; dữ liệu hỏng không ném lỗi', () => {
  const storage = memoryStorage({ [`${EATEN_PREFIX}77`]: JSON.stringify({ date: '2026-11-06', ids: ['2', '9'] }) });
  assert.deepEqual(readEaten(storage, '77', '2026-11-06', ['1', '2']), ['2']);
  storage.setItem(`${EATEN_PREFIX}77`, '{hỏng');
  assert.deepEqual(readEaten(storage, '77', '2026-11-06', ['1', '2']), []);
  assert.deepEqual(readEaten(null, '77', '2026-11-06', ['1']), []);
});

test('ghi ngày mới thì dọn bản ghi ngày cũ; bỏ tích hết thì xoá khoá', () => {
  const storage = memoryStorage({ [`${EATEN_PREFIX}70`]: JSON.stringify({ date: '2026-11-05', ids: ['5'] }), other: 'x' });
  writeEaten(storage, '77', '2026-11-06', ['1']);
  assert.deepEqual(Object.keys(storage.dump()).sort(), [`${EATEN_PREFIX}77`, 'other']);
  writeEaten(storage, '77', '2026-11-06', []);
  assert.deepEqual(Object.keys(storage.dump()), ['other']);
});

test('toggleEaten bật/tắt và không sửa mảng cũ', () => {
  const ids = ['1'];
  assert.deepEqual(toggleEaten(ids, 2), ['1', '2']);
  assert.deepEqual(toggleEaten(ids, '1'), []);
  assert.deepEqual(ids, ['1']);
});

test('summarizeMeals: nhóm theo bữa Sáng → Trưa → Phụ, cộng calo đã ăn', () => {
  const result = summarizeMeals(ITEMS, ['2'], 2870);
  assert.deepEqual(result.slots.map((group) => group.label), ['Sáng', 'Trưa', 'Phụ']);
  assert.deepEqual(result.slots[0].items.map((item) => item.done), [true, false]);
  assert.equal(result.slots[0].eatenKcal, 350);
  assert.equal(result.slots[0].totalKcal, 650);
  assert.equal(result.eatenKcal, 350);
  assert.equal(result.eatenCount, 1);
  assert.equal(result.total, 1000);
  assert.equal(result.goal, 2870);
  assert.equal(result.hasTarget, true);
});

test('summarizeMeals: thực đơn không có mục tiêu → mục tiêu = tổng calo thực đơn', () => {
  const result = summarizeMeals(ITEMS, [], 0);
  assert.equal(result.goal, 1000);
  assert.equal(result.hasTarget, false);
  assert.equal(result.eatenKcal, 0);
});
