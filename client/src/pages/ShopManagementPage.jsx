// Tùng — Sprint 2: quản lý quán đã xác minh, giữ bản công khai trong lúc chờ identity.
import { useCallback, useEffect, useRef, useState } from 'react';
// Tùng — Sprint 2: BRIDGE-02A trạng thái Shop owner dùng chung với navigation/Register.
import { useShopNavigation } from '../context/ShopNavigationContext';
import useShopResource from '../hooks/useShopResource';
import shopManagementService from '../services/shopManagement.service';
import Button from '../components/Button/Button';
import Checkbox from '../components/Checkbox/Checkbox';
import Modal from '../components/Modal/Modal';
import Notice from '../components/Notice/Notice';
import PageHeader from '../components/PageHeader/PageHeader';
import Pagination from '../components/Pagination/Pagination';
import Panel from '../components/Panel/Panel';
import Select from '../components/Select/Select';
import ShopMenuItem from '../components/ShopMenuItem/ShopMenuItem';
import Spinner from '../components/Spinner/Spinner';
import StatusBadge from '../components/StatusBadge/StatusBadge';
import TextField from '../components/TextField/TextField';
import { ShopIdentityFields, ShopMemberShell, ShopScheduleFields, ShopSnapshot, ShopSubmissionStatus, shopDate } from './ShopFormFields';
import styles from './ShopManagementPage.module.css';

function priceValue(raw) {
  return /^\d+$/.test(raw) && Number(raw) <= 99999999 ? Number(raw) : null;
}

function MenuRow({ item, busy, onEdit, onToggle }) {
  const warning = item.dishStatus !== 'active' ? 'Món chưa được duyệt hoặc đã ẩn; không hiển thị công khai.' : '';
  if (item.price !== 0) return <ShopMenuItem name={item.dishName} price={item.price} isAvailable={item.isAvailable}
    ingredientNote={[warning, item.ingredientNote].filter(Boolean).join(' ')} editable toggling={busy}
    onEdit={onEdit} onToggleAvailable={onToggle} />;
  // Composition riêng cho 0 VNĐ: không sửa formatter/props dùng chung.
  return <li className={styles.freeItem}><div><b>{item.dishName}</b>
    {warning && <p className={styles.warning}>{warning}</p>}
    {item.ingredientNote && <p className={styles.muted}>{item.ingredientNote}</p>}</div>
    <strong className={styles.free}>Miễn phí</strong>
    <Checkbox switch checked={item.isAvailable} disabled={busy} onChange={onToggle}>{item.isAvailable ? 'Đang bán' : 'Tạm hết'}</Checkbox>
    <Button variant="subtle" size="sm" disabled={busy} onClick={onEdit}>Sửa món</Button>
  </li>;
}

function DishPicker({ busy, failure, onClose, onAdd }) {
  const [page, setPage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);
  const [dishId, setDishId] = useState('');
  const [price, setPrice] = useState('');
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
    if (await onAdd({ dishId, price: amount })) onClose();
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
          {(localError || failure) && <Notice tone="alert">{localError || failure.message}</Notice>}
          <div className={styles.actions}><Button variant="subtle" disabled={busy} onClick={onClose}>Hủy</Button><Button type="submit" loading={busy} disabled={!options.length}>Thêm vào menu</Button></div>
        </form>
        <section className={styles.pendingGroup}><h3>Món tôi đề xuất đang chờ duyệt</h3>
          <p className={styles.muted}>Bạn có thể chọn món sau khi được quản trị viên duyệt. Bấm tải lại để cập nhật kết quả.</p>
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
      <TextField label="Ghi chú thành phần" value={note} onChange={setNote} disabled={busy} />
      <Checkbox switch checked={available} onChange={setAvailable} disabled={busy}>Đang bán</Checkbox>
      {(localError || failure) && <Notice tone="alert">{localError || failure.message}</Notice>}
      <div className={styles.actions}><Button variant="subtle" disabled={busy} onClick={onClose}>Hủy</Button><Button type="submit" loading={busy}>Lưu thay đổi</Button></div>
    </form>
  </Modal>;
}

