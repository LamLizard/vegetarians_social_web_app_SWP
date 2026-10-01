import { useId } from 'react';
import cx from '../cx';

/**
 * Ô nhập có nhãn + gợi ý + báo lỗi (dùng class form-control của Bootstrap).
 * Mọi prop còn lại (value, onChange, placeholder, type...) truyền thẳng vào <input>.
 * @param {string} label
 * @param {string} hint   dòng gợi ý dưới ô
 * @param {string} error  có giá trị → ô viền đỏ + hiện lỗi (thay cho hint)
 * @param {boolean} multiline  true → dùng <textarea>
 */
export default function FormField({ label, hint, error, required, multiline = false, className, ...inputProps }) {
  const id = useId();
  const describedBy = error || hint ? `${id}-desc` : undefined;
  const Field = multiline ? 'textarea' : 'input';

  return (
    <div className={cx('mb-3', className)}>
      {label && (
        <label htmlFor={id} className="form-label fw-semibold small mb-1">
          {label}
          {required && <span className="text-danger ms-1" aria-hidden="true">*</span>}
        </label>
      )}
      <Field
        id={id}
        className={cx('form-control', error && 'is-invalid')}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        required={required}
        rows={multiline ? 3 : undefined}
        {...inputProps}
      />
      {error ? (
        <div id={describedBy} className="invalid-feedback">{error}</div>
      ) : (
        hint && <div id={describedBy} className="form-text">{hint}</div>
      )}
    </div>
  );
}
