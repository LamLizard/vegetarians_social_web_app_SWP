import Avatar from '../Avatar/Avatar';
import IconButton from '../IconButton/IconButton';
import Logo from '../AppShell/Logo';
import cx from '../cx';
import { getLink } from '../link';
import styles from './AdminSidebar.module.css';

// Khoi's code 30/10: chia 3 nhóm (Kiểm duyệt · Nội dung · Người dùng) cho dễ tìm; key/href giữ nguyên như cũ
const MENU = [
  { key: 'dashboard', label: 'Tổng quan', icon: 'speedometer2', href: '/admin' },
  { group: 'Kiểm duyệt' },
  { key: 'moderation', label: 'Bài viết & báo cáo', icon: 'clipboard2-check', href: '/admin/moderation' },
  { key: 'recipe-verify', label: 'Duyệt công thức', icon: 'book-half', href: '/admin/recipes/verify' },
  // Duy's Code : Mở trang Admin xử lý tên nguyên liệu do thành viên đề cử.
  { key: 'ingredient-verify', label: 'Duyệt nguyên liệu', icon: 'basket', href: '/admin/ingredients/verify' },
  // Tùng — Sprint 2: BRIDGE-02 thêm entry riêng, khớp activeKey của ShopVerifyPage.
  { key: 'shops', label: 'Xác minh quán', icon: 'shop', href: '/admin/shops/verify' },
  { key: 'appeals', label: 'Khiếu nại', icon: 'envelope-paper', href: '/admin/appeals' },
  { group: 'Nội dung' },
  { key: 'dish-management', label: 'Quản lý món ăn', icon: 'egg-fried', href: '/admin/dishes' },
  // Duy's code: Mở form để Admin tạo Dish mới ở trạng thái hoạt động.
  { key: 'dish-create', label: 'Tạo món ăn', icon: 'plus-square', href: '/admin/dishes/create' },
  { key: 'categories', label: 'Danh mục', icon: 'tags', href: '/admin/categories' },
  { group: 'Người dùng' },
  { key: 'accounts', label: 'Tài khoản', icon: 'people', href: '/admin/accounts' },
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
          if (item.group) return <span key={`group-${index}`} className={styles.group}>{item.group}</span>;
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
