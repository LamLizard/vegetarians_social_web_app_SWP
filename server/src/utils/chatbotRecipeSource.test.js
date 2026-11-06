// Khoi's code (06/11/2026): test thuần cho nguồn công thức của Mầm (không cần DB).
const test = require('node:test');
const assert = require('node:assert/strict');
const { isHowToCook, pickSourceRecipe, formatAmount, missingQuantities } = require('./chatbotRecipeSource');

test('isHowToCook: nhận câu hỏi cách làm, có dấu và không dấu', () => {
  for (const text of ['Hướng dẫn cách làm Đậu hũ sốt cà chua', 'cach lam dau hu sot ca chua',
    'Cách nấu canh chua chay', 'huong dan nau pho chay', 'Cho mình công thức bánh xèo',
    'Làm món gì nhanh với đậu hũ', 'nau mon chay cho 4 người']) {
    assert.equal(isHowToCook(text), true, text);
  }
  for (const text of ['Gợi ý món chay với đậu hũ', 'Đậu hũ bao nhiêu calo?', 'Quán chay nào đang mở?']) {
    assert.equal(isHowToCook(text), false, text);
  }
});

test('pickSourceRecipe: chỉ nhận khi TOÀN BỘ tiêu đề nằm trong câu hỏi', () => {
  const recipes = [
    { id: '40', title: 'Đậu hũ sốt cà chua', likeCount: 1 },
    { id: '44', title: 'Gỏi cuốn chay đậu hũ rau sống', likeCount: 0 },
    { id: '41', title: 'Chả nấm chay', likeCount: 3 },
  ];
  assert.equal(pickSourceRecipe('Hướng dẫn cách làm đậu hũ sốt cà chua', recipes)?.id, '40');
  assert.equal(pickSourceRecipe('hướng dẫn cách làm ĐẬU HŨ SỐT CÀ CHUA ngon', recipes)?.id, '40');
  // "đậu hũ" không phải toàn bộ tiêu đề → không chọn
  assert.equal(pickSourceRecipe('Hướng dẫn cách làm đậu hũ', recipes), null);
  assert.equal(pickSourceRecipe('Hướng dẫn cách làm bánh xèo chay nấm', recipes), null);
});

test('pickSourceRecipe: nhiều bài khớp → tiêu đề dài nhất, rồi nhiều tim hơn', () => {
  const recipes = [
    { id: '1', title: 'Đậu hũ', likeCount: 9 },
    { id: '2', title: 'Đậu hũ sốt cà chua', likeCount: 1 },
    { id: '3', title: 'Đậu hũ sốt cà chua', likeCount: 5 },
  ];
  assert.equal(pickSourceRecipe('cách làm đậu hũ sốt cà chua', recipes)?.id, '3');
  assert.equal(pickSourceRecipe('cách làm đậu hũ', recipes)?.id, '1');
});

test('formatAmount: bỏ số 0 thừa, dấu phẩy kiểu Việt Nam', () => {
  assert.equal(formatAmount('300.00'), '300');
  assert.equal(formatAmount('0.50'), '0,5');
  assert.equal(formatAmount('1.25'), '1,25');
  assert.equal(formatAmount('2'), '2');
  assert.equal(formatAmount(null), '');
  assert.equal(formatAmount('không phải số'), '');
});

test('missingQuantities: bắt cả dạng "0,5" và "0.5"', () => {
  const ingredients = [
    { name: 'Đậu hũ', amount: '300.00', unit: 'g' },
    { name: 'Đường', amount: '0.50', unit: 'thìa' },
    { name: 'Muối', amount: '1.00', unit: 'g' },
  ];
  assert.deepEqual(missingQuantities('Dùng 300 g đậu hũ, 0,5 thìa đường, 1 g muối.', ingredients), []);
  assert.deepEqual(missingQuantities('Dùng 300 g đậu hũ và 1 g muối.', ingredients).map((item) => item.name), ['Đường']);
  assert.deepEqual(missingQuantities('Dùng 300 g đậu hũ, 0.5 thìa đường và 1 g muối.', ingredients), []);
  assert.deepEqual(missingQuantities('', ingredients).map((item) => item.name), ['Đậu hũ', 'Đường', 'Muối']);
});
