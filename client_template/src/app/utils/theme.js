import { useSyncExternalStore } from 'react';

// Chế độ Ngày / Đêm. Mặc định theo hệ điều hành; người dùng bấm đổi thì nhớ lựa chọn.
// Gắn <html data-theme="light|dark" data-bs-theme="…"> → token trong theme.scss tự đổi.

const KEY = 'anchay-theme';
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const listeners = new Set();

const readSaved = () => {
  try { return localStorage.getItem(KEY); } catch { return null; }
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

export function setTheme(theme) {
  try { localStorage.setItem(KEY, theme); } catch { /* bị chặn → chỉ đổi trong phiên này */ }
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.bsTheme = theme;
  listeners.forEach((fn) => fn());
}

/** @returns {['light'|'dark', ()=>void]}  [chế độ hiện tại, hàm đổi] */
export function useTheme() {
  const theme = useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => document.documentElement.dataset.theme ?? 'light',
  );
  return [theme, () => setTheme(theme === 'dark' ? 'light' : 'dark')];
}
