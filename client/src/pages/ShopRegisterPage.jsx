// Tùng — Sprint 2: Member đăng ký hoặc sửa/gửi lại hồ sơ bị từ chối.
import { useEffect, useRef, useState } from 'react';
// Tùng — Sprint 2: BRIDGE-02A form và navbar đọc cùng một resource theo account.
import { useShopNavigation } from '../context/ShopNavigationContext';
import shopRegistrationService from '../services/shopRegistration.service';
import Button from '../components/Button/Button';
import Checkbox from '../components/Checkbox/Checkbox';
import Notice from '../components/Notice/Notice';
import PageHeader from '../components/PageHeader/PageHeader';
import Panel from '../components/Panel/Panel';
import Spinner from '../components/Spinner/Spinner';
import StatusBadge from '../components/StatusBadge/StatusBadge';
import ShopReviewNotice from './ShopReviewNotice';
import ShopRetryWarning from './ShopRetryWarning';
import ShopOperationNotice from './ShopOperationNotice';
import { emptyShopForm, cloneShopSchedule, ShopIdentityFields, ShopScheduleFields, ShopMemberShell, ShopSnapshot, validateShopSchedule } from './ShopFormFields';
import styles from './ShopRegisterPage.module.css';

function RegistrationForm({ resubmitting, initialValue, onSaved, onConflict }) {
  const [form, setForm] = useState(() => initialValue || emptyShopForm());
  const [scheduleLater, setScheduleLater] = useState(() => !initialValue?.schedule?.some(day => !day.isClosed));
  const [failure, setFailure] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localErrors, setLocalErrors] = useState({});
  const uploadActive = useRef(false);
  const inFlight = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const submit = async event => {
    event.preventDefault();
    if (inFlight.current || uploadActive.current) return;
    const errors = scheduleLater ? {} : validateShopSchedule(form.schedule);
    if (!form.avtShopUrl) errors.avtShopUrl = 'Chọn và tải lên ảnh quán trước khi gửi hồ sơ.';
    setLocalErrors(errors);
    if (Object.keys(errors).length) return;
    inFlight.current = true;
    setSaving(true);
    setFailure(null);
    try {
      // Tùng — Sprint 2: chuyển response thành công lên provider để đổi nút Shop ngay.
      const payload = { ...form, schedule: scheduleLater ? [] : form.schedule };
      const result = await (resubmitting ? shopRegistrationService.resubmit(payload) : shopRegistrationService.register(payload));
      if (alive.current) onSaved(result);
    } catch (error) {
      if (alive.current) {
        setFailure(error);
        if (error.status === 409 || error.details?.code === 'SHOP_INACTIVE') onConflict(error.message);
      }
    } finally { inFlight.current = false; if (alive.current) setSaving(false); }
  };
  const errors = { ...failure?.details?.fieldErrors, ...localErrors };
  return <form onSubmit={submit} className={styles.form}>
    <ShopIdentityFields desktopColumns value={form} onChange={next => { setForm(next); setLocalErrors({}); }} errors={errors} disabled={saving}
      onShopUnavailable={onConflict}
      onUploadStateChange={active => { uploadActive.current = active; setUploading(active); }} />
    <section className={styles.schedule}>
      <Checkbox checked={scheduleLater} disabled={saving} onChange={value => { setScheduleLater(value); setLocalErrors({}); }}>Bổ sung lịch mở cửa sau</Checkbox>
      {scheduleLater ? <p className={styles.hint}>Bạn có thể cập nhật lịch trong trang quản lý sau khi quán được duyệt.</p>
        : <ShopScheduleFields allowCopy value={form.schedule} onChange={schedule => { setForm(current => ({ ...current, schedule })); setLocalErrors({}); }} errors={errors} disabled={saving} />}
    </section>
    {failure && <Notice tone="alert">{failure.message}</Notice>}
    <div className={styles.actions}>{uploading && <span role="status">Đang tải ảnh quán…</span>}
      <Button type="submit" loading={saving} disabled={uploading || !form.avtShopUrl} icon="send">{resubmitting ? 'Gửi đăng ký lại' : 'Gửi đăng ký quán'}</Button></div>
  </form>;
}

