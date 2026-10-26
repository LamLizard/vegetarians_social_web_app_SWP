// Tùng — Sprint 2: quản lý quán đã xác minh, giữ bản công khai trong lúc chờ identity.
import { useCallback, useEffect, useRef, useState } from 'react';
import useAuth from '../hooks/useAuth';
// Tùng — Sprint 2: BRIDGE-02A trạng thái Shop owner dùng chung với navigation/Register.
import { useShopNavigation } from '../context/ShopNavigationContext';
import useShopResource from '../hooks/useShopResource';
import shopManagementService from '../services/shopManagement.service';
import Button from '../components/Button/Button';
import Checkbox from '../components/Checkbox/Checkbox';
import ConfirmDialog from '../components/ConfirmDialog/ConfirmDialog';
import IconButton from '../components/IconButton/IconButton';
import Menu from '../components/Menu/Menu';
import Notice from '../components/Notice/Notice';
import PageHeader from '../components/PageHeader/PageHeader';
import Pagination from '../components/Pagination/Pagination';
import Panel from '../components/Panel/Panel';
import Photo from '../components/Photo/Photo';
import Spinner from '../components/Spinner/Spinner';
import StatusBadge from '../components/StatusBadge/StatusBadge';
import Tabs from '../components/Tabs/Tabs';
import ShopMenuForm from './ShopMenuForm';
import ShopOperationNotice from './ShopOperationNotice';
import ShopReviewNotice from './ShopReviewNotice';
import ShopRetryWarning from './ShopRetryWarning';
import { ShopIdentityComparison, ShopIdentityFields, ShopMemberShell, ShopScheduleFields, ShopSnapshot, ShopOperatingStatus, emptyShopForm, cloneShopSchedule, shopIdentityValue, shopSchedulesEqual, validateShopSchedule, shopDate } from './ShopFormFields';
import styles from './ShopManagementPage.module.css';

const MENU_PAGE_SIZE = 10;
const MENU_PRICE = new Intl.NumberFormat('vi-VN');

function MenuRow({ item, number, busy, readOnly, onEdit, onToggle, onRemove }) {
  const name = item.effectiveName || item.dishName;
  const [failedImage, setFailedImage] = useState(null);
  const image = item.effectiveImageUrl || item.imageUrl;
  const warning = item.dishStatus !== 'active' ? 'Món chưa được duyệt hoặc đã ẩn; không hiển thị công khai.' : '';
  return <li className={`${styles.menuRow} ${item.isAvailable ? '' : styles.off}`}>
    <span className={styles.menuNumber} aria-label={`Món số ${number}`}>{number}</span>
    <Photo src={failedImage === image ? item.dishImageUrl : image}
      {...(failedImage !== image && image !== item.dishImageUrl ? { onError: () => setFailedImage(image) } : {})}
      alt={`Ảnh món ${name}`} ratio="1/1" shape="rounded" className={styles.menuPhoto} />
    <div className={styles.menuInfo}><b title={name}>{name}</b><small className={styles.menuClassification} title={item.dishName}>Phân loại: {item.dishName}</small>
      {warning ? <p className={styles.warning} title={warning}>{warning}</p>
        : item.ingredientNote && <p className={styles.menuNote} title={item.ingredientNote}>{item.ingredientNote}</p>}</div>
    <strong className={item.price === 0 ? styles.free : styles.menuPrice}>{item.price === 0 ? 'Miễn phí' : `${MENU_PRICE.format(item.price)} ₫`}</strong>
    {readOnly ? <span className={styles.menuAvailability}>{item.isAvailable ? 'Đang bán' : 'Tạm hết'}</span>
      : <div className={styles.menuOwner}><Checkbox switch checked={item.isAvailable} disabled={busy} onChange={onToggle}>{item.isAvailable ? 'Đang bán' : 'Tạm hết'}</Checkbox>
      <Menu width={200} renderTrigger={props => <IconButton icon="three-dots" label={`Tuỳ chọn món ${name}`} variant="ghost" size="sm" disabled={busy} {...props} />}
        items={[{ icon: 'pencil', label: 'Sửa món', onClick: onEdit, disabled: busy },
          { icon: 'trash', label: 'Xóa khỏi menu', onClick: onRemove, disabled: busy }]} />
    </div>}
  </li>;
}

