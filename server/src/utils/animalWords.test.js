// Khoi's code: Test soi từ động vật. Chạy: node --test src/utils/animalWords.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { findAnimalWord } = require('./animalWords');

test('khớp nguyên từ, không phân biệt hoa/thường, bỏ dấu câu', () => {
  assert.equal(findAnimalWord('Chả cá chay'), 'cá');
  assert.equal(findAnimalWord('chả  CÁ-chay'), 'cá');
  assert.equal(findAnimalWord('trứng gà'), 'trứng');
  assert.equal(findAnimalWord('Thịt bò viên chay'), 'thịt');
  assert.equal(findAnimalWord('Sữa bò tươi'), 'sữa bò');
  assert.equal(findAnimalWord('Nước mắm chay'), 'nước mắm');
});

test('không khớp chữ giống nhưng khác dấu / nằm trong từ khác', () => {
  assert.equal(findAnimalWord('Cà chua'), null);
  assert.equal(findAnimalWord('Các loại rau'), null);
  assert.equal(findAnimalWord('Cải bó xôi'), null);
  assert.equal(findAnimalWord('Tàu hũ ky'), null);
  assert.equal(findAnimalWord(''), null);
});

test('cụm nhiều từ', () => {
  assert.equal(findAnimalWord('Mật ong rừng'), 'mật ong');
  assert.equal(findAnimalWord('Bạch tuộc chay'), 'bạch tuộc');
  assert.equal(findAnimalWord('Mật mía'), null);
});
