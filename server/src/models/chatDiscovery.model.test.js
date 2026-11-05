// Khoi's code (05/11/2026): test thuần cho tách từ khoá và dựng điều kiện tìm bài trong chat.
const test = require('node:test');
const assert = require('node:assert/strict');
const { splitSearchWords, buildChatPostFilter } = require('./chatDiscovery.model');

test('splitSearchWords: tách theo từ, bỏ dấu câu, bỏ trùng, bỏ từ 1 ký tự', () => {
  assert.deepEqual(splitSearchWords('đậu hủ'), ['đậu', 'hủ']);
  assert.deepEqual(splitSearchWords('hũ đậu'), ['hũ', 'đậu']);
  assert.deepEqual(splitSearchWords('  Đậu   Hũ  '), ['đậu', 'hũ']);
  assert.deepEqual(splitSearchWords('đậu, hũ!'), ['đậu', 'hũ']);
  assert.deepEqual(splitSearchWords('đậu đậu hủ'), ['đậu', 'hủ']);
  assert.deepEqual(splitSearchWords('a b đậu'), ['đậu']);
  assert.deepEqual(splitSearchWords(''), []);
  assert.deepEqual(splitSearchWords(null), []);
  assert.deepEqual(splitSearchWords('một hai ba bốn năm sáu bảy'), ['một', 'hai', 'ba', 'bốn', 'năm']);
});

test('buildChatPostFilter: mỗi từ một điều kiện, ghép AND, tham số bắt đầu đúng vị trí', () => {
  const filter = buildChatPostFilter('hũ đậu', 2);
  assert.deepEqual(filter.words, ['hũ', 'đậu']);
  assert.equal(filter.values.length, 6);
  assert.deepEqual(filter.values.slice(0, 3), ['%hũ%', '%hũ%', '%hũ%']);
  assert.deepEqual(filter.values.slice(3), ['%đậu%', '%đậu%', '%đậu%']);
  // mỗi từ đóng góp đúng 1 điều kiện nội dung (searchWhere có chữ AND bên trong nên đếm theo p.content)
  assert.equal(filter.sql.split('translate(lower(p.content)').length - 1, 2);
  assert.ok(filter.sql.indexOf(') AND (') > 0);
  for (const marker of ['$2::text', '$3::text', '$4::text', '$5::text', '$6::text', '$7::text']) {
    assert.ok(filter.sql.includes(marker), marker);
  }
  assert.ok(filter.sql.includes('translate(lower(p.title)'));
  assert.ok(filter.sql.includes('translate(lower(p.content)'));
  assert.ok(filter.sql.includes('post_category'));
});

// cùng phép bỏ dấu mà SQL đang dùng (translate + lower) để so sánh nghĩa của điều kiện
const foldJs = (text) => String(text).toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

test('buildChatPostFilter: "đậu hủ" và "hũ đậu" cho cùng bộ từ sau khi bỏ dấu', () => {
  const a = buildChatPostFilter('đậu hủ', 2);
  const b = buildChatPostFilter('hũ đậu', 2);
  assert.deepEqual(a.words, ['đậu', 'hủ']);
  assert.deepEqual(b.words, ['hũ', 'đậu']);
  assert.equal(a.values.length, 6);
  assert.equal(b.values.length, 6);
  assert.deepEqual(a.values.map(foldJs).sort(), b.values.map(foldJs).sort());
  assert.equal(a.sql.split('translate(lower(p.content)').length, b.sql.split('translate(lower(p.content)').length);
});

test('buildChatPostFilter: một từ hoặc rỗng', () => {
  const one = buildChatPostFilter('đậu', 1);
  assert.equal(one.words.length, 1);
  assert.equal(one.values.length, 3);
  assert.equal(one.sql.split('translate(lower(p.content)').length - 1, 1);
  const empty = buildChatPostFilter('   ', 1);
  assert.deepEqual(empty.words, []);
  assert.equal(empty.sql, '');
  assert.deepEqual(empty.values, []);
});

test('buildChatPostFilter: startIndex đổi thì số tham số đổi theo', () => {
  const filter = buildChatPostFilter('một hai', 5);
  assert.ok(filter.sql.includes('$5::text'));
  assert.ok(filter.sql.includes('$10::text'));
});
