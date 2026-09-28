import cx from '../cx';
import styles from './Tabs.module.css';

/**
 * Thanh tab gạch chân (trang hồ sơ, bảng tin, trang duyệt nội dung).
 * Trên điện thoại tự cuộn ngang.
 * @param {{key:string, label:string, icon?:string, count?:number}[]} items
 * @param {string} value  key đang chọn
 * @param {(key:string)=>void} onChange
 * @param {string} label  mô tả nhóm tab cho trình đọc màn hình
 */
export default function Tabs({ items, value, onChange, label = 'Chọn mục', className }) {
  return (
    <div className={cx(styles.tabs, className)} role="tablist" aria-label={label}>
      {items.map((t) => {
        const selected = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cx(styles.tab, selected && styles.selected)}
            onClick={() => onChange?.(t.key)}
          >
            {t.icon && <i className={`bi bi-${t.icon}`} aria-hidden="true" />}
            {t.label}
            {t.count != null && <span className={styles.count}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
