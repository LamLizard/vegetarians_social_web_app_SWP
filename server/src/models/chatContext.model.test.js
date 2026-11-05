// Khoi's code (05/11/2026): test phần thuần của chatContext.model (không cần DB).
const test = require('node:test');
const assert = require('node:assert/strict');
const { excludeAllergens, plain } = require('./chatContext.model');

test('plain: bỏ dấu tiếng Việt giống fold() của postSearch', () => {
  assert.equal(plain('Đậu hũ sốt cà chua'), 'dau hu sot ca chua');
  assert.equal(plain('  '), '  ');
  assert.equal(plain(null), '');
});

test('excludeAllergens: bỏ công thức có nguyên liệu trùng dị ứng (không phân biệt dấu/hoa thường)', () => {
  const items = [
    { id: '1', ingredientNames: ['Đậu hũ', 'Cà chua'] },
    { id: '2', ingredientNames: ['Nấm đùi gà'] },
    { id: '3', ingredientNames: ['Dầu đậu phộng'] },
  ];
  assert.deepEqual(excludeAllergens(items, []).map((item) => item.id), ['1', '2', '3']);
  assert.deepEqual(excludeAllergens(items, ['DAU HU']).map((item) => item.id), ['2', '3']);
  assert.deepEqual(excludeAllergens(items, ['đậu phộng', 'nấm']).map((item) => item.id), ['1']);
  assert.deepEqual(excludeAllergens(items, ['   ', '']).map((item) => item.id), ['1', '2', '3']);
  assert.deepEqual(excludeAllergens([], ['đậu hũ']), []);
});

test('excludeAllergens: chỉ xét nguyên liệu, không loại theo tiêu đề', () => {
  const items = [{ id: '1', title: 'Đậu hũ sốt cà', ingredientNames: ['Cà chua'] }];
  assert.deepEqual(excludeAllergens(items, ['đậu hũ']).map((item) => item.id), ['1']);
});
