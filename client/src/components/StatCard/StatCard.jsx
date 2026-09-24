import Skeleton from '../Skeleton/Skeleton';
import cx from '../cx';
import { getLink } from '../link';
import { formatNumber } from '../../utils/format';
import styles from './StatCard.module.css';

/**
 * Ô số liệu: Admin Dashboard (M-14: Post chờ duyệt, Dish chờ duyệt, Shop chờ xác minh, Report chờ xử lý)
 * và chỉ số sức khoẻ ở Meal Planner (BMI, TDEE, calo mục tiêu).
 * Có href/onClick → cả ô bấm được (vd mở đúng tab trong Moderation Center).
 *
 * @param {string} label
 * @param {number|string} value         số tự thêm dấu chấm ngăn cách: 1250 → "1.250"
 * @param {string} [unit]               "kcal", "bài"...
 * @param {string} [icon]
 * @param {'default'|'ok'|'warn'|'bad'} [tone='default']  warn khi có việc cần làm (vd còn mục chờ duyệt)
 * @param {React.ReactNode} [hint]      dòng nhỏ bên dưới, vd <StatusBadge .../> hoặc "Cập nhật 5 phút trước"
 * @param {string} [href] · [linkAs] · [onClick]
 * @param {boolean} [loading]
 */
export default function StatCard({
  label, value, unit, icon, tone = 'default', hint, href, linkAs, onClick, loading = false, className,
}) {
  const clickable = !!(href || onClick);
  const [Link, linkProps] = getLink(linkAs, href);
  const Tag = href ? Link : onClick ? 'button' : 'div';
  const tagProps = href ? linkProps : onClick ? { type: 'button', onClick } : {};

  return (
    <Tag {...tagProps} className={cx(styles.card, styles[tone], clickable && styles.clickable, className)}>
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        {icon && <span className={styles.icon} aria-hidden="true"><i className={`bi bi-${icon}`} /></span>}
      </div>
      {loading ? (
        <Skeleton shape="block" width="45%" height={34} />
      ) : (
        <div className={styles.value}>
          {typeof value === 'number' ? formatNumber(value) : value ?? 'Chưa có'}
          {unit && <small>{unit}</small>}
        </div>
      )}
      {hint && <div className={styles.hint}>{hint}</div>}
      {clickable && <i className={cx('bi bi-arrow-right', styles.go)} aria-hidden="true" />}
    </Tag>
  );
}
