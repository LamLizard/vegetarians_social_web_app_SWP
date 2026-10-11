// Tùng — Sprint 2: quản lý quán đã xác minh, giữ bản công khai trong lúc chờ identity.
import { useCallback, useEffect, useRef, useState } from 'react';
import useAuth from '../hooks/useAuth';
// Tùng — Sprint 2: BRIDGE-02A trạng thái Shop owner dùng chung với navigation/Register.
import { useShopNavigation } from '../context/ShopNavigationContext';
import useShopResource from '../hooks/useShopResource';
import shopManagementService from '../services/shopManagement.service';
import shopRegistrationService from '../services/shopRegistration.service';
import Button from '../components/Button/Button';
import Checkbox from '../components/Checkbox/Checkbox';
import ConfirmDialog from '../components/ConfirmDialog/ConfirmDialog';
import IconButton from '../components/IconButton/IconButton';
import Menu from '../components/Menu/Menu';
import Modal from '../components/Modal/Modal';
import Notice from '../components/Notice/Notice';
import PageHeader from '../components/PageHeader/PageHeader';
import Pagination from '../components/Pagination/Pagination';
import Panel from '../components/Panel/Panel';
import Photo from '../components/Photo/Photo';
import Select from '../components/Select/Select';
import Spinner from '../components/Spinner/Spinner';
import StatusBadge from '../components/StatusBadge/StatusBadge';
import Tabs from '../components/Tabs/Tabs';
import TextField from '../components/TextField/TextField';
import ShopOperationNotice from './ShopOperationNotice';
import { ShopIdentityComparison, ShopIdentityFields, ShopMemberShell, ShopScheduleFields, ShopSnapshot, ShopOperatingStatus, emptyShopForm, cloneShopSchedule, shopIdentityValue, shopSchedulesEqual, validateShopSchedule, shopDate } from './ShopFormFields';
import styles from './ShopManagementPage.module.css';

function priceValue(raw) {
  return /^\d+$/.test(raw) && Number(raw) <= 99999999 ? Number(raw) : null;
}

const MENU_PAGE_SIZE = 10;
const MENU_PRICE = new Intl.NumberFormat('vi-VN');

function MenuRow({ item, number, busy, readOnly, onEdit, onToggle, onRemove }) {
  const warning = item.dishStatus !== 'active' ? 'Món chưa được duyệt hoặc đã ẩn; không hiển thị công khai.' : '';
  return <li className={`${styles.menuRow} ${item.isAvailable ? '' : styles.off}`}>
    <span className={styles.menuNumber} aria-label={`Món số ${number}`}>{number}</span>
    <Photo src={item.imageUrl} alt={`Ảnh món ${item.dishName}`} ratio="1/1" shape="rounded" className={styles.menuPhoto} />
    <div className={styles.menuInfo}><b title={item.dishName}>{item.dishName}</b>
      {warning ? <p className={styles.warning} title={warning}>{warning}</p>
        : item.ingredientNote && <p className={styles.menuNote} title={item.ingredientNote}>{item.ingredientNote}</p>}</div>
    <strong className={item.price === 0 ? styles.free : styles.menuPrice}>{item.price === 0 ? 'Miễn phí' : `${MENU_PRICE.format(item.price)} ₫`}</strong>
    {readOnly ? <span className={styles.menuAvailability}>{item.isAvailable ? 'Đang bán' : 'Tạm hết'}</span>
      : <div className={styles.menuOwner}><Checkbox switch checked={item.isAvailable} disabled={busy} onChange={onToggle}>{item.isAvailable ? 'Đang bán' : 'Tạm hết'}</Checkbox>
      <Menu width={200} renderTrigger={props => <IconButton icon="three-dots" label={`Tuỳ chọn món ${item.dishName}`} variant="ghost" size="sm" disabled={busy} {...props} />}
        items={[{ icon: 'pencil', label: 'Sửa món', onClick: onEdit, disabled: busy },
          { icon: 'trash', label: 'Xóa khỏi menu', onClick: onRemove, disabled: busy }]} />
    </div>}
  </li>;
}

