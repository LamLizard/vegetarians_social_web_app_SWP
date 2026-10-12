// Khoi's code: Soi tên nguyên liệu CHƯA có trong kho xem có từ chỉ đồ động vật không (Tạo công thức, 12/10/2026).
// Chỉ để CẢNH BÁO (tô đỏ) — không chặn gửi. Vd "Chả cá chay" khớp "cá" nhưng vẫn có thể là đồ chay → Admin xem lại.
// Không dùng bảng banned_keyword: bảng đó là từ cấm spam/lừa đảo cho bình luận, không phải từ động vật.
// Nguyên liệu ĐÃ có trong kho thì tin cột ingredient.is_animal_derived (kho đã duyệt), không soi tên
// → tránh báo nhầm "Nấm đùi gà", "Đậu gà".
// Muốn thêm/bớt từ: sửa mảng dưới (viết thường, có dấu). Khớp theo NGUYÊN TỪ: "cá" không khớp "cà", "các".

const ANIMAL_WORDS = [
  // thịt
  'thịt', 'bò', 'heo', 'lợn', 'gà', 'vịt', 'ngan', 'ngỗng', 'cừu', 'dê', 'chim', 'ếch', 'lươn',
  'giò', 'lạp xưởng', 'xúc xích', 'pate', 'mỡ', 'gan', 'lòng', 'huyết', 'xương', 'gelatin',
  // thuỷ hải sản
  'cá', 'tôm', 'cua', 'ghẹ', 'mực', 'bạch tuộc', 'ốc', 'sò', 'hến', 'nghêu', 'ngao', 'hàu',
  'mắm', 'nước mắm',
  // trứng, sữa, khác
  'trứng', 'sữa bò', 'sữa dê', 'phô mai', 'bơ sữa', 'kem sữa', 'mật ong', 'yến sào',
];

/** "Chả  Cá-chay" → ["chả", "cá", "chay"] (giữ dấu tiếng Việt, bỏ dấu câu) */
const words = (s) => s.toLowerCase().normalize('NFC').split(/[^\p{L}\p{N}]+/u).filter(Boolean);

// Cụm dài xét trước để "sữa bò" thắng "bò", "nước mắm" thắng "mắm"
const PHRASES = ANIMAL_WORDS.map((w) => words(w)).sort((x, y) => y.length - x.length);

/** Từ động vật xuất hiện SỚM NHẤT trong tên (theo nguyên từ), không có → null. "Trứng gà" → "trứng" */
function findAnimalWord(name) {
  const tokens = words(String(name ?? ''));
  for (let i = 0; i < tokens.length; i += 1) {
    const hit = PHRASES.find((phrase) => phrase.every((p, j) => tokens[i + j] === p));
    if (hit) return hit.join(' ');
  }
  return null;
}

module.exports = { findAnimalWord, ANIMAL_WORDS };
