// Khoi's code: Test soi từ động vật. Chạy: node --test src/utils/animalWords.test.js
// Danh sách thật nằm ở banned_keyword (category 'animal'); test dùng danh sách nhỏ giống dữ liệu đó.
const test = require('node:test');
const assert = require('node:assert/strict');
const { findAnimalWord, animalWarnings } = require('./animalWords');

const WORDS = ['thịt', 'bò', 'gà', 'cá', 'trứng', 'sữa bò', 'mắm', 'nước mắm', 'mật ong', 'bạch tuộc'];

test('khớp nguyên từ, không phân biệt hoa/thường, bỏ dấu câu', () => {
  assert.equal(findAnimalWord('Chả cá chay', WORDS), 'cá');
  assert.equal(findAnimalWord('chả  CÁ-chay', WORDS), 'cá');
  assert.equal(findAnimalWord('trứng gà', WORDS), 'trứng');
  assert.equal(findAnimalWord('Thịt bò viên chay', WORDS), 'thịt');
  assert.equal(findAnimalWord('Sữa bò tươi', WORDS), 'sữa bò');
  assert.equal(findAnimalWord('Nước mắm chay', WORDS), 'nước mắm');
});

test('không khớp chữ giống nhưng khác dấu / nằm trong từ khác', () => {
  assert.equal(findAnimalWord('Cà chua', WORDS), null);
  assert.equal(findAnimalWord('Các loại rau', WORDS), null);
  assert.equal(findAnimalWord('Cải bó xôi', WORDS), null);
  assert.equal(findAnimalWord('', WORDS), null);
  assert.equal(findAnimalWord('Chả cá chay', []), null);
});

test('cụm nhiều từ', () => {
  assert.equal(findAnimalWord('Mật ong rừng', WORDS), 'mật ong');
  assert.equal(findAnimalWord('Bạch tuộc chay', WORDS), 'bạch tuộc');
  assert.equal(findAnimalWord('Mật mía', WORDS), null);
});

test('animalWarnings: chỉ trả ô có từ động vật', () => {
  assert.deepEqual(animalWarnings([
    { field: 'title', label: 'Tên công thức', text: 'Cá kho chay' },
    { field: 'dish', label: 'Món đề xuất', text: 'Đậu hũ sốt cà' },
  ], WORDS), [{ field: 'title', label: 'Tên công thức', text: 'Cá kho chay', keyword: 'cá' }]);
});
