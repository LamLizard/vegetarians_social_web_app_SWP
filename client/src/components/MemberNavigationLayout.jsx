// Tùng — Sprint 2: BRIDGE-02A trang Shop/Profile dùng sidebar và mobile nav giống Bảng tin.
import { useLayoutEffect } from 'react';
import useAuth from '../hooks/useAuth';
import useMemberSidebar, { MEMBER_NAV, navKeyOf } from '../hooks/useMemberSidebar';
import { useShopNavigation } from '../context/ShopNavigationContext';
import { APP_NAME, ROLE } from '../constants/domain';
import FeedSidebar from './FeedSidebar/FeedSidebar';
import MemberLayout from './MemberLayout/MemberLayout';
// Duy's Code: Dùng cùng popup trên các trang thành viên ngoài Bảng tin.
import MemberNotificationBell from './MemberNotificationBell/MemberNotificationBell';
import IconButton from './IconButton/IconButton';
import '../styles/feed-theme.css';
import styles from './MemberNavigationLayout.module.css';

export function MemberMobileNav({ activeKey }) {
  return <nav className={styles.mobileNav} aria-label="Điều hướng nhanh">
    {MEMBER_NAV.map(item => {
      const active = item.key === activeKey;
      return <a key={item.key} href={item.href} className={`${styles.mobileItem} ${active ? styles.active : ''}`}
        aria-current={active ? 'page' : undefined}>
        <i className={`bi bi-${active && item.iconActive ? item.iconActive : item.icon}`} aria-hidden="true" />
        <span>{item.short ?? item.label}</span>
      </a>;
    })}
  </nav>;
}

export default function MemberNavigationLayout({ children, activeKey: activeKeyProp }) {
  // Khoi's code 01/11: trang không truyền activeKey (vd /chatbot) → tự sáng mục theo đường dẫn
  const activeKey = activeKeyProp ?? navKeyOf();
  const { user } = useAuth();
  const { shopAction, accountMenu } = useShopNavigation();

  if (user?.role === 'member') {
    return <MemberLayout user={{ ...user, fullName: user.fullName || user.email }}
      activeKey={activeKey} accountMenu={accountMenu} shopAction={shopAction}>
      <main className={styles.content}>{children}</main>
    </MemberLayout>;
  }

  return <NonMemberNavigationLayout user={user} activeKey={activeKey} accountMenu={accountMenu} shopAction={shopAction}>
    {children}
  </NonMemberNavigationLayout>;
}

function NonMemberNavigationLayout({ children, activeKey, user, accountMenu, shopAction }) {
  const sidebar = useMemberSidebar();
  // Duy's Code: Tránh nhân đôi liên kết nếu consumer đã truyền mục này.
  const memberAccountMenu = !accountMenu.some((item) => item.href === '/me/posts')
    ? [{ icon: 'journal-text', label: 'Bài của tôi', href: '/me/posts' }, ...accountMenu]
    : accountMenu;
  useLayoutEffect(() => {
    document.documentElement.dataset.feedV2 = '';
    return () => { delete document.documentElement.dataset.feedV2; };
  }, []);

  return <div className={`feed-v2-page ${styles.shell}`} data-collapsed={!sidebar.isMobile && sidebar.collapsed ? '1' : '0'}>
    <FeedSidebar nav={MEMBER_NAV} activeKey={activeKey}
      user={user ? { name: user.fullName || user.email, avatarUrl: user.avatarUrl, roleLabel: ROLE[user.role] } : null}
      accountMenu={memberAccountMenu} shopAction={shopAction} notificationSlot={<MemberNotificationBell role={user?.role} />}
      collapsed={!sidebar.isMobile && sidebar.collapsed} onToggle={sidebar.toggleCollapsed}
      mobileOpen={sidebar.isMobile && sidebar.drawerOpen} onCloseMobile={() => sidebar.setDrawerOpen(false)}
      onLogin={() => window.location.assign('/login')} onRegister={() => window.location.assign('/register')} />
    <div className={styles.main}>
      <header className={styles.mobileHeader}>
        <IconButton icon="list" label="Mở menu" onClick={() => sidebar.setDrawerOpen(true)} />
        <a href="/">{APP_NAME}</a>
      </header>
      <main className={styles.content}>{children}</main>
    </div>
    <MemberMobileNav activeKey={activeKey} />
  </div>;
}