function ManagementContent({ initial, onConflict, onReload }) {
  const [context, setContext] = useState(initial);
  const [identity, setIdentity] = useState({ name: initial.shop.name, address: initial.shop.address, phone: initial.shop.phone || '' });
  const [schedule, setSchedule] = useState(initial.shop.schedule);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const [message, setMessage] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const inFlight = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const menu = useShopResource(shopManagementService.listMenu);
  const shop = context.shop;
  const pending = context.pendingSubmission;
  const identityErrors = failure?.area === 'identity' ? failure.error.details?.fieldErrors : {};
  const scheduleErrors = failure?.area === 'schedule' ? failure.error.details?.fieldErrors : {};
  const mutate = async (area, work, onSuccess, successText) => {
    if (inFlight.current) return false;
    inFlight.current = true; setBusy(true); setFailure(null); setMessage(null);
    try {
      const result = await work();
      if (alive.current) { onSuccess(result); setMessage(result.unchanged ? 'Thông tin không thay đổi; không tạo hồ sơ mới.' : successText); }
      return true;
    } catch (error) {
      if (alive.current) { setFailure({ area, error }); if (error.status === 409) onConflict(error.message); }
      return false;
    } finally { inFlight.current = false; if (alive.current) setBusy(false); }
  };
  const editMenu = (item, update) => mutate('menu-edit', () => shopManagementService.updateMenu(item.shopDishId, update), menu.reload, 'Đã cập nhật menu.');
  const recentReject = context.latestSubmission?.submissionType === 'identity_edit' && context.latestSubmission.status === 'rejected';
  return <>
    {message && <Notice tone="success" onDismiss={() => setMessage(null)}>{message}</Notice>}
    {failure && <Notice tone="alert">{failure.error.message}</Notice>}
    <Panel title="Thông tin đã được xác minh" action={<Button size="sm" variant="outline" disabled={busy} onClick={() => { if (!inFlight.current) onReload(); }}>Tải lại trạng thái</Button>}><StatusBadge entity="shop" status={shop.verificationStatus} />
      <div className={styles.current}><ShopSnapshot value={shop} /></div>
    </Panel>
    {pending && <Panel title="Yêu cầu sửa đang chờ duyệt"><ShopSubmissionStatus status={pending.status} />
      <p className={styles.muted}>Gửi lúc {shopDate(pending.submittedAt)}. Bản đã duyệt vẫn công khai; lịch và menu vẫn chỉnh được.</p>
      <div className={styles.comparison}><section><h3>Trước khi gửi</h3><ShopSnapshot value={pending.beforeValue} /></section>
        <section><h3>Thông tin đề xuất</h3><ShopSnapshot value={pending.afterValue} /></section></div>
    </Panel>}
    {recentReject && !pending && <Notice tone="alert" title="Yêu cầu sửa trước bị từ chối">{context.latestSubmission.reviewNote} Quán vẫn được xác minh; bạn có thể gửi yêu cầu mới.</Notice>}
    <div className={styles.editors}>
      <Panel title="Đề nghị sửa thông tin"><form className={styles.form} onSubmit={event => {
        event.preventDefault(); mutate('identity', () => shopManagementService.requestIdentity(identity), setContext, 'Đã gửi yêu cầu sửa thông tin cho quản trị viên.');
      }}>
        <ShopIdentityFields value={identity} onChange={setIdentity} errors={identityErrors || {}} disabled={busy || Boolean(pending)} />
        <p className={styles.muted}>Tên, địa chỉ và điện thoại được cập nhật sau khi yêu cầu được duyệt.</p>
        <Button type="submit" loading={busy} disabled={Boolean(pending)}>Gửi yêu cầu sửa</Button>
      </form></Panel>
      <Panel title="Cập nhật lịch mở cửa"><form className={styles.form} onSubmit={event => {
        event.preventDefault(); mutate('schedule', () => shopManagementService.updateSchedule(schedule, shop.version), setContext, 'Đã lưu lịch mở cửa.');
      }}>
        <ShopScheduleFields value={schedule} onChange={setSchedule} errors={scheduleErrors || {}} disabled={busy} />
        <Button type="submit" loading={busy}>Lưu lịch mở cửa</Button>
      </form></Panel>
    </div>
    <Panel title="Menu của quán" action={<Button size="sm" icon="plus-lg" disabled={busy} onClick={() => { setFailure(null); setAdding(true); }}>Thêm món</Button>}>
      {menu.loading || (!menu.data && !menu.error) ? <Spinner showLabel /> : menu.error ? <Notice tone="alert" action={{ label: 'Thử lại', onClick: menu.reload }}>{menu.error.message}</Notice>
        : <><ul className={styles.menu}>{(menu.data?.items || []).map(item => <MenuRow key={item.shopDishId} item={item} busy={busy}
          onEdit={() => { if (!inFlight.current) { setFailure(null); setEditing(item); } }}
          onToggle={isAvailable => editMenu(item, { isAvailable, expectedVersion: item.version })} />)}</ul>
          {!menu.data?.items.length && <p className={styles.muted}>Chưa có món trong menu. Chọn món đã được duyệt rồi đặt giá riêng.</p>}</>}
    </Panel>
    {adding && <DishPicker busy={busy} failure={failure?.area === 'menu-add' ? failure.error : null}
      onClose={() => { if (!inFlight.current) setAdding(false); }}
      onAdd={item => mutate('menu-add', () => shopManagementService.addMenu(item), menu.reload, 'Đã thêm món vào menu.')} />}
    {editing && <MenuEditor key={editing.shopDishId} item={editing} busy={busy} failure={failure?.area === 'menu-edit' ? failure.error : null}
      onClose={() => { if (!inFlight.current) setEditing(null); }} onSave={editMenu} />}
  </>;
}

