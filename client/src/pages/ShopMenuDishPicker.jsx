// Chỉ chọn phân loại Dish đã duyệt; không tạo Dish, Recipe hoặc dòng menu.
import { useCallback, useEffect, useId, useState } from 'react';
import useShopResource from '../hooks/useShopResource';
import shopManagementService from '../services/shopManagement.service';
import Button from '../components/Button/Button';
import Field from '../components/Field/Field';
import Notice from '../components/Notice/Notice';
import Pagination from '../components/Pagination/Pagination';
import Spinner from '../components/Spinner/Spinner';
import styles from './ShopManagementPage.module.css';

export default function ShopMenuDishPicker({ value, onChange, disabled, error, onDirty }) {
  const inputId = useId();
  const listId = `${inputId}-list`;
  const [typed, setTyped] = useState(value?.name || '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [search, setSearch] = useState({ q: '', page: 1, pendingPage: 1 });
  const query = typed.trim();
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(current => current.q === query ? current : { q: query, page: 1, pendingPage: 1 }), 250);
    return () => window.clearTimeout(timer);
  }, [query]);
  const lookupKey = JSON.stringify(search);
  const load = useCallback(async signal => {
    const data = await shopManagementService.listDishes(search.page, search.pendingPage, signal, search.q);
    return { ...data, lookupKey: JSON.stringify(search) };
  }, [search]);
  const resource = useShopResource(load);
  const waiting = query !== search.q;
  const loading = waiting || resource.loading || Boolean(resource.data && resource.data.lookupKey !== lookupKey) || (!resource.data && !resource.error);
  const options = loading || resource.error ? [] : resource.data.active.items;
  const pick = item => {
    if (!item?.selectable || disabled) return;
    onChange(item); onDirty?.(true); setTyped(item.name); setOpen(false); setActive(-1);
  };
  const move = direction => {
    const choices = options.flatMap((item, index) => item.selectable ? [index] : []);
    const position = choices.indexOf(active);
    if (!choices.length) { setActive(-1); return; }
    const next = position < 0 ? (direction > 0 ? 0 : choices.length - 1) : position + direction;
    setActive(choices[Math.max(0, Math.min(choices.length - 1, next))]);
  };
  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${inputId}-option-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, inputId]);
  return <>
    <Field id={inputId} label="Phân loại món (Dish)" required error={error}
      hint="Tìm nhóm món như bánh mì, cơm, phở rồi chọn từ gợi ý. Tên món bán được nhập riêng bên dưới.">
      <div className={styles.dishSearch} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
        <input id={inputId} className="form-control" role="combobox" required autoComplete="off" maxLength={200}
          disabled={disabled} value={typed} placeholder="Ví dụ: banh mi, com, pho…"
          aria-expanded={open} aria-controls={open ? listId : undefined} aria-autocomplete="list"
          aria-describedby={`${inputId}-desc`} aria-invalid={Boolean(error)}
          aria-activedescendant={open && options[active] ? `${inputId}-option-${active}` : undefined}
          onFocus={() => setOpen(true)} onChange={event => {
            setTyped(event.target.value); onChange(null); onDirty?.(Boolean(event.target.value.trim())); setOpen(true); setActive(-1);
          }} onKeyDown={event => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); move(event.key === 'ArrowDown' ? 1 : -1); }
            else if (event.key === 'Enter' && open) { event.preventDefault(); pick(options[active]); }
            else if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
          }} />
        {open && <div className={styles.dishDropdown}>
          <ul id={listId} role="listbox" aria-label="Phân loại phù hợp" className={styles.dishOptions} aria-busy={loading}>
            {loading ? <li role="presentation" className={styles.dishEmpty}><Spinner showLabel /></li>
              : resource.error ? <li role="presentation" className={styles.dishEmpty}>Chưa tải được danh sách phân loại.</li>
                : options.length ? options.map((item, index) => <li key={item.dishId} id={`${inputId}-option-${index}`}
                  role="option" aria-selected={value?.dishId === item.dishId} aria-disabled={!item.selectable}
                  className={`${styles.dishOption} ${index === active ? styles.dishOptionActive : ''}`}
                  onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(item.selectable ? index : -1)} onClick={() => pick(item)}>
                  <span>{item.name}</span>{item.alreadyLinked && <small>Đã dùng phân loại này</small>}
                </li>) : <li role="presentation" className={styles.dishEmpty}>Không tìm thấy phân loại. Thử tên nhóm món khác.</li>}
          </ul>
          {!loading && resource.data?.active.totalPages > 1 && <div className={styles.dishResultsFooter}>
            <Pagination page={resource.data.active.page} totalPages={resource.data.active.totalPages} pageSize={resource.data.active.pageSize}
              totalItems={resource.data.active.total} itemLabel="phân loại"
              onChange={page => { setActive(-1); setSearch(current => ({ ...current, page })); }} />
          </div>}
        </div>}
      </div>
    </Field>
    {resource.error && !waiting && <Notice tone="alert" action={{ label: 'Thử lại', onClick: resource.reload }}>{resource.error.message}</Notice>}
    {!loading && !resource.error && resource.data?.active.total === 0 && <div>
      <Button variant="outline" size="sm" disabled title="Chức năng tạo Dish sẽ được tích hợp sau.">Tạo Dish</Button>
    </div>}
    {!loading && resource.data?.ownPending.total > 0 && <details className={styles.pendingGroup}>
      <summary>Phân loại tôi đề xuất đang chờ duyệt ({resource.data.ownPending.total})</summary>
      <p className={styles.muted}>Sau khi được duyệt, tải lại danh mục rồi chọn phân loại để thêm món.</p>
      <ul className={styles.pendingList}>{resource.data.ownPending.items.map(item => <li key={item.dishId}>{item.name} · Đang chờ duyệt</li>)}</ul>
      <Pagination page={resource.data.ownPending.page} totalPages={resource.data.ownPending.totalPages} pageSize={resource.data.ownPending.pageSize}
        totalItems={resource.data.ownPending.total} itemLabel="phân loại đang chờ"
        onChange={pendingPage => setSearch(current => ({ ...current, pendingPage }))} />
    </details>}
    <div><Button variant="outline" size="sm" icon="arrow-clockwise" disabled={disabled || loading}
      onClick={() => { onChange(null); setActive(-1); resource.reload(); }}>Tải lại danh mục</Button></div>
  </>;
}
