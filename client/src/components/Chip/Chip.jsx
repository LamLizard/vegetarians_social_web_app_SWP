import cx from '../cx';
import styles from './Chip.module.css';

/**
 * Nhãn nhỏ. Dùng để hiển thị Category ("Món nước", "Món khô") và làm bộ lọc bấm được.
 * (Thay cho Tag cũ – v4.0 đã bỏ entity Tag, chỉ còn Category.)
 *
 * Hai cách dùng:
 *  - Chỉ hiển thị:   <Chip>Món nước</Chip>
 *  - Bấm để lọc:     <Chip selected={x} onClick={() => ...}>Món nước</Chip>
 *    → thành <button aria-pressed>, có viền, đổi màu khi selected.
 *
 * @param {string}  [icon]      tên Bootstrap Icon
 * @param {boolean} [selected]  đang được chọn (chỉ có tác dụng khi có onClick)
 * @param {() => void} [onClick]
 * @param {() => void} [onRemove]  hiện nút × để bỏ (vd danh mục đã chọn trong form)
 * @param {boolean} [disabled]
 */
export default function Chip({ icon, selected = false, onClick, onRemove, disabled, className, children }) {
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
        className={cx(styles.chip, styles.clickable, selected && styles.active, className)}
        aria-pressed={selected}
        disabled={disabled}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={cx(styles.chip, onRemove && styles.removable, className)}>
      {content}
      {onRemove && (
        <button type="button" className={styles.remove} onClick={onRemove} aria-label={`Bỏ ${typeof children === 'string' ? children : ''}`.trim()} disabled={disabled}>
          <i className="bi bi-x" aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