function DishPicker({ busy, failure, onClose, onAdd }) {
  const [page, setPage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);
  const [dishId, setDishId] = useState('');
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [localError, setLocalError] = useState(null);
  const load = useCallback(signal => shopManagementService.listDishes(page, pendingPage, signal), [page, pendingPage]);
  const resource = useShopResource(load);
  const options = (resource.data?.active.items || []).map(item => ({ value: item.dishId,
    label: `${item.name}${item.alreadyLinked ? ' · Đã có trong menu' : ''}`, disabled: !item.selectable }));
  const submit = async event => {
    event.preventDefault();
    const amount = priceValue(price);
    if (!dishId || amount === null) { setLocalError('Chọn món đã duyệt và nhập giá nguyên VNĐ từ 0 đến 99.999.999.'); return; }
    setLocalError(null);
    if (await onAdd({ dishId, price: amount, ingredientNote: note })) onClose();
  };
  return <Modal open onClose={onClose} title="Thêm món vào menu" size="lg" dismissible={!busy}>
    <div className={styles.dialogBody}>
      {resource.loading || (!resource.data && !resource.error) ? <Spinner showLabel /> : resource.error ? <Notice tone="alert" action={{ label: 'Thử lại', onClick: resource.reload }}>{resource.error.message}</Notice>
        : <><form onSubmit={submit} className={styles.form}>
          <Select label="Món đã được duyệt" placeholder="Chọn món" options={options} value={dishId} onChange={setDishId} required disabled={busy} />
          {!options.length && <Notice>Chưa có món đã duyệt để thêm. Món mới cần đi qua quy trình tạo và duyệt món trước.</Notice>}
          <Pagination page={resource.data.active.page} totalPages={resource.data.active.totalPages} pageSize={resource.data.active.pageSize} totalItems={resource.data.active.total} itemLabel="món đã duyệt"
            onChange={next => { setDishId(''); setPage(next); }} />
          <TextField label="Giá bán" value={price} onChange={setPrice} inputMode="numeric" suffix="VNĐ" required disabled={busy}
            hint="Nhập 0 nếu miễn phí." error={failure?.details?.fieldErrors?.price} />
          <TextField label="Ghi chú thành phần" value={note} onChange={setNote} disabled={busy}
            hint="Không bắt buộc; có thể để trống." error={failure?.details?.fieldErrors?.ingredientNote} />
          {(localError || failure) && <Notice tone="alert">{localError || failure.message}</Notice>}
          <div className={styles.actions}><Button variant="subtle" disabled={busy} onClick={onClose}>Hủy</Button><Button type="submit" loading={busy} disabled={!options.length}>Thêm vào menu</Button></div>
        </form>
        <section className={styles.pendingGroup}><h3>Món tôi đề xuất đang chờ duyệt</h3>
          <p className={styles.muted}>Bạn có thể chọn món sau khi được quản trị viên duyệt. Chọn “Tải lại danh mục” để cập nhật kết quả.</p>
          <ul className={styles.pendingList}>{resource.data.ownPending.items.map(item => <li key={item.dishId}>
            <Button variant="subtle" disabled block>{item.name} · Đang chờ duyệt</Button>
          </li>)}</ul>
          {!resource.data.ownPending.items.length && <p className={styles.muted}>Không có món của bạn đang chờ duyệt.</p>}
          <Pagination page={resource.data.ownPending.page} totalPages={resource.data.ownPending.totalPages} pageSize={resource.data.ownPending.pageSize} totalItems={resource.data.ownPending.total} itemLabel="món đang chờ" onChange={setPendingPage} />
          <Button variant="outline" icon="arrow-clockwise" disabled={busy} onClick={() => { setDishId(''); resource.reload(); }}>Tải lại danh mục</Button>
        </section></>}
    </div>
  </Modal>;
}

