import { useEffect, useId, useRef, useState } from 'react';
import Button from '../Button/Button';
import Field from '../Field/Field';
import IconButton from '../IconButton/IconButton';
import cx from '../cx';
import { INGREDIENT_UNIT } from '../../constants/domain';
import { formatAmount, isNoAmountUnit, newIngredientRow, parseAmount } from '../../utils/ingredient';
import styles from './IngredientEditor.module.css';

/**
 * Nhập danh sách nguyên liệu cho công thức (M-19, UC-11): tên + số lượng + đơn vị.
 * Lưu vào recipe_ingredient (amount, unit) + ingredient (name).
 *
 *  - Tên: gõ tự do, có gợi ý từ từ điển nguyên liệu (`suggestions`). Backend tự tìm/ tạo ingredient theo tên.
 *  - Số lượng: nhận "2", "0,5", "1/2". Đơn vị "ít", "vừa đủ" thì bỏ trống số được.
 *  - Đơn vị: gõ tự do, có gợi ý INGREDIENT_UNIT để cả app viết giống nhau.
 *  - Enter ở dòng cuối → thêm dòng mới. Xoá dòng duy nhất → dòng đó trống lại.
 *
 * Kiểm tra bằng validateIngredients(rows) rồi truyền `error` + `rowErrors` vào. Gửi API: cleanIngredients(rows).
 *
 * @param {{key: string, name: string, amount: number|null, unit: string}[]} value  tạo dòng mới bằng newIngredientRow()
 * @param {(rows) => void} onChange
 * @param {string[]} [suggestions]      tên nguyên liệu gợi ý (ingredient.name)
 * @param {({name?: string, amount?: string}|undefined)[]} [rowErrors]  lỗi từng dòng, cùng thứ tự với value
 * @param {number} [max=40]
 * @param {string} [label='Nguyên liệu'] · [hint] · [error] · [required] · [disabled]
 */
export default function IngredientEditor({
  value = [], onChange, suggestions = [], rowErrors = [], max = 40,
  label = 'Nguyên liệu', hint, error, required, disabled, className,
}) {
  const id = useId();
  const nameListId = `${id}-names`;
  const unitListId = `${id}-units`;
  const [amountText, setAmountText] = useState({}); // key → chữ đang gõ (giữ "0," khi đang gõ dở)
  const nameRefs = useRef({});
  const focusKey = useRef(null);

  const fallback = useRef(null);
  if (!fallback.current) fallback.current = newIngredientRow();
  const rows = value.length ? value : [fallback.current];

  useEffect(() => {
    if (focusKey.current && nameRefs.current[focusKey.current]) {
      nameRefs.current[focusKey.current].focus();
      focusKey.current = null;
    }
  });

  const update = (key, patch) => onChange?.(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const add = () => {
    if (rows.length >= max) return;
    const row = newIngredientRow();
    focusKey.current = row.key;
    onChange?.([...rows, row]);
  };

  const remove = (key) => {
    const i = rows.findIndex((r) => r.key === key);
    if (rows.length === 1) {
      const row = newIngredientRow();
      focusKey.current = row.key;
      onChange?.([row]);
      return;
    }
    const next = rows.filter((r) => r.key !== key);
    focusKey.current = next[Math.max(0, i - 1)].key;
    onChange?.(next);
  };

  const onEnter = (e, index) => {
    if (e.key !== 'Enter') return;
    e.preventDefault(); // không gửi form
    if (index === rows.length - 1) add();
    else nameRefs.current[rows[index + 1].key]?.focus();
  };

  const filled = rows.filter((r) => r.name.trim()).length;

  return (
    <Field
      id={id}
      as="legend"
      label={label}
      required={required}
      error={error}
      hint={hint ?? 'Mỗi dòng 1 nguyên liệu. Đơn vị "ít", "vừa đủ" không cần số lượng. Enter để thêm dòng.'}
      className={className}
    >
      <div className={styles.head} aria-hidden="true">
        <span>Tên nguyên liệu</span><span>Số lượng</span><span>Đơn vị</span><span />
      </div>
      <ol className={styles.list}>
        {rows.map((r, i) => {
          const err = rowErrors[i];
          const noAmount = isNoAmountUnit(r.unit);
          const n = i + 1;
          return (
            <li key={r.key} className={styles.row}>
              <span className={styles.num} aria-hidden="true">{n}</span>
              <input
                ref={(el) => { nameRefs.current[r.key] = el; }}
                className={cx('form-control', styles.name, err?.name && 'is-invalid')}
                value={r.name}
                list={nameListId}
                placeholder="vd: Đậu hũ non"
                maxLength={120}
                aria-label={`Tên nguyên liệu ${n}`}
                aria-invalid={err?.name ? true : undefined}
                disabled={disabled}
                onChange={(e) => update(r.key, { name: e.target.value })}
                onKeyDown={(e) => onEnter(e, i)}
              />
              <input
                className={cx('form-control', styles.amount, err?.amount && 'is-invalid')}
                inputMode="decimal"
                value={amountText[r.key] ?? (r.amount == null ? '' : formatAmount(r.amount))}
                placeholder={noAmount ? '' : '0'}
                aria-label={`Số lượng nguyên liệu ${n}`}
                aria-invalid={err?.amount ? true : undefined}
                disabled={disabled || noAmount}
                onChange={(e) => {
                  const text = e.target.value;
                  setAmountText((t) => ({ ...t, [r.key]: text }));
                  update(r.key, { amount: parseAmount(text) });
                }}
                onBlur={() => setAmountText(({ [r.key]: _, ...rest }) => rest)}
                onKeyDown={(e) => onEnter(e, i)}
              />
              <input
                className={cx('form-control', styles.unit)}
                value={r.unit}
                list={unitListId}
                placeholder="g, muỗng..."
                maxLength={30}
                aria-label={`Đơn vị nguyên liệu ${n}`}
                disabled={disabled}
                onChange={(e) => {
                  const unit = e.target.value;
                  update(r.key, isNoAmountUnit(unit) ? { unit, amount: null } : { unit });
                }}
                onKeyDown={(e) => onEnter(e, i)}
              />
              <IconButton
                icon="x-lg"
                label={`Xoá nguyên liệu ${r.name || n}`}
                variant="ghost"
                size="sm"
                className={styles.remove}
                onClick={() => remove(r.key)}
                disabled={disabled}
              />
              {err && (err.name || err.amount) && (
                <span className={styles.rowError} role="alert">
                  <i className="bi bi-exclamation-circle" aria-hidden="true" /> Dòng {n}: {[err.name, err.amount].filter(Boolean).join(' · ')}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <div className={styles.foot}>
        <Button variant="subtle" size="sm" icon="plus-lg" onClick={add} disabled={disabled || rows.length >= max}>Thêm nguyên liệu</Button>
        <span className={styles.count}>{filled} nguyên liệu</span>
      </div>

      <datalist id={nameListId}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
      <datalist id={unitListId}>{INGREDIENT_UNIT.map((u) => <option key={u.value} value={u.value} />)}</datalist>
    </Field>
  );
}
