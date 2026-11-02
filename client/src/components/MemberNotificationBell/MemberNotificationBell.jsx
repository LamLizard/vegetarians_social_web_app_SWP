import { useCallback, useEffect, useState } from 'react';
import Menu from '../Menu/Menu';
import NotificationList from '../NotificationList/NotificationList';
import { getMyNotifications, markAllNotificationsRead, markNotificationRead } from '../../services/notification.service';
import getNotificationTarget from '../../utils/getNotificationTarget';
import cx from '../cx';
import styles from './MemberNotificationBell.module.css';

export default function MemberNotificationBell({ side = 'right', role = 'member', collapsed = false }) {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const result = await getMyNotifications();
      setItems(result.items.map((item) => ({ ...item, href: getNotificationTarget(item, role) })));
      setUnreadCount(result.unreadCount);
      setLoaded(true);
    } catch { /* keep the notification control usable during temporary network failures */ }
  }, [role]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [refresh]);

  const open = async () => {
    if (loaded) return;
    setLoading(true);
    await refresh();
    setLoading(false);
  };

  const markRead = async (item) => {
    if (item.isRead) return;
    try {
      await markNotificationRead(item.id);
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, isRead: true } : entry));
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch { /* the next poll will reconcile server state */ }
  };

  const markAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setItems((current) => current.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch { /* the next poll will reconcile server state */ }
  };

  // Duy's Code: Trigger đổi theo trạng thái rail, vẫn giữ một nút accessible duy nhất.
  return (
    <Menu
      side={side}
      width={380}
      className={styles.triggerWrap}
      panelClassName={styles.menu}
      portal
      role="dialog"
      ariaLabel="Thông báo"
      mobileSheet
      renderTrigger={(props) => (
        <button
          type="button"
          {...props}
          className={cx(styles.trigger, collapsed ? styles.compactTrigger : styles.expandedTrigger)}
          aria-label="Thông báo"
          title={collapsed ? 'Thông báo' : undefined}
          onClick={(event) => { props.onClick(event); open(); }}
        >
          <i className={`bi bi-${unreadCount ? 'bell-fill' : 'bell'}`} aria-hidden="true" />
          {!collapsed && <span className={styles.triggerLabel}>Thông báo</span>}
          {unreadCount > 0 && <span className={cx(styles.badge, collapsed && styles.compactBadge)} aria-hidden="true">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>}
        </button>
      )}
    >
      {(close) => <div className={styles.list}>
        <NotificationList
          items={items}
          loading={loading}
          onClose={close}
          onItemClick={async (item) => {
            await markRead(item);
          }}
          onMarkAllRead={markAllRead}
        />
      </div>}
    </Menu>
  );
}
