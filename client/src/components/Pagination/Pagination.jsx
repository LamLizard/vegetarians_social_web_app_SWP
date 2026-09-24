import cx from '../cx';
import styles from './Pagination.module.css';

// 1 … 4 5 [6] 7 8 … 20
function pagesToShow(page, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => set.add(p));
  if (page >= total - 2) [total - 3, total - 2, total - 1].forEach((p) => set.add(p));
  const list = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  return list.flatMap((p, i) => (i && p - list[i - 1] > 1 ? ['…', p] : [p]));
}

/**
 * Phân trang. Dùng cho: kết quả tìm Post, danh sách quán, bảng admin.
 * Trang bắt đầu từ 1 (khớp ?page=1 của API).
 *
 * @param {number} page         trang hiện tại
 * @param {number} totalPages   tổng số trang (≤ 1 thì không hiện gì)
 * @param {(page: number) => void} onChange
 * @param {number} [totalItems] có → hiện "Hiển thị 11 đến 20 trong 57 bài"
 * @param {number} [pageSize]   đi cùng totalItems
 * @param {string} [itemLabel='mục']  "bài", "quán", "tài khoản"
 */
export default function Pagination({ page, totalPages, onChange, totalItems, pageSize, itemLabel = 'mục', className }) {
  if (!totalPages || totalPages <= 1) return null;
  const go = (p) => { if (p >= 1 && p <= totalPages && p !== page) onChange?.(p); };
  const from = totalItems && pageSize ? (page - 1) * pageSize + 1 : null;
  const to = from ? Math.min(page * pageSize, totalItems) : null;

  return (
    <nav className={cx(styles.wrap, className)} aria-label="Phân trang">
      {from && <span className={styles.info}>Hiển thị {from} đến {to} trong {totalItems} {itemLabel}</span>}
      <ul className={styles.list}>
        <li>
          <button type="button" className={styles.btn} onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Trang trước">
            <i className="bi bi-chevron-left" aria-hidden="true" />
          </button>
        </li>
        {pagesToShow(page, totalPages).map((p, i) => (
          <li key={`${p}-${i}`} className={typeof p === 'number' ? styles.num : styles.ellipsis}>
            {p === '…' ? (
              <span className={styles.gap} aria-hidden="true">…</span>
            ) : (
              <button
                type="button"
                className={cx(styles.btn, p === page && styles.current)}
                onClick={() => go(p)}
                aria-current={p === page ? 'page' : undefined}
                aria-label={`Trang ${p}`}
              >
                {p}
              </button>
            )}
          </li>
        ))}
        <li className={styles.mobileOnly} aria-hidden="true"><span className={styles.gap}>{page} / {totalPages}</span></li>
        <li>
          <button type="button" className={styles.btn} onClick={() => go(page + 1)} disabled={page >= totalPages} aria-label="Trang sau">
            <i className="bi bi-chevron-right" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </nav>
  );
}