function ShopHeader({ shop }) {
  return <div className={styles.shopHeader}>
    <div className={styles.shopDetails}><h2>{shop.name}</h2><p>{shop.address}</p>
      <div className={styles.shopStatuses}><StatusBadge entity="shop" status={shop.verificationStatus} className={shop.verificationStatus === 'rejected' ? styles.rejectedBadge : undefined} /><ShopOperatingStatus status={shop.status} /></div>
    </div>
    <Photo src={shop.avtShopUrl} alt={`Ảnh quán ${shop.name}`} ratio="1/1" shape="rounded" className={styles.shopPhoto} />
  </div>;
}

const MANAGEMENT_TABS = [
  { key: 'information', label: 'Thông tin' },
  { key: 'schedule', label: 'Lịch mở cửa' },
  { key: 'menu', label: 'Menu' },
];

function ManagementContent({ initial, refreshing, onConflict, onAdopt, onMessage }) {
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
  // Tùng — Sprint 3: mỗi lần kiểm tra lịch đều dẫn focus tới ngày/ca lỗi.
  const [scheduleValidationAttempt, setScheduleValidationAttempt] = useState(0);
  const [failure, setFailure] = useState(null);
  const [menuDialog, setMenuDialog] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [removing, setRemoving] = useState(null);
  const [menuPage, setMenuPage] = useState(1);
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
  }, [initial]);
  const menu = useShopResource(shopManagementService.listMenu);
  useEffect(() => { if (menu.data) setMenuItems(menu.data.items); }, [menu.data]);
  const shop = context.shop;
  const readOnly = shop.status !== 'active' || shop.verificationStatus !== 'verified';
  const pending = context.pendingSubmission;
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
      if (successText !== null) onMessage({ text: result.unchanged ? 'Thông tin không thay đổi; không tạo hồ sơ mới.' : successText,
        tone: result.unchanged ? 'info' : 'success', createdAt: messageTime() });
      return result;
    } catch (error) {
      if (alive.current) {
        setFailure({ area, error });
        if (error.details?.code === 'SHOP_CONFLICT' || error.details?.code === 'SHOP_INACTIVE') {
          if (area.startsWith('menu-')) menu.reload();
          onConflict(error.message);
        }
      }
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
    // Tùng — Sprint 3: chỉ bổ sung điều hướng lỗi, giữ validator và version lưu lịch.
    setScheduleValidationAttempt(current => current + 1);
    const errors = validateShopSchedule(schedule);
    setScheduleLocalErrors(errors);
    if (Object.keys(errors).length) return;
    mutate('schedule', () => shopManagementService.updateSchedule(schedule, shop.version), result => {
      adopt(result); setSchedule(cloneShopSchedule(result.shop.schedule));
    }, 'Đã lưu lịch mở cửa.');
  };
  const adoptMenuItem = result => setMenuItems(current => current.map(row => row.shopDishId === result.item.shopDishId ? result.item : row));
  const editMenu = (item, update) => mutate('menu-edit', () => shopManagementService.updateMenu(item.shopDishId, update), adoptMenuItem, 'Đã cập nhật menu.');
  const addMenu = (payload, { keepAdding } = {}) => mutate('menu-add', () => shopManagementService.addMenu(payload), result => {
    const items = [...menuItems.filter(row => row.shopDishId !== result.item.shopDishId), result.item]
      .sort((left, right) => BigInt(left.shopDishId) < BigInt(right.shopDishId) ? -1 : 1);
    setMenuItems(items);
    setMenuPage(Math.floor(items.findIndex(row => row.shopDishId === result.item.shopDishId) / MENU_PAGE_SIZE) + 1);
  }, keepAdding ? null : 'Đã thêm món vào menu.');
  return <>
    {failure && !failure.area.startsWith('menu-') && <Notice tone="alert">{failure.error.message}</Notice>}
    <ShopHeader shop={shop} />
    {shop.status === 'inactive' && <Notice tone="alert" className={styles.operatingNotice} title="Quán tạm ngưng hoạt động">
      <p className={styles.rejectionReason}>{context.operatingDecision?.status === 'inactive' && context.operatingDecision.reason?.trim()
        ? context.operatingDecision.reason.trim() : 'Quản trị viên chưa cung cấp lý do.'}</p>
      {context.operatingDecision?.status === 'inactive' && <p className={styles.operatingMeta}>
        {context.operatingDecision.adminName || 'Quản trị viên'} · {shopDate(context.operatingDecision.occurredAt)}
      </p>}
      Bạn chỉ có thể xem hồ sơ, lịch mở cửa và menu.
    </Notice>}
    {shop.verificationStatus === 'pending' && <Notice>Bạn có thể chỉnh sửa thông tin và menu sau khi quán được xác minh.</Notice>}
    <Tabs items={MANAGEMENT_TABS} value={tab} onChange={setTab} label="Quản lý quán" />
    <section className={styles.tabSection} hidden={tab !== 'information'} role="tabpanel" aria-label="Thông tin">
      {pending && <Notice className={styles.pendingNotice} title={pending.submissionType === 'identity_edit' ? 'Yêu cầu sửa thông tin đang chờ duyệt' : 'Hồ sơ đăng ký đang chờ duyệt'}>
        Gửi lúc {shopDate(pending.submittedAt)}. {pending.submissionType === 'identity_edit' ? 'Thông tin đề xuất chỉ được áp dụng sau khi quản trị viên duyệt.' : 'Vui lòng chờ kết quả xác minh từ quản trị viên.'}
      </Notice>}
      <Panel title="Thông tin quán">
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
        {/* Tùng — Sprint 3: xóa lỗi lịch đã cũ, giữ lỗi identity/menu và guard hiện tại. */}
        <ShopScheduleFields value={schedule} onChange={next => {
          if (readOnly || inFlight.current || refreshing) return;
          setSchedule(next); setScheduleLocalErrors({}); setFailure(current => current?.area === 'schedule' ? null : current);
        }} validationAttempt={scheduleValidationAttempt}
          errors={scheduleErrors} disabled={busy} savedSchedule={shop.schedule} allowCopy showHeading={false} />
        <div className={styles.actions}><Button variant="subtle" disabled={busy || !scheduleChanged} onClick={() => {
          // Tùng — Sprint 3: Hủy lịch chỉ xóa failure thuộc lịch, giữ các khu vực khác.
          setSchedule(shop.schedule.length ? cloneShopSchedule(shop.schedule) : emptyShopForm().schedule); setScheduleLocalErrors({}); setFailure(current => current?.area === 'schedule' ? null : current);
        }}>Hủy</Button><Button type="submit" loading={busyArea === 'schedule'} disabled={busy || !scheduleChanged}>Lưu lịch mở cửa</Button></div>
      </form>}</Panel>
    </section>
    <section className={styles.tabSection} hidden={tab !== 'menu'} role="tabpanel" aria-label="Menu">
      <Panel title="Menu của quán" action={!readOnly && <Button size="sm" icon="plus-lg" disabled={busy || menu.loading || Boolean(menu.error)} onClick={() => { setFailure(null); setMenuDialog({ kind: 'add' }); }}>Thêm món</Button>}>
        {failure?.area === 'menu-edit' && !menuDialog && <Notice tone="alert">{failure.error.message}</Notice>}
        {menu.loading || (!menu.data && !menu.error) ? <Spinner showLabel /> : menu.error ? <Notice tone="alert" action={{ label: 'Thử lại', onClick: menu.reload }}>{menu.error.message}</Notice>
          : <><ul className={styles.menu}>{visibleMenu.map((item, index) => <MenuRow key={item.shopDishId} item={item} busy={busy} readOnly={readOnly} number={(visibleMenuPage - 1) * MENU_PAGE_SIZE + index + 1}
            onEdit={() => { if (!inFlight.current) { setFailure(null); setMenuDialog({ kind: 'edit', item }); } }}
            onRemove={() => { if (!inFlight.current) { setFailure(null); setRemoving(item); } }}
            onToggle={isAvailable => editMenu(item, { isAvailable, expectedVersion: item.version })} />)}</ul>
            {!menuItems.length && <p className={styles.muted}>{readOnly ? 'Quán chưa có món trong menu.' : 'Chưa có món trong menu. Chọn phân loại, nhập tên món và giá bán của quán.'}</p>}
            {menuItems.length > 0 && <div className={styles.menuPagination}><Pagination page={visibleMenuPage} totalPages={menuTotalPages} pageSize={MENU_PAGE_SIZE} totalItems={menuItems.length} itemLabel="món" onChange={setMenuPage} /></div>}</>}
      </Panel>
    </section>
    {menuDialog && <ShopMenuForm key={menuDialog.item?.shopDishId || 'create'} item={menuDialog.item}
      latestItem={menu.data ? menuItems.find(row => row.shopDishId === menuDialog.item?.shopDishId) : null} busy={busy} readOnly={readOnly}
      failure={failure?.area === (menuDialog.kind === 'add' ? 'menu-add' : 'menu-edit') ? failure.error : null}
      onClearFailure={() => setFailure(null)} onRefresh={() => { menu.reload(); onConflict('Đang tải bản mới của quán.'); }}
      onClose={() => { if (!inFlight.current) { setMenuDialog(null); setFailure(null); } }}
      onSave={menuDialog.kind === 'add' ? addMenu : payload => editMenu(menuDialog.item, payload)} />}
    <ConfirmDialog open={!readOnly && Boolean(removing)} title={`Xóa “${removing?.effectiveName || removing?.dishName || ''}” khỏi menu?`} confirmLabel="Xóa khỏi menu" cancelLabel="Hủy" loading={busy}
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

