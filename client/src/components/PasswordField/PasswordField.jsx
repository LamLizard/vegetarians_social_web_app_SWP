import { useState } from 'react';
import Field, { useFieldId } from '../Field/Field';
import cx from '../cx';
import styles from './PasswordField.module.css';

/**
 * Ô mật khẩu có nút hiện/ẩn. Dùng cho Đăng ký, Đăng nhập (M-17).
 *
 * @param {string} value
 * @param {(value: string, event) => void} onChange
 * @param {'current-password'|'new-password'} [autoComplete='current-password']
 *        Đăng nhập: current-password · Đăng ký: new-password (trình duyệt gợi ý mật khẩu mạnh)
 * @param {string} [label='Mật khẩu'] · [hint] · [error] · [required]
 */
export default function PasswordField({
  label = 'Mật khẩu', value, onChange, hint, error, required, autoComplete = 'current-password', id, className, ...rest
}) {
  const [show, setShow] = useState(false);
  const { id: fieldId, inputProps } = useFieldId({ id, error, hint });

  return (
    <Field id={fieldId} label={label} hint={hint} error={error} required={required} className={className}>
      <div className={styles.wrap}>
        <input
          {...inputProps}
          type={show ? 'text' : 'password'}
          className={cx('form-control', error && 'is-invalid')}
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value, e)}
          autoComplete={autoComplete}
          required={required}
          {...rest}
        />
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          aria-pressed={show}
        >
          <i className={`bi bi-${show ? 'eye-slash' : 'eye'}`} aria-hidden="true" />
        </button>
      </div>
    </Field>
  );
}
