// 27/10/2026: lựa chọn "Ẩn món tôi dị ứng" là SỞ THÍCH của người dùng, không phải trạng thái của 1 lần xem trang
// → nhớ theo từng tài khoản trên máy này, để mở lại trang Công thức (link "Xem tất cả công thức", thanh bên, nút Back)
// vẫn giữ nguyên lọc. Dùng chung cho trang Công thức và khối "Có thể bạn cũng thích" ở trang Xem công thức.
import { useState } from 'react';

const keyOf = (userId) => `anchay-hide-allergen:${userId ?? 'guest'}`;

const read = (userId) => {
  try { return localStorage.getItem(keyOf(userId)) === '1'; } catch { return false; } // trình duyệt chặn storage → mặc định tắt
};

/** [đangẨn, đặtẨn] — giống useState nhưng nhớ qua các lần tải trang */
export default function useHideAllergen(userId) {
  const [on, setOn] = useState(() => read(userId));
  const set = (next) => {
    setOn(next);
    try { localStorage.setItem(keyOf(userId), next ? '1' : '0'); } catch { /* chỉ nhớ trong lần xem này */ }
  };
  return [on, set];
}
