import { useId } from 'react';
import cx from '../cx';
import styles from './Checkbox.module.css';

/**
 * Ô tick có / không.
 * Dùng cho: đồng ý thu thập dữ liệu sức khoẻ (BR-08, profile.consent_at), "Ghi nhớ đăng nhập",
 * món trong menu quán "Đang bán" (shop_dish.is_available).
 *
 * @param {boolean} checked
 * @param {(checked: boolean, event) => void} onChange
 * @param {React.ReactNode} children   chữ bên cạnh ô tick
 * @param {string} [hint]      dòng giải thích nhỏ bên dưới
 * @param {string} [error]
 * @param {boolean} [switch]   hiện dạng công tắc gạt (bật/tắt tức thì, vd "Đang bán")
 * @param {boolean} [disabled] · [required]
 */
export default function Checkbox({
  checked, onChange, children, hint, error, switch: isSwitch = false, disabled, required, id, className, ...rest
}) {
  const auto = useId();
  const boxId = id ?? auto;
  const descId = error || hint ? `${boxId}-desc` : undefined;

  return (
    <div className={cx('form-check', isSwitch && 'form-switch', styles.check, className)}>
      <input
        id={boxId}
        type="checkbox"
        role={isSwitch ? 'switch' : undefined}
        className={cx('form-check-input', error && 'is-invalid')}
        checked={!!checked}
        onChange={(e) => onChange?.(e.target.checked, e)}
        disabled={disabled}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={descId}
        {...rest}
      />
      <label htmlFor={boxId} className={cx('form-check-label', styles.label)}>
        {children}
        {required && <span className={styles.req} aria-hidden="true">*</span>}
      </label>
      {error
        ? <div id={descId} className={styles.error} role="alert">{error}</div>
        : hint && <div id={descId} className={styles.hint}>{hint}</div>}
    </div>
  );
}
