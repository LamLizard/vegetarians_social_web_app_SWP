import Button from '../Button/Button';
import cx from '../cx';
import styles from './Notice.module.css';

const TONES = {
  alert:   { icon: 'exclamation-triangle-fill', role: 'alert' },  // đất nung – cần người dùng xử lý
  success: { icon: 'check-circle-fill',        role: 'status' },
  info:    { icon: 'info-circle-fill',         role: 'status' },
};

/**
 * Thông báo nằm cố định trong trang (không tự ẩn).
 * Dùng cho: tài khoản bị khoá, lý do bài bị từ chối/ẩn, lỗi tải dữ liệu, cảnh báo "không thay thế tư vấn y tế".
 *
 * @param {'alert'|'success'|'info'} [tone='info']  "alert" chỉ dùng khi người dùng thật sự cần hành động
 * @param {string} [title]
 * @param {{label: string, onClick: () => void}} [action]  1 nút hành động, vd "Thử lại"
 * @param {() => void} [onDismiss]  hiện nút × để tắt
 * @param {React.ReactNode} [children]  nội dung chi tiết
 */
export default function Notice({ tone = 'info', title, action, onDismiss, className, children }) {
  const t = TONES[tone] ?? TONES.info;
  return (
    <div className={cx(styles.notice, styles[tone], className)} role={t.role}>
      <i className={cx(`bi bi-${t.icon}`, styles.icon)} aria-hidden="true" />
      <div className={styles.body}>
        {title && <div className={styles.title}>{title}</div>}
        {children && <div className={styles.text}>{children}</div>}
        {action && (
          <Button
            size="sm"
            variant={tone === 'alert' ? 'alert' : 'outline'}
            className="mt-2"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        )}
      </div>
      {onDismiss && (
        <button type="button" className={styles.dismiss} onClick={onDismiss} aria-label="Đóng thông báo">
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
