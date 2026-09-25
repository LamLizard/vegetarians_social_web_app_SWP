import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import cx from '../cx';
import styles from './Toast.module.css';

const ToastContext = createContext(null);
const ICONS = { success: 'check-circle-fill', info: 'info-circle-fill', alert: 'exclamation-triangle-fill' };

/**
 * Thông báo nhỏ góc dưới màn hình, tự ẩn ("Đã lưu", "Bài đang chờ duyệt"...).
 *
 * 1. Bọc app 1 lần trong main.jsx:  <ToastProvider><App /></ToastProvider>
 * 2. Ở bất kỳ component nào:
 *      const toast = useToast();
 *      toast('Đã lưu bài viết');                                   // tone mặc định: success
 *      toast('Bài đang chờ Admin duyệt', { tone: 'info' });
 *      toast('Không kết nối được máy chủ', { tone: 'alert' });
 *      toast('Đã xoá bình luận', { action: { label: 'Hoàn tác', onClick: undo } });
 *
 * Quy tắc: thông báo quan trọng cần người dùng xử lý thì dùng Notice trong trang, không dùng Toast.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const show = useCallback((message, { tone = 'success', duration = 3200, action } = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((list) => [...list.slice(-2), { id, message, tone, action }]);
    timers.current.set(id, setTimeout(() => dismiss(id), action ? duration + 2000 : duration));
    return id;
  }, [dismiss]);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.stack} role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cx(styles.toast, styles[t.tone])}>
            <i className={`bi bi-${ICONS[t.tone] ?? ICONS.info}`} aria-hidden="true" />
            <span className={styles.msg}>{t.message}</span>
            {t.action && (
              <button type="button" className={styles.action} onClick={() => { t.action.onClick?.(); dismiss(t.id); }}>
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** @returns {(message: string, options?: {tone?: 'success'|'info'|'alert', duration?: number, action?: {label: string, onClick: () => void}}) => string} */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast() phải nằm bên trong <ToastProvider>. Kiểm tra main.jsx.');
  return ctx;
}
