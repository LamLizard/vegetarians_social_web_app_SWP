// Khoi's code (08/11/2026): test thuần cho điều kiện tìm bài trong chat — cụm chủ đề ở tiêu đề/nội dung.
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPhraseFilter } = require('./chatDiscovery.model');

test('buildPhraseFilter: một cụm → so khớp cả tiêu đề lẫn nội dung, tham số đúng vị trí', () => {
  const filter = buildPhraseFilter(['đậu hũ'], 2);
  assert.deepEqual(filter.values, ['%đậu hũ%', '%đậu hũ%']);
  assert.ok(filter.sql.includes("translate(lower(p.title)"));
  assert.ok(filter.sql.includes("translate(lower(p.content)"));
  assert.ok(filter.sql.includes('$2::text') && filter.sql.includes('$3::text'));
  // cụm giữ nguyên khoảng trắng (không tách từ) → khớp theo cụm liền nhau
  assert.equal(filter.values[0], '%đậu hũ%');
  assert.equal(filter.sql.includes(' AND '), false);
});

test('buildPhraseFilter: "đậu hủ" và "hũ đậu" là hai cụm khác nhau (SQL tự bỏ dấu)', () => {
  const a = buildPhraseFilter(['đậu hủ'], 2);
  const b = buildPhraseFilter(['hũ đậu'], 2);
  assert.deepEqual(a.values, ['%đậu hủ%', '%đậu hủ%']);
  assert.deepEqual(b.values, ['%hũ đậu%', '%hũ đậu%']);
  assert.notDeepEqual(a.values, b.values);
});

test('buildPhraseFilter: nhiều cụm nối bằng OR, tham số tăng dần', () => {
  const filter = buildPhraseFilter(['đậu hũ', 'đậu phụ'], 2);
  assert.deepEqual(filter.values, ['%đậu hũ%', '%đậu hũ%', '%đậu phụ%', '%đậu phụ%']);
  for (const p of ['$2::text', '$3::text', '$4::text', '$5::text']) assert.ok(filter.sql.includes(p), p);
  assert.equal(filter.sql.split(' OR ').length, 4);
  assert.ok(filter.rank.startsWith('(CASE WHEN ('));
});

test('buildPhraseFilter: xếp hạng tiêu đề trước nội dung', () => {
  const filter = buildPhraseFilter(['đậu'], 1);
  assert.ok(filter.rank.includes('THEN 2 WHEN'));
  assert.ok(filter.rank.indexOf("p.title") < filter.rank.indexOf("p.content"));
});

test('buildPhraseFilter: cụm rỗng → không lọc gì, escape % và _', () => {
  assert.deepEqual(buildPhraseFilter(['   '], 1), { sql: '', rank: '', values: [] });
  assert.deepEqual(buildPhraseFilter([], 1), { sql: '', rank: '', values: [] });
  assert.deepEqual(buildPhraseFilter(['50%'], 1).values, ['%50\\%%', '%50\\%%']);
  assert.deepEqual(buildPhraseFilter(['a_b'], 1).values, ['%a\\_b%', '%a\\_b%']);
});

test('buildPhraseFilter: startIndex đổi thì số tham số đổi theo', () => {
  const filter = buildPhraseFilter(['một hai'], 5);
  assert.ok(filter.sql.includes('$5::text') && filter.sql.includes('$6::text'));
});