function MenuEditor({ item, busy, failure, onClose, onSave }) {
  const [price, setPrice] = useState(String(item.price));
  const [note, setNote] = useState(item.ingredientNote || '');
  const [available, setAvailable] = useState(item.isAvailable);
  const [localError, setLocalError] = useState(null);
  const submit = async event => {
    event.preventDefault();
    const amount = priceValue(price);
    if (amount === null) { setLocalError('Giá phải là số nguyên VNĐ từ 0 đến 99.999.999.'); return; }
    setLocalError(null);
    if (await onSave(item, { price: amount, ingredientNote: note, isAvailable: available, expectedVersion: item.version })) onClose();
  };
  return <Modal open onClose={onClose} title={`Sửa món: ${item.dishName}`} dismissible={!busy}>
    <form className={styles.form} onSubmit={submit}>
      <TextField label="Giá bán" value={price} onChange={setPrice} inputMode="numeric" suffix="VNĐ" disabled={busy} required hint="0 VNĐ hiển thị Miễn phí." error={failure?.details?.fieldErrors?.price} />
      <TextField label="Ghi chú thành phần" value={note} onChange={setNote} disabled={busy} error={failure?.details?.fieldErrors?.ingredientNote} />
      <Checkbox switch checked={available} onChange={setAvailable} disabled={busy}>Đang bán</Checkbox>
      {(localError || failure) && <Notice tone="alert">{localError || failure.message}</Notice>}
      <div className={styles.actions}><Button variant="subtle" disabled={busy} onClick={onClose}>Hủy</Button><Button type="submit" loading={busy}>Lưu thay đổi</Button></div>
    </form>
  </Modal>;
}

function ShopHeader({ shop, busy, refreshing, onReload }) {
  return <div className={styles.shopHeader}>
    <Photo src={shop.avtShopUrl} alt={`Ảnh quán ${shop.name}`} ratio="1/1" shape="rounded" className={styles.shopPhoto} />
    <div className={styles.shopDetails}><h2>{shop.name}</h2><p>{shop.address}</p>
      <div className={styles.shopStatuses}><StatusBadge entity="shop" status={shop.verificationStatus} className={shop.verificationStatus === 'rejected' ? styles.rejectedBadge : undefined} /><ShopOperatingStatus status={shop.status} /></div>
    </div>
    <Button size="sm" variant="outline" loading={refreshing} disabled={busy} onClick={onReload}>{refreshing ? 'Đang tải lại…' : 'Tải lại trạng thái'}</Button>
  </div>;
}

const MANAGEMENT_TABS = [
  { key: 'information', label: 'Thông tin' },
  { key: 'schedule', label: 'Lịch mở cửa' },
  { key: 'menu', label: 'Menu' },
];

