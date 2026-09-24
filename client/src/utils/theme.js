import { useSyncExternalStore } from 'react';

// Chế độ Ngày / Đêm.
//  - Người dùng chọn 1 trong 3: 'light' (Sáng) · 'dark' (Tối) · 'system' (Theo máy, mặc định).
//  - 'system' đi theo cài đặt hệ điều hành và TỰ ĐỔI khi máy đổi (vd máy tự tối lúc 18h).
//  - Lựa chọn lưu trong localStorage của trình duyệt (không cần Backend).
// Gắn <html data-theme="light|dark" data-bs-theme="…"> → token trong theme.scss tự đổi.

const KEY = 'anchay-theme';
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const listeners = new Set();

const readSaved = () => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch { return null; }
};
const resolve = () => readSaved() ?? (media?.matches ? 'dark' : 'light');

function apply() {
  const theme = resolve();
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.bsTheme = theme;
  listeners.forEach((fn) => fn());
}

/** Gọi 1 lần trước khi vẽ app (main.jsx) để không bị nháy màu. */
export function initTheme() {
  apply();
  media?.addEventListener('change', () => { if (!readSaved()) apply(); });
}

/**
 * Đổi chế độ.
 * @param {'light'|'dark'|'system'} preference  'system' = bỏ lựa chọn đã lưu, đi theo máy
 */
export function setTheme(preference) {
  try {
    if (preference === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, preference);
  } catch { /* bị chặn → chỉ đổi trong phiên này */ }
  if (preference === 'system') { apply(); return; }
  document.documentElement.dataset.theme = preference;
  document.documentElement.dataset.bsTheme = preference;
  listeners.forEach((fn) => fn());
}

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const snapshot = () => `${document.documentElement.dataset.theme ?? 'light'}|${readSaved() ?? 'system'}`;

/**
 * @returns {['light'|'dark', () => void, 'light'|'dark'|'system']}
 *   [chế độ đang hiện, hàm đảo Sáng ↔ Tối, lựa chọn của người dùng]
 */
export function useTheme() {
  const [theme, preference] = useSyncExternalStore(subscribe, snapshot).split('|');
  return [theme, () => setTheme(theme === 'dark' ? 'light' : 'dark'), preference];
}
