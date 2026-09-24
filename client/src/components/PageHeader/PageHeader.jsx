import cx from '../cx';
import { getLink } from '../link';
import styles from './PageHeader.module.css';

/**
 * Đầu trang thống nhất: đường dẫn (tuỳ chọn) · tiêu đề H1 · mô tả · nút thao tác bên phải.
 * Mỗi trang chỉ 1 PageHeader (nó chứa thẻ <h1>).
 *
 * @param {string} title
 * @param {React.ReactNode} [description]
 * @param {{label: string, href?: string}[]} [breadcrumb]   mục cuối là trang hiện tại (không cần href)
 * @param {React.ReactNode} [actions]     vd <Button icon="plus-lg">Tạo danh mục</Button>
 * @param {React.ElementType} [linkAs]
 */
export default function PageHeader({ title, description, breadcrumb, actions, linkAs, className }) {
  return (
    <header className={cx(styles.head, className)}>
      <div className={styles.text}>
        {breadcrumb?.length > 0 && (
          <nav aria-label="Đường dẫn" className={styles.crumbs}>
            <ol>
              {breadcrumb.map((c, i) => {
                const last = i === breadcrumb.length - 1;
                const [Link, linkProps] = getLink(linkAs, c.href);
                return (
                  <li key={c.label}>
                    {c.href && !last ? <Link {...linkProps}>{c.label}</Link> : <span aria-current={last ? 'page' : undefined}>{c.label}</span>}
                    {!last && <i className="bi bi-chevron-right" aria-hidden="true" />}
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.desc}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
