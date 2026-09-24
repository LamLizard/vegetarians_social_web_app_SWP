import Avatar from '../Avatar/Avatar';
import Button from '../Button/Button';
import IconButton from '../IconButton/IconButton';
import Menu from '../Menu/Menu';
import cx from '../cx';
import { getLink } from '../link';
import { useTheme } from '../../utils/theme';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import Logo from './Logo';
import styles from './AppShell.module.css';

/**
 * Khung cho mọi trang của khách và thành viên (giữ đúng bố cục bản app-an-chay-ui_1):
 *  - Máy tính (≥ 768px): dock dọc bên trái (logo, nút Đăng bài, menu, chế độ Đêm, chuông, tài khoản) + thanh trên có ô tìm.
 *  - Điện thoại: thanh trên (logo, tìm, chuông, tài khoản) + thanh tab dưới đáy (4 mục + nút Đăng bài ở giữa).
 *  - `aside`: cột phải, chỉ hiện từ 1280px.
 * Component KHÔNG đọc store, KHÔNG biết route: trang/App truyền `nav`, `activeKey`, `user`...
 *
 * @param {{key, label, icon, iconActive?, href, badge?}[]} nav   mục điều hướng chính
 * @param {string} [activeKey]           mục đang mở (tự tính từ useLocation() ở App)
 * @param {React.ElementType} [linkAs]   Link của react-router
 * @param {{name, avatarUrl?}} [user]    không có → khách: hiện Đăng nhập / Đăng ký
 * @param {{icon?, label, onClick, tone?, divider?}[]} [accountMenu]  menu tài khoản (Trang cá nhân, Quản trị, Đăng xuất...)
 * @param {number} [notificationCount]
 * @param {(close) => ReactNode} [renderNotifications]  nội dung menu chuông, thường <NotificationList />
 * @param {() => void} [onCreate]        nút "Đăng bài" (dock + giữa tab dưới). Không truyền → ẩn
 * @param {React.ReactNode} [search]     ô tìm trên thanh trên, vd <SearchInput /> (hoặc dùng onSearchClick)
 * @param {() => void} [onSearchClick]   ô giả "Tìm món, bài viết, quán..." bấm để mở trang tìm
 * @param {string[]} [mobileNavKeys]     key hiện ở tab dưới (tối đa 4), mặc định 4 mục đầu
 * @param {() => void} [onLogin] · [onRegister]
 * @param {React.ReactNode} [aside]      cột phải (≥ 1280px)
 * @param {'feed'|'wide'|'full'} [width='wide']  feed 660px · wide 1056px · full hết chiều ngang
 * @param {boolean} [contained]          chỉ dùng trong Review Kit: khung cao theo biến --shell-h thay vì cả màn hình
 */
