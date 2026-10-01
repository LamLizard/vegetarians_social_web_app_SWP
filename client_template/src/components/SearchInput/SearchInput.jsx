import cx from '../cx';
import styles from './SearchInput.module.css';

/**
 * Ô tìm kiếm có icon kính lúp (dùng ở header).
 * Mọi prop còn lại (value, onChange, onKeyDown...) truyền thẳng vào <input>.
 */
export default function SearchInput({
  placeholder = 'Tìm món chay, quán ăn, công thức...',
  label = 'Tìm kiếm',
  className,
  ...inputProps
}) {
  return (
    <div className={cx(styles.wrap, className)}>
      <i className={cx('bi bi-search', styles.icon)} aria-hidden="true" />
      <input
        type="search"
        className={cx('form-control', styles.input)}
        placeholder={placeholder}
        aria-label={label}
        {...inputProps}
      />
    </div>
  );
}
