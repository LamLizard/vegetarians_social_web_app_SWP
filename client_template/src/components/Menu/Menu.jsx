import { useEffect, useId, useRef, useState } from 'react';
import cx from '../cx';
import styles from './Menu.module.css';

/**
 * Menu thả xuống (nút "…" trên bài viết, menu tài khoản, thông báo).
 * Bấm ra ngoài hoặc Esc để đóng.
 * @param {(props)=>React.ReactNode} renderTrigger  nhận props phải gắn vào nút mở menu
 * @param {{icon?:string, label:string, onClick?:()=>void, tone?:'alert', hint?:string}[]} items
 *        phần tử { divider: true } = đường kẻ ngăn cách
 * @param {(close:()=>void)=>React.ReactNode} children  dùng thay items khi cần nội dung tự do
 * @param {'start'|'end'} align  canh menu theo mép trái / phải của nút
 * @param {number} width  px, mặc định 240
 * @param {'bottom'|'right'} side  bottom = xổ xuống dưới nút · right = bật sang phải, canh đáy (nút ở cuối dock)
 */
export default function Menu({ renderTrigger, items, align = 'end', side = 'bottom', width = 240, className, children }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const menuId = useId();
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={cx(styles.wrap, className)}>
      {renderTrigger({
        onClick: () => setOpen((o) => !o),
        'aria-expanded': open,
        'aria-haspopup': 'menu',
        'aria-controls': open ? menuId : undefined,
      })}

      {open && (
        <div id={menuId} className={cx(styles.menu, side === 'right' ? styles.right : styles[align])} style={{ width }} role={items ? 'menu' : undefined}>
          {items
            ? items.map((it, i) => (it.divider ? (
              <hr key={`d${i}`} className={styles.divider} />
            ) : (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                className={cx(styles.item, it.tone === 'alert' && styles.alert)}
                onClick={() => { close(); it.onClick?.(); }}
              >
                {it.icon && <i className={`bi bi-${it.icon}`} aria-hidden="true" />}
                <span>
                  {it.label}
                  {it.hint && <small>{it.hint}</small>}
                </span>
              </button>
            )))
            : children?.(close)}
        </div>
      )}
    </div>
  );
}
