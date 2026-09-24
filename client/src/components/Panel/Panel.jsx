import cx from '../cx';
import styles from './Panel.module.css';

/**
 * Khung thẻ có tiêu đề – dùng cho các khối ở cột phải bảng tin, trang hồ sơ, trang quản trị.
 * @param {string} title
 * @param {string} icon     (tuỳ chọn) icon trước tiêu đề
 * @param {React.ReactNode} action  góc phải tiêu đề, vd link "Xem tất cả"
 * @param {boolean} flush   true → thân không có padding (cho danh sách/bảng sát mép)
 */
export default function Panel({ title, icon, action, flush = false, as: Tag = 'section', className, children, ...rest }) {
  return (
    <Tag className={cx(styles.panel, className)} {...rest}>
      {(title || action) && (
        <header className={styles.head}>
          {title && (
            <h2 className={styles.title}>
              {icon && <i className={`bi bi-${icon}`} aria-hidden="true" />}
              {title}
            </h2>
          )}
          {action && <div className={styles.action}>{action}</div>}
        </header>
      )}
      <div className={cx(styles.body, flush && styles.flush)}>{children}</div>
    </Tag>
  );
}
