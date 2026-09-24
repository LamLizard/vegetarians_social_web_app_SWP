import { useRef } from 'react';
import cx from '../cx';
import styles from './Tabs.module.css';

/**
 * Thanh tab gạch chân trong trang (Bài của tôi: Blog/Video, Moderation Center: Post/Dish/Shop/Report...).
 * Trên điện thoại tự cuộn ngang. Bàn phím: ← → Home End để chuyển tab.
 *
 * @param {{key: string, label: string, icon?: string, count?: number, disabled?: boolean}[]} items
 * @param {string} value       key đang chọn
 * @param {(key: string) => void} onChange
 * @param {string} [label='Chọn mục']  mô tả nhóm tab cho trình đọc màn hình
 *
 * Tabs chỉ vẽ thanh tab. Nội dung bên dưới do trang tự đổi theo `value`.
 */
export default function Tabs({ items, value, onChange, label = 'Chọn mục', className }) {
  const listRef = useRef(null);

  const onKeyDown = (e) => {
    const enabled = items.filter((t) => !t.disabled);
    const i = enabled.findIndex((t) => t.key === value);
    let next;
    if (e.key === 'ArrowRight') next = enabled[(i + 1) % enabled.length];
    else if (e.key === 'ArrowLeft') next = enabled[(i - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    if (!next) return;
    e.preventDefault();
    onChange?.(next.key);
    listRef.current?.querySelector(`[data-key="${CSS.escape(next.key)}"]`)?.focus();
  };

  return (
    <div ref={listRef} className={cx(styles.tabs, className)} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {items.map((t) => {
        const selected = t.key === value;
        return (
          <button
            key={t.key}
            data-key={t.key}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={t.disabled}
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
