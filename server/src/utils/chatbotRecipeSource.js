// Khoi's code (06/11/2026): nhận diện câu hỏi "cách làm món X" và chọn đúng công thức Green Bowl làm nguồn,
// để Mầm diễn đạt lại từ dữ liệu DB thay vì tự bịa định lượng.
const { plain } = require('../models/chatContext.model');

const HOW_TO_MARKERS = ['cach lam', 'cach nau', 'huong dan lam', 'huong dan nau', 'cong thuc', 'lam mon', 'nau mon'];

/** Câu hỏi có phải dạng "cách làm / hướng dẫn nấu" (so khớp đã bỏ dấu). */
function isHowToCook(text) {
  const value = plain(text);
  return HOW_TO_MARKERS.some((marker) => value.includes(marker));
}

/** Công thức mà TOÀN BỘ tiêu đề (bỏ dấu) nằm trong câu hỏi; nhiều bài khớp → tiêu đề dài nhất, rồi nhiều tim hơn. */
function pickSourceRecipe(question, recipes = []) {
  const value = plain(question);
  const matches = (Array.isArray(recipes) ? recipes : []).filter((recipe) => {
    const title = plain(recipe?.title);
    return Boolean(title) && value.includes(title);
  });
  if (!matches.length) return null;
  return matches.slice().sort((a, b) => (plain(b.title).length - plain(a.title).length)
    || ((Number(b.likeCount) || 0) - (Number(a.likeCount) || 0)))[0] ?? null;
}

/** "300.00" → "300"; "0.50" → "0,5" (định dạng số Việt Nam của DB numeric). */
function formatAmount(amount) {
  const raw = String(amount ?? '').trim().replace(',', '.');
  if (!raw) return '';
  const value = Number(raw);
  if (!Number.isFinite(value)) return '';
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2))).replace('.', ',');
}

/** Nguyên liệu mà định lượng (cả "0,5" và "0.5") không xuất hiện trong câu trả lời. */
function missingQuantities(answerText, ingredients = []) {
  const text = String(answerText ?? '');
  return (Array.isArray(ingredients) ? ingredients : []).filter((item) => {
    const formatted = formatAmount(item?.amount);
    if (!formatted) return false;
    return !text.includes(formatted) && !text.includes(formatted.replace(',', '.'));
  });
}

module.exports = { isHowToCook, pickSourceRecipe, formatAmount, missingQuantities };
