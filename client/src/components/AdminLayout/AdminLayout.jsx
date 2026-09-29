import { useState } from 'react';
import IconButton from '../IconButton/IconButton';
import Modal from '../Modal/Modal';
import cx from '../cx';
import AdminSidebar from '../AdminSidebar/AdminSidebar';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import styles from './AdminLayout.module.css';

/**
 * Khung khu quản trị /admin (M-14, M-15, M-16): menu trái cố định + thanh trên có đường dẫn.
 * Điện thoại / máy tính bảng (< 992px): menu trái ẩn, bấm nút ☰ mở ngăn kéo.
 *
 * @param {string} [activeKey] · [linkAs]
 * @param {string} title                 tên trang hiện tại, hiện trên thanh trên
 * @param {{fullName?, name?, email?, avatarUrl?}} user
 * @param {() => void} onLogout
 * @param {boolean} [contained]          chỉ dùng trong Review Kit
 */
export default function AdminLayout({
  activeKey, linkAs, title = 'Quản trị', user, onLogout, contained = false, children,
}) {
  const [drawer, setDrawer] = useState(false);

  return (
    <div className={cx(styles.shell, contained && styles.contained)}>
      <aside className={styles.sidebar}>
        <AdminSidebar activeKey={activeKey} user={user} onLogout={onLogout} linkAs={linkAs} />
      </aside>
      <div className={styles.content}>
        <header className={styles.topbar}>
          <IconButton className={styles.menuBtn} icon="list" label="Mở menu quản trị" onClick={() => setDrawer(true)} />
          <div className={styles.crumbs}>
            <span>Quản trị</span>
            <i className="bi bi-chevron-right" aria-hidden="true" />
            <b>{title}</b>
          </div>
          <ThemeToggle buttonVariant="ghost" />
        </header>
        <main className={styles.main}>{children}</main>
      </div>
      <Modal open={drawer} onClose={() => setDrawer(false)} title="Menu quản trị" placement="left">
        <AdminSidebar
          activeKey={activeKey}
          user={user}
          onLogout={onLogout}
          linkAs={linkAs}
          onNavigate={() => setDrawer(false)}
        />
      </Modal>
    </div>
  );
}
