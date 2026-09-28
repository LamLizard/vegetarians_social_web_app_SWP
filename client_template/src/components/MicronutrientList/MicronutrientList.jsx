import StatusBadge from '../StatusBadge/StatusBadge';
import cx from '../cx';
import styles from './MicronutrientList.module.css';

/**
 * Danh sách vi chất (B12, sắt, canxi, omega-3...) kèm trạng thái đủ/thiếu.
 * @param {{name:string, short?:string, amount?:string, status:'enough'|'low'|'lacking'}[]} items
 *   short  = ký hiệu hiện trong ô tròn, vd "Fe"; amount = lượng đã nạp, vd "12/18 mg"
 */
export default function MicronutrientList({ items, className }) {
  return (
    <ul className={cx(styles.list, className)}>
      {items.map((it) => (
        <li key={it.name} className={styles.row}>
          <span className={styles.symbol} aria-hidden="true">{it.short ?? it.name.slice(0, 2)}</span>
          <span className={styles.name}>
            {it.name}
            {it.amount && <small>{it.amount}</small>}
          </span>
          <StatusBadge status={it.status} />
        </li>
      ))}
    </ul>
  );
}
