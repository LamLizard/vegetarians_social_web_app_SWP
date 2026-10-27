import cx from '../cx';
import { getStatus } from '../../constants/status';
import styles from './StatusBadge.module.css';

/**
 * Nhãn trạng thái của một đối tượng (bài đăng, món, quán, tài khoản, báo cáo...).
 * Chữ, màu và icon lấy từ src/constants/status.js, khớp đúng giá trị trong database.
 *
 * @param {'post'|'comment'|'dish'|'shop'|'shopDish'|'shopOpen'|'account'|'report'|'mealPlan'} entity  BẮT BUỘC
 * @param {string} status  đúng giá trị API trả về, vd 'pending', 'verified'
 * @param {string} [label] ghi đè chữ mặc định (hiếm khi cần)
 * @param {'ok'|'warn'|'bad'|'neutral'} [toneOverride] ghi đè màu ở nơi dùng cụ thể, không đổi bảng trạng thái toàn app
 * @param {'sm'|'md'} [size='md']
 *
 * @example <StatusBadge entity="post" status={post.status} />
 * @example <StatusBadge entity="shopDish" status={item.is_available ? 'available' : 'unavailable'} />
 */
// Duy's Code: Tone override chỉ được truyền ở Bài của tôi cho trạng thái bị từ chối/gỡ/xóa.
export default function StatusBadge({ entity, status, label, toneOverride, size = 'md', className }) {
  const s = getStatus(entity, status);
  return (
    <span className={cx(styles.badge, styles[toneOverride || s.tone], size === 'sm' && styles.sm, className)}>
      <i className={`bi bi-${s.icon}`} aria-hidden="true" />
      {label ?? s.label}
    </span>
  );
}
