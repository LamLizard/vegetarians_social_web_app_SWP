// Khoi's code: Soi chữ xem có từ chỉ đồ động vật không (Tạo công thức, 12/10/2026).
// Danh sách từ nằm trong bảng banned_keyword với category = 'animal' (đọc qua models/bannedKeyword.model.js),
// file này chỉ là cách SO KHỚP, không chứa danh sách.
// Chỉ để CẢNH BÁO (tô đỏ, Admin xem lại) — không chặn gửi. Vd "Chả cá chay" khớp "cá" nhưng vẫn có thể là đồ chay.
// Nguyên liệu ĐÃ có trong kho thì tin cột ingredient.is_animal_derived, không soi tên
// → tránh báo nhầm "Nấm đùi gà", "Đậu gà".
// Khớp theo NGUYÊN TỪ, giữ dấu: "cá" không khớp "cà", "các".
// Bản ở client: client/src/utils/animalWords.js — sửa cách so ở đây thì sửa cả bên đó.

/** "Chả  Cá-chay" → ["chả", "cá", "chay"] (giữ dấu tiếng Việt, bỏ dấu câu) */
const words = (s) => String(s ?? '').toLowerCase().normalize('NFC').split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/**
 * Từ động vật xuất hiện SỚM NHẤT trong chữ (theo nguyên từ), không có → null.
 * Cụm dài được ưu tiên tại cùng vị trí: "sữa bò tươi" → "sữa bò", "trứng gà" → "trứng".
 * @param {string} text
 * @param {string[]} keywords   từ bảng banned_keyword (category 'animal')
 */
function findAnimalWord(text, keywords) {
  const tokens = words(text);
  if (tokens.length === 0 || !keywords?.length) return null;
  const phrases = keywords.map(words).filter((p) => p.length).sort((x, y) => y.length - x.length);
  for (let i = 0; i < tokens.length; i += 1) {
    const hit = phrases.find((phrase) => phrase.every((p, j) => tokens[i + j] === p));
    if (hit) return hit.join(' ');
  }
  return null;
}

/**
 * Soi nhiều ô cùng lúc → danh sách cảnh báo cho Admin.
 * @param {{field: string, label: string, text: string}[]} fields
 * @param {string[]} keywords
 * @returns {{field: string, label: string, text: string, keyword: string}[]}
 */
function animalWarnings(fields, keywords) {
  return fields
    .map((f) => ({ ...f, keyword: findAnimalWord(f.text, keywords) }))
    .filter((f) => f.keyword);
}

module.exports = { findAnimalWord, animalWarnings };
