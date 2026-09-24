import Field, { useFieldId } from '../Field/Field';
import cx from '../cx';
import styles from './TextField.module.css';

/**
 * Ô nhập 1 dòng: tiêu đề bài, email, tên quán, số cân nặng...
 *
 * @param {string} [label]
 * @param {string} value
 * @param {(value: string, event) => void} onChange   nhận THẲNG giá trị: onChange={setTitle}
 * @param {string} [type='text']   'email' | 'number' | 'url' | 'tel'... (mật khẩu dùng PasswordField)
 * @param {string} [hint] · [error] · [required] · [disabled] · [placeholder]
 * @param {number} [maxLength]     có → hiện bộ đếm "12/200" (nên khớp độ dài cột VARCHAR)
 * @param {string} [icon]          icon bên trái ô, vd "envelope"
 * @param {string} [suffix]        chữ đơn vị bên phải, vd "kg", "cm", "kcal", "đ"
 * @param {'sm'|'md'|'lg'} [size='md']
 *
 * Mọi prop khác (name, autoComplete, min, max, step, onBlur, inputMode...) truyền thẳng xuống <input>.
 */
export default function TextField({
  label, value, onChange, type = 'text', hint, error, required, maxLength, icon, suffix,
  size = 'md', id, className, ...rest
}) {
  const { id: fieldId, inputProps } = useFieldId({ id, error, hint });
  const counter = maxLength ? { value: String(value ?? '').length, max: maxLength } : undefined;

  return (
    <Field id={fieldId} label={label} hint={hint} error={error} required={required} counter={counter} className={className}>
      <div className={cx(styles.wrap, icon && styles.hasIcon, suffix && styles.hasSuffix)}>
        {icon && <i className={cx(`bi bi-${icon}`, styles.icon)} aria-hidden="true" />}
        <input
          {...inputProps}
          type={type}
          className={cx('form-control', size !== 'md' && `form-control-${size}`, error && 'is-invalid')}
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value, e)}
          required={required}
          maxLength={maxLength}
          {...rest}
        />
        {suffix && <span className={styles.suffix} aria-hidden="true">{suffix}</span>}
      </div>
    </Field>
  );
}
