// Khoi's code: chép từ prototype (Prototype_UI_SWP/src/v2/recipe/dishMatch.js, 11/10/2026)
// =====================================================================
//  So khớp tên món (Dish) — giữ đúng logic của prototype nghiệp vụ:
//  bỏ dấu tiếng Việt · trùng hẳn = 100 · chứa nhau = 65 · còn lại tính theo số từ trùng.
//  Phía User chỉ dùng để XẾP HẠNG danh sách và CHẶN đề xuất trùng hẳn;
//  hệ thống không tự kết luận "gần giống là trùng" (việc đó Admin quyết).
// =====================================================================

/** "Đậu Hũ  sốt cà" → "dau hu sot ca" */
export const plain = (s = '') => s
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase().trim().replace(/\s+/g, ' ');

/** Điểm giống nhau 0..100 giữa chữ người dùng gõ và tên món. */
export function matchScore(query, name) {
  const q = plain(query);
  const n = plain(name);
  if (!q) return 0;
  if (q === n) return 100;
  if (n.includes(q) || q.includes(n)) return 65;
  const qw = q.split(' ');
  const nw = new Set(n.split(' '));
  const shared = qw.filter((w) => nw.has(w)).length;
  return shared ? Math.round((shared / Math.max(qw.length, nw.size)) * 60) : 0;
}

/**
 * Lọc + xếp hạng một danh sách bất kỳ theo tên (dùng chung cho món và nguyên liệu).
 * Khoi's code: tách từ searchDishes để ô chọn nguyên liệu dùng cùng cách so (12/10/2026).
 * @param {object[]} items · @param {string} query · @param {(item) => string} getName
 * @returns {{ options: object[], exact: object|undefined }}  exact: trùng hẳn tên (bỏ dấu)
 */
export function searchByName(items, query, getName, limit = 8) {
  if (!plain(query)) return { options: items.slice(0, limit), exact: undefined };
  const scored = items
    .map((item) => ({ item, score: matchScore(query, getName(item)) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || getName(a.item).localeCompare(getName(b.item), 'vi'));
  return {
    options: scored.slice(0, limit).map((x) => x.item),
    exact: scored.find((x) => x.score === 100)?.item,
  };
}

/**
 * Lọc + xếp hạng món đang active theo chữ đã gõ.
 * @returns {{ options: object[], exact: object|undefined }}
 *   exact: món có tên trùng hẳn (bỏ dấu) → không cho đề xuất trùng.
 */
export function searchDishes(dishes, query, limit = 8) {
  return searchByName(dishes.filter((d) => d.status === 'active'), query, (d) => d.name, limit);
}
