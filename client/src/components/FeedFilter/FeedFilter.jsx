// Khoi's code: Hàng nút lọc Bảng tin theo danh mục — theo prototype UI v2 (src/v2/App.jsx → .tabs).
// Danh mục lấy từ API (GET /api/categories), không cố định như prototype.
// Gọn 1 hàng: "Tất cả" + tối đa MAX_INLINE danh mục; còn lại gom vào nút "Khác" (Menu của kit).
// Khoi's code 29/10: trang truyền options đã xếp theo số bài (nhiều nhất trước) → 4 nút đầu là chủ đề hay dùng nhất.
//   Nút cuối "+N chủ đề" mở menu có ô lọc nhanh (chủ đề do Admin thêm có thể nhiều lên).
import { useState } from 'react';
import Menu from '../Menu/Menu';
import cx from '../cx';
import s from './FeedFilter.module.css';

const MAX_INLINE = 4;
const plain = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

/** Danh sách chủ đề còn lại trong menu "+N chủ đề", có ô lọc nhanh */
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

/**
 * @param {{id: string, name: string, postCount?: number}[]} options  đã xếp theo thứ tự muốn hiện
 * @param {string|null} value   id đang chọn, null = Tất cả
 * @param {(id: string|null) => void} onChange
 */
export default function FeedFilter({ options = [], value = null, onChange }) {
  const inline = options.slice(0, MAX_INLINE);
  const rest = options.slice(MAX_INLINE);
  const picked = rest.find((o) => o.id === value); // đang chọn 1 mục trong "Khác" → nút Khác hiện tên mục đó

  const tab = (id, label) => (
    <button key={id ?? 'all'} type="button" className={cx(s.tab, value === id && s.on)} aria-pressed={value === id} onClick={() => onChange(id)}>
      {label}
    </button>
  );

  return (
    <div className={s.tabs} role="group" aria-label="Lọc theo chủ đề">
      {tab(null, 'Tất cả')}
      {inline.map((o) => tab(o.id, o.name))}
      {rest.length > 0 && (
        <Menu
          width={240}
          align="end"
          className={s.moreWrap}
          role="menu"
          ariaLabel="Chủ đề khác"
          renderTrigger={(p) => (
            <button type="button" className={cx(s.tab, s.more, picked && s.on)} {...p}>
              <span className={s.moreLabel}>{picked ? picked.name : `+${rest.length} chủ đề`}</span>
              <i className="bi bi-chevron-down" aria-hidden="true" />
            </button>
          )}
        >
          {(close) => <MoreTopics rest={rest} value={value} onPick={(id) => { close(); onChange(id); }} />}
        </Menu>
      )}
    </div>
  );
}
