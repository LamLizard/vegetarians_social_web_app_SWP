import { useLayoutEffect, useRef } from 'react';
import Field, { useFieldId } from '../Field/Field';
import cx from '../cx';

/**
 * Ô nhập nhiều dòng, tự cao lên theo nội dung: nội dung blog, mô tả món, hướng dẫn nấu, bình luận.
 *
 * @param {string} value
 * @param {(value: string, event) => void} onChange
 * @param {number} [rows=3]      chiều cao tối thiểu (số dòng)
 * @param {number} [maxRows=12]  cao tối đa rồi mới hiện thanh cuộn
 * @param {number} [maxLength]   có → hiện bộ đếm
 * @param {string} [label] · [hint] · [error] · [required] · [placeholder] · [disabled]
 */
export default function TextArea({
  label, value, onChange, hint, error, required, maxLength, rows = 3, maxRows = 12, id, className, ...rest
}) {
  const { id: fieldId, inputProps } = useFieldId({ id, error, hint });
  const ref = useRef(null);

  // Tự giãn chiều cao theo nội dung
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const line = parseFloat(cs.lineHeight) || 24;
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const borderY = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    el.style.height = 'auto';
    const max = line * maxRows + padY + borderY;
    el.style.height = `${Math.min(el.scrollHeight + borderY, max)}px`;
  }, [value, maxRows]);

  const counter = maxLength ? { value: String(value ?? '').length, max: maxLength } : undefined;

  return (
    <Field id={fieldId} label={label} hint={hint} error={error} required={required} counter={counter} className={className}>
      <textarea
        ref={ref}
        {...inputProps}
        className={cx('form-control', error && 'is-invalid')}
        rows={rows}
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value, e)}
        required={required}
        maxLength={maxLength}
        style={{ resize: 'vertical', overflowY: 'auto' }}
        {...rest}
      />
    </Field>
  );
}
