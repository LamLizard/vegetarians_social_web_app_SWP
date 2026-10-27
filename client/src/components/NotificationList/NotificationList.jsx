import Skeleton from '../Skeleton/Skeleton';
import cx from '../cx';
import { getLink } from '../link';
import { NOTIFICATION_TYPE } from '../../constants/domain';
import { timeAgo } from '../../utils/format';
import styles from './NotificationList.module.css';

const FALLBACK = { label: 'Thông báo', icon: 'bell', tone: 'neutral' };

/**
 * Danh sách thông báo (bảng notification). Thường đặt trong <Menu> mở từ nút chuông của AppShell.
 * Icon và màu lấy theo notification.type (NOTIFICATION_TYPE); type lạ vẫn hiện được với icon chuông.
 *
 * @param {{id, type, title, content?, createdAt, isRead, href?}[]} items
 * @param {(item) => void} [onItemClick]   thường: đánh dấu đã đọc + đóng menu (link tự chuyển trang)
 * @param {() => void} [onMarkAllRead]
 * @param {boolean} [loading]
 * @param {React.ElementType} [linkAs]
 * @param {string} [title='Thông báo']
 */
export default function NotificationList({
  items = [], onItemClick, onMarkAllRead, onClose, loading = false, linkAs, title = 'Thông báo', className,
}) {
  const unread = items.filter((n) => !n.isRead).length;

  return (
    <div className={cx(styles.box, className)}>
      <div className={styles.head}>
        <h2>{title}</h2>
        <div className={styles.actions}>
          {onMarkAllRead && <button type="button" className={styles.link} disabled={unread === 0} onClick={onMarkAllRead}>Đánh dấu tất cả đã đọc</button>}
          {onClose && <button type="button" className={styles.close} onClick={onClose} aria-label="Đóng thông báo"><i className="bi bi-x-lg" aria-hidden="true" /></button>}
        </div>
      </div>
      {loading && [0, 1, 2].map((i) => (
        <div key={i} className={styles.item}><Skeleton shape="circle" width={38} /><div className={styles.text}><Skeleton lines={2} /></div></div>
      ))}
      {!loading && items.length === 0 && (
        <p className={styles.empty}><i className="bi bi-bell-slash" aria-hidden="true" /> Chưa có thông báo nào.</p>
      )}
      {!loading && items.length > 0 && (
        <ul className={styles.list}>
          {items.map((n) => {
            const t = NOTIFICATION_TYPE[n.type] ?? FALLBACK;
            const [Tag, linkProps] = n.href ? getLink(linkAs, n.href) : ['button', { type: 'button' }];
            return (
              <li key={n.id}>
                <Tag {...linkProps} className={cx(styles.item, n.href ? styles.clickable : styles.staticItem, !n.isRead && styles.unread)}
                  title={!n.href ? 'Thông báo này không có trang đích.' : new Date(n.createdAt).toLocaleString('vi-VN')}
                  onClick={async (event) => {
                  if (!onItemClick) return;
                  const result = onItemClick(n);
                  if (result && typeof result.then === 'function') {
                    event.preventDefault();
                    await result;
                    if (n.href) window.location.assign(n.href);
                  }
                }}>
                  <span className={cx(styles.icon, styles[t.tone])} aria-hidden="true"><i className={`bi bi-${t.icon}`} /></span>
                  <span className={styles.text}>
                    <b>{n.title}</b>
                    {n.content && <span className={styles.content}>{n.content}</span>}
                    <small><time dateTime={n.createdAt}>{timeAgo(n.createdAt)}</time></small>
                  </span>
                  {!n.isRead && <span className={styles.dot}><span className="visually-hidden">Chưa đọc</span></span>}
                  {n.href && <i className={`bi bi-chevron-right ${styles.chevron}`} aria-hidden="true" />}
                </Tag>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
