import { useEffect, useRef } from 'react';

/**
 * Khoi's code (01/11/2026): đo chiều cao cột bên → biến CSS --rail-h.
 * CSS: top = min(ngay dưới thanh trên, 100vh - --rail-h - 68px)
 *  - cột ngắn hơn màn hình → dính ngay dưới thanh trên
 *  - cột dài hơn → cuộn theo trang tới khi chạm ĐÁY rồi mới dính (kiểu X), chừa 68px cho nút Lên đầu trang.
 */
export default function useRailHeight() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => el.style.setProperty('--rail-h', `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return ref;
}