export default function AppShell({
  nav = [], activeKey, linkAs, user, accountMenu = [], notificationCount = 0, renderNotifications, onCreate,
  search, onSearchClick, mobileNavKeys, onLogin, onRegister, aside, width = 'wide', contained = false, className, children,
}) {
  const [theme, toggleTheme] = useTheme();
  const tabs = (mobileNavKeys ? nav.filter((n) => mobileNavKeys.includes(n.key)) : nav).slice(0, 4);
  const themeLabel = theme === 'dark' ? 'Chuyển sang chế độ Sáng' : 'Chuyển sang chế độ Tối';

  const bell = renderNotifications && ((side, w) => (
    <Menu side={side} width={w} renderTrigger={(p) => (
      <IconButton variant="ghost" icon={notificationCount ? 'bell-fill' : 'bell'} badge={notificationCount}
        label={`Thông báo${notificationCount ? ` (${notificationCount} chưa đọc)` : ''}`} {...p} />
    )}>
      {(close) => renderNotifications(close)}
    </Menu>
  ));
  const account = (side, size) => user && (
    <Menu side={side} width={260} items={[...accountMenu, { divider: true }, { icon: theme === 'dark' ? 'sun' : 'moon-stars', label: themeLabel, onClick: toggleTheme }]}
      renderTrigger={(p) => (
        <button type="button" className={styles.avatarBtn} aria-label="Tài khoản của bạn" {...p}>
          <Avatar name={user.name} src={user.avatarUrl} size={size} />
        </button>
      )} />
  );

  const navLink = (item, cls, activeCls, content) => {
    const [Link, linkProps] = getLink(linkAs, item.href);
    const on = item.key === activeKey;
    return (
      <Link key={item.key} {...linkProps} className={cx(cls, on && activeCls)} aria-current={on ? 'page' : undefined}>
        {content(on)}
      </Link>
    );
  };

  return (
    <div className={cx(styles.shell, contained && styles.contained, className)}>
      {/* ---------- Dock trái (máy tính) ---------- */}
      <nav className={styles.dock} aria-label="Điều hướng chính">
        <Logo linkAs={linkAs} />
        {onCreate && (
          <button type="button" className={styles.create} onClick={onCreate} aria-label="Đăng bài mới" title="Đăng bài mới">
            <i className="bi bi-plus-lg" aria-hidden="true" />
          </button>
        )}
        <div className={styles.dockNav}>
          {nav.map((item) => navLink(item, styles.dockItem, styles.dockItemOn, (on) => (
            <>
              <span className={styles.dockIcon}>
                <i className={`bi bi-${on && item.iconActive ? item.iconActive : item.icon}`} aria-hidden="true" />
                {item.badge > 0 && <span className={styles.dot}><span className="visually-hidden">, có {item.badge} mục mới</span></span>}
              </span>
              <span className={styles.dockLabel}>{item.label}</span>
            </>
          )))}
        </div>
        <div className={styles.dockBottom}>
          {!user && <ThemeToggle buttonVariant="ghost" />}
          {user && bell?.('right', 360)}
          {account('right', 40)}
          {!user && onLogin && <IconButton variant="solid" icon="box-arrow-in-right" label="Đăng nhập" onClick={onLogin} />}
        </div>
      </nav>

      <div className={styles.main}>
        {/* ---------- Thanh trên ---------- */}
        <header className={styles.topbar}>
          <div className={cx(styles.barInner, styles[`w_${width}`])}>
            <Logo linkAs={linkAs} size={36} className={styles.mobileOnly} />
            <div className={styles.search}>
              {search ?? (onSearchClick && (
                <button type="button" className={styles.omnibox} onClick={onSearchClick}>
                  <i className="bi bi-search" aria-hidden="true" />
                  <span className={styles.omniLong}>Tìm món, bài viết, quán chay... hoặc hỏi Mầm</span>
                  <span className={styles.omniShort}>Tìm hoặc hỏi Mầm</span>
                </button>
              ))}
            </div>
            {user ? (
              <div className={styles.mobileOnly}>
                {bell?.('bottom', 330)}
                {account('bottom', 34)}
              </div>
            ) : (
              <div className={styles.guest}>
                {onRegister && <Button size="sm" variant="subtle" onClick={onRegister} className={styles.hideXs}>Đăng ký</Button>}
                {onLogin && <Button size="sm" onClick={onLogin}>Đăng nhập</Button>}
              </div>
            )}
          </div>
        </header>

        <main className={cx(styles.content, styles[`w_${width}`], aside && styles.withAside)}>
          <div className={styles.page}>{children}</div>
          {aside && <aside className={styles.aside}>{aside}</aside>}
        </main>
      </div>

      {/* ---------- Tab dưới (điện thoại) ---------- */}
      <nav className={styles.tabbar} aria-label="Điều hướng nhanh" style={{ gridTemplateColumns: `repeat(${tabs.length + (onCreate ? 1 : 0)}, 1fr)` }}>
        {tabs.slice(0, 2).map((item) => navLink(item, styles.tab, styles.tabOn, (on) => (
          <><i className={`bi bi-${on && item.iconActive ? item.iconActive : item.icon}`} aria-hidden="true" />{item.label}</>
        )))}
        {onCreate && (
          <button type="button" className={styles.tabCreate} aria-label="Đăng bài mới" onClick={onCreate}>
            <i className="bi bi-plus-lg" aria-hidden="true" />
          </button>
        )}
        {tabs.slice(2).map((item) => navLink(item, styles.tab, styles.tabOn, (on) => (
          <><i className={`bi bi-${on && item.iconActive ? item.iconActive : item.icon}`} aria-hidden="true" />{item.label}</>
        )))}
      </nav>
    </div>
  );
}