function UnverifiedProfile({ context }) {
  const { shop, latestSubmission } = context;
  const [confirmFresh, setConfirmFresh] = useState(false);
  const rejected = shop.verificationStatus === 'rejected';
  const retryUrl = mode => `/shops/register?${new URLSearchParams({ retry: mode, submission: latestSubmission?.submissionId || `legacy:${shop.shopId}` })}`;
  return <>
    {!rejected && <Notice>Bạn có thể chỉnh sửa thông tin và menu sau khi quán được xác minh.</Notice>}
    <Panel title={rejected ? <StatusBadge entity="shop" status="rejected" className={styles.rejectedBadge} /> : 'Quán đang chờ xác minh'}>
      {!rejected && <StatusBadge entity="shop" status={shop.verificationStatus} />}
      <div className={styles.current}><ShopSnapshot value={shop} /></div>
      {rejected ? <div className={styles.retryActions}>
        <Button as="a" href={retryUrl('edit')} icon="pencil">Chỉnh sửa</Button>
        <Button variant="outline" icon="plus-circle" onClick={() => setConfirmFresh(true)}>Đăng ký lại từ đầu</Button>
      </div> : null}
    </Panel>
    <ShopRetryWarning open={confirmFresh}
      onConfirm={() => window.location.assign(retryUrl('fresh'))} onCancel={() => setConfirmFresh(false)} />
  </>;
}

