import cx from '../cx';
import styles from './IconButton.module.css';

/**
 * Nút tròn chỉ có icon (header, góc thẻ bài viết, khung chat).
 * @param {string} icon    tên Bootstrap Icon
 * @param {string} label   BẮT BUỘC – đọc cho trình đọc màn hình + hiện khi rê chuột
 * @param {number} badge   số thông báo; > 9 hiện "9+"
 * @param {'soft'|'ghost'|'solid'} variant  soft = nền be (header) · ghost = trong suốt · solid = xanh rêu
 * @param {'sm'|'md'|'lg'} size  32 · 40 · 48 px
 * @param {boolean} active  đang bật (vd khung chat đang mở)
 */
export default function IconButton({
  icon, label, badge, variant = 'soft', size = 'md', active = false, className, type = 'button', ...rest
}) {
  return (
    <button
      type={type}
      className={cx(styles.btn, styles[variant], styles[size], active && styles.active, className)}
      aria-label={label}
      title={label}
      {...rest}
    >
      <i className={`bi bi-${icon}`} aria-hidden="true" />
      {badge > 0 && <span className={styles.badge}>{badge > 9 ? '9+' : badge}</span>}
    </button>
  );
}
