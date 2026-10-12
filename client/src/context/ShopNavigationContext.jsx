// Tùng — Sprint 2: BRIDGE-02A dùng cùng trạng thái Shop cho navbar và hai trang owner.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import useAuth from '../hooks/useAuth';
import shopRegistrationService from '../services/shopRegistration.service';
import ShopReviewPopup from '../pages/ShopReviewPopup';

const ShopNavigationContext = createContext(null);
const emptyState = { accountId: null, data: null, error: null, loading: false, refreshError: null, refreshOutcome: null };

export function ShopNavigationProvider({ children }) {
  const { user, isCheckingSession, logout } = useAuth();
  const member = !isCheckingSession && user?.role === 'member';
  const accountId = member ? String(user.id) : null;
  const [state, setState] = useState(emptyState);
  const [revision, setRevision] = useState({ id: 0, manual: false, accountId: null });
  const request = useRef(null);
  // Tùng — BRIDGE-15: tải thủ công có phản hồi riêng; refresh nền không tạo thông báo.
  const reload = useCallback(options => {
    if (options?.manual && request.current) return;
    setRevision(value => ({ id: value.id + 1, manual: options?.manual === true, accountId }));
  }, [accountId]);
  const clearRefreshFeedback = useCallback(() => setState(previous => ({ ...previous, refreshOutcome: null })), []);
  const refreshedAt = useRef(0);
  const hasPendingReview = state.accountId === accountId && (Boolean(state.data?.pendingSubmission) || state.data?.shop?.verificationStatus === 'pending');

  // Tùng — Sprint 2: hủy GET cũ và gắn dữ liệu với account, không dùng state của phiên trước.
  useEffect(() => {
    if (!accountId) { setState(emptyState); return; }
    const controller = new AbortController();
    const manual = revision.manual && revision.accountId === accountId;
    refreshedAt.current = Date.now();
    request.current = controller;
    setState(previous => ({ accountId, data: previous.accountId === accountId ? previous.data : null,
      error: null, loading: true, refreshOutcome: null,
      refreshError: !manual && previous.accountId === accountId ? previous.refreshError : null }));
    shopRegistrationService.getContext(controller.signal).then(data => {
      if (!data || !Object.hasOwn(data, 'shop')) throw new Error('Chưa đọc được thông tin quán. Vui lòng thử lại.');
      if (!controller.signal.aborted) setState({ accountId, data, error: null, loading: false, refreshError: null,
        refreshOutcome: manual ? { text: 'Đã cập nhật trạng thái quán.', tone: 'success', createdAt: Date.now() } : null });
    }).catch(error => {
      if (!controller.signal.aborted) setState(previous => ({ accountId,
        data: previous.accountId === accountId ? previous.data : null,
        error: previous.accountId === accountId && previous.data ? null : error, loading: false, refreshOutcome: null,
        refreshError: previous.accountId === accountId && previous.data ? manual ? error : previous.refreshError : null }));
    }).finally(() => { if (request.current === controller) request.current = null; });
    return () => {
      controller.abort();
      if (request.current === controller) request.current = null;
    };
  }, [accountId, revision]);

  // Kết quả tới khi offline được đọc lại khi online, quay về tab hoặc đăng nhập.
  useEffect(() => {
    if (!accountId) return;
    const refresh = () => {
      if (document.visibilityState === 'hidden' || !navigator.onLine || request.current || Date.now() - refreshedAt.current < 10000) return;
      reload();
    };
    const online = () => { request.current?.abort(); request.current = null; refreshedAt.current = 0; refresh(); };
    const interval = hasPendingReview ? window.setInterval(refresh, 30000) : null;
    window.addEventListener('online', online);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      if (interval) window.clearInterval(interval);
    };
  }, [accountId, hasPendingReview, reload]);

  // Tùng — Sprint 2: POST/PUT thành công đổi nút ngay, không đợi GET hoặc lưu Shop vào localStorage.
  const adopt = useCallback(data => {
    if (!data || !Object.hasOwn(data, 'shop')) { reload(); return; }
    request.current?.abort();
    setState({ accountId, data, error: null, loading: false, refreshError: null, refreshOutcome: null });
  }, [accountId, reload]);
  const current = member && state.accountId === accountId ? state : null;
  const resource = { data: current?.data || null, error: current?.error || null,
    loading: member && (!current || (current.loading && !current.data)),
    refreshing: Boolean(current?.data && current.loading), refreshError: current?.refreshError || null,
    refreshOutcome: current?.refreshOutcome || null, clearRefreshFeedback, reload, adopt };
  const review = current?.data?.reviewNotification;
  const showReview = member && review && !review.popupSeenAt && ['registration', 'resubmission'].includes(review.submissionType)
    && ['accepted', 'rejected'].includes(review.status);
  const onReviewSeen = result => {
    request.current?.abort();
    setState(previous => {
      if (previous.accountId !== accountId || previous.data?.reviewNotification?.notificationId !== result.notificationId) return previous;
      return { ...previous, loading: false, data: { ...previous.data, reviewNotification: { ...previous.data.reviewNotification, popupSeenAt: result.popupSeenAt } } };
    });
  };

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
    {showReview && <ShopReviewPopup key={`${accountId}:${review.notificationId}`} notification={review} onSeen={onReviewSeen} />}
  </ShopNavigationContext.Provider>;
}

// Tùng — Sprint 2: consumer phải dùng provider chung, không tự gọi thêm GET cho navbar.
export function useShopNavigation() {
  const value = useContext(ShopNavigationContext);
  if (!value) throw new Error('useShopNavigation must be used inside ShopNavigationProvider.');
  return value;
}