export default function ShopManagementPage() {
  // Tùng — Sprint 2: registration-context và getMine cùng Shop view, không thêm GET navbar riêng.
  const { member, isCheckingSession, resource } = useShopNavigation();
  const [message, setMessage] = useState(null);
  const shop = resource.data?.shop;
  return <ShopMemberShell><div className={styles.page}>
    <PageHeader title="Quán của tôi" description="Quản lý thông tin, lịch mở cửa và menu quán chay." />
    {message && <Notice onDismiss={() => setMessage(null)}>{message}</Notice>}
    {isCheckingSession ? <Spinner showLabel /> : !member ? <Notice tone="alert">Vui lòng đăng nhập bằng tài khoản Member để quản lý quán.</Notice>
      : resource.loading ? <Spinner showLabel /> : resource.error ? <Notice tone="alert" action={{ label: 'Thử lại', onClick: resource.reload }}>{resource.error.message}</Notice>
        : resource.data && (!shop ? <Panel title="Bạn chưa đăng ký quán"><p>Gửi thông tin quán để quản trị viên xác minh.</p><Button as="a" href="/shops/register">Đăng ký quán</Button></Panel>
          : shop.verificationStatus !== 'verified' ? <Panel title={shop.verificationStatus === 'pending' ? 'Quán đang chờ xác minh' : 'Đăng ký quán bị từ chối'} action={<Button size="sm" variant="outline" onClick={resource.reload}>Tải lại trạng thái</Button>}>
            <StatusBadge entity="shop" status={shop.verificationStatus} /><div className={styles.current}><ShopSnapshot value={shop} /></div>
            <Notice tone={shop.verificationStatus === 'rejected' ? 'alert' : 'info'}>{shop.verificationNote || 'Bạn có thể chỉnh sửa thông tin và menu sau khi quán được xác minh.'}</Notice>
            {shop.verificationStatus === 'rejected' && <Button as="a" href="/shops/register" className="mt-3">Đăng ký lại đầy đủ</Button>}
          </Panel> : <ManagementContent initial={resource.data} onReload={resource.reload} onConflict={text => { setMessage(text); resource.reload(); }} />)}
  </div></ShopMemberShell>;
}
