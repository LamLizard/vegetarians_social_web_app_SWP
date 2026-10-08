// Tùng — Sprint 2: BRIDGE-02A dùng cùng trạng thái Shop cho navbar và hai trang owner.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import useAuth from '../hooks/useAuth';
import shopRegistrationService from '../services/shopRegistration.service';

const ShopNavigationContext = createContext(null);
const emptyState = { accountId: null, data: null, error: null, loading: false };

export function ShopNavigationProvider({ children }) {
  const { user, isCheckingSession, logout } = useAuth();
  const member = !isCheckingSession && user?.role === 'member';
  const accountId = member ? String(user.id) : null;
  const [state, setState] = useState(emptyState);
  const [revision, setRevision] = useState(0);
  const request = useRef(null);
  const reload = useCallback(() => setRevision(value => value + 1), []);

  // Tùng — Sprint 2: hủy GET cũ và gắn dữ liệu với account, không dùng state của phiên trước.
  useEffect(() => {
    if (!accountId) { setState(emptyState); return; }
    const controller = new AbortController();
    request.current = controller;
    setState(previous => ({ accountId, data: previous.accountId === accountId ? previous.data : null,
      error: null, loading: true }));
    shopRegistrationService.getContext(controller.signal).then(data => {
      if (!data || !Object.hasOwn(data, 'shop')) throw new Error('Chưa đọc được thông tin quán. Vui lòng thử lại.');
      if (!controller.signal.aborted) setState({ accountId, data, error: null, loading: false });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ accountId, data: null, error, loading: false });
    });
    return () => {
      controller.abort();
      if (request.current === controller) request.current = null;
    };
  }, [accountId, revision]);

  // Tùng — Sprint 2: POST/PUT thành công đổi nút ngay, không đợi GET hoặc lưu Shop vào localStorage.
  const adopt = useCallback(data => {
    if (!data || !Object.hasOwn(data, 'shop')) { reload(); return; }
    request.current?.abort();
    setState({ accountId, data, error: null, loading: false });
  }, [accountId, reload]);
  const current = member && state.accountId === accountId ? state : null;
  const resource = { data: current?.data || null, error: current?.error || null,
    loading: member && (!current || current.loading), reload, adopt };

  // Tùng — Sprint 2: có bản ghi Shop là Hồ sơ quán, độc lập pending/rejected/verified.
  let shopAction;
  if (member) {
    if (resource.error) shopAction = { label: 'Tải lại thông tin quán', icon: 'arrow-clockwise',
      onClick: reload, title: resource.error.message };
    else if (!resource.data) shopAction = { label: 'Đang tải quán…', icon: 'hourglass-split', disabled: true };
    else {
      const hasShop = Boolean(resource.data.shop);
      shopAction = { label: hasShop ? 'Hồ sơ quán' : 'Đăng ký quán', icon: hasShop ? 'shop' : 'plus-circle',
        href: hasShop ? '/shops/manage' : '/shops/register', active: window.location.pathname.startsWith('/shops/') };
    }
  }

  // Tùng — Sprint 2: giữ entry hồ sơ của Duy và đăng xuất của Khôi trong cùng menu Member.
  const accountMenu = useMemo(() => user ? [
    ...(user.role !== 'admin' ? [{ icon: 'person', label: 'Hồ sơ cá nhân', onClick: () => window.location.assign('/profile') }] : []),
    { icon: 'box-arrow-right', label: 'Đăng xuất', tone: 'alert', onClick: logout },
  ] : [], [user, logout]);

  return <ShopNavigationContext.Provider value={{ member, isCheckingSession, resource, shopAction, accountMenu }}>
    {children}
  </ShopNavigationContext.Provider>;
}

// Tùng — Sprint 2: consumer phải dùng provider chung, không tự gọi thêm GET cho navbar.
export function useShopNavigation() {
  const value = useContext(ShopNavigationContext);
  if (!value) throw new Error('useShopNavigation must be used inside ShopNavigationProvider.');
  return value;
}
