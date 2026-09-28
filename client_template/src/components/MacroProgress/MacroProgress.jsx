import { NUTRIENTS } from '../nutrients';
import cx from '../cx';
import styles from './MacroProgress.module.css';

/**
 * Danh sách thanh tiến độ theo từng nhóm chất: đã nạp / mục tiêu.
 * @param {{key:'protein'|'carb'|'fat'|'fiber', value:number, target:number, unit?:string}[]} items
 */
export default function MacroProgress({ items, className }) {
  return (
    <ul className={cx(styles.list, className)}>
      {items.map(({ key, value, target, unit = 'g' }) => {
        const n = NUTRIENTS[key];
        const pct = Math.min(100, Math.round((value / target) * 100));
        return (
          <li key={key} className={styles.row}>
            <div className={styles.head}>
              <span className={styles.name}>
                <span className={styles.swatch} style={{ background: n.color }} />
                {n.label}
              </span>
              <span className={styles.value}>
                <b>{value}</b> / {target}{unit}
              </span>
            </div>
            <div
              className={styles.track}
              role="progressbar"
              aria-label={n.label}
              aria-valuenow={value}
              aria-valuemin={0}
              aria-valuemax={target}
              aria-valuetext={`${value} trên ${target}${unit}`}
            >
              <div className={styles.fill} style={{ width: `${pct}%`, background: n.color }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
