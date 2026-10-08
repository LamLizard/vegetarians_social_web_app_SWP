// Tùng — Sprint 2: Member đăng ký/nộp lại toàn bộ form, không mở editor của Shop rejected.
import { useEffect, useRef, useState } from 'react';
// Tùng — Sprint 2: BRIDGE-02A form và navbar đọc cùng một resource theo account.
import { useShopNavigation } from '../context/ShopNavigationContext';
import shopRegistrationService from '../services/shopRegistration.service';
import Button from '../components/Button/Button';
import Notice from '../components/Notice/Notice';
import PageHeader from '../components/PageHeader/PageHeader';
import Panel from '../components/Panel/Panel';
import Spinner from '../components/Spinner/Spinner';
import StatusBadge from '../components/StatusBadge/StatusBadge';
import { emptyShopForm, ShopIdentityFields, ShopScheduleFields, ShopMemberShell, ShopSnapshot } from './ShopFormFields';
import styles from './ShopRegisterPage.module.css';

function RegistrationForm({ resubmitting, onSaved, onConflict }) {
  const [form, setForm] = useState(emptyShopForm);
  const [failure, setFailure] = useState(null);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const submit = async event => {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setFailure(null);
    try {
      // Tùng — Sprint 2: chuyển response thành công lên provider để đổi nút Shop ngay.
      const result = await (resubmitting ? shopRegistrationService.resubmit(form) : shopRegistrationService.register(form));
      if (alive.current) onSaved(result);
    } catch (error) {
      if (alive.current) {
        setFailure(error);
        if (error.status === 409) onConflict(error.message);
      }
    } finally { inFlight.current = false; if (alive.current) setSaving(false); }
  };
  const errors = failure?.details?.fieldErrors || {};
  return <form onSubmit={submit} className={styles.form}>
    <ShopIdentityFields value={form} onChange={setForm} errors={errors} disabled={saving} />
    <ShopScheduleFields value={form.schedule} onChange={schedule => setForm(current => ({ ...current, schedule }))} errors={errors} disabled={saving} />
    {failure && <Notice tone="alert">{failure.message}</Notice>}
    <div className={styles.actions}><Button type="submit" loading={saving} icon="send">{resubmitting ? 'Gửi đăng ký lại' : 'Gửi đăng ký quán'}</Button></div>
  </form>;
}

export default function ShopRegisterPage() {
  // Tùng — Sprint 2: GET shared không gọi trùng cho form và navigation.
  const { member, isCheckingSession, resource } = useShopNavigation();
  const [message, setMessage] = useState(null);
  const shop = resource.data?.shop;
  return <ShopMemberShell><div className={styles.page}>
    <PageHeader title="Đăng ký quán chay" description="Gửi thông tin quán để quản trị viên xác minh." />
    {isCheckingSession ? <Spinner showLabel /> : !member ? <Notice tone="alert" title="Cần tài khoản thành viên">Vui lòng đăng nhập bằng tài khoản Member để đăng ký quán.</Notice>
      : resource.loading ? <Spinner showLabel /> : resource.error ? <Notice tone="alert" title="Chưa tải được thông tin" action={{ label: 'Thử lại', onClick: resource.reload }}>{resource.error.message}</Notice>
        : resource.data && <>
          {message && <Notice onDismiss={() => setMessage(null)}>{message}</Notice>}
          {shop?.verificationStatus === 'verified' ? <Panel title="Quán đã được xác minh">
            <StatusBadge entity="shop" status="verified" /><ShopSnapshot value={shop} />
            <Button as="a" href="/shops/manage" className="mt-3">Quản lý quán</Button>
          </Panel> : shop?.verificationStatus === 'pending' ? <Panel title="Đang chờ xác minh">
            <StatusBadge entity="shop" status="pending" /><p className="mt-3">Hồ sơ đã được gửi. Bạn có thể quản lý quán sau khi được duyệt.</p>
            <ShopSnapshot value={shop} />
          </Panel> : <Panel title={shop ? 'Đăng ký lại quán' : 'Thông tin đăng ký'}>
            {shop && <Notice tone="alert" title="Đăng ký trước bị từ chối">{shop.verificationNote || 'Vui lòng nhập lại đầy đủ thông tin. Hồ sơ trước vẫn được lưu.'}</Notice>}
            <RegistrationForm key={shop?.shopId || 'new'} resubmitting={Boolean(shop)}
              // Tùng — Sprint 2: pending cũng là đã có Shop, navbar chuyển sang Hồ sơ quán.
              onSaved={result => { resource.adopt(result); setMessage('Đã gửi hồ sơ. Quán đang chờ quản trị viên xác minh.'); }}
              onConflict={text => { setMessage(text); resource.reload(); }} />
          </Panel>}
        </>}
  </div></ShopMemberShell>;
}
