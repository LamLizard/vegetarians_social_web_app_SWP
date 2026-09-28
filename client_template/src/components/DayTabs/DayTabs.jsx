import cx from '../cx';
import styles from './DayTabs.module.css';

export const WEEK_DAYS = [
  { key: 'mon', label: 'Thứ 2' },
  { key: 'tue', label: 'Thứ 3' },
  { key: 'wed', label: 'Thứ 4' },
  { key: 'thu', label: 'Thứ 5' },
  { key: 'fri', label: 'Thứ 6' },
  { key: 'sat', label: 'Thứ 7' },
  { key: 'sun', label: 'CN' },
];

/**
 * Dãy nút chọn ngày trong tuần (trang Thực đơn tuần).
 * @param {{key:string,label:string,sub?:string}[]} days  mặc định: Thứ 2 → CN
 * @param {string} value     key của ngày đang chọn
 * @param {string} todayKey  key của hôm nay → có chấm nhỏ đánh dấu
 * @param {(key:string)=>void} onChange
 */
export default function DayTabs({ days = WEEK_DAYS, value, todayKey, onChange, className }) {
  return (
    <div className={cx(styles.row, className)} role="group" aria-label="Chọn ngày">
      {days.map((d) => {
        const selected = d.key === value;
        return (
          <button
            key={d.key}
            type="button"
            className={cx(styles.day, selected && styles.selected)}
            aria-pressed={selected}
            onClick={() => onChange?.(d.key)}
          >
            <span>{d.label}</span>
            {d.sub && <small className={styles.sub}>{d.sub}</small>}
            {d.key === todayKey && (
              <span className={styles.today} title="Hôm nay" aria-label="Hôm nay" />
            )}
          </button>
        );
      })}
    </div>
  );
}