function RejectedRegistration({ context, onSaved, onConflict }) {
  const { shop, latestSubmission } = context;
  const [mode, setMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('submission') === (latestSubmission?.submissionId || `legacy:${shop.shopId}`) && ['edit', 'fresh'].includes(params.get('retry')) ? params.get('retry') : null;
  });
  const [confirmFresh, setConfirmFresh] = useState(false);
  const snapshot = latestSubmission?.afterValue || shop;
  const initialValue = mode === 'edit' ? { name: snapshot.name || '', address: snapshot.address || '', phone: snapshot.phone || '', avtShopUrl: snapshot.avtShopUrl || '',
    schedule: snapshot.schedule?.length === 7 ? cloneShopSchedule(snapshot.schedule) : emptyShopForm().schedule } : null;
  const chooseMode = next => {
    const params = new URLSearchParams(window.location.search);
    params.set('retry', next);
    params.set('submission', latestSubmission?.submissionId || `legacy:${shop.shopId}`);
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`);
    setMode(next);
  };
  return <>
    <Panel title="Thông tin đăng ký">
      <StatusBadge entity="shop" status="rejected" className={styles.rejectedBadge} />
      {!mode ? <><div className={styles.choices}>
        <Button icon="pencil" onClick={() => chooseMode('edit')}>Chỉnh sửa</Button>
        <Button variant="outline" icon="plus-circle" onClick={() => setConfirmFresh(true)}>Đăng ký lại từ đầu</Button>
      </div><ShopSnapshot value={snapshot} /></>
        : <><Notice className={styles.modeNotice}>{mode === 'edit'
          ? 'Đang chỉnh sửa hồ sơ đăng ký lại. Kiểm tra thông tin trước khi gửi.'
          : 'Đang đăng ký lại từ đầu. Nhập thông tin và tải ảnh mới trước khi gửi.'}</Notice>
          <RegistrationForm key={mode} initialValue={initialValue} resubmitting onSaved={onSaved} onConflict={onConflict} /></>}
    </Panel>
    <ShopRetryWarning open={confirmFresh}
      onConfirm={() => { chooseMode('fresh'); setConfirmFresh(false); }} onCancel={() => setConfirmFresh(false)} />
  </>;
}

export default function ShopRegisterPage() {
  // Tùng — Sprint 2: GET shared không gọi trùng cho form và navigation.
  const { member, isCheckingSession, resource } = useShopNavigation();
  const [message, setMessage] = useState(null);
  const shop = resource.data?.shop;
  const saved = result => {
    resource.adopt(result);
    setMessage({ text: 'Đã gửi hồ sơ. Quán đang chờ quản trị viên xác minh.', tone: 'success', createdAt: Date.now() });
  };
  const conflict = text => { setMessage({ text, tone: 'alert', createdAt: Date.now() }); resource.reload(); };
  return <ShopMemberShell><div className={styles.page}>
    <PageHeader title="Đăng ký quán chay" description="Gửi thông tin quán để quản trị viên xác minh." />
    <ShopReviewNotice />
    {member && <ShopOperationNotice message={message} onDismiss={() => setMessage(null)} />}
    {isCheckingSession ? <Spinner showLabel /> : !member ? <Notice tone="alert" title="Cần tài khoản thành viên">Vui lòng đăng nhập bằng tài khoản thành viên để đăng ký quán.</Notice>
      : resource.loading ? <Spinner showLabel /> : resource.error ? <Notice tone="alert" title="Chưa tải được thông tin" action={{ label: 'Thử lại', onClick: resource.reload }}>{resource.error.message}</Notice>
        : resource.data && <>
          {shop?.status === 'inactive' ? <Panel title="Quán tạm ngưng hoạt động">
            <Notice>Quán đã bị quản trị viên khóa. Bạn chỉ có thể xem hồ sơ; vui lòng liên hệ quản trị viên để được mở khóa.</Notice>
            <StatusBadge entity="shop" status={shop.verificationStatus} /><ShopSnapshot value={shop} />
            <Button as="a" href="/shops/manage" className="mt-3">Xem hồ sơ quán</Button>
          </Panel> : shop?.verificationStatus === 'verified' ? <Panel title="Quán đã được xác minh">
            <StatusBadge entity="shop" status="verified" /><ShopSnapshot value={shop} />
            <Button as="a" href="/shops/manage" className="mt-3">Quản lý quán</Button>
          </Panel> : shop?.verificationStatus === 'pending' ? <Panel title="Đang chờ xác minh">
            <StatusBadge entity="shop" status="pending" /><p className="mt-3">Hồ sơ đã được gửi. Bạn có thể quản lý quán sau khi được duyệt.</p>
            <ShopSnapshot value={shop} />
          </Panel> : shop ? <RejectedRegistration key={`${shop.shopId}:${resource.data.latestSubmission?.submissionId || shop.version}`} context={resource.data}
            onSaved={saved} onConflict={conflict} /> : <Panel title="Thông tin đăng ký">
            <RegistrationForm key="new" resubmitting={false}
              // Tùng — Sprint 2: pending cũng là đã có Shop, navbar chuyển sang Hồ sơ quán.
              onSaved={saved} onConflict={conflict} />
          </Panel>}
        </>}
  </div></ShopMemberShell>;
}