// Thời điểm tạo thông báo; tách ra ngoài component để không gọi Date.now() trong thân component (lint react-hooks/purity).
const messageTime = () => Date.now();

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
    <ShopReviewNotice />
    {member && <ShopOperationNotice message={message} onDismiss={dismissMessage} />}
    {member && conflict && <Notice tone="alert" onDismiss={() => setConflict(null)}>{conflict}</Notice>}
    {member && resource.refreshError && <Notice tone="alert" action={{ label: 'Thử lại', onClick: reload }}>{resource.refreshError.message}</Notice>}
    {isCheckingSession ? <Spinner showLabel /> : !member ? <Notice tone="alert">Vui lòng đăng nhập bằng tài khoản thành viên để quản lý quán.</Notice>
      : resource.loading ? <Spinner showLabel /> : resource.error ? <Notice tone="alert" action={{ label: 'Thử lại', onClick: reload }}>{resource.error.message}</Notice>
        : resource.data && (!shop ? <Panel title="Bạn chưa đăng ký quán"><p>Gửi thông tin quán để quản trị viên xác minh.</p><Button as="a" href="/shops/register">Đăng ký quán</Button></Panel>
          : shop.verificationStatus !== 'verified' && shop.status !== 'inactive' ? <UnverifiedProfile key={`${shop.shopId}:${resource.data.latestSubmission?.submissionId || shop.version}`} context={resource.data} />
            : <ManagementContent key={shop.shopId} initial={resource.data} refreshing={resource.refreshing} onAdopt={resource.adopt}
              onMessage={setMessage} onConflict={text => { setConflict(text); resource.reload(); }} />)}
  </div></ShopMemberShell>;
}
