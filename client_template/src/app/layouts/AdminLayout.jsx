import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Avatar, IconButton, Menu, Modal } from '../../components';
import cx from '../../components/cx';
import { useApp, useCurrentUser } from '../store/AppStore';
import { APP_NAME } from '../config';
import { useTheme } from '../utils/theme';
import Logo from './Logo';
import styles from '../pages/admin/admin.module.css';

const TITLES = {
  '/admin': 'Tổng quan',
  '/admin/verification': 'Duyệt nội dung',
  '/admin/members': 'Quản lý thành viên',
};

function AdminNav({ onNavigate }) {
  const { state, actions } = useApp();
  const me = useCurrentUser();
  const navigate = useNavigate();
  const pending = state.posts.filter((p) => p.status === 'pending').length
    + state.restaurants.filter((r) => r.status === 'pending_verification').length;
  const members = state.users.filter((u) => u.role === 'member').length;
  const itemClass = ({ isActive }) => cx(styles.navItem, isActive && styles.navActive);

  return (
    <div className={styles.navInner}>
      <div className={styles.navBrand}>
        <Logo to="/admin" size={36} />
        <div>
          <b>{APP_NAME}</b>
          <small>Quản trị hệ thống</small>
        </div>
      </div>

      <nav className={styles.navList} aria-label="Menu quản trị">
        <NavLink to="/admin" end className={itemClass} onClick={onNavigate}>
          <i className="bi bi-speedometer2" aria-hidden="true" /> Tổng quan
        </NavLink>
        <NavLink to="/admin/verification" className={itemClass} onClick={onNavigate}>
          <i className="bi bi-clipboard2-check" aria-hidden="true" /> Duyệt nội dung
          {pending > 0 && <span className={styles.navBadge} aria-label={`${pending} mục chờ duyệt`}>{pending}</span>}
        </NavLink>
        <NavLink to="/admin/members" className={itemClass} onClick={onNavigate}>
          <i className="bi bi-people" aria-hidden="true" /> Thành viên
          <span className={styles.navCount}>{members}</span>
        </NavLink>

        <hr />
        <Link to="/" className={styles.navItem} onClick={onNavigate}>
          <i className="bi bi-box-arrow-up-right" aria-hidden="true" /> Xem trang người dùng
        </Link>
        <Link to="/kit" className={styles.navItem} onClick={onNavigate}>
          <i className="bi bi-palette" aria-hidden="true" /> Review Kit
        </Link>
      </nav>

      <div className={styles.navUser}>
        <Avatar name={me.fullName} src={me.avatar} size={36} />
        <div>
          <b>{me.fullName}</b>
          <small>Quản trị viên</small>
        </div>
        <IconButton
          variant="ghost"
          size="sm"
          icon="box-arrow-right"
          label="Đăng xuất"
          className={styles.navLogout}
          onClick={() => { navigate('/login', { replace: true, state: { loggedOut: true } }); actions.logout(); }}
        />
      </div>
    </div>
  );
}

/** Khung trang quản trị: menu trái cố định + thanh tiêu đề. */
export default function AdminLayout() {
  const { pathname } = useLocation();
  const { actions } = useApp();
  const me = useCurrentUser();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);
  const [theme, toggleTheme] = useTheme();
  const title = TITLES[pathname] ?? 'Quản trị';

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}><AdminNav /></aside>

      <div className={styles.content}>
        <header className={styles.topbar}>
          <IconButton className="d-lg-none" icon="list" label="Mở menu quản trị" onClick={() => setDrawer(true)} />
          <div className={styles.crumbs}>
            <span>Quản trị</span>
            <i className="bi bi-chevron-right" aria-hidden="true" />
            <b>{title}</b>
          </div>
          <IconButton variant="ghost" icon={theme === 'dark' ? 'sun' : 'moon-stars'} label={theme === 'dark' ? 'Chuyển sang chế độ Ngày' : 'Chuyển sang chế độ Đêm'} onClick={toggleTheme} />
          <Menu
            width={240}
            items={[
              { icon: 'person', label: 'Trang cá nhân', onClick: () => navigate(`/profile/${me.id}`) },
              { icon: 'house-door', label: 'Về bảng tin', onClick: () => navigate('/') },
              { divider: true },
              { icon: 'box-arrow-right', label: 'Đăng xuất', onClick: () => { navigate('/login', { replace: true, state: { loggedOut: true } }); actions.logout(); } },
            ]}
            renderTrigger={(p) => (
              <button type="button" className={styles.topUser} aria-label="Tài khoản quản trị" {...p}>
                <Avatar name={me.fullName} src={me.avatar} size={34} />
                <span className="d-none d-sm-inline">{me.fullName}</span>
                <i className="bi bi-chevron-down" aria-hidden="true" />
              </button>
            )}
          />
        </header>

        <main className={styles.main}>
          <Outlet />
        </main>
      </div>

      <Modal open={drawer} onClose={() => setDrawer(false)} title="Menu quản trị" placement="left" className={styles.drawer}>
        <AdminNav onNavigate={() => setDrawer(false)} />
      </Modal>
    </div>
  );
}
