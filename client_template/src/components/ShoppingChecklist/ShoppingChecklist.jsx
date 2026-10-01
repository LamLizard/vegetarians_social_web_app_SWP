import { useId, useState } from 'react';
import cx from '../cx';
import styles from './ShoppingChecklist.module.css';

/**
 * Một nhóm trong danh sách đi chợ (Rau củ, Đậu hũ, Hạt & ngũ cốc...), tick được từng món.
 * @param {string} title
 * @param {string} icon  tên Bootstrap Icon
 * @param {{id:string, name:string, qty:string, checked?:boolean}[]} items  trạng thái ban đầu
 * @param {(items)=>void} onChange  nhận lại danh sách mới mỗi khi tick
 */
export default function ShoppingChecklist({ title, icon = 'basket', items: initial, onChange, className }) {
  const [items, setItems] = useState(initial);
  const baseId = useId();
  const done = items.filter((i) => i.checked).length;

  const toggle = (id) => {
    const next = items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i));
    setItems(next);
    onChange?.(next);
  };

  return (
    <section className={cx(styles.group, className)}>
      <header className={styles.head}>
        <span className={styles.title}>
          <i className={`bi bi-${icon}`} aria-hidden="true" />
          {title}
        </span>
        <span className={styles.count}>{done}/{items.length}</span>
      </header>
      <ul className={styles.list}>
        {items.map((it) => {
          const id = `${baseId}-${it.id}`;
          return (
            <li key={it.id} className={cx('form-check', styles.item, it.checked && styles.checked)}>
              <input id={id} type="checkbox" className="form-check-input" checked={!!it.checked} onChange={() => toggle(it.id)} />
              <label htmlFor={id} className={cx('form-check-label', styles.name)}>{it.name}</label>
              <span className={styles.qty}>{it.qty}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
