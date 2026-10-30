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
 * @param {string} [noun='danh mục']  Khoi's code 29/10: tên gọi trong ô lọc nhanh, vd "chủ đề" ở form Đăng bài
 * @param {(string|number)[]} [popularIds]  Khoi's code 29/10: có → chia 2 nhóm "Hay dùng" (theo thứ tự này) và "Tất cả (A–Z)".
 *        Không truyền → 1 danh sách như cũ (trang Admin tạo món không đổi).
 * @param {number} [collapseAfter]  nhóm "Tất cả" dài hơn số này → gập lại, có nút "+N <noun>" để mở hết
 */
export default function CategoryPicker({
  label, options = [], value = [], onChange, max, searchFrom = 12, hint, error, required, disabled, className, noun = 'danh mục',
  popularIds, collapseAfter,
}) {
  const id = useId();
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState(false);
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

  const chip = (o) => {
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
  };

  // Khoi's code 29/10: chia nhóm khi có popularIds và không đang lọc nhanh
  const grouped = !!popularIds?.length && !q.trim();
  const popular = grouped ? popularIds.map((pid) => options.find((o) => o.value === pid)).filter(Boolean) : [];
  const others = grouped
    ? options.filter((o) => !popularIds.includes(o.value)).sort((a, b) => a.label.localeCompare(b.label, 'vi'))
    : [];
  // Mục đã chọn luôn hiện (không bị gập mất)
  const limit = !expanded && collapseAfter != null ? collapseAfter : Infinity;
  const othersShown = others.filter((o, i) => i < limit || value.includes(o.value));
  const hiddenCount = others.length - othersShown.length;

  return (
    <Field id={id} as="legend" label={label} hint={hint ?? autoHint} error={error} required={required} className={className}>
      {options.length > searchFrom && (
        <div className={styles.search}>
          <i className="bi bi-search" aria-hidden="true" />
          <input
            type="search"
            className="form-control form-control-sm"
            placeholder={`Lọc nhanh ${noun}...`}
            aria-label={`Lọc nhanh ${noun}`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      )}
      {grouped ? (
        // Khoi's code 29/10: 2 nhóm — "Hay dùng" (nhiều bài nhất) rồi "Tất cả (A–Z)"; đang lọc nhanh thì gộp 1 danh sách
        <div className={cx(styles.groups, error && styles.invalid)}>
          <div className={styles.group} role="group" aria-labelledby={`${id}-pop`}>
            <span id={`${id}-pop`} className={styles.groupLabel}>Hay dùng</span>
            <div className={styles.chips}>{popular.map(chip)}</div>
          </div>
          {others.length > 0 && (
            <div className={styles.group} role="group" aria-labelledby={`${id}-all`}>
              <span id={`${id}-all`} className={styles.groupLabel}>Tất cả (A–Z)</span>
              <div className={styles.chips}>
                {othersShown.map(chip)}
                {hiddenCount > 0 && (
                  <button type="button" className={styles.moreBtn} onClick={() => setExpanded(true)} disabled={disabled}>
                    +{hiddenCount} {noun}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className={cx(styles.chips, error && styles.invalid)} role="group" aria-label={label}>
          {shown.map(chip)}
          {shown.length === 0 && <span className={styles.none}>Không có {noun} nào khớp "{q}"</span>}
        </div>
      )}
    </Field>
  );
}
