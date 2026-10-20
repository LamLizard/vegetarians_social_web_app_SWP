import { useId, useMemo, useRef, useState } from 'react';
import Field from '../Field/Field';
import HighlightChip from '../HighlightChip/HighlightChip';
import { searchDishes } from '../../utils/dishMatch';
import s from './DishPicker.module.css';

/**
 * Ô chọn món (Dish) có tìm kiếm + cho phép ĐỀ XUẤT tên mới.
 *  - Danh sách chỉ có món status = 'active'.
 *  - Không thấy món → dòng cuối `+ Đề xuất "tên vừa gõ"` (Enter cũng được).
 *  - Gõ trùng hẳn tên món có sẵn (bỏ dấu) → không cho đề xuất, Enter chọn luôn món có sẵn.
 *  - Tên gần giống ("Đậu hũ chiên" vs "Đậu hũ") vẫn đề xuất được.
 *
 * @param {{type:'existing', dish:object} | {type:'proposed', name:string} | null} value
 * @param {(value) => void} onChange
 * @param {object[]} dishes   bảng dish (có status)
 */
export default function DishPicker({ value, onChange, dishes, error, label = 'Tên món', required }) {
  const id = useId();
  const listId = `${id}-list`;
  const inputRef = useRef(null);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  // -1 = chưa chọn dòng nào bằng phím mũi tên → Enter sẽ đề xuất đúng chữ đã gõ
  const [active, setActive] = useState(-1);
  const [note, setNote] = useState('');

  const typed = text.trim();
  const { options, exact } = useMemo(() => searchDishes(dishes, typed), [dishes, typed]);
  const canPropose = typed.length > 0 && !exact;
  // Danh sách hiển thị: các món + (dòng đề xuất ở cuối)
  const rows = [...options.map((d) => ({ kind: 'dish', dish: d })), ...(canPropose ? [{ kind: 'propose' }] : [])];

  const pick = (row) => {
    if (!row) return;
    if (row.kind === 'dish') {
      onChange({ type: 'existing', dish: row.dish });
      setNote('');
    } else {
      onChange({ type: 'proposed', name: typed.slice(0, 200) });
      setNote('');
    }
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!typed && !open) return;
      const highlighted = open && active >= 0 ? rows[active] : undefined;
      if (exact && highlighted?.kind !== 'dish') {
        // Trùng hẳn món có sẵn → chọn món đó, không tạo đề xuất trùng
        pick({ kind: 'dish', dish: exact });
        setNote(`“${exact.name}” đã có sẵn nên mình chọn món này cho bạn.`);
        return;
      }
      pick(highlighted ?? (canPropose ? { kind: 'propose' } : undefined));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const change = () => {
    const prev = value?.type === 'existing' ? value.dish.name : value?.name ?? '';
    onChange(null);
    setText(prev);
    setOpen(true);
    setActive(-1);
    requestAnimationFrame(() => inputRef.current?.select());
  };

  const hint = (
    <>
      <b>Không thấy món của bạn?</b> Gõ tên món rồi chọn dòng “+ Đề xuất …” ở cuối danh sách.
      <br />
      Món đề xuất chỉ được gửi kèm công thức này. Admin sẽ kiểm tra trước khi duyệt.
    </>
  );

  // Đã chọn: hiện thẻ món thay cho ô gõ
  if (value) {
    const proposed = value.type === 'proposed';
    return (
      <Field id={id} label={label} required={required} error={error} hint={hint}>
        <div className={`form-control ${s.chosen}`} id={id} tabIndex={-1}>
          {proposed ? (
            <HighlightChip icon="lightbulb" className={s.proposedChip}>Đề xuất: {value.name}</HighlightChip>
          ) : (
            <span className={s.dishChip}><i className="bi bi-check-circle-fill" aria-hidden="true" />{value.dish.name}</span>
          )}
          <button type="button" className={s.change} onClick={change}>
            <i className="bi bi-arrow-repeat" aria-hidden="true" />Đổi món
          </button>
        </div>
        {note && <p className={s.note} role="status">{note}</p>}
      </Field>
    );
  }

  return (
    <Field id={`${id}-input`} label={label} required={required} error={error} hint={hint}>
      <div className={s.wrap}>
        <i className={`bi bi-search ${s.icon}`} aria-hidden="true" />
        <input
          ref={inputRef}
          id={`${id}-input`}
          className={`form-control ${s.input} ${error ? 'is-invalid' : ''}`}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && rows[active] ? `${id}-opt-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-input-desc`}
          autoComplete="off"
          placeholder="Gõ để tìm món, ví dụ: Đậu hũ sốt cà"
          value={text}
          maxLength={200}
          onChange={(e) => { setText(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        {open && (
          <ul className={s.list} id={listId} role="listbox" aria-label="Món ăn">
            {rows.map((row, i) => (
              <li
                key={row.kind === 'dish' ? row.dish.dish_id : 'propose'}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                className={`${s.opt} ${i === active ? s.optOn : ''} ${row.kind === 'propose' ? s.propose : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(row)}
              >
                {row.kind === 'dish' ? (
                  <>
                    <i className="bi bi-bookmark" aria-hidden="true" />
                    <span>{row.dish.name}</span>
                    {exact?.dish_id === row.dish.dish_id && <span className={s.same}>Trùng tên bạn gõ</span>}
                  </>
                ) : (
                  <>
                    <i className="bi bi-plus-lg" aria-hidden="true" />
                    <span>Đề xuất “<b>{typed}</b>”</span>
                  </>
                )}
              </li>
            ))}
            {rows.length === 0 && <li className={s.empty} role="presentation">Gõ tên món để tìm</li>}
            {exact && (
              <li className={s.empty} role="presentation">
                “{exact.name}” đã có sẵn, hãy chọn món ở trên.
              </li>
            )}
          </ul>
        )}
      </div>
    </Field>
  );
}
