// Tùng — kết quả xét duyệt đăng ký, receipt lưu ở server theo tài khoản/hồ sơ.
import { useEffect, useRef, useState } from 'react';
import Button from '../components/Button/Button';
import ConfirmDialog from '../components/ConfirmDialog/ConfirmDialog';
import Modal from '../components/Modal/Modal';
import Notice from '../components/Notice/Notice';
import shopRegistrationService from '../services/shopRegistration.service';
import styles from './ShopReviewPopup.module.css';

const CONFETTI = Array.from({ length: 16 }, (_, index) => index);

export default function ShopReviewPopup({ notification, onSeen }) {
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState(null);
  const [confirmFresh, setConfirmFresh] = useState(false);
  const inFlight = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const accepted = notification.status === 'accepted';
  const acknowledge = async action => {
    if (inFlight.current) return;
    inFlight.current = true; setSaving(true); setFailure(null);
    try {
      const result = await shopRegistrationService.acknowledgeReview(notification.notificationId);
      if (!alive.current) return;
      onSeen(result);
      if (action === 'manage') window.location.assign('/shops/manage');
      else if (action === 'edit' || action === 'fresh') window.location.assign(`/shops/register?${new URLSearchParams({ retry: action, submission: notification.submissionId })}`);
    } catch (error) {
      if (alive.current) { setConfirmFresh(false); setFailure(error); }
    } finally {
      inFlight.current = false;
      if (alive.current) setSaving(false);
    }
  };
  return <>
    <Modal open title={accepted ? 'Chúc mừng! Quán của bạn đã được duyệt.' : 'Hồ sơ chưa được phê duyệt'} size="md"
      className={styles.popup} dismissible={!saving && !confirmFresh} onClose={() => acknowledge('close')}
      footer={accepted ? <Button loading={saving} onClick={() => acknowledge('manage')}>Quản lý quán</Button>
        : <><Button variant="outline" disabled={saving} onClick={() => setConfirmFresh(true)}>Đăng ký lại từ đầu</Button>
          <Button loading={saving} onClick={() => acknowledge('edit')}>Chỉnh sửa hồ sơ</Button></>}>
      <div className={styles.body}>
        <div className={`${styles.symbol} ${accepted ? styles.accepted : styles.rejected}`} aria-hidden="true">
          <i className={`bi bi-${accepted ? 'check-lg' : 'x-lg'}`} />
          {accepted && <><span className={styles.halo} /><div className={styles.confetti}>{CONFETTI.map(index =>
            <span key={index} style={{ '--confetti-x': `${(index % 8 - 3.5) * 35}px`, '--confetti-delay': `${(index % 4) * 55}ms`, '--confetti-color': ['#45854a', '#dfb34c', '#7796b3', '#c87c65'][index % 4], '--confetti-angle': `${index * 37}deg` }} />)}</div></>}
        </div>
        {accepted ? <p>Bạn có thể quản lý thông tin, lịch mở cửa và menu của quán.</p>
          : <><Notice tone="alert" title="Lý do từ chối"><span className={styles.reason}>{notification.reviewNote || 'Chưa có lý do được ghi nhận.'}</span></Notice>
            <p>Chỉnh sửa hồ sơ để giữ lại dữ liệu đã nhập, hoặc đăng ký lại bằng form trống.</p></>}
        {failure && <Notice tone="alert">Chưa lưu được trạng thái đã xem. {failure.message} Vui lòng thử lại.</Notice>}
      </div>
    </Modal>
    <ConfirmDialog open={confirmFresh} title="Đăng ký lại từ đầu?" confirmLabel="Mở form trống" cancelLabel="Giữ hồ sơ" loading={saving}
      message="Form mới sẽ để trống các trường. Hồ sơ đã gửi và lý do từ chối vẫn được giữ trong lịch sử."
      onConfirm={() => acknowledge('fresh')} onCancel={() => { if (!inFlight.current) setConfirmFresh(false); }} />
  </>;
}
