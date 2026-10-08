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
 */
export default function FeedTopbar({
  value,
  onChange,
  onSearch,
  onOpenMenu,
  placeholder = 'Tìm bài viết theo tiêu đề…',
  searchLabel = 'Tìm bài viết',
  onLogin,
}) {
  return (
    <header className={s.bar}>
      <div className={s.inner}>
        <button type="button" className={s.menuBtn} onClick={onOpenMenu} aria-label="Mở menu">
          <i className="bi bi-list" aria-hidden="true" />
        </button>

        <form
          role="search"
          className={s.search}
          onSubmit={(e) => { e.preventDefault(); onSearch(value.trim()); }}
        >
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

        {onLogin && (
          <button type="button" className={s.login} onClick={onLogin}>Đăng nhập</button>
        )}
      </div>
    </header>
  );
}
