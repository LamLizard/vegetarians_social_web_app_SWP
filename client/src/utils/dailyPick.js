// Khoi's code (01/11/2026): chọn "món của hôm nay" cố định theo NGÀY.
// Cùng 1 ngày → mọi người, mọi lần tải trang đều ra cùng kết quả; qua 0h (giờ máy) → đổi.
// Không cần bảng/cột mới trong DB: xáo danh sách bằng số ngẫu nhiên có "hạt giống" là ngày.

/** Ngày theo giờ máy dạng YYYY-MM-DD (không dùng toISOString vì đó là giờ UTC → 0h–7h sáng VN bị lệch 1 ngày). */
export function localDateKey(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Chuỗi → số nguyên 32 bit (FNV-1a). Cùng chuỗi luôn cùng số. */
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Bộ sinh số ngẫu nhiên có hạt giống (mulberry32) → [0, 1). */
function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Lấy `count` phần tử "của ngày hôm nay" từ danh sách.
 * Xếp theo id trước khi xáo → thứ tự API trả về thay đổi cũng không làm đổi kết quả trong ngày.
 * @template T
 * @param {T[]} items · @param {number} count
 * @param {string} [dayKey]   mặc định = ngày hôm nay (localDateKey())
 * @param {(item: T) => string} [idOf]
 * @returns {T[]}
 */
export function pickForDay(items, count, dayKey = localDateKey(), idOf = (it) => String(it.id)) {
  const list = [...items].sort((a, b) => idOf(a).localeCompare(idOf(b), 'en', { numeric: true }));
  const rand = seeded(hash(dayKey));
  for (let k = list.length - 1; k > 0; k -= 1) {
    const j = Math.floor(rand() * (k + 1));
    [list[k], list[j]] = [list[j], list[k]];
  }
  return list.slice(0, count);
}

/** Ảnh "thật" của công thức: có link và không phải ảnh ngẫu nhiên của dữ liệu mẫu (picsum.photos). */
export const hasRealPhoto = (url) => typeof url === 'string' && /^https?:\/\//.test(url) && !/picsum\.photos/i.test(url);
