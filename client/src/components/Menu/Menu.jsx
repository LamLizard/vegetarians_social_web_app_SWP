import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import cx from '../cx';
import styles from './Menu.module.css';

/**
 * Menu thả xuống (nút "…" trên bài viết, menu tài khoản, thông báo).
 * Bấm ra ngoài hoặc Esc để đóng.
 * @param {(props)=>React.ReactNode} renderTrigger  nhận props phải gắn vào nút mở menu
 * @param {{icon?:string, label:string, href?:string, onClick?:()=>void, tone?:'alert', hint?:string, disabled?:boolean}[]} items
 *        phần tử { divider: true } = đường kẻ ngăn cách
 * @param {(close:()=>void)=>React.ReactNode} children  dùng thay items khi cần nội dung tự do
 * @param {'start'|'end'} align  canh menu theo mép trái / phải của nút
 * @param {number} width  px, mặc định 240
 * @param {'bottom'|'right'} side  bottom = xổ xuống dưới nút · right = bật sang phải, canh đáy (nút ở cuối dock)
 */
export default function Menu({ renderTrigger, items, align = 'end', side = 'bottom', width = 240, className, panelClassName, role, ariaLabel, mobileSheet = false, portal = false, children }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, bottom: 12 });
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const menuId = useId();
  const close = () => setOpen(false);

  // Duy's Code: Đo nút neo và panel để popover portal không chiếm chỗ trong sidebar.
  const updatePosition = useCallback(() => {
    if (!portal || !wrapRef.current || typeof window === 'undefined') return;
    const trigger = wrapRef.current.firstElementChild || wrapRef.current;
    const anchor = trigger.getBoundingClientRect();
    const sidebarRight = wrapRef.current.closest('aside')?.getBoundingClientRect().right ?? anchor.right;
    const panel = panelRef.current;
    const panelWidth = panel?.getBoundingClientRect().width || width;
    const panelHeight = panel?.getBoundingClientRect().height || Math.min(560, window.innerHeight * 0.7);
    const left = Math.max(12, Math.min(sidebarRight + 12, window.innerWidth - panelWidth - 12));
    const alignedBottom = window.innerHeight - anchor.bottom;
    const maxBottom = Math.max(12, window.innerHeight - panelHeight - 12);
    const bottom = Math.max(12, Math.min(alignedBottom, maxBottom));
    setPosition({ left, bottom });
  }, [portal, width]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target) && !panelRef.current?.contains(e.target)) close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key !== 'Tab' || role !== 'dialog') return;
      const controls = panelRef.current?.querySelectorAll('a[href], button:not(:disabled)');
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      const panel = panelRef.current;
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || document.activeElement === panel)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('popstate', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('popstate', close);
    };
  }, [open, role]);

  useEffect(() => {
    if (!open || !portal) return undefined;
    updatePosition();
    const onChange = () => updatePosition();
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, true);
    return () => {
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, true);
    };
  }, [open, portal, updatePosition]);

  useEffect(() => {
    if (!open || role !== 'dialog') return;
    panelRef.current?.focus();
  }, [menuId, open, role]);

  return (
    <div ref={wrapRef} className={cx(styles.wrap, className)}>
      {renderTrigger({
        onClick: () => setOpen((o) => !o),
        'aria-expanded': open,
        'aria-haspopup': role === 'dialog' ? 'dialog' : 'menu',
        'aria-controls': open ? menuId : undefined,
      })}

      {open && (
        (portal && typeof document !== 'undefined' ? createPortal : (node) => node)(
        <>
        {mobileSheet && <button type="button" className={styles.backdrop} aria-label="Đóng thông báo" onClick={close} />}
        <div ref={panelRef} id={menuId} className={cx(styles.menu, portal && styles.portalMenu, panelClassName, side === 'right' ? styles.right : styles[align])}
          style={{ width, ...(portal && window.innerWidth >= 768 ? {
            left: position.left,
            bottom: position.bottom,
          } : {}) }}
          role={role || (items ? 'menu' : undefined)} aria-label={ariaLabel} aria-modal={role === 'dialog' && mobileSheet ? true : undefined}
          tabIndex={role === 'dialog' ? -1 : undefined}>
          {/* Duy's Code: Menu tài khoản thu gọn phải giữ href để mở đúng trang như menu sidebar thường. */}
          {items
            ? items.map((it, i) => (it.divider ? (
              <hr key={`d${i}`} className={styles.divider} />
            ) : (
              it.href ? <a
                key={it.label}
                href={it.href}
                role="menuitem"
                aria-disabled={it.disabled || undefined}
                className={cx(styles.item, it.tone === 'alert' && styles.alert)}
                onClick={(event) => {
                  if (it.disabled) { event.preventDefault(); return; }
                  close();
                  it.onClick?.();
                }}
              >
                {it.icon && <i className={`bi bi-${it.icon}`} aria-hidden="true" />}
                <span>
                  {it.label}
                  {it.hint && <small>{it.hint}</small>}
                </span>
              </a> : <button
                key={it.label}
                type="button"
                role="menuitem"
                disabled={it.disabled}
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
            // Duy's Code: Menu con nhận ReactNode hoặc render function; tránh gọi React element như hàm gây trắng trang.
            : (typeof children === 'function' ? children(close) : children)}
        </div>
        </>
        , document.body)
      )}
    </div>
  );
}
