import { useEffect, useId, useRef, useState } from 'react';
import Button from '../Button/Button';
import Field from '../Field/Field';
import IconButton from '../IconButton/IconButton';
import IngredientPicker from '../IngredientPicker/IngredientPicker';
import UnitPicker from '../UnitPicker/UnitPicker';
import cx from '../cx';
import { formatAmount, isNoAmountUnit, newIngredientRow, parseAmount } from '../../utils/ingredient';
import { plain } from '../../utils/dishMatch';
import styles from './IngredientEditor.module.css';

/**
 * Nhập danh sách nguyên liệu cho công thức (M-19, UC-11): tên + số lượng + đơn vị.
 * Lưu vào recipe_ingredient (amount, unit) + ingredient (name).
 *
 *  - Tên: gõ tự do, có gợi ý từ từ điển nguyên liệu (`suggestions`). Backend tự tìm/ tạo ingredient theo tên.
 *  - Số lượng: nhận "2", "0,5", "1/2". Đơn vị "ít", "vừa đủ" thì bỏ trống số được.
 *  - Đơn vị: Khoi's code (20/10/2026) — ô CHỌN từ bộ đơn vị chuẩn, có nhóm + chú thích (UnitPicker), KHÔNG gõ tự do.
 *  - Enter ở dòng cuối → thêm dòng mới. Xoá dòng duy nhất → dòng đó trống lại.
 *
 * Kiểm tra bằng validateIngredients(rows) rồi truyền `error` + `rowErrors` vào. Gửi API: cleanIngredients(rows).
 *
 * @param {{key: string, name: string, amount: number|null, unit: string}[]} value  tạo dòng mới bằng newIngredientRow()
 * @param {(rows) => void} onChange
 * @param {string[]} [suggestions]      tên nguyên liệu gợi ý (ingredient.name) — ô tên vẫn gõ tự do
 * @param {string[]} [catalog]   Khoi's code: có prop này → ô tên thành Ô CHỌN từ kho (IngredientPicker), không gõ tự do.
 *        Không có trong kho → chọn "Đề xuất nguyên liệu mới", dòng đó có thêm `proposed: true`.
 * @param {({name?: string, amount?: string, unit?: string}|undefined)[]} [rowErrors]  lỗi từng dòng, cùng thứ tự với value
 * @param {({tone: 'bad'|'warn', text: string}|undefined)[]} [rowNotes]  Khoi's code: lưu ý từng dòng, KHÔNG chặn gửi
 *        (vd Tạo công thức: 'bad' = nghi không chay → tô đỏ ô tên · 'warn' = chưa có trong kho nguyên liệu)
 * @param {number} [max=40]
 * @param {string} [label='Nguyên liệu'] · [hint] · [error] · [required] · [disabled]
 */
