import { useState } from 'react';
import Avatar from '../Avatar/Avatar';
import IconButton from '../IconButton/IconButton';
import Menu from '../Menu/Menu';
import Modal from '../Modal/Modal';
import Logo from '../AppShell/Logo';
import cx from '../cx';
import { getLink } from '../link';
import { APP_NAME } from '../../constants/domain';
import { useTheme } from '../../utils/theme';
import styles from './AdminLayout.module.css';

/**
 * Khung khu quản trị /admin (M-14, M-15, M-16): menu trái cố định + thanh trên có đường dẫn.
 * Điện thoại / máy tính bảng (< 992px): menu trái ẩn, bấm nút ☰ mở ngăn kéo.
 *
 * @param {({key, label, icon, href, badge?, count?} | {divider: true})[]} nav
 *        badge = số việc chờ xử lý (nền vàng) · count = số đếm thường (xám)
 * @param {string} [activeKey] · [linkAs]
 * @param {string} title                 tên trang hiện tại, hiện trên thanh trên
 * @param {{name, avatarUrl?}} user
 * @param {{icon?, label, onClick, tone?, divider?}[]} [accountMenu]
 * @param {React.ReactNode} [actions]    nút thêm trên thanh trên
 * @param {boolean} [contained]          chỉ dùng trong Review Kit
 */
export default function AdminLayout({
  nav = [], activeKey, linkAs, title = 'Quản trị', user, accountMenu = [], actions, contained = false, className, children,
}) {
  const [drawer, setDrawer] = useState(false);
  const [theme, toggleTheme] = useTheme();

  const renderNav = (onNavigate) => (
    <div className={styles.navInner}>
      <div className={styles.brand}>
        <Logo size={36} linkAs={linkAs} href={nav.find((n) => n.href)?.href ?? '/admin'} />
        <div><b>{APP_NAME}</b><small>Quản trị hệ thống</small></div>
      </div>
      <nav className={styles.navList} aria-label="Menu quản trị">
        {nav.map((item, i) => {
          if (item.divider) return <hr key={`d-${i}`} />;
          const [Link, linkProps] = getLink(linkAs, item.href);
          const on = item.key === activeKey;
          return (
            <Link key={item.key} {...linkProps} className={cx(styles.navItem, on && styles.navOn)} aria-current={on ? 'page' : undefined} onClick={onNavigate}>
              <i className={`bi bi-${item.icon}`} aria-hidden="true" />
              <span className={styles.navLabel}>{item.label}</span>
              {item.badge > 0 && <span className={styles.badge} aria-label={`${item.badge} mục chờ xử lý`}>{item.badge > 99 ? '99+' : item.badge}</span>}
              {item.count != null && !item.badge && <span className={styles.count}>{item.count}</span>}
            </Link>
          );
        })}
      </nav>
      {user && (
        <div className={styles.user}>
          <Avatar name={user.name} src={user.avatarUrl} size={36} />
          <div><b>{user.name}</b><small>Quản trị viên</small></div>
        </div>
      )}
    </div>
  );

  return (
    <div className={cx(styles.shell, contained && styles.contained, className)}>
      <aside className={styles.sidebar}>{renderNav()}</aside>
      <div className={styles.content}>
        <header className={styles.topbar}>
          <IconButton className={styles.menuBtn} icon="list" label="Mở menu quản trị" onClick={() => setDrawer(true)} />
          <div className={styles.crumbs}>
            <span>Quản trị</span>
            <i className="bi bi-chevron-right" aria-hidden="true" />
            <b>{title}</b>
          </div>
          {actions}
          <IconButton variant="ghost" icon={theme === 'dark' ? 'sun' : 'moon-stars'} label={theme === 'dark' ? 'Chuyển sang chế độ Ngày' : 'Chuyển sang chế độ Đêm'} onClick={toggleTheme} />
          {user && (
            <Menu width={240} items={accountMenu} renderTrigger={(p) => (
              <button type="button" className={styles.topUser} aria-label="Tài khoản quản trị" {...p}>
                <Avatar name={user.name} src={user.avatarUrl} size={32} />
                <span className={styles.topName}>{user.name}</span>
                <i className="bi bi-chevron-down" aria-hidden="true" />
              </button>
            )} />
          )}
        </header>
        <main className={styles.main}>{children}</main>
      </div>
      <Modal open={drawer} onClose={() => setDrawer(false)} title="Menu quản trị" placement="left">
        {renderNav(() => setDrawer(false))}
      </Modal>
    </div>
  );
}
