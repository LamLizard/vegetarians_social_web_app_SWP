import cx from '../cx';
import styles from './Avatar.module.css';

// Lấy chữ cái cuối của tên (người Việt gọi theo tên): "Lâm Anh Khôi" → "K"
const initialOf = (name = '') => name.trim().split(/\s+/).pop()?.charAt(0).toUpperCase() ?? '?';

/**
 * Ảnh đại diện; không có ảnh → hiện chữ cái đầu của tên.
 * @param {number} size  px, mặc định 40
 */
export default function Avatar({ src, name, size = 40, className }) {
  const style = { width: size, height: size, fontSize: size * 0.42 };
  return src ? (
    <img src={src} alt={name ?? ''} className={cx(styles.avatar, className)} style={style} />
  ) : (
    <span className={cx(styles.avatar, styles.initial, className)} style={style} role="img" aria-label={name}>
      {initialOf(name)}
    </span>
  );
}
