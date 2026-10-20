// Khoi's code: Test kiểm tra dữ liệu Tạo công thức. Chạy: node --test src/utils/recipeInput.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseRecipeInput, parseCheckNames, RecipeInputError } = require('./recipeInput');

const CLOUD = 'demo-cloud';
const IMG = `https://res.cloudinary.com/${CLOUD}/image/upload/v1/greenbowl/recipes/abc.jpg`;
const base = (over = {}) => ({
  dishId: '1',
  title: 'Đậu hũ sốt cà',
  ingredients: [{ name: 'Đậu hũ', amount: 200, unit: 'g' }],
  instructions: 'Chiên đậu\nNấu sốt',
  ...over,
});
const parse = (body) => parseRecipeInput(body, { cloudName: CLOUD });
const rejects = (body, re) => assert.throws(() => parse(body), (e) => e instanceof RecipeInputError && re.test(e.message));

test('hợp lệ tối thiểu: các trường tuỳ chọn về null, cắt/gộp khoảng trắng', () => {
  assert.deepEqual(parse(base({ title: '  Đậu  hũ   sốt cà ' })), {
    dishId: '1', proposedDishName: null, title: 'Đậu hũ sốt cà', description: null, thumbnailUrl: null, youtubeUrl: null,
    servings: null, prepTimeMinutes: null, cookTimeMinutes: null, caloriesKcal: null,
    proteinG: null, carbG: null, fatG: null, fiberG: null, sugarG: null, sodiumMg: null,
    ingredients: [{ name: 'Đậu hũ', amount: 200, unit: 'g' }], instructions: 'Chiên đậu\nNấu sốt',
  });
});

test('món: phải chọn đúng 1 trong 2 (dishId hoặc proposedDishName)', () => {
  rejects(base({ dishId: undefined }), /Chọn một món/);
  rejects(base({ proposedDishName: 'Bánh xèo chay' }), /Chọn một món/);
  rejects(base({ dishId: 'abc' }), /Món ăn không hợp lệ/);
  rejects(base({ dishId: '0' }), /Món ăn không hợp lệ/);
  const p = parse(base({ dishId: null, proposedDishName: '  Bánh   xèo chay ' }));
  assert.equal(p.dishId, null);
  assert.equal(p.proposedDishName, 'Bánh xèo chay');
  rejects(base({ dishId: null, proposedDishName: 'a'.repeat(201) }), /tối đa 200/);
});

test('tên công thức + cách làm bắt buộc, giới hạn độ dài theo ký tự', () => {
  rejects(base({ title: '   ' }), /Nhập tên công thức/);
  rejects(base({ title: 'ộ'.repeat(256) }), /tối đa 255/);
  assert.equal(parse(base({ title: 'ộ'.repeat(255) })).title.length, 255);
  rejects(base({ instructions: '' }), /ít nhất 1 bước/);
  rejects(base({ instructions: 123 }), /ít nhất 1 bước/);
});

test('ảnh bìa: chỉ nhận link Cloudinary của nhóm', () => {
  assert.equal(parse(base({ thumbnailUrl: IMG })).thumbnailUrl, IMG);
  assert.equal(parse(base({ thumbnailUrl: '' })).thumbnailUrl, null);
  rejects(base({ thumbnailUrl: 'https://evil.com/a.jpg' }), /Ảnh bìa không hợp lệ/);
  assert.throws(() => parseRecipeInput(base({ thumbnailUrl: IMG }), {}), RecipeInputError);
});

test('khẩu phần 1–20, thời gian 0–600, số nguyên', () => {
  const p = parse(base({ servings: 4, prepTimeMinutes: '15', cookTimeMinutes: 0 }));
  assert.deepEqual([p.servings, p.prepTimeMinutes, p.cookTimeMinutes], [4, 15, 0]);
  rejects(base({ servings: 0 }), /Khẩu phần/);
  rejects(base({ servings: 2.5 }), /Khẩu phần/);
  rejects(base({ cookTimeMinutes: 601 }), /Thời gian nấu/);
  rejects(base({ prepTimeMinutes: -1 }), /Thời gian chuẩn bị/);
});

test('nguyên liệu: đơn vị "ít"/"vừa đủ" bỏ số lượng, đơn vị khác phải có số lượng', () => {
  const p = parse(base({ ingredients: [
    { name: 'Đậu hũ', amount: '0,5', unit: 'kg' },
    { name: 'Muối', amount: 3, unit: 'Vừa đủ' },
    { name: 'Tiêu', amount: null, unit: '' },
  ] }));
  assert.deepEqual(p.ingredients, [
    { name: 'Đậu hũ', amount: 0.5, unit: 'kg' },
    { name: 'Muối', amount: null, unit: 'Vừa đủ' },
    { name: 'Tiêu', amount: null, unit: null },
  ]);
  rejects(base({ ingredients: [{ name: 'Đậu hũ', amount: 1, unit: 'g' }, { name: 'Sả', amount: null, unit: 'cây' }] }), /Nhập số lượng cho “Sả”/);
});

