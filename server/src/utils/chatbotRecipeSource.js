// Khoi's code (06/11/2026): tiện ích cho công thức nguồn của câu "cách làm món X".
// Việc nhận diện "cách làm" do classifier quyết định (khoá cookDish), không dò chữ ở đây nữa.

/** "300.00" → "300"; "0.50" → "0,5" (định dạng số Việt Nam của DB numeric). */
function formatAmount(amount) {
  const raw = String(amount ?? '').trim().replace(',', '.');
  if (!raw) return '';
  const value = Number(raw);
  if (!Number.isFinite(value)) return '';
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2))).replace('.', ',');
}

/**
 * Nguyên liệu mà cụm "số + đơn vị" (cả "0,5" và "0.5") không xuất hiện trong câu trả lời.
 * Khớp theo cụm để "1 g" không bị coi là có khi câu chỉ có "300 g"; nguyên liệu không có đơn vị thì bỏ qua.
 */
function missingQuantities(answerText, ingredients = []) {
  const text = String(answerText ?? '');
  return (Array.isArray(ingredients) ? ingredients : []).filter((item) => {
    const amount = formatAmount(item?.amount);
    const unit = typeof item?.unit === 'string' ? item.unit.trim() : '';
    if (!amount || !unit) return false;
    const number = amount.replace(',', '[.,]');
    const escapedUnit = unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(^|[^\\d.,])${number}\\s*${escapedUnit}(?!\\p{L})`, 'iu');
    return !pattern.test(text);
  });
}

module.exports = { formatAmount, missingQuantities };
