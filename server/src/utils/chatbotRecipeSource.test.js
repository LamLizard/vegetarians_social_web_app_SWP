// Khoi's code (06/11/2026): test thuần cho nguồn công thức của Mầm (không cần DB).
const test = require('node:test');
const assert = require('node:assert/strict');
const { formatAmount, missingQuantities } = require('./chatbotRecipeSource');

// Khoi's code (06/11/2026): mở rộng cách nói "chỉ/dạy/bày … làm", "làm … sao", "công thức (món) <tên món>".
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

// Khoi's code (06/11/2026): phải khớp cả SỐ + ĐƠN VỊ, "300 g" không tính là "0 g".
test('missingQuantities: so khớp cụm số + đơn vị, bỏ qua nguyên liệu không có đơn vị', () => {
  const ingredients = [
    { name: 'Đậu hũ', amount: '300.00', unit: 'g' },
    { name: 'Cà chua', amount: '2.00', unit: 'quả' },
    { name: 'Tỏi', amount: '2.00', unit: 'tép' },
    { name: 'Muối', amount: '1.00', unit: 'g' },
    { name: 'Nước tương', amount: '15.00', unit: 'ml' },
    { name: 'Hành lá', amount: null, unit: null },
  ];
  const thieu = missingQuantities('Dùng 300 g đậu hũ, 2 quả cà chua, 15 ml nước tương.', ingredients);
  assert.deepEqual(thieu.map((item) => item.name), ['Tỏi', 'Muối']);
  const du = missingQuantities('Dùng 300 g đậu hũ, 2 quả cà chua, 2 tép tỏi, 1 g muối, 15 ml nước tương.', ingredients);
  assert.deepEqual(du, []);
  // "300 g" không được coi là có "0 g"/"30 g"; "15 ml" không được coi là có "5 ml"
  assert.deepEqual(missingQuantities('Dùng 300 g đậu hũ, 2 quả cà chua, 2 tép tỏi, 15 ml nước tương.',
    [{ name: 'Muối', amount: '30.00', unit: 'g' }, { name: 'Dầu', amount: '5.00', unit: 'ml' }])
    .map((item) => item.name), ['Muối', 'Dầu']);
});
