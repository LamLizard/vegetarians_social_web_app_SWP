// Khoi's code: Hàng nút lọc Bảng tin theo danh mục — theo prototype UI v2 (src/v2/App.jsx → .tabs).
// Danh mục lấy từ API (GET /api/categories), không cố định như prototype.
// Gọn 1 hàng: "Tất cả" + tối đa MAX_INLINE danh mục; còn lại gom vào nút "Khác" (Menu của kit).
import Menu from '../Menu/Menu';
import cx from '../cx';
import s from './FeedFilter.module.css';

const MAX_INLINE = 4;

/**
 * @param {{id: string, name: string}[]} options
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
          width={220}
          className={s.moreWrap}
          items={rest.map((o) => ({ icon: o.id === value ? 'check2' : undefined, label: o.name, onClick: () => onChange(o.id) }))}
          renderTrigger={(p) => (
            <button type="button" className={cx(s.tab, s.more, picked && s.on)} {...p}>
              <span className={s.moreLabel}>{picked ? picked.name : 'Khác'}</span>
              <i className="bi bi-chevron-down" aria-hidden="true" />
            </button>
          )}
        />
      )}
    </div>
  );
}
