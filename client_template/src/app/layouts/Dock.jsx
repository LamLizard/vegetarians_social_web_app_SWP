import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Avatar, IconButton, Menu, useToast } from '../../components';
import cx from '../../components/cx';
import { useApp, useCurrentUser } from '../store/AppStore';
import { useTheme } from '../utils/theme';
import { timeAgo } from '../utils/format';
import { DOCK_NAV } from '../config';
import { useShell } from './ShellContext';
import Logo from './Logo';
import styles from './shell.module.css';

/** Danh sách thông báo – dùng chung cho dock (desktop) và thanh trên (điện thoại). */
export function NotificationList({ close }) {
  const { state, actions } = useApp();
  const me = useCurrentUser();
  const navigate = useNavigate();
  const list = state.notifications
    .filter((n) => n.userId === me.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = list.filter((n) => !n.read).length;

  return (
    <div className={styles.notif}>
      <div className={styles.notifHead}>
        <h2>Thông báo</h2>
        {unread > 0 && <button type="button" className={styles.linkBtn} onClick={actions.markNotificationsRead}>Đánh dấu đã đọc</button>}
      </div>
      {list.length === 0 && <p className={styles.notifEmpty}>Chưa có thông báo nào.</p>}
      {list.map((n) => (
        <button
          key={n.id}
          type="button"
          className={cx(styles.notifItem, !n.read && styles.notifUnread)}
          onClick={() => { close(); navigate(n.link); }}
        >
          <span className={cx(styles.notifIcon, n.tone && styles[`tone_${n.tone}`])} aria-hidden="true"><i className={`bi bi-${n.icon}`} /></span>
          <span className={styles.notifText}>
            {n.text}
            <small>{timeAgo(n.createdAt)}</small>
          </span>
          {!n.read && <span className={styles.unreadDot} aria-label="Chưa đọc" />}
        </button>
      ))}
    </div>
  );
}

export function useUnreadCount() {
  const { state } = useApp();
  const me = useCurrentUser();
  return state.notifications.filter((n) => n.userId === me.id && !n.read).length;
}

/** Các mục menu tài khoản – dùng chung dock + điện thoại */
export function useAccountItems() {
  const { actions } = useApp();
  const me = useCurrentUser();
  const navigate = useNavigate();
  const toast = useToast();
  const [theme, toggleTheme] = useTheme();
  return [
    { icon: 'person', label: 'Trang cá nhân', hint: 'Hộ chiếu chay của bạn', onClick: () => navigate(`/profile/${me.id}`) },
    ...(me.role === 'admin' ? [{ icon: 'speedometer2', label: 'Trang quản trị', onClick: () => navigate('/admin') }] : []),
    { icon: theme === 'dark' ? 'sun' : 'moon-stars', label: theme === 'dark' ? 'Chuyển sang chế độ Ngày' : 'Chuyển sang chế độ Đêm', onClick: toggleTheme },
    { icon: 'palette', label: 'Review Kit (component)', onClick: () => navigate('/kit') },
    { icon: 'arrow-counterclockwise', label: 'Đặt lại dữ liệu demo', onClick: () => { actions.resetDemo(); toast('Đã khôi phục dữ liệu mẫu ban đầu'); } },
    { divider: true },
    { icon: 'box-arrow-right', label: 'Đăng xuất', onClick: () => { navigate('/login', { replace: true, state: { loggedOut: true } }); actions.logout(); } },
  ];
}

/** Dock dọc bên trái (từ 768px trở lên). */
export default function Dock() {
  const me = useCurrentUser();
  const { openCompose } = useShell();
  const unread = useUnreadCount();
  const [theme, toggleTheme] = useTheme();
  const accountItems = useAccountItems();

  return (
    <nav className={styles.dock} aria-label="Điều hướng chính">
      <Logo />

      <motion.button
        type="button"
        className={styles.dockCreate}
        onClick={() => openCompose('share')}
        whileHover={{ rotate: 90 }}
        whileTap={{ scale: 0.92 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        aria-label="Đăng bài mới"
        title="Đăng bài mới"
      >
        <i className="bi bi-plus-lg" aria-hidden="true" />
      </motion.button>

      <div className={styles.dockNav}>
        {DOCK_NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cx(styles.dockItem, isActive && styles.dockItemOn)}>
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="dock-pill" className={styles.dockPill} transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                <span className={styles.dockIcon}>
                  <i className={`bi bi-${isActive ? item.iconOn : item.icon}`} aria-hidden="true" />
                </span>
                <span className={styles.dockLabel}>{item.label}</span>
                {item.soon && <span className="visually-hidden">(sắp có)</span>}
              </>
            )}
          </NavLink>
        ))}
        {me.role === 'admin' && (
          <NavLink to="/admin" className={styles.dockItem}>
            <span className={styles.dockIcon}><i className="bi bi-speedometer2" aria-hidden="true" /></span>
            <span className={styles.dockLabel}>Quản trị</span>
          </NavLink>
        )}
      </div>

      <div className={styles.dockBottom}>
        <IconButton
          variant="ghost"
          icon={theme === 'dark' ? 'sun' : 'moon-stars'}
          label={theme === 'dark' ? 'Chuyển sang chế độ Ngày' : 'Chuyển sang chế độ Đêm'}
          onClick={toggleTheme}
        />
        <Menu side="right" width={360} renderTrigger={(p) => (
          <IconButton variant="ghost" icon={unread ? 'bell-fill' : 'bell'} badge={unread} label={`Thông báo${unread ? ` (${unread} chưa đọc)` : ''}`} {...p} />
        )}>
          {(close) => <NotificationList close={close} />}
        </Menu>
        <Menu side="right" width={270} items={accountItems} renderTrigger={(p) => (
          <button type="button" className={styles.dockAvatar} aria-label="Tài khoản của bạn" {...p}>
            <Avatar name={me.fullName} src={me.avatar} size={40} />
          </button>
        )} />
      </div>
    </nav>
  );
}
