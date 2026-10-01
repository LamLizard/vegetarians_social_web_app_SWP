import cx from '../cx';
import styles from './Tag.module.css';

/**
 * Nhãn nội dung: tag món ăn ("Giàu đạm thực vật"), danh mục ("Món nước")...
 * Truyền onClick → Tag trở thành nút bấm được (dùng làm bộ lọc), active = đang chọn.
 */
export default function Tag({ icon, active = false, onClick, className, children }) {
  const content = (
    <>
      {icon && <i className={`bi bi-${icon}`} aria-hidden="true" />}
      {children}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={cx(styles.tag, styles.clickable, active && styles.active, className)}
        aria-pressed={active}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }
  return <span className={cx(styles.tag, className)}>{content}</span>;
}
