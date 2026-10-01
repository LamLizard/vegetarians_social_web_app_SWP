import { useEffect, useId, useRef } from 'react';
import cx from '../cx';
import styles from './Modal.module.css';

/**
 * Hộp thoại (dùng thẻ <dialog> gốc → tự giữ focus bên trong, bấm Esc để đóng).
 * Nội dung chỉ được vẽ khi mở → form bên trong tự làm mới mỗi lần mở lại.
 * @param {boolean} open
 * @param {()=>void} onClose   gọi khi bấm X, bấm Esc hoặc bấm ra ngoài
 * @param {string} title
 * @param {'sm'|'md'|'lg'} size  sm 420px · md 560px · lg 760px
 * @param {React.ReactNode} footer  thường là các nút: Hủy + hành động chính
 * @param {'center'|'left'} placement  left = ngăn kéo trượt từ trái (menu trên điện thoại)
 */
export default function Modal({ open, onClose, title, size = 'md', placement = 'center', footer, className, children }) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cx(styles.dialog, styles[size], placement === 'left' && styles.left, className)}
      aria-labelledby={titleId}
      onCancel={(e) => { e.preventDefault(); onClose?.(); }}
      onClick={(e) => { if (e.target === ref.current) onClose?.(); }}
    >
      {open && (
        <div className={styles.inner}>
          <header className={styles.head}>
            <h2 id={titleId} className={styles.title}>{title}</h2>
            <button type="button" className={styles.close} aria-label="Đóng" onClick={onClose}>
              <i className="bi bi-x-lg" aria-hidden="true" />
            </button>
          </header>
          <div className={styles.body}>{children}</div>
          {footer && <footer className={styles.foot}>{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
