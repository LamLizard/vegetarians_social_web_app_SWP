import Menu from '../Menu/Menu';
import s from './FeedTopbar.module.css';

/**
 * Thanh trên của Bảng tin (theo prototype UI v2.1): ô tìm kiếm thẳng cột với bảng tin.
 * Điện thoại: thêm nút ☰ mở thanh bên; khách có thêm nút Đăng nhập.
 *
 * @param {string} value · @param {(v: string) => void} onChange   chữ đang gõ
 * @param {(v: string) => void} onSearch   bấm Enter (chuỗi rỗng = xoá tìm kiếm)
 * @param {() => void} onOpenMenu
 * @param {string} [placeholder='Tìm bài viết theo tiêu đề…']
 * @param {string} [searchLabel='Tìm bài viết']
 * @param {() => void} [onLogin]   chỉ truyền khi là khách
 * @param {boolean} [hideSearch]   Khoi's code: ẩn ô tìm kiếm (trang không cần). Máy tính: ẩn cả thanh; điện thoại: giữ nút ☰
 * @param {{value: string, label: string, icon: string, hint?: string}[]} [scopes]
 *        Khoi's code 28/10: có → nút chọn phạm vi tìm ở đầu ô tìm (vd Tất cả · Tiêu đề · Tác giả · Chủ đề). Không truyền → như cũ.
 * @param {string} [scope] · @param {(v: string) => void} [onScopeChange]
 */
export default function FeedTopbar({
  value,
  onChange,
  onSearch,
  onOpenMenu,
  placeholder = 'Tìm bài viết theo tiêu đề…',
  searchLabel = 'Tìm bài viết',
  onLogin,
  hideSearch = false,
  scopes,
  scope,
  onScopeChange,
}) {
  const current = scopes?.find((o) => o.value === scope) ?? scopes?.[0];
  return (
    <header className={`${s.bar} ${hideSearch ? s.noSearch : ''}`}>
      <div className={s.inner}>
        <button type="button" className={s.menuBtn} onClick={onOpenMenu} aria-label="Mở menu">
          <i className="bi bi-list" aria-hidden="true" />
        </button>

        {!hideSearch && (
        <form
          role="search"
          className={s.search}
          onSubmit={(e) => { e.preventDefault(); onSearch(value.trim()); }}
        >
          {/* Khoi's code 28/10: chọn phạm vi tìm — luôn thấy đang tìm theo gì (phương án A) */}
          {current && (
            <>
              <Menu
                align="start"
                width={240}
                className={s.scopeWrap}
                role="menu"
                ariaLabel="Tìm theo"
                renderTrigger={(p) => (
                  <button type="button" className={s.scope} aria-label={`Tìm theo: ${current.label}`} {...p}>
                    <i className={`bi bi-${current.icon} ${s.scopeIcon}`} aria-hidden="true" />
                    <span className={s.scopeLabel}>{current.label}</span>
                    <i className={`bi bi-chevron-down ${s.scopeChevron}`} aria-hidden="true" />
                  </button>
                )}
              >
                {(close) => scopes.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={o.value === current.value}
                    className={`${s.scopeItem} ${o.value === current.value ? s.scopeItemOn : ''}`}
                    onClick={() => { close(); onScopeChange?.(o.value); }}
                  >
                    <i className={`bi bi-${o.icon}`} aria-hidden="true" />
                    <span>{o.label}{o.hint && <small>{o.hint}</small>}</span>
                    {o.value === current.value && <i className={`bi bi-check2 ${s.scopeCheck}`} aria-hidden="true" />}
                  </button>
                ))}
              </Menu>
              <span className={s.scopeDivider} aria-hidden="true" />
            </>
          )}
          <i className="bi bi-search" aria-hidden="true" />
          <input
            type="search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            aria-label={searchLabel}
            enterKeyHint="search"
            maxLength={100}
          />
          {value && (
            <button type="button" className={s.clear} onClick={() => { onChange(''); onSearch(''); }} aria-label="Xoá tìm kiếm">
              <i className="bi bi-x-circle-fill" aria-hidden="true" />
            </button>
          )}
        </form>
        )}

        {onLogin && (
          <button type="button" className={s.login} onClick={onLogin}>Đăng nhập</button>
        )}
      </div>
    </header>
  );
}
