import ColorAvatar from '../ColorAvatar/ColorAvatar';
import Menu from '../Menu/Menu';
import cx from '../cx';
import { useTheme } from '../../utils/theme';
import s from './FeedSidebar.module.css';

/**
 * Thanh điều hướng bên trái của Bảng tin (theo prototype UI v2.1).
 *  - collapsed=true → chỉ còn icon (rê chuột hiện tên mục)
 *  - Điện thoại: thành ngăn kéo trượt từ trái (mobileOpen), bấm nền tối để đóng
 *  - Đáy: công tắc Sáng/Tối + tài khoản (Đăng xuất nằm cuối menu). Khách: nút Đăng nhập / Đăng ký.
 * Component KHÔNG gọi API, KHÔNG biết route: trang truyền nav, user, accountMenu...
 *
 * @param {{key, label, icon, iconActive?, href}[]} nav
 * @param {string} activeKey
 * @param {{name, avatarUrl?, roleLabel?}|null} user   null = khách
 * @param {{icon?, label, onClick, tone?, divider?}[]} [accountMenu]
 * @param {boolean} collapsed · @param {() => void} onToggle
 * @param {boolean} mobileOpen · @param {() => void} onCloseMobile
 * @param {() => void} [onLogin] · [onRegister]   chỉ dùng khi là khách
 */
export default function FeedSidebar({
  nav, activeKey, user, accountMenu = [], collapsed, onToggle, mobileOpen, onCloseMobile, onLogin, onRegister,
}) {
  const [theme, toggleTheme] = useTheme();

  const item = (n) => {
    const on = n.key === activeKey;
    return (
      <a key={n.key} href={n.href} className={cx(s.item, on && s.on)} aria-current={on ? 'page' : undefined} title={collapsed ? n.label : undefined}>
        <i className={`bi bi-${on && n.iconActive ? n.iconActive : n.icon} ${s.icon}`} aria-hidden="true" />
        <span className={s.label}>{n.label}</span>
      </a>
    );
  };

  return (
    <>
      <div className={cx(s.scrim, mobileOpen && s.scrimOn)} onClick={onCloseMobile} aria-hidden="true" />
      <aside className={cx(s.side, collapsed && s.collapsed, mobileOpen && s.open)} aria-label="Điều hướng chính">
        <div className={s.top}>
          <a href="/" className={s.brand} aria-label="Ăn Chay, về trang chủ">
            <span className={s.mark} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M5 19c0-8 5-13.5 14-14-.3 8.6-5.6 14-14 14Z" fill="currentColor" />
                <path d="M5 19c3-4.2 6-7 9.5-9" stroke="var(--v-surface)" strokeWidth="1.6" strokeLinecap="round" fill="none" />
              </svg>
            </span>
            <span className={s.name}>Ăn Chay</span>
          </a>
          <button
            type="button"
            className={s.toggle}
            onClick={onToggle}
            aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Mở rộng' : 'Thu gọn'}
          >
            <i className={`bi bi-${collapsed ? 'layout-sidebar-inset' : 'layout-sidebar'}`} aria-hidden="true" />
          </button>
          <button type="button" className={s.closeMobile} onClick={onCloseMobile} aria-label="Đóng menu">
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>

        <nav className={s.nav}>{nav.map(item)}</nav>

        <div className={s.bottom}>
          {/* Một nút: icon là chế độ SẼ chuyển sang */}
          <button
            type="button"
            className={s.theme}
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            title={collapsed ? (theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối') : undefined}
          >
            <i className={`bi bi-${theme === 'dark' ? 'sun' : 'moon-stars'} ${s.icon}`} aria-hidden="true" />
            <span className={s.label}>{theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}</span>
          </button>

          {user ? (
            <Menu
              side="right"
              width={240}
              className={s.accountWrap}
              items={accountMenu}
              renderTrigger={(p) => (
                <button type="button" className={s.account} aria-label="Tài khoản của bạn" {...p}>
                  <ColorAvatar name={user.name} src={user.avatarUrl} size={34} />
                  <span className={s.accountText}>
                    <b>{user.name}</b>
                    {user.roleLabel && <small>{user.roleLabel}</small>}
                  </span>
                  <i className={`bi bi-three-dots ${s.more}`} aria-hidden="true" />
                </button>
              )}
            />
          ) : (
            <div className={s.guest}>
              {onLogin && (
                <button type="button" className={s.login} onClick={onLogin} title={collapsed ? 'Đăng nhập' : undefined}>
                  <i className="bi bi-box-arrow-in-right" aria-hidden="true" />
                  <span className={s.label}>Đăng nhập</span>
                </button>
              )}
              {onRegister && (
                <button type="button" className={s.register} onClick={onRegister}>Tạo tài khoản miễn phí</button>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
