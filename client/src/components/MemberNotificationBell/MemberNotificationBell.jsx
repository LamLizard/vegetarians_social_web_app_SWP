import { useCallback, useEffect, useState } from 'react';
import IconButton from '../IconButton/IconButton';
import Menu from '../Menu/Menu';
import NotificationList from '../NotificationList/NotificationList';
import { getMyNotifications, markAllNotificationsRead, markNotificationRead } from '../../services/notification.service';
import styles from './MemberNotificationBell.module.css';

export default function MemberNotificationBell({ side = 'right' }) {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const result = await getMyNotifications();
      setItems(result.items);
      setUnreadCount(result.unreadCount);
      setLoaded(true);
    } catch { /* keep the notification control usable during temporary network failures */ }
  }, []);

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

  return (
    <Menu
      side={side}
      width={390}
      className={styles.menu}
      renderTrigger={(props) => <IconButton
        variant="ghost"
        icon={unreadCount ? 'bell-fill' : 'bell'}
        badge={unreadCount}
        label={`Thông báo${unreadCount ? ` (${unreadCount} chưa đọc)` : ''}`}
        {...props}
        onClick={(event) => { props.onClick(event); open(); }}
      />}
    >
      <div className={styles.list}>
        <NotificationList
          items={items}
          loading={loading}
          onItemClick={markRead}
          onMarkAllRead={markAllRead}
        />
      </div>
    </Menu>
  );
}
