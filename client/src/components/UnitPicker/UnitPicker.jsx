// Khoi's code: Ô chọn đơn vị cho 1 dòng của IngredientEditor (20/10/2026).
// Chỉ cho CHỌN trong bộ đơn vị chuẩn (INGREDIENT_UNIT), không cho gõ tự do → không có đơn vị lạ phải nhờ Admin duyệt.
//  - Bấm vào ô là mở danh sách chia nhóm (Khối lượng · Thể tích · Đếm · Khác), mỗi đơn vị có chú thích dùng cho gì.
//  - Gõ chỉ để LỌC danh sách ("mu" → muỗng canh, muỗng cà phê). Rời ô mà chữ gõ không khớp đơn vị nào → trả về lựa chọn cũ.
//  - Giá trị lưu vẫn là chữ ngắn ("g", "muỗng canh"), không đổi cột recipe_ingredient.unit.
import { useId, useMemo, useState } from 'react';
import cx from '../cx';
import { INGREDIENT_UNIT, INGREDIENT_UNIT_GROUPS } from '../../constants/domain';
import { plain } from '../../utils/dishMatch';
import s from './UnitPicker.module.css';

const findUnit = (text) => INGREDIENT_UNIT.find((u) => plain(u.value) === plain(text));

/**
 * @param {string} value   đơn vị đang chọn ('' = chưa chọn). Giá trị cũ ngoài bộ chuẩn vẫn hiện nguyên để người dùng thấy và chọn lại.
 * @param {(unit: string) => void} onChange   luôn là đơn vị trong bộ chuẩn, hoặc '' khi xoá
 * @param {() => void} [onEnter]   Enter khi không chọn gì → IngredientEditor nhảy dòng
 * @param {(el) => void} [inputRef]
 */
export default function UnitPicker({ value, onChange, onEnter, inputRef, ariaLabel, invalid, disabled }) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [draft, setDraft] = useState(null); // chữ đang gõ để lọc; null = đang hiện lựa chọn thật

  const text = draft ?? value;
  const query = draft?.trim() ?? '';
  const options = useMemo(() => {
    if (!query) return INGREDIENT_UNIT;
    const q = plain(query);
    return INGREDIENT_UNIT.filter((u) => plain(u.value).includes(q));
  }, [query]);

  const close = () => { setOpen(false); setActive(-1); setDraft(null); };
  const pick = (unit) => { onChange(unit); close(); };

  // Rời ô: gõ khớp đúng 1 đơn vị thì nhận luôn; gõ xoá trống thì bỏ chọn; còn lại trả về lựa chọn cũ
  const commitOnLeave = () => {
    if (draft !== null) {
      const hit = findUnit(draft);
      if (hit) { if (hit.value !== value) onChange(hit.value); }
      else if (!draft.trim() && value) onChange('');
    }
    close();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Chọn mục đang tô sáng; không tô thì nếu lọc còn đúng 1 kết quả → chọn nó; không có gì để chọn → sang dòng kế
      const target = open && active >= 0 ? options[active] : (draft !== null && options.length === 1 ? options[0] : null);
      if (target) pick(target.value);
      else { close(); onEnter?.(); }
    } else if (e.key === 'Escape') {
      close();
    }
  };

  // Gom theo nhóm nhưng giữ thứ tự phẳng để mũi tên lên/xuống chạy đúng
  const grouped = INGREDIENT_UNIT_GROUPS
    .map((g) => ({ ...g, items: options.filter((u) => u.group === g.key) }))
    .filter((g) => g.items.length);

  return (
    <div className={s.wrap}>
      <input
        ref={inputRef}
        className={cx('form-control', s.input, invalid && 'is-invalid')}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${id}-opt-${active}` : undefined}
        aria-invalid={invalid ? true : undefined}
        autoComplete="off"
        placeholder="Chọn đơn vị"
        value={text}
        maxLength={30}
        disabled={disabled}
        onChange={(e) => { setDraft(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={(e) => { setOpen(true); e.target.select(); }}
        onBlur={commitOnLeave}
        onKeyDown={onKeyDown}
      />
      <button
        type="button" tabIndex={-1} className={s.chevron} disabled={disabled}
        aria-label="Mở danh sách đơn vị"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
      >
        <i className={`bi bi-chevron-${open ? 'up' : 'down'}`} aria-hidden="true" />
      </button>
      {open && (
        <ul className={s.list} id={listId} role="listbox" aria-label="Đơn vị">
          {grouped.map((g) => (
            <li key={g.key} role="presentation">
              <div className={s.groupHead} role="presentation">{g.label}</div>
              <ul className={s.items} role="presentation">
                {g.items.map((u) => {
                  const i = options.indexOf(u);
                  const picked = plain(u.value) === plain(value);
                  return (
                    <li
                      key={u.value} id={`${id}-opt-${i}`} role="option"
                      aria-selected={picked}
                      className={cx(s.opt, i === active && s.optOn, picked && s.optPicked)}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => pick(u.value)}
                    >
                      <b className={s.optName}>{u.value}</b>
                      <span className={s.optHint}>{u.hint}</span>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
          {options.length === 0 && (
            <li className={s.none} role="presentation">Không có đơn vị “{query}”.</li>
          )}
        </ul>
      )}
    </div>
  );
}
