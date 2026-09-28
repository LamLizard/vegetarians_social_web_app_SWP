import cx from '../cx';
import styles from './HighlightChip.module.css';

/**
 * Nhãn ĐIỂM NHẤN màu vàng cúc (theme C) – kéo mắt người dùng.
 * Quy tắc: mỗi khu vực tối đa 1 chip này. Dùng cho "AI gợi ý", "MỚI", thành tích.
 * @param {'default'|'new'} variant  "new" = chữ in hoa nhỏ, dán góc ảnh
 */
export default function HighlightChip({ icon = 'stars', variant = 'default', className, children }) {
  return (
    <span className={cx(styles.chip, variant === 'new' && styles.new, className)}>
      {variant !== 'new' && icon && <i className={`bi bi-${icon}`} aria-hidden="true" />}
      {children}
    </span>
  );
}
