// Khoi's code: Ô chọn nguyên liệu cho 1 dòng của IngredientEditor (12/10/2026).
// Cùng cách làm với DishPicker (ô "Công thức này nấu món gì?"):
//  - Danh sách lấy từ bảng ingredient (kho nguyên liệu đã duyệt).
//  - Không thấy → dòng cuối `+ Đề xuất "tên vừa gõ"`: gửi kèm công thức, Admin duyệt (recipe_proposed_ingredient).
//  - Gõ trùng hẳn tên có sẵn (bỏ dấu) → không cho đề xuất, Enter chọn luôn nguyên liệu có sẵn.
//  - Nguyên liệu đã chọn ở dòng khác không hiện lại (server chặn trùng tên).
import { useId, useMemo, useRef, useState } from 'react';
import cx from '../cx';
import { plain, searchByName } from '../../utils/dishMatch';
import s from './IngredientPicker.module.css';

const byName = (n) => n;

/**
 * @param {string} name   tên đang chọn ('' = chưa chọn)
 * @param {boolean} [proposed]   true = tên đề xuất mới, chưa có trong kho
 * @param {string[]} catalog   tên trong bảng ingredient
 * @param {Set<string>} [taken]   tên (đã plain) đang dùng ở các dòng khác
 * @param {(v: {name: string, proposed: boolean}) => void} onPick   chọn xong (name '' = bỏ chọn để đổi)
 * @param {() => void} [onDone]   gọi sau khi chọn bằng bàn phím → chuyển sang ô số lượng
 * @param {'bad'|'warn'} [tone]   tô đỏ (nghi không chay) / viền đứt (đề xuất mới)
 * @param {(el) => void} [inputRef]   nhận phần tử để IngredientEditor focus
 */
export default function IngredientPicker({
  name, proposed = false, catalog, taken, onPick, onDone, tone, invalid, inputRef, ariaLabel, disabled,
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  // -1 = chưa dùng mũi tên. Khác DishPicker: có kết quả thì Enter chọn dòng ĐẦU (tránh lỡ tay đề xuất "dau"),
  // muốn đề xuất thì bấm hoặc dùng mũi tên xuống dòng "+ Đề xuất…"
  const [active, setActive] = useState(-1);
  const own = useRef(null);
  const setRef = (el) => { own.current = el; inputRef?.(el); };

  const typed = text.trim().replace(/\s+/g, ' ');
  const free = useMemo(() => catalog.filter((n) => !taken?.has(plain(n))), [catalog, taken]);
  const { options, exact } = useMemo(() => searchByName(free, typed, byName), [free, typed]);
  // Trùng hẳn tên đã chọn ở dòng khác → không cho đề xuất (sẽ báo "Trùng với dòng phía trên")
  const usedElsewhere = typed && taken?.has(plain(typed));
  const canPropose = typed.length > 0 && !exact && !usedElsewhere;
  const rows = [...options.map((n) => ({ kind: 'item', name: n })), ...(canPropose ? [{ kind: 'propose' }] : [])];
  const current = active >= 0 ? active : (typed && options.length ? 0 : -1);

  const pick = (row, viaKeyboard) => {
    if (!row) return;
    onPick(row.kind === 'item' ? { name: row.name, proposed: false } : { name: typed.slice(0, 120), proposed: true });
    setText('');
    setOpen(false);
    setActive(-1);
    if (viaKeyboard) requestAnimationFrame(() => onDone?.());
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive(Math.min(current + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(current - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!typed && !open) return;
      const highlighted = open && current >= 0 ? rows[current] : undefined;
      if (exact && highlighted?.kind !== 'item') { pick({ kind: 'item', name: exact }, true); return; }
      pick(highlighted ?? (canPropose ? { kind: 'propose' } : undefined), true);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Bấm "Đổi" → về ô gõ, giữ chữ cũ để sửa nhanh
  const change = () => {
    setText(name);
    setOpen(true);
    setActive(-1);
    onPick({ name: '', proposed: false });
    requestAnimationFrame(() => own.current?.select());
  };

  if (name) {
    return (
      <div className={cx('form-control', s.chosen, tone && s[`tone_${tone}`], invalid && 'is-invalid')}>
        {proposed ? (
          <span className={cx(s.chip, s.chipProposed)} title={`${name} — chưa có trong kho, Admin duyệt cùng công thức`}>
            <i className="bi bi-lightbulb" aria-hidden="true" />
            <span className={s.chipText}>Đề xuất: {name}</span>
          </span>
        ) : (
          <span className={s.chip} title={name}>
            <i className="bi bi-check-circle-fill" aria-hidden="true" />
            <span className={s.chipText}>{name}</span>
          </span>
        )}
        <button type="button" ref={setRef} className={s.change} onClick={change} disabled={disabled}
          aria-label={`Đổi ${ariaLabel?.toLowerCase() ?? 'nguyên liệu'}: ${name}`}>
          <i className="bi bi-arrow-repeat" aria-hidden="true" />Đổi
        </button>
      </div>
    );
  }

  return (
    <div className={s.wrap}>
      <i className={`bi bi-search ${s.icon}`} aria-hidden="true" />
      <input
        ref={setRef}
        className={cx('form-control', s.input, invalid && 'is-invalid')}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && rows[current] ? `${id}-opt-${current}` : undefined}
        aria-invalid={invalid ? true : undefined}
        autoComplete="off"
        placeholder="Tìm nguyên liệu…"
        value={text}
        maxLength={120}
        disabled={disabled}
        onChange={(e) => { setText(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul className={s.list} id={listId} role="listbox" aria-label="Nguyên liệu">
          {rows.map((row, i) => (
            <li
              key={row.kind === 'item' ? row.name : 'propose'}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === current}
              className={cx(s.opt, i === current && s.optOn, row.kind === 'propose' && s.propose)}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(row, false)}
            >
              {row.kind === 'item' ? (
                <>
                  <i className="bi bi-basket" aria-hidden="true" />
                  <span>{row.name}</span>
                  {exact === row.name && <span className={s.same}>Trùng tên bạn gõ</span>}
                </>
              ) : (
                <>
                  <i className="bi bi-plus-lg" aria-hidden="true" />
                  <span>Đề xuất nguyên liệu mới “<b>{typed}</b>”</span>
                </>
              )}
            </li>
          ))}
          {rows.length === 0 && !usedElsewhere && (
            <li className={s.empty} role="presentation">{catalog.length ? 'Gõ tên nguyên liệu để tìm' : 'Đang tải kho nguyên liệu…'}</li>
          )}
          {usedElsewhere && <li className={s.empty} role="presentation">“{typed}” đã có ở dòng khác.</li>}
          {exact && <li className={s.empty} role="presentation">“{exact}” đã có trong kho, hãy chọn ở trên.</li>}
        </ul>
      )}
    </div>
  );
}