export default function IngredientEditor({
  value = [], onChange, suggestions = [], catalog, rowErrors = [], rowNotes = [], max = 40,
  label = 'Nguyên liệu', hint, error, required, disabled, className,
}) {
  const id = useId();
  const nameListId = `${id}-names`;
  const [amountText, setAmountText] = useState({});
  const nameRefs = useRef({});
  const amountRefs = useRef({});
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
    e.preventDefault();
    if (index === rows.length - 1) add();
    else nameRefs.current[rows[index + 1].key]?.focus();
  };

  const filled = rows.filter((r) => r.name.trim()).length;
  // Tên đã chọn ở từng dòng (bỏ dấu) → ô chọn của dòng khác không hiện lại
  const takenBy = (key) => new Set(rows.filter((r) => r.key !== key && r.name.trim()).map((r) => plain(r.name)));

  return (
    <Field id={id} as="legend" label={label} required={required}
      error={error} hint={hint ?? 'Mỗi dòng 1 nguyên liệu. Chọn đơn vị trong danh sách. Đơn vị "ít", "vừa đủ" không cần số lượng. Enter để thêm dòng.'}
      className={className}>
      <div className={styles.head} aria-hidden="true">
        <span>Tên nguyên liệu</span><span>Số lượng</span><span>Đơn vị</span><span />
      </div>
      <ol className={styles.list}>
        {rows.map((r, i) => {
          const err = rowErrors[i];
          const note = rowNotes[i];
          const noAmount = isNoAmountUnit(r.unit);
          const n = i + 1;
          return (
            <li key={r.key} className={styles.row}>
              <span className={styles.num} aria-hidden="true">{n}</span>
              {catalog ? (
                <div className={styles.name}>
                  <IngredientPicker
                    name={r.name} proposed={!!r.proposed} catalog={catalog} taken={takenBy(r.key)}
                    onPick={(v) => update(r.key, v)} onDone={() => amountRefs.current[r.key]?.focus()}
                    tone={err?.name ? undefined : note?.tone} invalid={!!err?.name}
                    inputRef={(el) => { nameRefs.current[r.key] = el; }}
                    ariaLabel={`Tên nguyên liệu ${n}`} disabled={disabled}
                  />
                </div>
              ) : (
                <input
                  ref={(el) => { nameRefs.current[r.key] = el; }}
                  className={cx('form-control', styles.name, err?.name && 'is-invalid', !err?.name && note && styles[`note_${note.tone}`])}
                  value={r.name} list={nameListId} placeholder="vd: Đậu hũ non" maxLength={120}
                  aria-label={`Tên nguyên liệu ${n}`} aria-invalid={err?.name ? true : undefined}
                  disabled={disabled} onChange={(e) => update(r.key, { name: e.target.value })}
                  onKeyDown={(e) => onEnter(e, i)}
                />
              )}
              <input
                ref={(el) => { amountRefs.current[r.key] = el; }}
                className={cx('form-control', styles.amount, err?.amount && 'is-invalid')}
                inputMode="decimal" value={amountText[r.key] ?? (r.amount == null ? '' : formatAmount(r.amount))}
                placeholder={noAmount ? '' : '0'} aria-label={`Số lượng nguyên liệu ${n}`}
                aria-invalid={err?.amount ? true : undefined} disabled={disabled || noAmount}
                onChange={(e) => { const text = e.target.value; setAmountText((t) => ({ ...t, [r.key]: text })); update(r.key, { amount: parseAmount(text) }); }}
                onBlur={() => setAmountText(({ [r.key]: unused, ...rest }) => { void unused; return rest; })}
                onKeyDown={(e) => onEnter(e, i)}
              />
              <div className={styles.unit}>
                <UnitPicker
                  value={r.unit} disabled={disabled} ariaLabel={`Đơn vị nguyên liệu ${n}`} invalid={!!err?.unit}
                  onChange={(unit) => update(r.key, isNoAmountUnit(unit) ? { unit, amount: null } : { unit })}
                  onEnter={() => onEnter({ key: 'Enter', preventDefault() {} }, i)}
                />
              </div>
              <IconButton icon="x-lg" label={`Xoá nguyên liệu ${r.name || n}`} variant="ghost" size="sm"
                className={styles.remove} onClick={() => remove(r.key)} disabled={disabled} />
              {err && (err.name || err.amount || err.unit) && (
                <span className={styles.rowError} role="alert">
                  <i className="bi bi-exclamation-circle" aria-hidden="true" /> Dòng {n}: {[err.name, err.amount, err.unit].filter(Boolean).join(' · ')}
                </span>
              )}
              {note && (
                <span className={cx(styles.rowNote, styles[`rowNote_${note.tone}`])}>
                  <i className={`bi bi-${note.tone === 'bad' ? 'exclamation-triangle-fill' : 'info-circle'}`} aria-hidden="true" /> Dòng {n}: {note.text}
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
      {!catalog && <datalist id={nameListId}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>}
    </Field>
  );
}
