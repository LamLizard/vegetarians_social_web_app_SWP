// Khoi's code: Soi chữ có từ chỉ đồ động vật (bản client của server/src/utils/animalWords.js, 12/10/2026).
// Danh sách từ lấy từ API GET /api/recipes/animal-words (bảng banned_keyword, category 'animal').
// Chỉ để CẢNH BÁO (tô đỏ) — không chặn gửi. Khớp theo NGUYÊN TỪ, giữ dấu: "cá" không khớp "cà".

const words = (s) => String(s ?? '').toLowerCase().normalize('NFC').split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Từ động vật xuất hiện sớm nhất trong chữ, không có → null. "Chả cá chay" → "cá" */
export function findAnimalWord(text, keywords) {
  const tokens = words(text);
  if (tokens.length === 0 || !keywords?.length) return null;
  const phrases = keywords.map(words).filter((p) => p.length).sort((x, y) => y.length - x.length);
  for (let i = 0; i < tokens.length; i += 1) {
    const hit = phrases.find((phrase) => phrase.every((p, j) => tokens[i + j] === p));
    if (hit) return hit.join(' ');
  }
  return null;
}