function ManagementContent({ initial, refreshing, onConflict, onReload, onAdopt, onMessage }) {
  const [context, setContext] = useState(initial);
  const syncedContext = useRef(initial);
  const [identity, setIdentity] = useState(() => shopIdentityValue(initial.shop));
  const [schedule, setSchedule] = useState(() => initial.shop.schedule.length ? cloneShopSchedule(initial.shop.schedule) : emptyShopForm().schedule);
  const [tab, setTab] = useState('information');
  const [mutationBusy, setBusy] = useState(false);
  const busy = mutationBusy || refreshing;
  const [busyArea, setBusyArea] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [identityLocalErrors, setIdentityLocalErrors] = useState({});
  const [scheduleLocalErrors, setScheduleLocalErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [menuPage, setMenuPage] = useState(1);
  const [reviewSeen, setReviewSeen] = useState(Boolean(initial.reviewNotification?.popupSeenAt));
  const inFlight = useRef(false);
  const uploadActive = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (initial === syncedContext.current) return;
    const previous = syncedContext.current;
    syncedContext.current = initial;
    setContext(initial);
    if (Object.keys(shopIdentityValue(initial.shop)).some(key => initial.shop[key] !== previous.shop[key])) {
      setIdentity(current => Object.entries(current).some(([key, value]) => value !== shopIdentityValue(previous.shop)[key])
        ? current : shopIdentityValue(initial.shop));
    }
    if (!shopSchedulesEqual(initial.shop.schedule, previous.shop.schedule)) {
      const previousDraft = previous.shop.schedule.length ? previous.shop.schedule : emptyShopForm().schedule;
      setSchedule(current => !shopSchedulesEqual(current, previousDraft) ? current
        : initial.shop.schedule.length ? cloneShopSchedule(initial.shop.schedule) : emptyShopForm().schedule);
    }
    setReviewSeen(Boolean(initial.reviewNotification?.popupSeenAt));
  }, [initial]);
  const menu = useShopResource(shopManagementService.listMenu);
  const shop = context.shop;
  const readOnly = shop.status !== 'active' || shop.verificationStatus !== 'verified';
  const pending = context.pendingSubmission;
  const menuItems = menu.data?.items || [];
  const menuTotalPages = Math.max(1, Math.ceil(menuItems.length / MENU_PAGE_SIZE));
  const visibleMenuPage = Math.min(menuPage, menuTotalPages);
  const visibleMenu = menuItems.slice((visibleMenuPage - 1) * MENU_PAGE_SIZE, visibleMenuPage * MENU_PAGE_SIZE);
  const scheduleChanged = !shopSchedulesEqual(schedule, shop.schedule);
  const identityChanged = Object.entries(identity).some(([key, value]) => value !== (shop[key] || ''));
  const identityErrors = { ...(failure?.area === 'identity' ? failure.error.details?.fieldErrors : {}), ...identityLocalErrors };
  const scheduleErrors = { ...(failure?.area === 'schedule' ? failure.error.details?.fieldErrors : {}), ...scheduleLocalErrors };
  const adopt = result => { syncedContext.current = result; setContext(result); onAdopt(result); };
  const mutate = async (area, work, onSuccess, successText) => {
    if (inFlight.current || readOnly || refreshing) return false;
    inFlight.current = true; setBusy(true); setBusyArea(area); setFailure(null); onMessage(null);
    try {
      const result = await work();
      if (!alive.current) return false;
      onSuccess(result);
      onMessage({ text: result.unchanged ? 'Thông tin không thay đổi; không tạo hồ sơ mới.' : successText,
        tone: result.unchanged ? 'info' : 'success', createdAt: Date.now() });
      return true;
    } catch (error) {
      if (alive.current) { setFailure({ area, error }); if (error.status === 409 || error.details?.code === 'SHOP_INACTIVE') onConflict(error.message); }
      return false;
    } finally { inFlight.current = false; if (alive.current) { setBusy(false); setBusyArea(null); } }
  };
  const submitIdentity = event => {
    event.preventDefault();
    if (readOnly || pending || uploadActive.current || inFlight.current || refreshing) return;
    const errors = identity.avtShopUrl ? {} : { avtShopUrl: 'Chọn và tải lên ảnh quán trước khi gửi yêu cầu.' };
    setIdentityLocalErrors(errors);
    if (Object.keys(errors).length) return;
    mutate('identity', () => shopManagementService.requestIdentity(identity), result => {
      adopt(result); setIdentity(shopIdentityValue(result.shop));
    }, 'Đã gửi yêu cầu sửa thông tin cho quản trị viên.');
  };
  const submitSchedule = event => {
    event.preventDefault();
    if (readOnly || inFlight.current || refreshing || !scheduleChanged) return;
    const errors = validateShopSchedule(schedule);
    setScheduleLocalErrors(errors);
    if (Object.keys(errors).length) return;
    mutate('schedule', () => shopManagementService.updateSchedule(schedule, shop.version), result => {
      adopt(result); setSchedule(cloneShopSchedule(result.shop.schedule));
    }, 'Đã lưu lịch mở cửa.');
  };
  const editMenu = (item, update) => mutate('menu-edit', () => shopManagementService.updateMenu(item.shopDishId, update), menu.reload, 'Đã cập nhật menu.');
  const recentReject = context.latestSubmission?.submissionType === 'identity_edit' && context.latestSubmission.status === 'rejected';
  const rejectReason = recentReject ? context.latestSubmission.reviewNote?.trim()
    : shop.verificationStatus === 'rejected' ? shop.verificationNote?.trim() : '';
  const editRejectedIdentity = () => {
    if (readOnly || pending || inFlight.current || uploadActive.current) return;
    setIdentity({ ...shopIdentityValue(shop), ...context.latestSubmission.afterValue });
    setIdentityLocalErrors({}); setFailure(null); setTab('information');
  };
  const dismissRejectedIdentity = async () => {
    if (inFlight.current || !context.reviewNotification) return;
    inFlight.current = true; setBusy(true); setBusyArea('review-seen'); setFailure(null);
    try {
      const result = await shopRegistrationService.acknowledgeReview(context.reviewNotification.notificationId);
      if (alive.current) {
        setReviewSeen(true);
        adopt({ ...context, reviewNotification: { ...context.reviewNotification, popupSeenAt: result.popupSeenAt } });
      }
    } catch (error) { if (alive.current) setFailure({ area: 'review-seen', error }); }
    finally { inFlight.current = false; if (alive.current) { setBusy(false); setBusyArea(null); } }
  };
  return <>
    {failure && <Notice tone="alert">{failure.error.message}</Notice>}
    <ShopHeader shop={shop} busy={busy || uploading} refreshing={refreshing} onReload={() => { if (!inFlight.current && !uploadActive.current && !refreshing) onReload(); }} />
    {shop.status === 'inactive' && <Notice tone="alert" className={styles.operatingNotice} title="Quán tạm ngưng hoạt động">
      <p className={styles.rejectionReason}>{context.operatingDecision?.status === 'inactive' && context.operatingDecision.reason?.trim()
        ? context.operatingDecision.reason.trim() : 'Quản trị viên chưa cung cấp lý do.'}</p>
      {context.operatingDecision?.status === 'inactive' && <p className={styles.operatingMeta}>
        {context.operatingDecision.adminName || 'Quản trị viên'} · {shopDate(context.operatingDecision.occurredAt)}
      </p>}
      Bạn chỉ có thể xem hồ sơ, lịch mở cửa và menu.
    </Notice>}
    {shop.verificationStatus === 'pending' && <Notice>Bạn có thể chỉnh sửa thông tin và menu sau khi quán được xác minh.</Notice>}
    {shop.verificationStatus === 'rejected' && rejectReason && <Notice tone="alert" title="Lý do từ chối đăng ký quán"><span className={styles.rejectionReason}>{rejectReason}</span></Notice>}
    <Tabs items={MANAGEMENT_TABS} value={tab} onChange={setTab} label="Quản lý quán" />
    <section className={styles.tabSection} hidden={tab !== 'information'} role="tabpanel" aria-label="Thông tin">
      {recentReject && !pending && !reviewSeen && <Notice className={styles.rejectionCard} tone="alert" title="Yêu cầu cập nhật bị từ chối"
        onDismiss={!busy && context.reviewNotification ? dismissRejectedIdentity : undefined}
        action={!readOnly && !busy ? { label: 'Chỉnh sửa yêu cầu cập nhật', onClick: editRejectedIdentity } : undefined}>
        <span className={styles.rejectionReason}>{rejectReason || 'Chưa có lý do được ghi nhận.'}</span>
      </Notice>}
      <Panel title="Thông tin quán">
        {recentReject && !pending && reviewSeen && <div className={styles.savedRejection}>
          <b>Lý do từ chối yêu cầu cập nhật gần nhất</b><p className={styles.rejectionReason}>{rejectReason}</p>
          {!readOnly && <Button size="sm" variant="outline" disabled={busy || uploading} onClick={editRejectedIdentity}>Chỉnh sửa yêu cầu cập nhật</Button>}
        </div>}
        {pending && <Notice title={pending.submissionType === 'identity_edit' ? 'Yêu cầu sửa thông tin đang chờ duyệt' : 'Hồ sơ đăng ký đang chờ duyệt'}>
          Gửi lúc {shopDate(pending.submittedAt)}. {pending.submissionType === 'identity_edit' ? 'Thông tin đề xuất chỉ được áp dụng sau khi quản trị viên duyệt.' : 'Vui lòng chờ kết quả xác minh từ quản trị viên.'}
        </Notice>}
        {readOnly ? <><ShopSnapshot value={{ name: shop.name, address: shop.address, phone: shop.phone, avtShopUrl: shop.avtShopUrl }} />
          {pending?.submissionType === 'identity_edit' && <ShopIdentityComparison beforeValue={pending.beforeValue} afterValue={pending.afterValue} />}</>
          : <form className={styles.form} onSubmit={submitIdentity}>
        <ShopIdentityFields value={identity} onChange={next => { setIdentity(next); setIdentityLocalErrors({}); }} errors={identityErrors}
          onShopUnavailable={onConflict}
          disabled={busy || Boolean(pending)} pendingSubmission={pending}
          onUploadStateChange={active => { uploadActive.current = active; setUploading(active); }} />
        {!pending && <p className={styles.muted}>Tên, địa chỉ, điện thoại và ảnh mới được cập nhật sau khi quản trị viên duyệt.</p>}
        <div className={styles.actions}>{uploading && <span className={styles.muted} role="status">Đang tải ảnh quán…</span>}
          <Button variant="subtle" disabled={busy || uploading || Boolean(pending) || !identityChanged} onClick={() => {
            setIdentity(shopIdentityValue(shop)); setIdentityLocalErrors({}); setFailure(null);
          }}>Hủy</Button>
          <Button type="submit" loading={busyArea === 'identity'} disabled={busy || Boolean(pending) || uploading || !identity.avtShopUrl || !identityChanged}>Gửi yêu cầu sửa</Button>
        </div>
      </form>}</Panel>
    </section>
    <section className={styles.tabSection} hidden={tab !== 'schedule'} role="tabpanel" aria-label="Lịch mở cửa">
      <Panel title="Lịch mở cửa">{shop.scheduleIncomplete && <Notice>Lịch mở cửa hiện tại chưa đầy đủ.</Notice>}{readOnly ? <ShopSnapshot value={{ schedule: shop.schedule }} /> : <form className={styles.form} onSubmit={submitSchedule}>
        <ShopScheduleFields value={schedule} onChange={next => { setSchedule(next); setScheduleLocalErrors({}); }}
          errors={scheduleErrors} disabled={busy} savedSchedule={shop.schedule} allowCopy showHeading={false} />
        <div className={styles.actions}><Button variant="subtle" disabled={busy || !scheduleChanged} onClick={() => {
          setSchedule(shop.schedule.length ? cloneShopSchedule(shop.schedule) : emptyShopForm().schedule); setScheduleLocalErrors({}); setFailure(null);
        }}>Hủy</Button><Button type="submit" loading={busyArea === 'schedule'} disabled={busy || !scheduleChanged}>Lưu lịch mở cửa</Button></div>
      </form>}</Panel>
    </section>
    <section className={styles.tabSection} hidden={tab !== 'menu'} role="tabpanel" aria-label="Menu">
      <Panel title="Menu của quán" action={!readOnly && <Button size="sm" icon="plus-lg" disabled={busy} onClick={() => { setFailure(null); setAdding(true); }}>Thêm món</Button>}>
        {menu.loading || (!menu.data && !menu.error) ? <Spinner showLabel /> : menu.error ? <Notice tone="alert" action={{ label: 'Thử lại', onClick: menu.reload }}>{menu.error.message}</Notice>
          : <><ul className={styles.menu}>{visibleMenu.map((item, index) => <MenuRow key={item.shopDishId} item={item} busy={busy} readOnly={readOnly} number={(visibleMenuPage - 1) * MENU_PAGE_SIZE + index + 1}
            onEdit={() => { if (!inFlight.current) { setFailure(null); setEditing(item); } }}
            onRemove={() => { if (!inFlight.current) { setFailure(null); setRemoving(item); } }}
            onToggle={isAvailable => editMenu(item, { isAvailable, expectedVersion: item.version })} />)}</ul>
            {!menuItems.length && <p className={styles.muted}>{readOnly ? 'Quán chưa có món trong menu.' : 'Chưa có món trong menu. Chọn món đã được duyệt rồi đặt giá riêng.'}</p>}
            {menuItems.length > 0 && <div className={styles.menuPagination}><Pagination page={visibleMenuPage} totalPages={menuTotalPages} pageSize={MENU_PAGE_SIZE} totalItems={menuItems.length} itemLabel="món" onChange={setMenuPage} /></div>}</>}
      </Panel>
    </section>
    {!readOnly && adding && <DishPicker busy={busy} failure={failure?.area === 'menu-add' ? failure.error : null}
      onClose={() => { if (!inFlight.current) setAdding(false); }}
      onAdd={item => mutate('menu-add', () => shopManagementService.addMenu(item), menu.reload, 'Đã thêm món vào menu.')} />}
    {!readOnly && editing && <MenuEditor key={editing.shopDishId} item={editing} busy={busy} failure={failure?.area === 'menu-edit' ? failure.error : null}
      onClose={() => { if (!inFlight.current) setEditing(null); }} onSave={editMenu} />}
    <ConfirmDialog open={!readOnly && Boolean(removing)} title={`Xóa “${removing?.dishName || ''}” khỏi menu?`} confirmLabel="Xóa khỏi menu" cancelLabel="Hủy" loading={busy}
      message={<>Món sẽ được gỡ khỏi menu của quán. Món trong danh mục chung được giữ nguyên.
        {failure?.area === 'menu-remove' && <span className="d-block mt-3" role="alert">{failure.error.message}</span>}</>}
      onCancel={() => { if (!inFlight.current) { setRemoving(null); setFailure(null); } }}
      onConfirm={async () => {
        if (!removing) return;
        if (await mutate('menu-remove', () => shopManagementService.removeMenu(removing.shopDishId, removing.version), menu.reload, 'Đã xóa món khỏi menu của quán.')) {
          setMenuPage(Math.min(visibleMenuPage, Math.max(1, Math.ceil((menuItems.length - 1) / MENU_PAGE_SIZE))));
          setRemoving(null);
        }
      }} />
  </>;
}

