// Khoi's code: Kiểm tra dữ liệu form Tạo công thức (POST /api/recipes) — hàm thuần, không gọi DB, dễ test.
// Luật giống form ở client/src/pages/RecipeCreatePage.jsx + utils/ingredient.js, để gọi thẳng API cũng không lọt dữ liệu sai.
// Không nhận status / authorId từ client: công thức mới luôn 'pending', tác giả lấy từ token.

const MAX_TITLE = 255;            // recipe.title VARCHAR(255)
const MAX_DISH_NAME = 200;        // dish.name VARCHAR(200) = recipe.proposed_dish_name
const MAX_URL = 500;              // recipe.thumbnail_url VARCHAR(500)
const MAX_INGREDIENT_NAME = 120;  // ingredient.name VARCHAR(120)
const MAX_UNIT = 30;              // recipe_ingredient.unit VARCHAR(30)
const { NO_AMOUNT_UNITS, canonicalUnit } = require('./ingredientUnits');
const MAX_AMOUNT = 999999.99;     // DECIMAL(8,2)
const MAX_INGREDIENTS = 40;       // giống IngredientEditor (max=40)
const MAX_INSTRUCTIONS = 10000;
const MAX_MINUTES = 600;          // giống form (0–600 phút)
const MAX_SERVINGS = 20;          // giống NumberStepper (1–20 người)
const MAX_DESCRIPTION = 1000;     // Khoi's code: recipe.description TEXT — giới hạn cho vừa thẻ/trang chi tiết
const MAX_CALORIES = 5000;        // Khoi's code: recipe.calories_kcal INT — calo ước tính cho 1 người
const MAX_GRAMS = 1000;           // Khoi's code: đạm/tinh bột/béo/xơ/đường (g, 1 người) — NUMERIC(6,1)
const MAX_SODIUM = 20000;         // Khoi's code: natri (mg, 1 người) — INT
/** Khoi's code: chỉ số dinh dưỡng tuỳ chọn (tính cho 1 người): khoá body → [tên hiển thị, tối đa, số lẻ] */
const NUTRIENTS = {
  proteinG: ['Đạm', MAX_GRAMS, 1],
  carbG: ['Tinh bột', MAX_GRAMS, 1],
  fatG: ['Chất béo', MAX_GRAMS, 1],
  fiberG: ['Chất xơ', MAX_GRAMS, 1],
  sugarG: ['Đường', MAX_GRAMS, 1],
  sodiumMg: ['Natri', MAX_SODIUM, 0],
};
/** Khoi's code 28/10: chất bắt buộc khi requireNutrition (cùng Calo). Đường, Natri tuỳ chọn. */
const REQUIRED_NUTRIENTS = ['proteinG', 'carbG', 'fatG', 'fiberG'];

/** Lỗi dữ liệu đầu vào → controller đổi thành HTTP 400 */
class RecipeInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RecipeInputError';
  }
}

const fail = (message) => { throw new RecipeInputError(message); };
/** Đếm theo ký tự (tiếng Việt có dấu, emoji) giống VARCHAR của PostgreSQL */
const charCount = (s) => [...s].length;
/** Bỏ khoảng trắng 2 đầu + gộp khoảng trắng giữa: "  Đậu   hũ " → "Đậu hũ" */
const clean = (s) => s.trim().replace(/\s+/g, ' ');
/** Khoá so trùng tên: không phân biệt hoa/thường (giống lower() của PostgreSQL) */
const nameKey = (s) => clean(s).toLowerCase();
const isEmpty = (v) => v === undefined || v === null || v === '';

function parseOptionalInt(value, label, min, max) {
  if (isEmpty(value)) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) fail(`${label} phải là số nguyên từ ${min} đến ${max}.`);
  return n;
}

// Khoi's code: dùng chung cách nhận link YouTube với form Đăng bài (FE: utils/validate.js)
const { getYouTubeId } = require('./postInput');

/** Mô tả ngắn: không bắt buộc, bỏ trống → null */
function parseDescription(value) {
  if (isEmpty(value)) return null;
  if (typeof value !== 'string') fail('Mô tả không hợp lệ.');
  const text = value.trim();
  if (!text) return null;
  if (charCount(text) > MAX_DESCRIPTION) fail(`Mô tả tối đa ${MAX_DESCRIPTION} ký tự.`);
  return text;
}

/** Link YouTube: không bắt buộc, phải là link video YouTube hợp lệ */
function parseYouTubeUrl(value) {
  if (isEmpty(value)) return null;
  if (typeof value !== 'string') fail('Link YouTube không hợp lệ.');
  const url = value.trim();
  if (!url) return null;
  if (charCount(url) > MAX_URL || !getYouTubeId(url)) fail('Link YouTube không hợp lệ. Dán link video dạng youtube.com/watch?v=… hoặc youtu.be/…');
  return url;
}

