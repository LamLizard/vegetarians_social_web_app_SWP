// Tùng — Sprint 2: xét hồ sơ và quản lý khóa quán; chỉ hiển thị lịch sử đã lưu.
import { useCallback, useEffect, useRef, useState } from 'react';
import useAuth from '../hooks/useAuth';
import useShopResource from '../hooks/useShopResource';
import shopVerificationService from '../services/shopVerification.service';
import AdminLayout from '../components/AdminLayout/AdminLayout';
import Button from '../components/Button/Button';
import ConfirmDialog from '../components/ConfirmDialog/ConfirmDialog';
import DataTable from '../components/DataTable/DataTable';
import IconButton from '../components/IconButton/IconButton';
import Modal from '../components/Modal/Modal';
import Notice from '../components/Notice/Notice';
import PageHeader from '../components/PageHeader/PageHeader';
import Pagination from '../components/Pagination/Pagination';
import Spinner from '../components/Spinner/Spinner';
import SearchInput from '../components/SearchInput/SearchInput';
import Select from '../components/Select/Select';
import StatusBadge from '../components/StatusBadge/StatusBadge';
import Tabs from '../components/Tabs/Tabs';
import ShopOperationNotice from './ShopOperationNotice';
import { ShopIdentityComparison, ShopSnapshot, ShopSubmissionStatus, SUBMISSION_LABELS, SHOP_OPERATING_LABELS, shopDate } from './ShopFormFields';
import styles from './ShopVerifyPage.module.css';

const LIST_TABS = [{ key: 'queue', label: 'Hồ sơ chờ duyệt' }, { key: 'shops', label: 'Tất cả quán' }];
const DETAIL_TABS = [{ key: 'information', label: 'Thông tin' }, { key: 'history', label: 'Lịch sử' }];
const EVENT_LABELS = { submitted: 'Nộp hồ sơ', accepted: 'Duyệt hồ sơ', rejected: 'Từ chối hồ sơ', locked: 'Khóa quán', unlocked: 'Mở khóa quán' };
const OPERATING_OPTIONS = [{ value: '', label: 'Tất cả trạng thái' }, ...Object.entries(SHOP_OPERATING_LABELS).map(([value, label]) => ({ value, label }))];
const SUBMISSION_OPTIONS = [{ value: '', label: 'Tất cả loại hồ sơ' }, ...Object.entries(SUBMISSION_LABELS).map(([value, label]) => ({ value, label }))];
const VERIFICATION_OPTIONS = [{ value: '', label: 'Tất cả trạng thái' }, { value: 'pending', label: 'Chờ xác minh' }, { value: 'verified', label: 'Đã xác minh' }, { value: 'rejected', label: 'Bị từ chối' }];

function ShopName({ name, status, disabled, onToggle }) {
  const locked = status === 'inactive';
  return <span className={styles.shopNameCell}>
    <IconButton size="sm" icon={locked ? 'lock-fill' : 'unlock-fill'}
      label={`${locked ? 'Mở khóa' : 'Khóa'} quán “${name}”`} disabled={disabled} onClick={onToggle}
      className={locked ? styles.lockedIcon : styles.activeIcon} />
    <span>{name}</span>
  </span>;
}

