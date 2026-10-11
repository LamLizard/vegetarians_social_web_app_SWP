import cx from '../cx';
import styles from './Avatar.module.css';

// Lấy chữ cái cuối của tên (người Việt gọi theo tên): "Lâm Anh Khôi" → "K"
const initialOf = (name = '') => name.trim().split(/\s+/).pop()?.charAt(0).toUpperCase() ?? '?';

// Mỗi người một tông màu theo tên → bảng tin không bị đều đều (đã chốt 09/10/2026, phương án 2).
// Đây là NGOẠI LỆ của bảng 6 màu (giống màu dinh dưỡng): chỉ dùng cho avatar chữ cái.
// Tông chỉ pha nhạt vào nền thẻ (20%) và pha với màu chữ (64%) → chữ đạt ≥ 4.5:1 ở cả Sáng lẫn Tối.
const TONES = ['#3D7A3D', '#A0582A', '#2F7E8E', '#8B55A8', '#A87A00', '#C0502F'];
const hash = (s = '') => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/**
 * Ảnh đại diện; không có ảnh → hiện chữ cái của tên trên nền màu riêng theo tên.
 * @param {number} size  px, mặc định 40
 */
export default function Avatar({ src, name, size = 40, className }) {
  // flex: none viết trực tiếp (inline) để CSS của khối cha (vd `.composer span { flex: 1 }`) không kéo giãn avatar
  const style = { width: size, height: size, flex: 'none', fontSize: size * 0.4 };
  if (src) {
    return <img src={src} alt={name ?? ''} className={cx(styles.avatar, className)} style={style} />;
  }
  return (
    <span
      className={cx(styles.avatar, styles.initial, className)}
      style={{ ...style, '--av-tone': TONES[hash(name) % TONES.length] }}
      role="img"
      aria-label={name}
    >
      {initialOf(name)}
    </span>
  );
}
