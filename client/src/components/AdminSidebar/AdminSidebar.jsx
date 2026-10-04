import Avatar from '../Avatar/Avatar';
import IconButton from '../IconButton/IconButton';
import Logo from '../AppShell/Logo';
import cx from '../cx';
import { getLink } from '../link';
import styles from './AdminSidebar.module.css';

const MENU = [
  { key: 'dashboard', label: 'Bảng điều khiển', icon: 'speedometer2', href: '/admin' },
  { key: 'moderation', label: 'Kiểm duyệt', icon: 'clipboard2-check', href: '/admin/moderation' },
  // Duy's code: Mở form để Admin tạo Dish mới ở trạng thái hoạt động.
  { key: 'dish-create', label: 'Tạo món ăn', icon: 'plus-square', href: '/admin/dishes/create' },
  // Duy's code: Mở hàng chờ để Admin duyệt hoặc từ chối Dish Member đề xuất.
  { key: 'dish-verify', label: 'Duyệt món ăn', icon: 'basket-check', href: '/admin/dishes/verify' },
  { key: 'appeals', label: 'Khiếu nại', icon: 'envelope-paper', href: '/admin/appeals' },
  { key: 'accounts', label: 'Tài khoản', icon: 'people', href: '/admin/accounts' },
  { key: 'categories', label: 'Danh mục', icon: 'tags', href: '/admin/categories' },
  { divider: true },
  { key: 'site', label: 'Xem trang người dùng', icon: 'box-arrow-up-right', href: '/' },
];

export default function AdminSidebar({ activeKey, user, onLogout, linkAs, onNavigate }) {
  const adminName = user?.fullName || user?.name || user?.email || 'Quản trị viên';

  return (
    <div className={styles.inner}>
      <div className={styles.brand}>
        <Logo href="/admin" linkAs={linkAs} showName size={36} />
        <small>Quản trị hệ thống</small>
      </div>

      <nav className={styles.navList} aria-label="Menu quản trị">
        {MENU.map((item, index) => {
          if (item.divider) return <hr key={`divider-${index}`} />;
          const [Link, linkProps] = getLink(linkAs, item.href);
          const active = item.key === activeKey;
          return (
            <Link
              key={item.key}
              {...linkProps}
              className={cx(styles.navItem, active && styles.navOn)}
              aria-current={active ? 'page' : undefined}
              onClick={onNavigate}
            >
              <i className={`bi bi-${item.icon}`} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.user}>
        <Avatar name={adminName} src={user?.avatarUrl} size={36} />
        <div className={styles.userInfo}>
          <b>{adminName}</b>
          <small>Quản trị viên</small>
        </div>
        <IconButton icon="box-arrow-right" label="Đăng xuất" variant="ghost" size="sm" onClick={onLogout} />
      </div>
    </div>
  );
}