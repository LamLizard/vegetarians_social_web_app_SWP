import { cloneElement, isValidElement, useState } from 'react';
import Avatar from '../Avatar/Avatar';
import Menu from '../Menu/Menu';
import cx from '../cx';
import { APP_NAME } from '../../constants/domain';
import { useTheme } from '../../utils/theme';
import s from './FeedSidebar.module.css';

/**
 * Thanh điều hướng bên trái của Bảng tin — theo prototype UI v2 (src/v2/components/Sidebar.jsx, wireframe Figma "1 · Sketch").
 *  Trên:  logo Green Bowl + nút thu gọn · nút "+ Đăng bài" · các mục điều hướng
 *  Đáy:   nút Sáng/Tối · hộp tài khoản (bấm hàng tên → mở lối tắt: Hồ sơ cá nhân, Đăng xuất…)
 *  collapsed=true → chỉ còn icon; bấm avatar mở popup chứa các lối tắt tài khoản
 *  Điện thoại: ngăn kéo trượt từ trái (mobileOpen), bấm nền tối để đóng
 *  Khách: không có nút Đăng bài, đáy là Đăng nhập / Đăng ký
 * Component KHÔNG gọi API, KHÔNG biết route: trang truyền nav, user, accountMenu...
 *
 * @param {{key, label, icon, iconActive?, href}[]} nav
 * @param {string} activeKey
 * @param {{name, avatarUrl?, roleLabel?}|null} user   null = khách
 * @param {{icon?, label, href?, onClick?, tone?, disabled?, active?, title?}[]} [accountMenu]
 *        mục tone="alert" (Đăng xuất) luôn nằm cuối
 * Tùng — Sprint 2: shopAction nằm trong lối tắt tài khoản chung, dữ liệu do provider cấp.
 * @param {{label, icon, href?, onClick?, disabled?, active?, title?}} [shopAction]
 * @param {boolean} collapsed · @param {() => void} onToggle
 * @param {boolean} mobileOpen · @param {() => void} onCloseMobile
 * @param {() => void} [onCreate]   nút "+ Đăng bài" (chỉ hiện khi đã đăng nhập)
 * @param {() => void} [onLogin] · [onRegister]   chỉ dùng khi là khách
 */
