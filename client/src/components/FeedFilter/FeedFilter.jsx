// Khoi's code: Hàng nút lọc Bảng tin theo danh mục — theo prototype UI v2 (src/v2/App.jsx → .tabs). 01/11/2026: đổi sang giao diện v4.
// Danh mục lấy từ API (GET /api/categories), không cố định như prototype.
// Gọn 1 hàng: "Tất cả" + tối đa MAX_INLINE danh mục; còn lại gom vào nút "Thêm ▾" (Menu của kit).
// Khoi's code 29/10: trang truyền options đã xếp theo số bài (nhiều nhất trước) → 4 nút đầu là chủ đề hay dùng nhất.
//   Nút cuối "Thêm ▾" mở menu có ô lọc nhanh (chủ đề do Admin thêm có thể nhiều lên).
import { useLayoutEffect, useRef, useState } from 'react';
import Menu from '../Menu/Menu';
import cx from '../cx';
import s from './FeedFilter.module.css';

const MAX_INLINE = 4;
const plain = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

/** Danh sách chủ đề còn lại trong menu "Thêm", có ô lọc nhanh */
function MoreTopics({ rest, value, onPick }) {
  const [q, setQ] = useState('');
  const key = plain(q.trim());
  const shown = key ? rest.filter((o) => plain(o.name).includes(key)) : rest;
  return (
    <div className={s.morePanel}>
      <input
        type="search"
        className={s.moreSearch}
        placeholder="Lọc nhanh chủ đề…"
        aria-label="Lọc nhanh chủ đề"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />
      <div className={s.moreList}>
        {shown.map((o) => (
          <button
            key={o.id}
            type="button"
            role="menuitemradio"
            aria-checked={o.id === value}
            className={cx(s.moreItem, o.id === value && s.moreItemOn)}
            onClick={() => onPick(o.id)}
          >
            <span>{o.name}</span>
            {o.postCount != null && <small>{o.postCount} bài</small>}
            {o.id === value && <i className="bi bi-check2" aria-hidden="true" />}
          </button>
        ))}
        {shown.length === 0 && <span className={s.moreNone}>Không có chủ đề nào khớp “{q}”</span>}
      </div>
    </div>
  );
}

const SORTS = [
  { value: 'new', label: 'Mới nhất', icon: 'clock' },
  { value: 'top', label: 'Nhiều tim', icon: 'heart' },
];

/**
 * Khoi's code 01/11/2026: giao diện theo prototype v4 (src/v4/components/FeedTabs.jsx) —
 * tab chữ + gạch chân xanh dưới tab đang chọn, "Thêm ▾" (menu có ô lọc nhanh), nút sắp xếp "Mới nhất ▾ / Nhiều tim" bên phải.
 *
 * @param {{id: string, name: string, postCount?: number}[]} options  đã xếp theo thứ tự muốn hiện
 * @param {string|null} value   id đang chọn, null = Tất cả
 * @param {(id: string|null) => void} onChange
 * @param {'new'|'top'} [sort] · @param {(v: 'new'|'top') => void} [onSortChange]   không truyền → ẩn nút sắp xếp
 */
export default function FeedFilter({ options = [], value = null, onChange, sort = 'new', onSortChange }) {
  // Khoi's code 01/11: hiện TỐI ĐA MAX_INLINE chủ đề, nhưng chỉ bao nhiêu VỪA 1 hàng (đo bằng hàng ẩn bên dưới);
  // không vừa thì chuyển vào "Thêm" → không bao giờ bị cắt chữ (tên chủ đề thật dài hơn prototype).
  const [fit, setFit] = useState(MAX_INLINE);
  const tabsRef = useRef(null);
  const measureRef = useRef(null);
  const names = options.slice(0, MAX_INLINE).map((o) => o.name).join('|');
  useLayoutEffect(() => {
    const box = tabsRef.current;
    const ruler = measureRef.current;
    if (!box || !ruler || typeof ResizeObserver === 'undefined') return undefined;
    const update = () => {
      const widths = [...ruler.children].map((el) => el.getBoundingClientRect().width);
      const room = box.getBoundingClientRect().width;
      let used = widths[0] ?? 0; // "Tất cả"
      let n = 0;
      while (n < widths.length - 1 && used + 4 + widths[n + 1] <= room) { used += 4 + widths[n + 1]; n += 1; }
      setFit(n);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(box);
    return () => ro.disconnect();
  }, [names]);
  const inline = options.slice(0, Math.min(fit, MAX_INLINE));
  const rest = options.slice(inline.length);
  const picked = rest.find((o) => o.id === value); // đang chọn 1 mục trong "Thêm" → nút hiện tên mục đó
  const currentSort = SORTS.find((o) => o.value === sort) ?? SORTS[0];

  const tab = (id, label) => (
    <button key={id ?? 'all'} type="button" className={cx(s.tab, value === id && s.on)} aria-pressed={value === id} onClick={() => onChange(id)}>
      {label}
    </button>
  );

  return (
    <div className={s.wrap}>
      <div ref={tabsRef} className={s.tabs} role="group" aria-label="Lọc theo chủ đề">
        {tab(null, 'Tất cả')}
        {inline.map((o) => tab(o.id, o.name))}
      </div>
      {/* Hàng đo (ẩn): bề rộng thật của "Tất cả" + MAX_INLINE chủ đề đầu */}
      <div ref={measureRef} className={s.measure} aria-hidden="true">
        <span className={s.tab}>Tất cả</span>
        {options.slice(0, MAX_INLINE).map((o) => <span key={o.id} className={s.tab}>{o.name}</span>)}
      </div>
      {/* "Thêm" nằm NGOÀI hàng tab (hàng tab cuộn ngang → overflow sẽ cắt mất menu thả xuống) */}
      {rest.length > 0 && (
        <Menu
          width={240}
          align="start"
          className={s.moreWrap}
          role="menu"
          ariaLabel="Chủ đề khác"
          renderTrigger={(p) => (
            <button type="button" className={cx(s.tab, picked && s.on)} title={picked ? undefined : `${rest.length} chủ đề khác`} {...p}>
              <span className={s.moreLabel}>{picked ? picked.name : 'Thêm'}</span>
              <i className="bi bi-chevron-down" aria-hidden="true" />
            </button>
          )}
        >
          {(close) => <MoreTopics rest={rest} value={value} onPick={(id) => { close(); onChange(id); }} />}
        </Menu>
      )}

      {onSortChange && (
        <Menu
          width={180}
          align="end"
          className={s.sortWrap}
          items={SORTS.map((o) => ({
            icon: o.value === sort ? 'check2' : o.icon,
            label: o.label,
            onClick: () => onSortChange(o.value),
          }))}
          renderTrigger={(p) => (
            <button type="button" className={s.sort} aria-label={`Sắp xếp: ${currentSort.label}`} {...p}>
              {currentSort.label} <i className="bi bi-chevron-down" aria-hidden="true" />
            </button>
          )}
        />
      )}
    </div>
  );
}
