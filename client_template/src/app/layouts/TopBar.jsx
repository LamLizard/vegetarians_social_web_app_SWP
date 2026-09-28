import { Avatar, IconButton, Menu } from '../../components';
import { useCurrentUser } from '../store/AppStore';
import { useShell } from './ShellContext';
import { NotificationList, useAccountItems, useUnreadCount } from './Dock';
import Logo from './Logo';
import styles from './shell.module.css';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Thanh trên cùng của vùng nội dung: 1 ô duy nhất để TÌM hoặc HỎI MẦM (mở bảng lệnh).
 * Trên điện thoại thêm logo, chuông và ảnh đại diện (vì không có dock).
 */
export default function TopBar() {
  const me = useCurrentUser();
  const { openPalette } = useShell();
  const unread = useUnreadCount();
  const accountItems = useAccountItems();

  return (
    <header className={styles.topbar}>
      <div className={styles.barInner}>
      <Logo size={36} className={styles.mobileOnly} />

      <button type="button" className={styles.omnibox} onClick={openPalette} aria-label="Tìm kiếm hoặc hỏi trợ lý Mầm" aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}>
        <i className="bi bi-search" aria-hidden="true" />
        <span className={styles.omniLong}>Tìm món, bạn bè, quán ăn… hoặc hỏi Mầm</span>
        <span className={styles.omniShort}>Tìm hoặc hỏi Mầm</span>
        <kbd className={styles.kbd}>{isMac ? '⌘' : 'Ctrl'} K</kbd>
      </button>

      <div className={styles.mobileOnly}>
        <Menu width={330} renderTrigger={(p) => (
          <IconButton variant="ghost" icon={unread ? 'bell-fill' : 'bell'} badge={unread} label="Thông báo" {...p} />
        )}>
          {(close) => <NotificationList close={close} />}
        </Menu>
        <Menu width={260} items={accountItems} renderTrigger={(p) => (
          <button type="button" className={styles.dockAvatar} aria-label="Tài khoản của bạn" {...p}>
            <Avatar name={me.fullName} src={me.avatar} size={34} />
          </button>
        )} />
      </div>
      </div>
    </header>
  );
}