test('nguyên liệu: trùng tên (không phân biệt hoa/thường), thiếu tên, số lượng sai', () => {
  rejects(base({ ingredients: [{ name: 'Đậu hũ', amount: 1 }, { name: 'đậu  HŨ', amount: 2 }] }), /bị trùng/);
  rejects(base({ ingredients: [{ name: '  ', amount: 1 }] }), /chưa có tên/);
  rejects(base({ ingredients: [{ name: 'Đậu hũ', amount: 0 }] }), /lớn hơn 0/);
  rejects(base({ ingredients: [{ name: 'Đậu hũ', amount: 0.001 }] }), /quá nhỏ/);
  rejects(base({ ingredients: [{ name: 'Đậu hũ', amount: 1e7 }] }), /quá lớn/);
  rejects(base({ ingredients: [{ name: 'Muối', amount: null, unit: 'ít' }] }), /ít nhất 1 nguyên liệu có số lượng/);
  rejects(base({ ingredients: [] }), /ít nhất 1 nguyên liệu/);
  rejects(base({ ingredients: Array.from({ length: 41 }, (_, i) => ({ name: `NL ${i}`, amount: 1 })) }), /Tối đa 40/);
});

test('không nhận status / authorId từ client', () => {
  const p = parse(base({ status: 'approved', authorId: '99' }));
  assert.equal('status' in p, false);
  assert.equal('authorId' in p, false);
});

test('parseCheckNames: bỏ rỗng, bỏ trùng, gộp khoảng trắng', () => {
  assert.deepEqual(parseCheckNames(['Đậu hũ', ' đậu hũ ', '', null, 'Chả  cá chay']), ['Đậu hũ', 'Chả cá chay']);
  assert.throws(() => parseCheckNames('Đậu hũ'), RecipeInputError);
});

// Khoi's code: 3 trường tuỳ chọn (15/10/2026)
test('mô tả, link YouTube, calo: tuỳ chọn, kiểm tra giới hạn', () => {
  const p = parse(base({ description: '  Món nhẹ cho bữa sáng  ', youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', caloriesKcal: '350' }));
  assert.equal(p.description, 'Món nhẹ cho bữa sáng');
  assert.equal(p.youtubeUrl, 'https://youtu.be/dQw4w9WgXcQ');
  assert.equal(p.caloriesKcal, 350);
  assert.equal(parse(base({ description: '   ', youtubeUrl: '' })).description, null);
  rejects(base({ description: 'a'.repeat(1001) }), /Mô tả tối đa 1000/);
  rejects(base({ youtubeUrl: 'https://vimeo.com/123' }), /Link YouTube không hợp lệ/);
  rejects(base({ caloriesKcal: 0 }), /Calo phải là số nguyên từ 1 đến 5000/);
  rejects(base({ caloriesKcal: 12.5 }), /Calo/);
});

// Khoi's code: khẩu phần + thời gian bắt buộc ở form Tạo công thức; dinh dưỡng tuỳ chọn (15/10/2026)
test('requireMeta: bắt buộc khẩu phần, chuẩn bị, nấu — cho phép 0 phút, không nhận số âm', () => {
  const strict = (body) => parseRecipeInput(body, { cloudName: CLOUD, requireMeta: true });
  const meta = { servings: 2, prepTimeMinutes: 0, cookTimeMinutes: 15 };
  assert.equal(strict(base(meta)).prepTimeMinutes, 0);
  assert.throws(() => strict(base({ ...meta, servings: undefined })), /Nhập khẩu phần/);
  assert.throws(() => strict(base({ ...meta, prepTimeMinutes: '' })), /thời gian chuẩn bị/);
  assert.throws(() => strict(base({ ...meta, cookTimeMinutes: null })), /thời gian nấu/);
  assert.throws(() => strict(base({ ...meta, cookTimeMinutes: -5 })), /Thời gian nấu phải là số nguyên từ 0/);
  assert.equal(parse(base()).servings, null); // Admin (không requireMeta) vẫn được bỏ trống
});

test('dinh dưỡng: tuỳ chọn, không âm, làm tròn', () => {
  const p = parse(base({ proteinG: '12,55', fiberG: 3, sodiumMg: 450.7 }));
  assert.equal(p.proteinG, 12.6);
  assert.equal(p.fiberG, 3);
  assert.equal(p.sodiumMg, 451);
  assert.equal(p.carbG, null);
  rejects(base({ fatG: -1 }), /Chất béo phải là số từ 0 đến 1000/);
  rejects(base({ sodiumMg: 'abc' }), /Natri/);
});

test('strictUnits: chỉ nhận đơn vị trong bộ chuẩn và lưu đúng tên chuẩn', () => {
  const strict = { cloudName: CLOUD, strictUnits: true };
  const ok = parseRecipeInput(base({ ingredients: [{ name: 'Đậu hũ', amount: 2, unit: 'Muỗng Canh' }, { name: 'Muối', unit: 'Vừa đủ' }] }), strict);
  assert.deepEqual(ok.ingredients, [
    { name: 'Đậu hũ', amount: 2, unit: 'muỗng canh' },
    { name: 'Muối', amount: null, unit: 'vừa đủ' },
  ]);
  assert.throws(() => parseRecipeInput(base({ ingredients: [{ name: 'Sả', amount: 1, unit: 'cây' }] }), strict), /không có trong danh sách/);
  // Không bật strictUnits (luồng Admin) → đơn vị tự do vẫn nhận như cũ
  assert.equal(parseRecipeInput(base({ ingredients: [{ name: 'Sả', amount: 1, unit: 'cây' }] }), { cloudName: CLOUD }).ingredients[0].unit, 'cây');
});