export default function FeedSidebar({
  nav, activeKey, user, accountMenu = [], shopAction, notificationSlot, collapsed, onToggle, mobileOpen, onCloseMobile, onCreate, onLogin, onRegister,
}) {
  const [theme, toggleTheme] = useTheme();
  const dark = theme === 'dark';
  const [accountOpen, setAccountOpen] = useState(false);

  const item = (n) => {
    const on = n.key === activeKey;
    return (
      <a key={n.key} href={n.href} className={cx(s.item, on && s.on)} aria-current={on ? 'page' : undefined} title={collapsed ? n.label : undefined}>
        <i className={`bi bi-${on && n.iconActive ? n.iconActive : n.icon} ${s.icon}`} aria-hidden="true" />
        <span className={s.label}>{n.label}</span>
      </a>
    );
  };

  // Lối tắt thường trước, Đăng xuất (tone alert) sau
  const links = [
    ...(shopAction && !accountMenu.some(entry => entry.label === shopAction.label)
      ? [{ ...shopAction, onClick: shopAction.href ? () => window.location.assign(shopAction.href) : shopAction.onClick }] : []),
    // Duy's Code: Mục Post Management dùng chung trên mọi sidebar Member, gồm cả khám phá/chi tiết quán.
    ...(user && user.roleLabel !== 'Quản trị viên' && !accountMenu.some(entry => entry.href === '/me/posts')
      ? [{ icon: 'journal-text', label: 'Bài của tôi', href: '/me/posts' }] : []),
    ...accountMenu.filter((m) => m.tone !== 'alert'),
  ];
  const danger = accountMenu.filter((m) => m.tone === 'alert');
  const link = (l) => {
    const Tag = l.href ? 'a' : 'button';
    return <Tag key={l.label} {...(l.href ? { href: l.href } : { type: 'button', disabled: l.disabled })}
      className={cx(s.link, l.active && s.linkActive, l.tone === 'alert' && s.linkAlert)}
      onClick={l.href ? undefined : l.onClick} title={l.title}
      aria-current={l.active && l.href ? 'page' : undefined} aria-busy={l.disabled || undefined}>
      <i className={`bi bi-${l.icon} ${s.icon}`} aria-hidden="true" />
      <span>{l.label}</span>
    </Tag>;
  };
  const collapsedMenu = links.length && danger.length ? [...links, { divider: true }, ...danger] : [...links, ...danger];

  return (
    <>
      <div className={cx(s.scrim, mobileOpen && s.scrimOn)} onClick={onCloseMobile} aria-hidden="true" />
      <aside className={cx(s.side, collapsed && s.collapsed, mobileOpen && s.open)} aria-label="Điều hướng chính">
        <div className={s.top}>
          <a href="/" className={s.brand} aria-label={`${APP_NAME}, về trang chủ`}>
            <span className={s.mark} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M5 19c0-8 5-13.5 14-14-.3 8.6-5.6 14-14 14Z" fill="currentColor" />
                <path d="M5 19c3-4.2 6-7 9.5-9" stroke="var(--v-accent)" strokeWidth="1.6" strokeLinecap="round" fill="none" />
              </svg>
            </span>
            <span className={s.name}>{APP_NAME}</span>
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

        {user && onCreate && (
          <button type="button" className={s.create} onClick={onCreate} title={collapsed ? 'Đăng bài' : undefined}>
            <i className="bi bi-plus-lg" aria-hidden="true" />
            <span className={s.label}>Đăng bài</span>
          </button>
        )}

        <nav className={s.nav}>{nav.map(item)}</nav>

        <div className={s.bottom}>
          {/* Duy's Code: Chuông Sprint 3 hiển thị trên navbar dùng chung của thành viên. */}
          {/* Duy's Code: Chuông nhận cùng trạng thái thu gọn của rail dùng chung. */}
          {user && notificationSlot && (isValidElement(notificationSlot)
            ? cloneElement(notificationSlot, { collapsed })
            : notificationSlot)}
          {/* Một nút: icon + chữ là chế độ SẼ chuyển sang (chốt 08/10/2026) */}
          <button
            type="button"
            className={s.theme}
            onClick={toggleTheme}
            aria-label={dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            title={collapsed ? (dark ? 'Chế độ sáng' : 'Chế độ tối') : undefined}
          >
            <i className={`bi bi-${dark ? 'sun' : 'moon-stars'} ${s.icon}`} aria-hidden="true" />
            <span className={s.label}>{dark ? 'Chế độ sáng' : 'Chế độ tối'}</span>
          </button>

          {/* Tùng — BRIDGE-16: Shop dùng cùng hộp tài khoản ở mọi consumer của navbar. */}
          {user && collapsed && (
            // Duy's Code: Portal menu neo theo avatar để không bị rail/sidebar cắt.
            <Menu
              side="right"
              width={240}
              className={s.accountWrap}
              portal
              items={collapsedMenu}
              renderTrigger={(p) => (
                <button type="button" className={s.avatarBtn} aria-label={`Tài khoản: ${user.name}`} {...p}>
                  <Avatar name={user.name} src={user.avatarUrl} size={34} />
                </button>
              )}
            />
          )}

          {user && !collapsed && (
            <div className={s.accountBox}>
              <div className={cx(s.drawer, accountOpen && s.drawerOpen)} id="feed-account-links" inert={!accountOpen}>
                <div className={s.drawerClip}><div className={s.drawerInner}>{[...links, ...danger].map(link)}</div></div>
              </div>
              <button
                type="button"
                className={s.userRow}
                onClick={() => setAccountOpen((o) => !o)}
                aria-expanded={accountOpen}
                aria-controls="feed-account-links"
                aria-label={`Tài khoản ${user.name}, ${accountOpen ? 'thu gọn' : 'mở'} lối tắt`}
              >
                <Avatar name={user.name} src={user.avatarUrl} size={34} />
                <span className={s.accountText}>
                  <b>{user.name}</b>
                  {user.roleLabel && <small>{user.roleLabel}</small>}
                </span>
                <i className={`bi bi-chevron-up ${s.chev}`} aria-hidden="true" />
              </button>
            </div>
          )}

          {!user && (
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