function UnverifiedProfile({ context, refreshing, onReload }) {
  const { shop, latestSubmission } = context;
  const [confirmFresh, setConfirmFresh] = useState(false);
  const rejected = shop.verificationStatus === 'rejected';
  const reason = latestSubmission?.status === 'rejected' ? latestSubmission.reviewNote?.trim() : shop.verificationNote?.trim();
  const retryUrl = mode => `/shops/register?${new URLSearchParams({ retry: mode, submission: latestSubmission?.submissionId || `legacy:${shop.shopId}` })}`;
  return <>
    {rejected && reason && <Notice tone="alert" title="Lý do từ chối"><span className={styles.rejectionReason}>{reason}</span></Notice>}
    {!rejected && <Notice>Bạn có thể chỉnh sửa thông tin và menu sau khi quán được xác minh.</Notice>}
    <Panel title={rejected ? <StatusBadge entity="shop" status="rejected" className={styles.rejectedBadge} /> : 'Quán đang chờ xác minh'}
      action={<Button size="sm" variant="outline" loading={refreshing} onClick={onReload}>{refreshing ? 'Đang tải lại…' : 'Tải lại trạng thái'}</Button>}>
      {!rejected && <StatusBadge entity="shop" status={shop.verificationStatus} />}
      <div className={styles.current}><ShopSnapshot value={shop} /></div>
      {rejected ? <div className={styles.retryActions}>
        <Button as="a" href={retryUrl('edit')} icon="pencil">Chỉnh sửa hồ sơ</Button>
        <Button variant="outline" icon="plus-circle" onClick={() => setConfirmFresh(true)}>Đăng ký lại từ đầu</Button>
      </div> : null}
    </Panel>
    <ConfirmDialog open={confirmFresh} title="Đăng ký lại từ đầu?" confirmLabel="Mở form trống" cancelLabel="Giữ hồ sơ"
      message="Form sẽ để trống các trường. Hồ sơ cũ và lý do từ chối vẫn được giữ trong lịch sử."
      onConfirm={() => window.location.assign(retryUrl('fresh'))} onCancel={() => setConfirmFresh(false)} />
  </>;
}