/** Số không âm, tuỳ chọn, làm tròn `digits` chữ số lẻ: "12,5" → 12.5 · bỏ trống → null */
function parseOptionalNumber(value, label, max, digits) {
  if (isEmpty(value)) return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > max) fail(`${label} phải là số từ 0 đến ${max}.`);
  const k = 10 ** digits;
  return Math.round(n * k) / k;
}

/** Chọn món có sẵn (dishId) HOẶC đề xuất tên món mới (proposedDishName) — đúng 1 trong 2 */
function parseDish(b) {
  const hasId = !isEmpty(b.dishId);
  const hasName = typeof b.proposedDishName === 'string' && b.proposedDishName.trim() !== '';
  if (hasId === hasName) fail('Chọn một món có sẵn hoặc đề xuất tên món mới.');
  if (hasId) {
    const id = String(b.dishId).trim();
    if (!/^[1-9]\d{0,17}$/.test(id)) fail('Món ăn không hợp lệ.');
    return { dishId: id, proposedDishName: null };
  }
  const name = clean(b.proposedDishName);
  if (charCount(name) > MAX_DISH_NAME) fail(`Tên món đề xuất tối đa ${MAX_DISH_NAME} ký tự.`);
  return { dishId: null, proposedDishName: name };
}

/** Ảnh bìa chỉ nhận link do chính API upload của nhóm trả về (giống postInput.js) */
function parseThumbnailUrl(value, cloudName) {
  if (isEmpty(value)) return null;
  if (typeof value !== 'string') fail('Ảnh bìa không hợp lệ.');
  const url = value.trim();
  const prefix = `https://res.cloudinary.com/${cloudName}/image/upload/`;
  if (!cloudName || !url.startsWith(prefix) || charCount(url) > MAX_URL) {
    fail('Ảnh bìa không hợp lệ, vui lòng tải ảnh lên lại.');
  }
  return url;
}

/** Số lượng: null (bỏ trống) hoặc số > 0, làm tròn 2 chữ số như DECIMAL(8,2) */
function parseAmount(value, name) {
  if (isEmpty(value)) return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) fail(`Số lượng của “${name}” phải lớn hơn 0.`);
  if (n > MAX_AMOUNT) fail(`Số lượng của “${name}” quá lớn.`);
  const rounded = Math.round(n * 100) / 100;
  if (rounded === 0) fail(`Số lượng của “${name}” quá nhỏ (tối thiểu 0,01).`);
  return rounded;
}

/**
 * [{ name, amount, unit }] → đã làm sạch. Luật:
 *  - 1..40 dòng, tên bắt buộc ≤ 120 ký tự, không trùng tên (không phân biệt hoa/thường)
 *  - đơn vị "ít" / "vừa đủ" → bỏ số lượng; đơn vị khác mà thiếu số lượng → lỗi
 *  - strictUnits (Khoi's code): chỉ nhận đơn vị trong bộ chuẩn (ingredientUnits.js), lưu đúng tên chuẩn
 *  - ít nhất 1 nguyên liệu có số lượng
 */
function parseIngredients(value, { strictUnits = false } = {}) {
  if (!Array.isArray(value) || value.length === 0) fail('Cần ít nhất 1 nguyên liệu.');
  if (value.length > MAX_INGREDIENTS) fail(`Tối đa ${MAX_INGREDIENTS} nguyên liệu.`);
  const seen = new Set();
  const items = value.map((row) => {
    if (!row || typeof row !== 'object' || typeof row.name !== 'string' || !row.name.trim()) {
      fail('Có dòng nguyên liệu chưa có tên.');
    }
    const name = clean(row.name);
    if (charCount(name) > MAX_INGREDIENT_NAME) fail(`Tên nguyên liệu tối đa ${MAX_INGREDIENT_NAME} ký tự.`);
    const key = nameKey(name);
    if (seen.has(key)) fail(`Nguyên liệu “${name}” bị trùng.`);
    seen.add(key);

    if (!isEmpty(row.unit) && typeof row.unit !== 'string') fail(`Đơn vị của “${name}” không hợp lệ.`);
    let unit = isEmpty(row.unit) ? null : clean(row.unit) || null;
    if (unit && strictUnits) {
      const std = canonicalUnit(unit);
      if (!std) fail(`Đơn vị “${unit}” của “${name}” không có trong danh sách. Hãy chọn đơn vị trong danh sách.`);
      unit = std;
    }
    if (unit && charCount(unit) > MAX_UNIT) fail(`Đơn vị tối đa ${MAX_UNIT} ký tự.`);
    const noAmount = unit !== null && NO_AMOUNT_UNITS.includes(unit.toLowerCase());
    const amount = noAmount ? null : parseAmount(row.amount, name);
    if (amount === null && unit && !noAmount) fail(`Nhập số lượng cho “${name}”.`);
    return { name, amount, unit };
  });
  if (!items.some((i) => i.amount !== null)) fail('Cần ít nhất 1 nguyên liệu có số lượng.');
  return items;
}

