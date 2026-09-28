import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import cx from '../cx';
import styles from './Toast.module.css';

const ToastContext = createContext(() => {});
const ICONS = { success: 'check-circle-fill', info: 'info-circle-fill', alert: 'exclamation-triangle-fill' };

/**
 * Thông báo nhỏ góc dưới màn hình, tự ẩn sau ~3 giây ("Đã lưu bài viết", "Đã sao chép liên kết"...).
 * Bọc app 1 lần bằng <ToastProvider>, sau đó gọi:
 *   const toast = useToast();
 *   toast('Đã lưu bài viết');                    // tone mặc định: success
 *   toast('Bài đang chờ duyệt', { tone: 'info' });
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, { tone = 'success', duration = 3200 } = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((list) => [...list.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), duration);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.stack} role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cx(styles.toast, styles[t.tone])}>
            <i className={`bi bi-${ICONS[t.tone]}`} aria-hidden="true" />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
