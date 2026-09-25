import { useEffect, useId, useRef } from 'react';
import cx from '../cx';
import styles from './Modal.module.css';

/**
 * Hộp thoại (dùng thẻ <dialog> gốc → tự giữ focus bên trong, Esc để đóng).
 * Nội dung chỉ được vẽ khi mở → form bên trong tự làm mới mỗi lần mở lại.
 *
 * @param {boolean} open
 * @param {() => void} onClose  gọi khi bấm X, Esc hoặc bấm ra ngoài
 * @param {string} title
 * @param {React.ReactNode} [description]  1 dòng mô tả dưới tiêu đề
 * @param {'sm'|'md'|'lg'} [size='md']  sm 420px · md 560px · lg 760px
 * @param {React.ReactNode} [footer]  thường là: <Button variant="subtle">Huỷ</Button> + nút chính
 * @param {'center'|'left'} [placement='center']  left = ngăn kéo trượt từ trái (menu điện thoại)
 * @param {boolean} [dismissible=true]  false → không đóng được bằng X/Esc/bấm ngoài (vd đang gửi dữ liệu)
 *
 * Muốn hỏi "Bạn chắc chắn...?" thì dùng ConfirmDialog, không tự dựng lại.
 */
export default function Modal({
  open, onClose, title, description, size = 'md', placement = 'center', footer, dismissible = true, className, children,
}) {
  const ref = useRef(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const requestClose = () => { if (dismissible) onClose?.(); };

  return (
    <dialog
      ref={ref}
      className={cx(styles.dialog, styles[size], placement === 'left' && styles.left, className)}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => { e.preventDefault(); requestClose(); }}
      onClick={(e) => { if (e.target === ref.current) requestClose(); }}
    >
      {open && (
        <div className={styles.inner}>
          <header className={styles.head}>
            <h2 id={titleId} className={styles.title}>{title}</h2>
            {description && <p id={descId} className={styles.desc}>{description}</p>}
            <button type="button" className={styles.close} aria-label="Đóng" onClick={requestClose} disabled={!dismissible}>
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
