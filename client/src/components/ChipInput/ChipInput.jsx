import { useState } from 'react';
import Field, { useFieldId } from '../Field/Field';
import Chip from '../Chip/Chip';
import cx from '../cx';
import styles from './ChipInput.module.css';

/**
 * Nhập nhiều giá trị chữ tự do, mỗi giá trị thành 1 chip.
 * Dùng cho: dị ứng / món kiêng trong Profile (allergy), nguyên liệu có sẵn khi tạo Meal Plan.
 *
 * Gõ rồi bấm Enter hoặc dấu phẩy để thêm · Backspace khi ô trống để xoá chip cuối.
 * Tự bỏ trùng (không phân biệt hoa thường).
 *
 * @param {string[]} value
 * @param {(values: string[]) => void} onChange
 * @param {string[]} [suggestions]  gợi ý bấm nhanh, vd ['Đậu phộng', 'Gluten', 'Đậu nành']
 * @param {number} [max]            tối đa bao nhiêu mục
 * @param {number} [maxLength=50]   độ dài mỗi mục
 * @param {string} [label] · [hint] · [error] · [required] · [placeholder] · [disabled]
 */
export default function ChipInput({
  label, value = [], onChange, suggestions = [], max, maxLength = 50, placeholder = 'Gõ rồi bấm Enter',
  hint, error, required, disabled, id, className,
}) {
  const [text, setText] = useState('');
  const { id: fieldId, inputProps } = useFieldId({ id, error, hint });
  const full = max != null && value.length >= max;
  const has = (v) => value.some((x) => x.toLowerCase() === v.toLowerCase());

  const add = (raw) => {
    const v = raw.trim().replace(/\s+/g, ' ').slice(0, maxLength);
    if (!v || has(v) || full) return;
    onChange?.([...value, v]);
  };
  const remove = (v) => onChange?.(value.filter((x) => x !== v));

  const onKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && text.trim()) {
      e.preventDefault();
      add(text);
      setText('');
    } else if (e.key === 'Backspace' && !text && value.length) {
      remove(value[value.length - 1]);
    }
  };

  const freeSuggestions = suggestions.filter((s) => !has(s));

  return (
    <Field
      id={fieldId}
      label={label}
      hint={hint ?? (max ? `Tối đa ${max} mục` : undefined)}
      error={error}
      required={required}
      className={className}
    >
      <div className={cx('form-control', styles.box, error && 'is-invalid', disabled && styles.disabled)}>
        {value.map((v) => <Chip key={v} onRemove={disabled ? undefined : () => remove(v)}>{v}</Chip>)}
        <input
          {...inputProps}
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value.replace(',', ''))}
          onKeyDown={onKeyDown}
          onBlur={() => { if (text.trim()) { add(text); setText(''); } }}
          placeholder={full ? 'Đã đủ số mục' : placeholder}
          disabled={disabled || full}
          maxLength={maxLength}
        />
      </div>
      {freeSuggestions.length > 0 && !full && !disabled && (
        <div className={styles.suggest}>
          <span>Gợi ý:</span>
          {freeSuggestions.map((s) => (
            <button key={s} type="button" className={styles.sugBtn} onClick={() => add(s)}>
              <i className="bi bi-plus" aria-hidden="true" />{s}
            </button>
          ))}
        </div>
      )}
    </Field>
  );
}
