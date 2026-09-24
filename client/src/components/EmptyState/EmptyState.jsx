import cx from '../cx';
import styles from './EmptyState.module.css';

/**
 * Trạng thái trống: chưa có bài, không tìm thấy kết quả, hàng chờ duyệt đã xử lý hết...
 * @param {string} icon   tên Bootstrap Icon
 * @param {string} title
 * @param {React.ReactNode} action  (tuỳ chọn) nút gợi ý bước tiếp theo
 */
export default function EmptyState({ icon = 'flower3', title, action, className, children }) {
  return (
    <div className={cx(styles.empty, className)}>
      <span className={styles.icon} aria-hidden="true"><i className={`bi bi-${icon}`} /></span>
      {title && <p className={styles.title}>{title}</p>}
      {children && <p className={styles.text}>{children}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
