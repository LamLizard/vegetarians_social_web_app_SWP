const test = require('node:test');
const assert = require('node:assert/strict');
const { DishInputError, getDishDecision, normalizeDishInput } = require('./dish');

// Duy's code: Kiểm tra chuẩn hóa tên/mô tả và loại bỏ category ID trùng lặp.
test('normalizes a dish and requires valid category references', () => {
  assert.deepEqual(normalizeDishInput({
    name: '  Bún   riêu chay ',
    description: '  Nước dùng rau củ. ',
    thumbnailUrl: 'https://images.example.com/bun-rieu.jpg',
    categoryIds: ['2', 2, '4'],
  }), {
    name: 'Bún riêu chay',
    description: 'Nước dùng rau củ.',
    thumbnailUrl: 'https://images.example.com/bun-rieu.jpg',
    categoryIds: [2, 4],
  });
});

// Duy's code: Xác nhận đầu vào thiếu category hoặc dùng URL ảnh không HTTPS bị từ chối.
test('rejects dish inputs without a valid category or HTTPS image', () => {
  assert.throws(() => normalizeDishInput({ name: 'Món chay', categoryIds: [] }), DishInputError);
  assert.throws(() => normalizeDishInput({
    name: 'Món chay',
    thumbnailUrl: 'http://images.example.com/dish.jpg',
    categoryIds: [1],
  }), DishInputError);
});

// Duy's code: Chỉ cho phép trạng thái duyệt/reject của phạm vi Sprint 2.
test('maps decisions only to Sprint 2 dish statuses and event types', () => {
  assert.equal(getDishDecision('approve').status, 'active');
  assert.equal(getDishDecision('reject').status, 'rejected');
  assert.throws(() => getDishDecision('hide'), DishInputError);
});
