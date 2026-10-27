// Khoi's code: Khung trang dùng chung cho các trang của khách/thành viên (tách từ PostFeedPage, 11/10/2026).
//   MemberLayout
//   ├── FeedSidebar (thanh bên: + Đăng bài, menu, Sáng/Tối, tài khoản · điện thoại: ngăn kéo)
//   ├── vùng chính: thanh trên (renderTopbar) + nội dung trang (children)
//   └── thanh tab nổi dưới đáy (chỉ điện thoại)
// Trang nào dùng khung này cũng có nền chấm + biến bố cục của styles/feed-theme.css (<html data-feed-v2>).
import { useEffect, useLayoutEffect, useState } from 'react';
import FeedSidebar from '../FeedSidebar/FeedSidebar';
// Duy's Code: Chuông thông báo được gắn vào sidebar chung của thành viên.
import MemberNotificationBell from '../MemberNotificationBell/MemberNotificationBell';
import { ROLE } from '../../constants/domain';
import { MEMBER_NAV } from '../../hooks/useMemberSidebar';
import '../../styles/feed-theme.css';
import s from './MemberLayout.module.css';

// TODO: chuyển lên App khi nhóm có react-router
/** user của BE ({ fullName }) → dạng component cần ({ name }) */
export const toPerson = (u) => (u ? { name: u.fullName, avatarUrl: u.avatarUrl ?? null } : null);

/** Nhớ lựa chọn thu gọn; lần đầu thì màn < 1200px tự thu gọn cho rộng chỗ */
const COLLAPSE_KEY = 'anchay-feed-sidebar-collapsed';
const readCollapsed = () => {
  try {
    const v = localStorage.getItem(COLLAPSE_KEY);
    if (v !== null) return v === '1';
  } catch { /* trình duyệt chặn localStorage → dùng mặc định */ }
  return window.innerWidth < 1200;
};

const MOBILE_QUERY = '(max-width: 767.98px)';
const useIsMobile = () => {
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const on = () => setMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return mobile;
};

/**
 * @param {string} [activeKey]   mục menu đang sáng ('feed'…); bỏ trống = không sáng mục nào (vd trang Tạo công thức)
 * @param {{id, fullName, role, avatarUrl?}|null} user   null = khách
 * @param {{icon?, label, onClick, tone?}[]} [accountMenu]
 * @param {object} [shopAction]   nút Hồ sơ quán / Đăng ký quán (ShopNavigationContext)
 * @param {() => void} [onCreate]   nút "+ Đăng bài" (thanh bên + thanh dưới điện thoại), chỉ khi đã đăng nhập
 * @param {() => void} [onLogin] · [onRegister]   chỉ dùng khi là khách
 * @param {({ openMenu }) => React.ReactNode} [renderTopbar]   thanh trên; openMenu mở ngăn kéo trên điện thoại
 */
export default function MemberLayout({
  activeKey, user, accountMenu = [], shopAction, onCreate, onLogin, onRegister, renderTopbar, children,
}) {
  const isGuest = !user;
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const toggleCollapsed = () => setCollapsed((c) => {
    try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1'); } catch { /* bỏ qua */ }
    return !c;
  });

  // Bố cục 3 cột + nền chấm chỉ áp khi đang ở trang dùng khung này (gỡ khi rời trang); màu nằm ở theme.scss
  useLayoutEffect(() => {
    document.documentElement.dataset.feedV2 = '';
    return () => { delete document.documentElement.dataset.feedV2; };
  }, []);

  const create = onCreate && !isGuest ? () => { setDrawerOpen(false); onCreate(); } : undefined;
  // Duy's Code: Giữ liên kết Bài của tôi trong menu tài khoản mà không lặp mục đã được truyền vào.
  const memberAccountMenu = user && !accountMenu.some((item) => item.href === '/me/posts')
    ? [{ icon: 'journal-text', label: 'Bài của tôi', href: '/me/posts' }, ...accountMenu]
    : accountMenu;

  return (
    <div className={`feed-v2-page ${s.shell}`}>
      <FeedSidebar
        nav={MEMBER_NAV}
        activeKey={activeKey}
        user={user && { ...toPerson(user), roleLabel: ROLE[user.role] }}
        accountMenu={memberAccountMenu}
        shopAction={shopAction}
        notificationSlot={user ? <MemberNotificationBell role={user.role} /> : null}
        collapsed={!isMobile && collapsed}
        onToggle={toggleCollapsed}
        mobileOpen={isMobile && drawerOpen}
        onCloseMobile={() => setDrawerOpen(false)}
        onCreate={create}
        onLogin={onLogin}
        onRegister={onRegister}
      />

      <div className={`feed-v2-main ${s.main}`}>
        {renderTopbar?.({ openMenu: () => setDrawerOpen(true) })}
        {children}
      </div>

      {/* Điện thoại: thanh tab nổi dưới đáy */}
      <nav className={`${s.mobileNav} ${create ? s.mobileNav5 : ''}`} aria-label="Điều hướng nhanh">
        {MEMBER_NAV.map((n, i) => {
          const on = n.key === activeKey;
          const link = (
            <a key={n.key} href={n.href} className={`${s.mItem} ${on ? s.mOn : ''}`} aria-current={on ? 'page' : undefined}>
              <i className={`bi bi-${on && n.iconActive ? n.iconActive : n.icon}`} aria-hidden="true" /><span>{n.label}</span>
            </a>
          );
          // Thành viên: nút Đăng bài nằm giữa thanh (theo prototype UI v2)
          return create && i === 2
            ? [<button key="create" type="button" className={s.mCreate} onClick={create} aria-label="Đăng bài"><i className="bi bi-plus-lg" aria-hidden="true" /></button>, link]
            : link;
        })}
      </nav>
    </div>
  );
}
