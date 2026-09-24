// =====================================================================
//  NGUYÊN LIỆU CÔNG THỨC (recipe_ingredient: ingredient + amount + unit)
// =====================================================================
import { INGREDIENT_UNIT } from '../constants/domain';

const plain = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim().replace(/\s+/g, ' ');

let seq = 0;
/** Dòng trống mới cho IngredientEditor. `key` chỉ để React vẽ danh sách, KHÔNG gửi API. */
export const newIngredientRow = (init = {}) => ({ key: `ing-${Date.now()}-${seq++}`, name: '', amount: null, unit: '', ...init });

/** Đơn vị không cần số lượng ("ít", "vừa đủ"). */
export const isNoAmountUnit = (unit) => INGREDIENT_UNIT.some((u) => u.noAmount && plain(u.value) === plain(unit));

/** Chuỗi người dùng gõ → số. Nhận cả dấu phẩy "0,5" và phân số "1/2". Rỗng → null. */
export function parseAmount(text) {
  const t = String(text ?? '').trim().replace(',', '.');
  if (!t) return null;
  const frac = /^(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (frac) return Number(frac[2]) ? Number(frac[1]) / Number(frac[2]) : NaN;
  return Number(t);
}

/** Số → chữ gọn: 0.5 → "0,5" · 2 → "2" · 1.333 → "1,3" · 225.4 → "225". */
export function formatAmount(n) {
  if (n == null || Number.isNaN(n)) return '';
  const v = n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
  return v.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
}

/** Nhân số lượng theo khẩu phần: 300g cho 4 người, xem cho 2 người → 150. */
export const scaleAmount = (amount, fromServings, toServings) =>
  amount == null || !fromServings ? amount : (amount * toServings) / fromServings;

/**
 * Kiểm tra danh sách nguyên liệu trước khi gửi.
 * @returns {{error?: string, rowErrors: ({name?: string, amount?: string}|undefined)[], hasError: boolean}}
 */
export function validateIngredients(rows = [], { min = 1 } = {}) {
  const filled = rows.filter((r) => r.name.trim() || r.amount != null || r.unit.trim());
  const seen = new Map();
  const rowErrors = rows.map((r) => {
    const empty = !r.name.trim() && r.amount == null && !r.unit.trim();
    if (empty) return undefined;
    const e = {};
    if (!r.name.trim()) e.name = 'Nhập tên nguyên liệu';
    else if (seen.has(plain(r.name))) e.name = 'Trùng với dòng phía trên';
    else seen.set(plain(r.name), true);
    if (r.amount != null && (Number.isNaN(r.amount) || r.amount <= 0)) e.amount = 'Số lượng phải lớn hơn 0';
    else if (r.amount == null && r.unit.trim() && !isNoAmountUnit(r.unit)) e.amount = 'Nhập số lượng';
    return Object.keys(e).length ? e : undefined;
  });
  const error = filled.length < min ? `Cần ít nhất ${min} nguyên liệu` : undefined;
  return { error, rowErrors, hasError: !!error || rowErrors.some(Boolean) };
}

/** Bỏ dòng trống + UI-only fields → đúng dữ liệu gửi API. */
export const cleanIngredients = (rows = []) =>
  rows
    .filter((r) => r.name.trim())
    .map(({ name, amount, unit }) => ({ name: name.trim(), amount, unit: unit.trim() }));
