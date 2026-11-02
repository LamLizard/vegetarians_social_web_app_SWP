import assert from 'node:assert/strict';
import test from 'node:test';
import { hasRealPhoto, localDateKey, pickForDay } from './dailyPick.js';

// Khoi's code (01/11/2026): "Hôm nay ăn gì?" phải cố định trong ngày và đổi khi sang ngày mới.
const items = Array.from({ length: 12 }, (_, i) => ({ id: String(i + 1) }));
const ids = (list) => list.map((it) => it.id);

test('same day gives the same pick, regardless of input order', () => {
  const a = pickForDay(items, 4, '2026-11-01');
  const b = pickForDay([...items].reverse(), 4, '2026-11-01');
  assert.deepEqual(ids(a), ids(b));
  assert.equal(a.length, 4);
  assert.equal(new Set(ids(a)).size, 4);
});

test('different days give a different pick', () => {
  const days = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'].map((d) => ids(pickForDay(items, 4, d)).join(','));
  assert.ok(new Set(days).size > 1);
});

test('fewer items than requested returns them all', () => {
  assert.equal(pickForDay(items.slice(0, 2), 4, '2026-11-01').length, 2);
  assert.deepEqual(pickForDay([], 4, '2026-11-01'), []);
});

test('localDateKey uses local calendar date', () => {
  assert.equal(localDateKey(new Date(2026, 10, 1, 0, 30)), '2026-11-01');
});

test('picsum seed images are not real photos', () => {
  assert.equal(hasRealPhoto('https://picsum.photos/seed/greenbowl-dish-1/800/600'), false);
  assert.equal(hasRealPhoto('https://res.cloudinary.com/x/image/upload/a.jpg'), true);
  assert.equal(hasRealPhoto(null), false);
});
