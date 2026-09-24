import { useEffect, useRef } from 'react';
import EmptyState from '../EmptyState/EmptyState';
import Skeleton from '../Skeleton/Skeleton';
import cx from '../cx';
import styles from './DataTable.module.css';

/**
 * Bảng dữ liệu cho trang quản trị (M-14, M-15, M-16): danh sách chờ duyệt, báo cáo, tài khoản, danh mục.
 * Không tự gọi API, không tự lọc/sắp xếp: bấm tiêu đề cột → onSortChange → trang gọi API lại.
 * Điện thoại (< 768px): mỗi dòng thành 1 thẻ, cột `primary` làm tiêu đề, cột khác hiện "Nhãn: giá trị".
 *
 * @param {{key: string, header: string, render?: (row) => ReactNode, width?: string|number,
 *          align?: 'left'|'right'|'center', sortable?: boolean, primary?: boolean, hideOnMobile?: boolean}[]} columns
 *        render không có → hiện row[key]. Cột nút thao tác đặt key 'actions', align 'right'.
 * @param {object[]} rows
 * @param {string|((row) => string|number)} [rowKey='id']
 * @param {{key: string, dir: 'asc'|'desc'}} [sort] · [onSortChange]
 * @param {boolean} [selectable] · [selected=[]] · [onSelectionChange]   chọn nhiều dòng (duyệt hàng loạt)
 * @param {React.ReactNode} [bulkActions]   hiện khi đã chọn ≥ 1 dòng, vd <Button>Duyệt 3 mục</Button>
 * @param {boolean} [loading]               hiện 5 dòng giữ chỗ
 * @param {{icon?, title, children?}} [empty]  khi rows rỗng
 * @param {string} caption                  mô tả bảng cho trình đọc màn hình (bắt buộc)
 * @param {React.ReactNode} [footer]        thường là <Pagination />
 * @param {(row) => boolean} [isRowMuted]   làm mờ dòng (vd tài khoản đã khoá, danh mục đã tắt)
 */
export default function DataTable({
  columns = [], rows = [], rowKey = 'id', sort, onSortChange, selectable = false, selected = [], onSelectionChange,
  bulkActions, loading = false, empty = { title: 'Không có dữ liệu' }, caption, footer, isRowMuted, className,
}) {
  const keyOf = (row) => (typeof rowKey === 'function' ? rowKey(row) : row[rowKey]);
  const pageKeys = rows.map(keyOf);
  const allOn = pageKeys.length > 0 && pageKeys.every((k) => selected.includes(k));
  const someOn = !allOn && pageKeys.some((k) => selected.includes(k));
  const headerBox = useRef(null);
  useEffect(() => { if (headerBox.current) headerBox.current.indeterminate = someOn; }, [someOn]);

  const toggleAll = () => onSelectionChange?.(allOn
    ? selected.filter((k) => !pageKeys.includes(k))
    : [...new Set([...selected, ...pageKeys])]);
  const toggleOne = (k) => onSelectionChange?.(selected.includes(k) ? selected.filter((x) => x !== k) : [...selected, k]);

  const clickSort = (col) => {
    if (!col.sortable || !onSortChange) return;
    const dir = sort?.key === col.key && sort.dir === 'asc' ? 'desc' : 'asc';
    onSortChange({ key: col.key, dir });
  };

  const colCount = columns.length + (selectable ? 1 : 0);

  return (
    <div className={cx(styles.wrap, className)}>
      {selectable && selected.length > 0 && (
        <div className={styles.bulk} role="region" aria-label="Thao tác hàng loạt">
          <span><b>{selected.length}</b> mục đã chọn</span>
          <button type="button" className={styles.clear} onClick={() => onSelectionChange?.([])}>Bỏ chọn</button>
          <span className={styles.spacer} />
          {bulkActions}
        </div>
      )}
      {selectable && rows.length > 0 && !loading && (
        <label className={styles.mobileAll}>
          <input type="checkbox" className="form-check-input" checked={allOn} onChange={toggleAll} />
          Chọn tất cả ({rows.length})
        </label>
      )}
      <div className={styles.scroller}>
        <table className={styles.table} aria-busy={loading || undefined}>
          {caption && <caption className="visually-hidden">{caption}</caption>}
          <thead>
            <tr>
              {selectable && (
                <th className={styles.check} scope="col">
                  <input ref={headerBox} type="checkbox" className="form-check-input" checked={allOn} onChange={toggleAll}
                    aria-label="Chọn tất cả trong trang" disabled={loading || !rows.length} />
                </th>
              )}
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    style={{ width: c.width, textAlign: c.align }}
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : c.sortable ? 'none' : undefined}
                    className={cx(c.hideOnMobile && styles.hideMobile)}
                  >
                    {c.sortable && onSortChange ? (
                      <button type="button" className={cx(styles.sortBtn, active && styles.sorted)} onClick={() => clickSort(c)}>
                        {c.header}
                        <i className={`bi bi-${active ? (sort.dir === 'asc' ? 'sort-up' : 'sort-down') : 'arrow-down-up'}`} aria-hidden="true" />
                      </button>
                    ) : c.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 5 }, (_, i) => (
              <tr key={`sk-${i}`} className={styles.skRow}>
                {selectable && <td className={styles.check} />}
                {columns.map((c) => <td key={c.key}><Skeleton width={c.primary ? '70%' : '50%'} /></td>)}
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr className={styles.emptyRow}>
                <td colSpan={colCount}>
                  <EmptyState icon={empty.icon ?? 'inbox'} title={empty.title} action={empty.action}>{empty.children}</EmptyState>
                </td>
              </tr>
            )}
            {!loading && rows.map((row) => {
              const k = keyOf(row);
              const on = selected.includes(k);
              return (
                <tr key={k} className={cx(on && styles.selected, isRowMuted?.(row) && styles.muted)}>
                  {selectable && (
                    <td className={styles.check}>
                      <input type="checkbox" className="form-check-input" checked={on} onChange={() => toggleOne(k)}
                        aria-label={`Chọn dòng ${String(row[columns.find((c) => c.primary)?.key] ?? k)}`} />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      data-label={c.primary || c.key === 'actions' ? undefined : c.header}
                      style={{ textAlign: c.align }}
                      className={cx(c.primary && styles.primary, c.key === 'actions' && styles.actions, c.hideOnMobile && styles.hideMobile)}
                    >
                      {c.render ? c.render(row) : row[c.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