/**
 * @param {object} body  req.body
 * @param {{ cloudName?: string, requireMeta?: boolean }} options
 *        requireMeta (Khoi's code): form Tạo công thức BẮT BUỘC khẩu phần, thời gian chuẩn bị, thời gian nấu (cho phép 0 phút).
 *        Mặc định false để luồng Admin tạo món kèm công thức (dish.controller) không đổi.
 *        strictUnits (Khoi's code): chỉ nhận đơn vị trong bộ chuẩn; chỉ form Tạo/Sửa công thức của người dùng bật.
 *        requireNutrition (Khoi's code 28/10): BẮT BUỘC 5 chỉ số dinh dưỡng (Calo, Đạm, Tinh bột, Chất béo, Chất xơ — 1 người);
 *             Đường, Natri vẫn tuỳ chọn.
 *             Chỉ form Tạo/Sửa công thức của thành viên bật; Admin tạo món kèm công thức (dish.controller) vẫn tuỳ chọn.
 * @returns {{ dishId, proposedDishName, title, description, thumbnailUrl, youtubeUrl, servings, prepTimeMinutes,
 *             cookTimeMinutes, caloriesKcal, proteinG, carbG, fatG, fiberG, sugarG, sodiumMg, ingredients, instructions }}
 */
function parseRecipeInput(body, { cloudName, requireMeta = false, strictUnits = false, requireNutrition = false } = {}) {
  const b = body ?? {};
  if (requireMeta) {
    if (isEmpty(b.servings)) fail('Nhập khẩu phần.');
    if (isEmpty(b.prepTimeMinutes)) fail('Nhập thời gian chuẩn bị (không cần thì ghi 0).');
    if (isEmpty(b.cookTimeMinutes)) fail('Nhập thời gian nấu (không cần thì ghi 0).');
  }
  if (requireNutrition) {
    const missing = [['caloriesKcal', 'Calo'], ...REQUIRED_NUTRIENTS.map((key) => [key, NUTRIENTS[key][0]])]
      .filter(([key]) => isEmpty(b[key])).map(([, label]) => label);
    if (missing.length) fail(`Nhập đủ dinh dưỡng cho 1 người, còn thiếu: ${missing.join(', ')}.`);
  }
  const dish = parseDish(b);

  if (typeof b.title !== 'string' || !b.title.trim()) fail('Nhập tên công thức.');
  const title = clean(b.title);
  if (charCount(title) > MAX_TITLE) fail(`Tên công thức tối đa ${MAX_TITLE} ký tự.`);

  if (typeof b.instructions !== 'string' || !b.instructions.trim()) fail('Cần ít nhất 1 bước nấu.');
  const instructions = b.instructions.trim();
  if (charCount(instructions) > MAX_INSTRUCTIONS) fail(`Cách làm tối đa ${MAX_INSTRUCTIONS} ký tự.`);

  return {
    ...dish,
    title,
    description: parseDescription(b.description),
    thumbnailUrl: parseThumbnailUrl(b.thumbnailUrl, cloudName),
    youtubeUrl: parseYouTubeUrl(b.youtubeUrl),
    servings: parseOptionalInt(b.servings, 'Khẩu phần', 1, MAX_SERVINGS),
    prepTimeMinutes: parseOptionalInt(b.prepTimeMinutes, 'Thời gian chuẩn bị', 0, MAX_MINUTES),
    cookTimeMinutes: parseOptionalInt(b.cookTimeMinutes, 'Thời gian nấu', 0, MAX_MINUTES),
    caloriesKcal: parseOptionalInt(b.caloriesKcal, 'Calo', 1, MAX_CALORIES),
    ...Object.fromEntries(Object.entries(NUTRIENTS)
      .map(([key, [label, max, digits]]) => [key, parseOptionalNumber(b[key], label, max, digits)])),
    ingredients: parseIngredients(b.ingredients, { strictUnits }),
    instructions,
  };
}

/** POST /api/recipes/ingredients/check { names[] } → tên đã làm sạch, bỏ trùng, bỏ rỗng (tối đa 40) */
function parseCheckNames(value) {
  if (!Array.isArray(value)) fail('Danh sách tên nguyên liệu không hợp lệ.');
  if (value.length > MAX_INGREDIENTS) fail(`Tối đa ${MAX_INGREDIENTS} nguyên liệu.`);
  const seen = new Set();
  const names = [];
  for (const v of value) {
    if (typeof v !== 'string' || !v.trim()) continue;
    const name = clean(v);
    if (charCount(name) > MAX_INGREDIENT_NAME) fail(`Tên nguyên liệu tối đa ${MAX_INGREDIENT_NAME} ký tự.`);
    if (seen.has(nameKey(name))) continue;
    seen.add(nameKey(name));
    names.push(name);
  }
  return names;
}

module.exports = { parseRecipeInput, parseCheckNames, RecipeInputError, nameKey };
