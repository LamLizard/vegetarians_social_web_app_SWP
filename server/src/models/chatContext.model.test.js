// Khoi's code (05/11/2026): test phần thuần của chatContext.model (không cần DB).
const test = require('node:test');
const assert = require('node:assert/strict');
const { excludeAllergens, matchedAllergens, plain, findRecipesForChat } = require('./chatContext.model');
const { groupScheduleRows } = require('./shop.model');
const { shopOpenInfo, shopStatusText } = require('../utils/shopOpen');

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

// Khoi's code (11/11/2026): nêu đúng nguyên liệu trùng dị ứng của công thức bị loại.
test('matchedAllergens: trả tên nguyên liệu trùng dị ứng, không dấu/hoa thường, không trùng lặp', () => {
  const recipe = { ingredientNames: ['Đậu hũ', 'Cà chua', 'Hành tím', 'Hành lá', 'Hành lá'] };
  assert.deepEqual(matchedAllergens(recipe, ['hanh la']), ['Hành lá']);
  assert.deepEqual(matchedAllergens(recipe, ['HÀNH']), ['Hành tím', 'Hành lá']);
  assert.deepEqual(matchedAllergens(recipe, ['đậu phộng']), []);
  assert.deepEqual(matchedAllergens(recipe, []), []);
  assert.deepEqual(matchedAllergens(null, ['hành lá']), []);
});

test('excludeAllergens: chỉ xét nguyên liệu, không loại theo tiêu đề', () => {
  const items = [{ id: '1', title: 'Đậu hũ sốt cà', ingredientNames: ['Cà chua'] }];
  assert.deepEqual(excludeAllergens(items, ['đậu hũ']).map((item) => item.id), ['1']);
});

test('lịch quán: dạng phẳng SQL trả về → gom theo ngày đúng như API quán', () => {
  // ĐÚNG dạng json_agg của findOpenShops: mỗi ca một object phẳng.
  const rows = [
    { dayOfWeek: 1, isClosed: false, openTime: '08:00', closeTime: '11:30' },
    { dayOfWeek: 1, isClosed: false, openTime: '17:00', closeTime: '21:00' },
    { dayOfWeek: 2, isClosed: true, openTime: null, closeTime: null },
  ];
  const schedule = groupScheduleRows(rows);
  assert.deepEqual(schedule, [
    { dayOfWeek: 1, isClosed: false, slots: [{ openTime: '08:00', closeTime: '11:30' }, { openTime: '17:00', closeTime: '21:00' }] },
    { dayOfWeek: 2, isClosed: true, slots: [] },
  ]);
  // 09:00 thứ Hai (02/11/2026) → đang trong ca sáng
  assert.equal(shopStatusText(shopOpenInfo(schedule, new Date('2026-11-02T02:00:00Z'))), 'Mở đến 11:30');
  assert.equal(shopStatusText(shopOpenInfo(schedule, new Date('2026-11-02T11:00:00Z'))), 'Mở đến 21:00');
  assert.equal(shopStatusText(shopOpenInfo(schedule, new Date('2026-11-02T05:30:00Z'))), 'Đóng cửa · mở lúc 17:00');
  // quán chưa có lịch → câu "Chưa cập nhật giờ" (không phải đang mở)
  assert.equal(shopStatusText(shopOpenInfo(groupScheduleRows([]), new Date('2026-11-02T02:00:00Z'))), 'Chưa cập nhật giờ');
});

// Khoi's code (06/11/2026): controller gửi tối đa 6 term (MAX_RECIPE_TERMS) → SQL phải có đúng 6 tham số.
test('findRecipesForChat: nhận tối đa 6 term, tham số SQL khớp số term', async () => {
  const pool = require('../config/db');
  const original = pool.query;
  let captured = null;
  pool.query = async (sql, params) => { captured = { sql, params }; return { rows: [] }; };
  try {
    await findRecipesForChat(['một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy'], { limit: 3 });
  } finally {
    pool.query = original;
  }
  assert.equal(captured.params.length, 6);
  assert.equal(captured.params[0], 'một');
  assert.equal(captured.params[5], 'sáu');
  assert.ok(captured.sql.includes('$6'));
  assert.equal(captured.sql.includes('$7'), false);
});

// Khoi's code (13/11/2026): khớp trọn từ (không còn "hien" khớp "chien"); fillToLimit bỏ điều kiện lọc để bù món khác.
test('findRecipesForChat: khớp trọn từ; fillToLimit không lọc mà xếp món khớp trước', async () => {
  const pool = require('../config/db');
  const original = pool.query;
  const calls = [];
  pool.query = async (sql, params) => { calls.push({ sql, params }); return { rows: [] }; };
  try {
    await findRecipesForChat(['đậu hũ (non)'], { limit: 3 });
    await findRecipesForChat(['đậu hũ'], { limit: 10, fillToLimit: true });
  } finally {
    pool.query = original;
  }
  assert.equal(calls[0].params[0], 'đậu hũ non');
  assert.ok(calls[0].sql.includes("'(^|[^a-z0-9])'"));
  assert.equal(calls[0].sql.includes('position('), false);
  assert.ok(/WHERE r\.status = 'approved' AND \(/.test(calls[0].sql));
  assert.equal(/WHERE r\.status = 'approved' AND \(/.test(calls[1].sql), false);
  assert.ok(calls[1].sql.includes('DESC, random()'));
});
