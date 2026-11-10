// Tùng — Sprint 2: BRIDGE-02A dùng chung NAV và lựa chọn thu gọn hiện có của Bảng tin.
import { useEffect, useState } from 'react';

// Duy's Code: Dùng một bộ mục sidebar chuẩn cho Bảng tin, quản lý bài và khu vực quán.
export const MEMBER_NAV = [
  { key: 'feed', label: 'Bảng tin', icon: 'house', iconActive: 'house-fill', href: '/' },
  { key: 'recipes', label: 'Công thức', icon: 'journal-richtext', href: '/recipes' },
  { key: 'meal-plan', label: 'Thực đơn', icon: 'calendar-week', iconActive: 'calendar-week-fill', href: '/meal-plan' },
  // Khoi's code (01/11/2026): lối vào trang chatbot /chatbot của Tùng (trước chỉ vào được bằng gõ đường dẫn).
  // short = nhãn ngắn cho thanh tab dưới đáy điện thoại (6 ô trên màn 390px, nhãn dài bị xuống dòng).
  { key: 'chatbot', label: 'Trợ lý Mầm', short: 'Mầm', icon: 'chat-heart', iconActive: 'chat-heart-fill', href: '/chatbot' },
  { key: 'shops', label: 'Quán chay', icon: 'shop', href: '/shops' },
];

/** Khoi's code (01/11/2026): mục đang mở theo đường dẫn — cho trang không truyền activeKey (vd /chatbot). */
export const navKeyOf = (path = window.location.pathname) =>
  MEMBER_NAV.find((n) => (n.href === '/' ? path === '/' : path === n.href || path.startsWith(`${n.href}/`)))?.key;
const COLLAPSE_KEY = 'anchay-feed-sidebar-collapsed';
const MOBILE_QUERY = '(max-width: 767.98px)';
const readCollapsed = () => {
  try {
    const value = localStorage.getItem(COLLAPSE_KEY);
    if (value !== null) return value === '1';
  } catch { /* Tùng — Sprint 2: storage bị chặn vẫn dùng được sidebar. */ }
  return window.innerWidth < 1200;
};

export default function useMemberSidebar() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const onChange = () => { setIsMobile(query.matches); setDrawerOpen(false); };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  const toggleCollapsed = () => setCollapsed(previous => {
    try { localStorage.setItem(COLLAPSE_KEY, previous ? '0' : '1'); }
    catch { /* Tùng — Sprint 2: giữ lựa chọn trong phiên nếu storage bị chặn. */ }
    return !previous;
  });
  return { isMobile, collapsed, drawerOpen, setDrawerOpen, toggleCollapsed };
}
