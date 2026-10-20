// Tùng — kết quả xét duyệt ở đầu trang; receipt server ngăn lặp giữa các phiên/tab.
import { useEffect, useRef, useState } from 'react';
import useAuth from '../hooks/useAuth';
import { useShopNavigation } from '../context/ShopNavigationContext';
import shopRegistrationService from '../services/shopRegistration.service';
import Button from '../components/Button/Button';
import Notice from '../components/Notice/Notice';
import ShopOperationNotice from './ShopOperationNotice';
import styles from './ShopReviewNotice.module.css';

export default function ShopReviewNotice() {
  const { user } = useAuth();
  const { member, resource } = useShopNavigation();
  const notification = resource.data?.reviewNotification;
  const accountId = member ? String(user.id) : null;
  const notificationId = notification?.notificationId;
  const status = notification?.status;
  const popupSeenAt = notification?.popupSeenAt;
  const identity = notification?.submissionType === 'identity_edit';
  const { adoptReviewReceipt } = resource;
  const [approval, setApproval] = useState(null);
  const [failure, setFailure] = useState(null);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const claims = useRef(new Map());
  const inFlight = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    if (!accountId || !notificationId || status !== 'accepted' || popupSeenAt) return;
    const key = `${accountId}:${notificationId}`;
    let claim = claims.current.get(key);
    if (!claim) {
      claim = shopRegistrationService.acknowledgeReview(notificationId);
      claims.current.set(key, claim);
    }
    let active = true;
    claim.then(result => {
      if (!active) return;
      adoptReviewReceipt(result);
      setFailure(null);
      if (result.newlySeen) setApproval({ accountId, notificationId, tone: 'success', createdAt: Date.now(),
        text: identity ? 'Yêu cầu sửa thông tin quán đã được duyệt.' : 'Đăng ký quán đã được duyệt. Bạn có thể quản lý quán.' });
    }).catch(error => {
      if (active) setFailure({ accountId, notificationId, error });
    });
    return () => { active = false; };
  }, [accountId, notificationId, status, popupSeenAt, identity, adoptReviewReceipt, attempt]);

  const hide = async () => {
    if (inFlight.current || !notificationId) return;
    inFlight.current = true; setSaving(true); setFailure(null);
    try {
      const result = await shopRegistrationService.acknowledgeReview(notificationId);
      if (alive.current) adoptReviewReceipt(result);
    } catch (error) {
      if (alive.current) setFailure({ accountId, notificationId, error });
    } finally {
      inFlight.current = false;
      if (alive.current) setSaving(false);
    }
  };
  const currentFailure = failure?.accountId === accountId && failure.notificationId === notificationId ? failure.error : null;
  const currentApproval = approval?.accountId === accountId && approval.notificationId === notificationId ? approval : null;
  if (!member) return null;
  return <>
    <ShopOperationNotice message={currentApproval} onDismiss={() => setApproval(null)} />
    {status === 'rejected' && !popupSeenAt && <Notice tone="alert"
      title={identity ? 'Yêu cầu cập nhật bị từ chối' : 'Đăng ký quán bị từ chối'}>
      <p className={styles.reason}>{notification.reviewNote?.trim() || 'Quản trị viên chưa cung cấp lý do.'}</p>
      <Button size="sm" variant="subtle" className={styles.hide} loading={saving} onClick={hide}>Không hiển thị nữa</Button>
    </Notice>}
    {currentFailure && <Notice tone="alert" action={status === 'accepted' ? { label: 'Thử lại', onClick: () => {
      claims.current.delete(`${accountId}:${notificationId}`); setFailure(null); setAttempt(value => value + 1);
    } } : undefined}>
      Chưa lưu được trạng thái thông báo. {currentFailure.message}
    </Notice>}
  </>;
}
