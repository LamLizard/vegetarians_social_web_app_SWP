// Khoi's code (06/11/2026): đánh dấu món ĐÃ ĂN của thực đơn hôm nay (khối "Calo hôm nay" ở Bảng tin).
// Phương án L1: lưu trên trình duyệt (localStorage) theo id thực đơn + ngày — DB chưa có cột "đã ăn".
// Đổi sang lưu DB (L2) chỉ cần thay readEaten/writeEaten, giao diện giữ nguyên.

export const EATEN_PREFIX = 'gb-meal-eaten-v1:';
export const SLOT_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];
export const SLOT_LABEL = { breakfast: 'Sáng', lunch: 'Trưa', dinner: 'Tối', snack: 'Phụ' };

const keyOf = (planId) => `${EATEN_PREFIX}${planId}`;

/** Danh sách id món đã ăn của thực đơn `planId` trong ngày `date`; chỉ giữ id còn trong thực đơn. */
export function readEaten(storage, planId, date, itemIds = []) {
  if (!storage || !planId) return [];
  try {
    const value = JSON.parse(storage.getItem(keyOf(planId)) ?? 'null');
    if (!value || value.date !== date || !Array.isArray(value.ids)) return [];
    const valid = new Set(itemIds.map(String));
    return [...new Set(value.ids.map(String))].filter((id) => valid.has(id));
  } catch {
    return [];
  }
}

/** Ghi danh sách đã ăn; dọn bản ghi của các ngày khác để localStorage không phình. */
export function writeEaten(storage, planId, date, ids) {
  if (!storage || !planId) return;
  try {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (!key?.startsWith(EATEN_PREFIX) || key === keyOf(planId)) continue;
      let old = null;
      try { old = JSON.parse(storage.getItem(key) ?? 'null'); } catch { /* bản ghi hỏng → xoá */ }
      if (old?.date !== date) storage.removeItem(key);
    }
    if (ids.length) storage.setItem(keyOf(planId), JSON.stringify({ date, ids }));
    else storage.removeItem(keyOf(planId));
  } catch { /* trình duyệt chặn lưu trữ → chỉ mất ghi nhớ, không lỗi trang */ }
}

/** Bật/tắt một món, trả mảng mới (không sửa mảng cũ). */
export function toggleEaten(ids, id) {
  const key = String(id);
  return ids.includes(key) ? ids.filter((value) => value !== key) : [...ids, key];
}

/**
 * Số liệu cho vòng tròn + nhóm theo bữa.
 * goal = mục tiêu calo của thực đơn; thực đơn không ghi mục tiêu → dùng tổng calo của thực đơn.
 */
export function summarizeMeals(items = [], eatenIds = [], targetKcal = 0) {
  const eaten = new Set(eatenIds.map(String));
  const kcal = (item) => Number(item.caloriesKcal) || 0;
  const total = items.reduce((sum, item) => sum + kcal(item), 0);
  const groups = new Map();
  items.forEach((item, index) => {
    const id = String(item.id ?? `${item.mealSlot}-${index}`);
    const slot = item.mealSlot ?? 'other';
    if (!groups.has(slot)) groups.set(slot, { slot, label: SLOT_LABEL[slot] ?? slot, items: [], totalKcal: 0, eatenKcal: 0 });
    const group = groups.get(slot);
    const done = eaten.has(id);
    group.items.push({ ...item, id, done });
    group.totalKcal += kcal(item);
    if (done) group.eatenKcal += kcal(item);
  });
  const rank = (slot) => (SLOT_ORDER.includes(slot) ? SLOT_ORDER.indexOf(slot) : SLOT_ORDER.length);
  const slots = [...groups.values()].sort((a, b) => rank(a.slot) - rank(b.slot));
  const eatenKcal = slots.reduce((sum, group) => sum + group.eatenKcal, 0);
  const eatenCount = slots.reduce((sum, group) => sum + group.items.filter((item) => item.done).length, 0);
  const goal = Number(targetKcal) > 0 ? Number(targetKcal) : total;
  return { slots, total, goal, hasTarget: Number(targetKcal) > 0, eatenKcal, eatenCount, itemCount: items.length };
}
