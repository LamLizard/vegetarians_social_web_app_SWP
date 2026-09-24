import cx from '../cx';
import styles from './SearchInput.module.css';

/**
 * Ô tìm kiếm có kính lúp + nút xoá nhanh.
 * Dùng cho: thanh trên (tìm bài), trang kết quả M-02, danh sách quán, bảng admin.
 *
 * @param {string} value
 * @param {(value: string) => void} onChange       mỗi lần gõ
 * @param {(value: string) => void} [onSearch]     bấm Enter (gọi API ở đây, không gọi mỗi lần gõ)
 * @param {string} [placeholder='Tìm bài viết, món chay...']
 * @param {string} [label='Tìm kiếm']   đọc cho trình đọc màn hình (ô không có nhãn hiện ra)
 * @param {'sm'|'md'|'lg'} [size='md']
 * @param {boolean} [loading]           hiện vòng xoay thay kính lúp khi đang tìm
 */
export default function SearchInput({
  value, onChange, onSearch, placeholder = 'Tìm bài viết, món chay...', label = 'Tìm kiếm',
  size = 'md', loading = false, className, ...rest
}) {
  return (
    <form
      role="search"
      className={cx(styles.wrap, className)}
      onSubmit={(e) => { e.preventDefault(); onSearch?.(String(value ?? '').trim()); }}
    >
      {loading
        ? <span className={cx('spinner-border spinner-border-sm', styles.icon)} aria-hidden="true" />
        : <i className={cx('bi bi-search', styles.icon)} aria-hidden="true" />}
      <input
        type="search"
        className={cx('form-control', size !== 'md' && `form-control-${size}`, styles.input)}
        placeholder={placeholder}
        aria-label={label}
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value, e)}
        enterKeyHint="search"
        {...rest}
      />
      {value && (
        <button
          type="button"
          className={styles.clear}
          aria-label="Xoá nội dung tìm kiếm"
          onClick={() => { onChange?.(''); onSearch?.(''); }}
        >
          <i className="bi bi-x-circle-fill" aria-hidden="true" />
        </button>
      )}
    </form>
  );
}