function HistoryPanel({ resource, onPageChange }) {
  if (resource.loading || (!resource.data && !resource.error)) return <Spinner showLabel />;
  if (resource.error) return <Notice tone="alert" action={{ label: 'Thử lại', onClick: resource.reload }}>{resource.error.message}</Notice>;
  return <div className={styles.history}>
    {!resource.data.items.length ? <Notice>Chưa có sự kiện được lưu cho quán này.</Notice>
      : <ol className={styles.historyList}>{resource.data.items.map(event => <li key={event.eventId}>
        <div className={styles.eventHeader}><b>{EVENT_LABELS[event.eventType] || 'Sự kiện'}</b><time dateTime={event.occurredAt}>{shopDate(event.occurredAt)}</time></div>
        <p>Người thực hiện: {event.actorName || 'Chưa có thông tin'}</p>
        {event.submissionId && <p>{SUBMISSION_LABELS[event.submissionType]} · Hồ sơ #{event.submissionId}</p>}
        {event.fromStatus && event.toStatus && <p>{SHOP_OPERATING_LABELS[event.fromStatus]} → {SHOP_OPERATING_LABELS[event.toStatus]}</p>}
        {event.note && <p className={styles.eventNote}>{event.note}</p>}
      </li>)}</ol>}
    <Pagination page={resource.data.page} pageSize={resource.data.pageSize} totalPages={resource.data.totalPages} totalItems={resource.data.total} itemLabel="sự kiện" onChange={onPageChange} />
  </div>;
}

export default function ShopVerifyPage() {
  const { user, logout, isCheckingSession } = useAuth();
  const admin = !isCheckingSession && user?.role === 'admin';
  const [listTab, setListTab] = useState('queue');
  const [queuePage, setQueuePage] = useState(1);
  const [shopsPage, setShopsPage] = useState(1);
  const [queueFilters, setQueueFilters] = useState({ q: '', submissionType: '', operatingStatus: '' });
  const [shopFilters, setShopFilters] = useState({ q: '', verificationStatus: '', operatingStatus: '' });
  const [searchDrafts, setSearchDrafts] = useState({ queue: '', shops: '' });
  const [selected, setSelected] = useState(null);
  const [detailTab, setDetailTab] = useState('information');
  const [historyPage, setHistoryPage] = useState(1);
  const [decision, setDecision] = useState(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState(null);
  const [message, setMessage] = useState(null);
  const inFlight = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const selectionId = selected?.id;
  const selectionKind = selected?.kind;
  const loadQueue = useCallback(signal => shopVerificationService.list(queuePage, signal, queueFilters), [queuePage, queueFilters]);
  const loadShops = useCallback(signal => shopVerificationService.listShops(shopsPage, signal, shopFilters), [shopsPage, shopFilters]);
  const loadDetail = useCallback(signal => selectionKind === 'submission'
    ? shopVerificationService.detail(selectionId, signal) : shopVerificationService.shopDetail(selectionId, signal), [selectionKind, selectionId]);
  const queue = useShopResource(loadQueue, admin && listTab === 'queue');
  const shops = useShopResource(loadShops, admin && listTab === 'shops');
  const detail = useShopResource(loadDetail, admin && Boolean(selectionId));
  const shop = detail.data?.shop;
  const detailMatches = !detail.loading && !detail.error && Boolean(shop) && (selectionKind === 'shop'
    ? shop.shopId === selectionId : detail.data?.submission?.submissionId === selectionId);
  const submission = detailMatches ? (selectionKind === 'submission' ? detail.data.submission : detail.data.pendingSubmission) : null;
  const canDecide = detailMatches && submission?.status === 'pending';
  const shopId = detailMatches ? shop.shopId : null;
  const loadHistory = useCallback(signal => shopVerificationService.history(shopId, historyPage, signal), [shopId, historyPage]);
  const history = useShopResource(loadHistory, admin && Boolean(shopId) && detailTab === 'history');
  const list = listTab === 'queue' ? queue : shops;
  const filters = listTab === 'queue' ? queueFilters : shopFilters;
  const updateFilter = (key, value) => {
    if (listTab === 'queue') { setQueuePage(1); setQueueFilters(current => ({ ...current, [key]: value })); }
    else { setShopsPage(1); setShopFilters(current => ({ ...current, [key]: value })); }
  };
  const search = value => updateFilter('q', value.trim());
  const resetFilters = () => {
    setSearchDrafts(current => ({ ...current, [listTab]: '' }));
    if (listTab === 'queue') { setQueuePage(1); setQueueFilters({ q: '', submissionType: '', operatingStatus: '' }); }
    else { setShopsPage(1); setShopFilters({ q: '', verificationStatus: '', operatingStatus: '' }); }
  };
  const openDetail = (kind, id) => {
    if (inFlight.current) return;
    setFailure(null); setMessage(null); setDecision(null); setDetailTab('information'); setHistoryPage(1); setSelected({ kind, id });
  };
  const reloadLists = () => { queue.reload(); shops.reload(); };
  const refreshDetail = () => { detail.reload(); history.reload(); reloadLists(); };
  const openOperatingDecision = async targetId => {
    if (!admin || inFlight.current) return;
    inFlight.current = true; setSaving(true); setFailure(null); setMessage(null);
    try {
      const result = await shopVerificationService.shopDetail(targetId);
      if (alive.current) setDecision({ kind: 'status', id: result.shop.shopId, name: result.shop.name,
        version: result.shop.version, status: result.shop.status === 'inactive' ? 'active' : 'inactive' });
    } catch (error) {
      if (alive.current) setFailure(error);
    } finally {
      inFlight.current = false;
      if (alive.current) setSaving(false);
    }
  };
  const confirm = async reason => {
    if (!decision || inFlight.current || !admin) return;
    if (decision.kind === 'review' && (!detailMatches || !canDecide || decision.id !== submission.submissionId)) return;
    inFlight.current = true; setSaving(true); setFailure(null);
    try {
      const result = decision.kind === 'review'
        ? await shopVerificationService.decide(decision.id, decision.action, reason)
        : await shopVerificationService.setStatus(decision.id, decision.status, decision.version, reason);
      if (alive.current) {
        setMessage({ createdAt: Date.now(), tone: decision.kind === 'review' ? 'success'
          : result.unchanged ? 'info' : decision.status === 'inactive' ? 'alert' : 'success',
          text: decision.kind === 'review' ? decision.action === 'reject' ? 'Đã từ chối hồ sơ thành công và gửi lý do cho chủ quán.' : 'Đã duyệt hồ sơ thành công và gửi thông báo cho chủ quán.'
            : result.unchanged ? 'Trạng thái quán không thay đổi.' : decision.status === 'inactive' ? 'Đã khóa quán và lưu lý do cho chủ quán.' : 'Đã mở khóa quán.' });
        setDecision(null); refreshDetail();
      }
    } catch (error) {
      if (alive.current) {
        setFailure(error);
        if (error.status === 409) { setDecision(null); refreshDetail(); }
      }
    } finally { inFlight.current = false; if (alive.current) setSaving(false); }
  };
  const queueColumns = [
    { key: 'shopName', header: 'Quán', primary: true, render: row => <ShopName name={row.shopName} status={row.shopStatus}
      disabled={saving} onToggle={() => openOperatingDecision(row.shopId)} /> },
    { key: 'submissionType', header: 'Loại hồ sơ', render: row => SUBMISSION_LABELS[row.submissionType] },
    { key: 'ownerName', header: 'Chủ quán', render: row => row.ownerName || row.ownerEmail },
    { key: 'submittedAt', header: 'Ngày gửi', render: row => shopDate(row.submittedAt) },
    { key: 'actions', header: 'Chi tiết', align: 'right', render: row => <Button size="sm" variant="outline" disabled={saving} onClick={() => openDetail('submission', row.submissionId)}>Xem hồ sơ</Button> },
  ];
  const shopColumns = [
    { key: 'name', header: 'Quán', primary: true, render: row => <ShopName name={row.name} status={row.status}
      disabled={saving} onToggle={() => openOperatingDecision(row.shopId)} /> },
    { key: 'ownerName', header: 'Chủ quán', render: row => row.ownerName || row.ownerEmail },
    { key: 'verificationStatus', header: 'Xác minh', render: row => <StatusBadge entity="shop" status={row.verificationStatus} /> },
    { key: 'actions', header: 'Chi tiết', align: 'right', render: row => <Button size="sm" variant="outline" disabled={saving} onClick={() => openDetail('shop', row.shopId)}>Xem quán</Button> },
  ];
  const reviewDecision = decision?.kind === 'review';
  const accepting = reviewDecision && decision.action === 'accept';
  const identity = reviewDecision && decision.type === 'identity_edit';
  const unlocking = decision?.kind === 'status' && decision.status === 'active';
  const closeDetail = () => { if (!inFlight.current) { setSelected(null); setDecision(null); setFailure(null); } };
  return <AdminLayout activeKey="shops" title="Xác minh quán" user={user} onLogout={() => { logout(); window.location.assign('/'); }}>
    <div className={styles.page}>
      <PageHeader title="Xác minh và quản lý quán" description="Xét hồ sơ, quản lý trạng thái hoạt động và xem lịch sử quán."
        actions={<Button variant="outline" icon="arrow-clockwise" disabled={saving || list.loading} onClick={reloadLists}>Tải lại</Button>} />
      {isCheckingSession ? <Spinner showLabel /> : !admin ? <Notice tone="alert">Chỉ quản trị viên được truy cập trang xác minh quán.</Notice> : <>
        {!selected && <ShopOperationNotice message={message} onDismiss={() => setMessage(null)} />}
        {failure && !selected && <Notice tone="alert" onDismiss={() => setFailure(null)}>{failure.message}</Notice>}
        <Tabs items={LIST_TABS} value={listTab} onChange={setListTab} label="Danh sách quản trị quán" />
        <div className={styles.filters}>
          <div className={styles.search}><SearchInput value={searchDrafts[listTab]} maxLength={200} label="Tìm quán hoặc chủ quán" placeholder="Tên quán, địa chỉ, chủ quán…"
            onChange={value => setSearchDrafts(current => ({ ...current, [listTab]: value }))} onSearch={search} loading={list.loading} />
            <Button variant="outline" icon="search" onClick={() => search(searchDrafts[listTab])}>Tìm</Button></div>
          {listTab === 'queue' ? <Select label="Loại hồ sơ" options={SUBMISSION_OPTIONS} value={filters.submissionType} onChange={value => updateFilter('submissionType', value)} />
            : <Select label="Xác minh" options={VERIFICATION_OPTIONS} value={filters.verificationStatus} onChange={value => updateFilter('verificationStatus', value)} />}
          <Select label="Hoạt động" options={OPERATING_OPTIONS} value={filters.operatingStatus} onChange={value => updateFilter('operatingStatus', value)} />
          <Button variant="subtle" onClick={resetFilters}>Xóa bộ lọc</Button>
        </div>
        {list.error ? <Notice tone="alert" action={{ label: 'Thử lại', onClick: list.reload }}>{list.error.message}</Notice> : <DataTable
          columns={listTab === 'queue' ? queueColumns : shopColumns} rows={list.data?.items || []} rowKey={listTab === 'queue' ? 'submissionId' : 'shopId'}
          loading={list.loading || !list.data} caption={listTab === 'queue' ? 'Hồ sơ quán đang chờ xác minh' : 'Danh sách tất cả quán'}
          empty={{ title: Object.values(filters).some(Boolean) ? 'Không có kết quả phù hợp' : listTab === 'queue' ? 'Không có hồ sơ chờ duyệt' : 'Chưa có quán đăng ký' }}
          footer={list.data && <Pagination page={list.data.page} pageSize={list.data.pageSize} totalPages={list.data.totalPages} totalItems={list.data.total} itemLabel={listTab === 'queue' ? 'hồ sơ' : 'quán'} onChange={listTab === 'queue' ? setQueuePage : setShopsPage} />} />}
      </>}
    </div>
    <Modal open={Boolean(selected) && admin} onClose={closeDetail} title="Chi tiết quán" size="lg" dismissible={!saving}
      footer={canDecide && <>
        <Button variant="alert" disabled={saving} onClick={() => { setFailure(null); setDecision({ kind: 'review', id: submission.submissionId, type: submission.submissionType, action: 'reject' }); }}>Từ chối</Button>
        <Button disabled={saving} onClick={() => { setFailure(null); setDecision({ kind: 'review', id: submission.submissionId, type: submission.submissionType, action: 'accept' }); }}>Duyệt hồ sơ</Button>
      </>}>
      <div className={styles.detail}>
        {detailMatches && <header><h2 className={styles.shopName}><ShopName name={shop.name} status={shop.status}
          disabled={saving} onToggle={() => openOperatingDecision(shop.shopId)} /></h2>
          <div className={styles.shopState}><span>Xác minh quán:</span><StatusBadge entity="shop" status={shop.verificationStatus} /></div>
        </header>}
        <ShopOperationNotice message={message} onDismiss={() => setMessage(null)} />
        {failure && !decision && <Notice tone="alert" onDismiss={() => setFailure(null)}>{failure.message}</Notice>}
        {detail.loading || (!detail.data && !detail.error) || (!detail.error && !detailMatches) ? <Spinner showLabel />
          : detail.error ? <Notice tone="alert" action={{ label: 'Thử lại', onClick: detail.reload }}>{detail.error.message}</Notice>
            : <>
            <Tabs items={DETAIL_TABS} value={detailTab} onChange={setDetailTab} label="Chi tiết quán" />
            {detailTab === 'history' ? <HistoryPanel resource={history} onPageChange={setHistoryPage} /> : <>
              <dl className={styles.metadata}>
                <div><dt>Mã quán</dt><dd>#{shop.shopId}</dd></div>
                <div><dt>Chủ quán</dt><dd>{shop.ownerName || submission?.ownerName || shop.ownerEmail || submission?.ownerEmail || 'Chưa có thông tin'}</dd></div>
                {submission && <>
                  <div><dt>Loại hồ sơ</dt><dd>{SUBMISSION_LABELS[submission.submissionType]}</dd></div>
                  <div><dt>Mã hồ sơ</dt><dd>#{submission.submissionId}</dd></div>
                  <div><dt>Ngày gửi</dt><dd>{shopDate(submission.submittedAt)}</dd></div>
                  <div><dt>Trạng thái hồ sơ</dt><dd><ShopSubmissionStatus status={submission.status} /></dd></div>
                </>}
              </dl>
              {shop.status === 'inactive' && <Notice tone="alert" className={styles.operatingNotice} title="Quán đang tạm ngưng hoạt động">
                <p className={styles.operatingReason}>{detail.data.operatingDecision?.status === 'inactive' && detail.data.operatingDecision.reason?.trim()
                  ? detail.data.operatingDecision.reason.trim() : 'Quản trị viên chưa cung cấp lý do.'}</p>
                {detail.data.operatingDecision?.status === 'inactive' && <p className={styles.operatingMeta}>
                  {detail.data.operatingDecision.adminName || 'Quản trị viên'} · {shopDate(detail.data.operatingDecision.occurredAt)}
                </p>}
                Hồ sơ chờ duyệt vẫn có thể được xử lý; quyết định duyệt hoặc từ chối giữ nguyên trạng thái khóa.
              </Notice>}
              {submission?.submissionType === 'identity_edit' ? <section><h3 className={styles.title}>Các thay đổi đề nghị</h3>
                <ShopIdentityComparison beforeValue={submission.beforeValue} afterValue={submission.afterValue} status={submission.status} />
              </section> : <section><h3 className={styles.title}>{submission ? 'Hồ sơ đã gửi' : 'Thông tin hiện tại'}</h3>
                <ShopSnapshot value={submission?.afterValue || shop} />
                {!submission && shop.scheduleIncomplete && <Notice>Lịch mở cửa hiện tại chưa đầy đủ.</Notice>}
              </section>}
              {submission?.status === 'rejected' && submission.reviewNote?.trim() && <p className={styles.rejectionNote} role="note">
                <i className="bi bi-exclamation-triangle" aria-hidden="true" />
                <span><strong>Lý do từ chối: </strong>{submission.reviewNote.trim()}</span>
              </p>}
              {!submission && detail.data.latestSubmission?.status === 'rejected' && detail.data.latestSubmission.reviewNote?.trim()
                && <p className={styles.rejectionNote} role="note">
                  <i className="bi bi-exclamation-triangle" aria-hidden="true" />
                  <span><strong>Lý do từ chối hồ sơ gần nhất: </strong>{detail.data.latestSubmission.reviewNote.trim()}</span>
                </p>}
            </>}
            </>}
      </div>
    </Modal>
    <ConfirmDialog open={Boolean(decision) && admin} loading={saving} tone={accepting || unlocking ? 'primary' : 'alert'} cancelLabel="Hủy"
      title={reviewDecision ? (accepting ? 'Duyệt ' : 'Từ chối ') + (identity ? 'yêu cầu sửa thông tin?' : 'đăng ký quán?')
        : (unlocking ? 'Mở khóa ' : 'Khóa ') + '“' + (decision?.name || '') + '”?'}
      confirmLabel={reviewDecision ? accepting ? 'Duyệt hồ sơ' : 'Từ chối hồ sơ' : unlocking ? 'Mở khóa quán' : 'Khóa quán'}
      reason={reviewDecision ? !accepting ? { label: 'Lý do từ chối', required: true } : undefined
        : decision?.kind === 'status' ? { label: unlocking ? 'Lý do mở khóa (không bắt buộc)' : 'Lý do khóa quán', required: !unlocking } : undefined}
      message={<>{reviewDecision ? identity ? 'Quyết định này xử lý yêu cầu sửa; quán vẫn được xác minh. Trạng thái mở/khóa được giữ nguyên.'
        : 'Kết quả sẽ được gửi cho chủ quán. Trạng thái mở/khóa được giữ nguyên.'
        : unlocking ? 'Chủ quán được thao tác theo trạng thái xác minh hiện tại. Mở khóa không tự xác minh quán.'
          : 'Chủ quán chỉ được xem hồ sơ, lịch và menu. Quán đã xác minh vẫn hiển thị công khai với nhãn “Tạm ngưng hoạt động”. Hồ sơ chờ duyệt được giữ nguyên.'}
        {failure && <span role="alert" className="d-block mt-3">{failure.message}</span>}</>}
      onConfirm={confirm} onCancel={() => { if (!inFlight.current) { setDecision(null); setFailure(null); } }} />
  </AdminLayout>;
}
