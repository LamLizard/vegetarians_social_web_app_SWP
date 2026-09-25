import { useId, useMemo, useState } from 'react';
import Field from '../Field/Field';
import Chip from '../Chip/Chip';
import cx from '../cx';
import styles from './CategoryPicker.module.css';

// So khớp không dấu: "mon nuoc" tìm ra "Món nước"
const plain = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

/**
 * Chọn nhiều Category bằng chip bấm được (Post N-M Category, Dish N-M Category).
 * Dùng cho: form Viết Blog, Đăng Video, Tạo món; bộ lọc trang tìm kiếm.
 *
 * @param {{value: string|number, label: string}[]} options  danh sách category từ API (category_id, name)
 * @param {(string|number)[]} value      các id đang chọn
 * @param {(ids: (string|number)[]) => void} onChange
 * @param {number} [max]       tối đa bao nhiêu (hết chỗ → các chip còn lại bị khoá)
 * @param {number} [searchFrom=12]  nhiều hơn số này thì hiện ô lọc nhanh
 * @param {string} [label] · [hint] · [error] · [required] · [disabled]
 *
 * "Ít nhất 1 danh mục" (UC-03) kiểm tra ở trang, dùng validate.minItems().
 */
export default function CategoryPicker({
  label, options = [], value = [], onChange, max, searchFrom = 12, hint, error, required, disabled, className,
}) {
  const id = useId();
  const [q, setQ] = useState('');
  const full = max != null && value.length >= max;

  const shown = useMemo(
    () => (q.trim() ? options.filter((o) => plain(o.label).includes(plain(q.trim()))) : options),
    [options, q],
  );

  const toggle = (v) => {
    if (value.includes(v)) onChange?.(value.filter((x) => x !== v));
    else if (!full) onChange?.([...value, v]);
  };

  const autoHint = max ? `Đã chọn ${value.length}/${max}` : undefined;

  return (
    <Field id={id} as="legend" label={label} hint={hint ?? autoHint} error={error} required={required} className={className}>
      {options.length > searchFrom && (
        <div className={styles.search}>
          <i className="bi bi-search" aria-hidden="true" />
          <input
            type="search"
            className="form-control form-control-sm"
            placeholder="Lọc nhanh danh mục..."
            aria-label="Lọc nhanh danh mục"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      )}
      <div className={cx(styles.chips, error && styles.invalid)} role="group" aria-label={label}>
        {shown.map((o) => {
          const selected = value.includes(o.value);
          return (
            <Chip
              key={o.value}
              selected={selected}
              icon={selected ? 'check2' : undefined}
              disabled={disabled || (!selected && full)}
              onClick={() => toggle(o.value)}
            >
              {o.label}
            </Chip>
          );
        })}
        {shown.length === 0 && <span className={styles.none}>Không có danh mục nào khớp "{q}"</span>}
      </div>
    </Field>
  );
}
