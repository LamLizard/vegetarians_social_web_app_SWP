// Khoi's code (01/11/2026): cursor Bảng tin cho Mới nhất / Nhiều tim (không cần DB).
const test = require('node:test');
const assert = require('node:assert/strict');
const { FEED_SORTS, parseFeedCursor, buildFeedCursor } = require('./feedCursor');

test('2 cách sắp xếp', () => {
  assert.deepEqual(FEED_SORTS, ['new', 'top']);
});

test('Mới nhất: cursor cũ vẫn dùng được', () => {
  assert.deepEqual(parseFeedCursor('1790650000000000_12'), { time: '1790650000000000', id: '12' });
  assert.equal(buildFeedCursor({ sortKey: '1790650000000000', id: '12', voteCount: 5 }), '1790650000000000_12');
});

test('Nhiều tim: cursor có thêm số tim, đi vòng build → parse không đổi', () => {
  const row = { voteCount: 47, sortKey: '1790650000000000', id: '95' };
  const cursor = buildFeedCursor(row, 'top');
  assert.equal(cursor, '47_1790650000000000_95');
  assert.deepEqual(parseFeedCursor(cursor, 'top'), { votes: '47', time: '1790650000000000', id: '95' });
});

test('cursor không khớp cách sắp xếp hoặc sai định dạng → null', () => {
  assert.equal(parseFeedCursor('47_1790650000000000_95', 'new'), null);
  assert.equal(parseFeedCursor('1790650000000000_12', 'top'), null);
  assert.equal(parseFeedCursor('abc', 'new'), null);
  assert.equal(parseFeedCursor('1_2_0', 'top'), null);
  assert.equal(parseFeedCursor('1_2', 'hot'), null);
});
