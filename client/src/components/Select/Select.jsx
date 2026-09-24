import Field, { useFieldId } from '../Field/Field';
import cx from '../cx';

/**
 * Hộp chọn 1 giá trị (dùng <select> gốc → chạy tốt trên điện thoại).
 * Dùng cho: mức vận động, giới tính, lý do báo cáo, sắp xếp "Mới nhất / Xem nhiều".
 * Ít hơn 5 lựa chọn và muốn thấy hết cùng lúc → dùng RadioGroup.
 *
 * @param {{value: string, label: string, disabled?: boolean}[]} options
 *        Lấy từ hằng số: options={toOptions(ACTIVITY_LEVEL)}
 * @param {string} value
 * @param {(value: string, event) => void} onChange
 * @param {string} [placeholder]  dòng đầu "Chọn...", không chọn được lại
 * @param {string} [label] · [hint] · [error] · [required] · [disabled]
 * @param {'sm'|'md'|'lg'} [size='md']
 */
export default function Select({
  label, options = [], value, onChange, placeholder, hint, error, required, size = 'md', id, className, ...rest
}) {
  const { id: fieldId, inputProps } = useFieldId({ id, error, hint });
  return (
    <Field id={fieldId} label={label} hint={hint} error={error} required={required} className={className}>
      <select
        {...inputProps}
        className={cx('form-select', size !== 'md' && `form-select-${size}`, error && 'is-invalid')}
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value, e)}
        required={required}
        {...rest}
      >
        {placeholder !== undefined && <option value="" disabled>{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
        ))}
      </select>
    </Field>
  );
}