export default function ShopManagementPage() {
  // Tùng — Sprint 2: registration-context và getMine cùng Shop view, không thêm GET navbar riêng.
  const { member, isCheckingSession, resource } = useShopNavigation();
  const { user } = useAuth();
  const [message, setMessage] = useState(null);
  const [conflict, setConflict] = useState(null);
  useEffect(() => { setMessage(null); setConflict(null); }, [user?.id]);
  useEffect(() => { if (resource.refreshOutcome) setMessage(resource.refreshOutcome); }, [resource.refreshOutcome]);
  const reload = () => { setMessage(null); setConflict(null); resource.reload({ manual: true }); };
  const dismissMessage = () => { setMessage(null); resource.clearRefreshFeedback(); };
  const shop = resource.data?.shop;
  return <ShopMemberShell><div className={styles.page}>
    <PageHeader title="Quán của tôi" description="Quản lý thông tin, lịch mở cửa và menu quán chay." />
    {member && <ShopOperationNotice message={message} onDismiss={dismissMessage} />}
    {member && conflict && <Notice tone="alert" onDismiss={() => setConflict(null)}>{conflict}</Notice>}
    {member && resource.refreshError && <Notice tone="alert" action={{ label: 'Thử lại', onClick: reload }}>{resource.refreshError.message}</Notice>}
    {isCheckingSession ? <Spinner showLabel /> : !member ? <Notice tone="alert">Vui lòng đăng nhập bằng tài khoản thành viên để quản lý quán.</Notice>
      : resource.loading ? <Spinner showLabel /> : resource.error ? <Notice tone="alert" action={{ label: 'Thử lại', onClick: reload }}>{resource.error.message}</Notice>
        : resource.data && (!shop ? <Panel title="Bạn chưa đăng ký quán"><p>Gửi thông tin quán để quản trị viên xác minh.</p><Button as="a" href="/shops/register">Đăng ký quán</Button></Panel>
          : shop.verificationStatus !== 'verified' && shop.status !== 'inactive' ? <UnverifiedProfile key={`${shop.shopId}:${resource.data.latestSubmission?.submissionId || shop.version}`} context={resource.data} refreshing={resource.refreshing} onReload={reload} />
            : <ManagementContent key={shop.shopId} initial={resource.data} refreshing={resource.refreshing} onReload={reload} onAdopt={resource.adopt}
              onMessage={setMessage} onConflict={text => { setConflict(text); resource.reload(); }} />)}
  </div></ShopMemberShell>;
}
