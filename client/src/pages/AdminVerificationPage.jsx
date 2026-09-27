import { useEffect, useRef, useState } from 'react';
import {
  AdminLayout, Button, ConfirmDialog, DataTable, Modal, Notice,
  PageHeader, Pagination, SearchInput, Spinner, StatusBadge, Tabs, useToast,
} from '../components';
import {
  clearAdminAccessToken, getAdminAccessToken, getShopById,
  getShopsForVerification, saveAdminAccessToken, updateShopVerification,
} from '../services/shop.service';
import styles from './AdminVerificationPage.module.css';

const pageSize = 10;
const statusTabs = [
  { key: 'pending', label: 'Chờ xác minh', icon: 'hourglass-split' },
  { key: 'verified', label: 'Đã xác minh', icon: 'patch-check' },
  { key: 'rejected', label: 'Đã từ chối', icon: 'x-circle' },
];
function formatDateTime(value) {
  if (!value) return 'Chưa có';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa có';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
function displayValue(value) {
  return value === null || value === undefined || value === '' ? 'Chưa cung cấp' : value;
}

// Khối chi tiết chỉ nhận props, không tự gọi API.
function ShopDetails({ shop }) {
  const fields = [
    ['Tên quán', shop.name], ['Địa chỉ', shop.address], ['Điện thoại', shop.phone],
    ['Giờ mở cửa', shop.open_time?.slice(0, 5)], ['Giờ đóng cửa', shop.close_time?.slice(0, 5)],
    ['Ngày hoạt động', shop.open_days], ['Chủ quán', shop.owner_name], ['Email chủ quán', shop.owner_email],
    ['Ngày đăng ký', formatDateTime(shop.created_at)],
    ['Trạng thái hoạt động', { active: 'Đang hoạt động', inactive: 'Ngừng hoạt động', renovating: 'Đang sửa chữa' }[shop.status] || shop.status],
  ];
  return <div className={styles.detailContent}>
    <div className={styles.detailHeading}>
      <span className={styles.shopIcon}><i className="bi bi-shop" aria-hidden="true" /></span>
      <div><h3>{shop.name}</h3><StatusBadge entity="shop" status={shop.verification_status} /></div>
    </div>
    <dl className={styles.detailGrid}>{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{displayValue(value)}</dd></div>)}</dl>
    {shop.verification_status !== 'pending' && <section className={styles.resultBox} aria-label="Kết quả xác minh">
      <h3>Kết quả xử lý</h3>
      <dl className={styles.detailGrid}>
        <div><dt>Người xử lý</dt><dd>{displayValue(shop.verifier_name)}</dd></div>
        <div><dt>Thời điểm xử lý</dt><dd>{formatDateTime(shop.verified_at)}</dd></div>
        <div className={styles.fullWidth}><dt>Ghi chú</dt><dd>{displayValue(shop.verification_note)}</dd></div>
      </dl>
    </section>}
  </div>;
}

export default function AdminVerificationPage() {
  const toast = useToast();
  const [verificationStatus, setVerificationStatus] = useState('pending');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [shops, setShops] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [selectedShopId, setSelectedShopId] = useState(null);
  const [selectedShop, setSelectedShop] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [detailVersion, setDetailVersion] = useState(0);
  const [decision, setDecision] = useState(null);
  const [saving, setSaving] = useState(false);
  const [decisionError, setDecisionError] = useState('');
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenInputError, setTokenInputError] = useState('');
  // Chặn gửi lặp trước khi React kịp cập nhật state loading.
  const savingReference = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    async function loadShops() {
      setListLoading(true);
      setListError(null);
      try {
        const result = await getShopsForVerification({ verificationStatus, search, page, limit: pageSize, signal: controller.signal });
        if (controller.signal.aborted) return;
        // Duyệt dòng cuối của trang: trở về trang còn dữ liệu.
        if (page > Math.max(1, result.pagination.totalPages)) {
          setPage(Math.max(1, result.pagination.totalPages));
          return;
        }
        setShops(result.shops);
        setPagination(result.pagination);
      } catch (error) {
        if (controller.signal.aborted) return;
        setShops([]);
        setPagination({ total: 0, totalPages: 0 });
        setListError(error);
      } finally {
        if (!controller.signal.aborted) setListLoading(false);
      }
    }
    loadShops();
    // Hủy request cũ để không ghi đè kết quả của bộ lọc mới.
    return () => controller.abort();
  }, [verificationStatus, search, page, reloadVersion]);

  useEffect(() => {
    if (selectedShopId === null) return;
    const controller = new AbortController();
    async function loadDetail() {
      setDetailLoading(true);
      setSelectedShop(null);
      setDetailError(null);
      try {
        const shop = await getShopById(selectedShopId, { signal: controller.signal });
        if (!controller.signal.aborted) setSelectedShop(shop);
      } catch (error) {
        if (!controller.signal.aborted) setDetailError(error);
      } finally {
        if (!controller.signal.aborted) setDetailLoading(false);
      }
    }
    loadDetail();
    return () => controller.abort();
  }, [selectedShopId, detailVersion]);

  // Thay đổi phiên bản tải để effect gọi API lại với bộ lọc hiện tại.
  function refreshList() {
    setReloadVersion((value) => value + 1);
  }

  function changeStatus(status) {
    setVerificationStatus(status);
    setPage(1);
  }

  // Chỉ tìm khi nhấn Enter hoặc nút xóa; không gọi API mỗi lần gõ.
  function submitSearch(value) {
    setSearch(value.trim());
    setPage(1);
    refreshList();
  }
  function closeDetail() {
    if (savingReference.current) return;
    setSelectedShopId(null);
    setSelectedShop(null);
    setDecision(null);
    setDecisionError('');
  }
  function startDecision(status) {
    setDecisionError('');
    setDecision(status);
  }

  async function confirmDecision(reason = '') {
    if (savingReference.current || !selectedShop || !decision) return;
    const note = reason.trim();
    if (decision === 'rejected' && !note) {
      setDecisionError('Vui lòng nhập lý do từ chối.');
      return;
    }
    if (Array.from(note).length > 255) {
      setDecisionError('Lý do không được vượt quá 255 ký tự.');
      return;
    }
    savingReference.current = true;
    setSaving(true);
    setDecisionError('');
    try {
      const result = await updateShopVerification({ shopId: selectedShop.shop_id, verificationStatus: decision, verificationNote: note });
      setDecision(null);
      setSelectedShopId(null);
      setSelectedShop(null);
      toast(result.message);
      refreshList();
    } catch (error) {
      if (error.status === 409) {
        setDecision(null);
        setDetailVersion((value) => value + 1);
        refreshList();
        toast(error.message, { tone: 'alert' });
      } else {
        // Giữ lý do đã nhập để người dùng có thể thử lại.
        setDecisionError(error.message);
      }
    } finally {
      savingReference.current = false;
      setSaving(false);
    }
  }

  function saveTemporaryToken(event) {
    event.preventDefault();
    const token = tokenInput.trim();
    if (!token || /\s/.test(token) || token.split('.').length !== 3) {
      setTokenInputError('Nhập JWT nguyên bản, không thêm chữ Bearer hoặc khoảng trắng.');
      return;
    }
    saveAdminAccessToken(token);
    setTokenInput('');
    setTokenInputError('');
    setTokenDialogOpen(false);
    closeDetail();
    setPage(1);
    refreshList();
    toast('Đã cập nhật token. Đang kiểm tra phiên Admin.', { tone: 'info' });
  }

  const columns = [
    { key: 'name', header: 'Tên quán', primary: true, render: (shop) => <div className={styles.shopName}><b>{shop.name}</b><small>Mã quán #{shop.shop_id}</small></div> },
    { key: 'address', header: 'Địa chỉ', render: (shop) => <span className={styles.address}>{shop.address}</span> },
    { key: 'owner_name', header: 'Chủ quán', render: (shop) => <div className={styles.owner}><span>{shop.owner_name || 'Chưa cung cấp'}</span><small>{shop.owner_email}</small></div> },
    { key: 'created_at', header: 'Ngày đăng ký', render: (shop) => formatDateTime(shop.created_at) },
    { key: 'verification_status', header: 'Trạng thái', render: (shop) => <StatusBadge entity="shop" status={shop.verification_status} size="sm" /> },
    { key: 'actions', header: 'Thao tác', align: 'right', render: (shop) => <Button size="sm" variant="outline" icon="eye" onClick={() => { setSelectedShop(null); setDetailError(null); setDetailLoading(true); setSelectedShopId(String(shop.shop_id)); }}>Xem chi tiết</Button> },
  ];
  const nav = [
    { key: 'verification', label: 'Xác minh quán', icon: 'patch-check', href: '/admin/verification' },
    { divider: true },
    { key: 'kit', label: 'Bộ giao diện', icon: 'palette', href: '/kit' },
  ];

  return <AdminLayout nav={nav} activeKey="verification" title="Xác minh quán">
    <div className={styles.page}>
      <PageHeader title="Xác minh quán chay" description="Xem thông tin đăng ký và xác minh từng quán trước khi hiển thị công khai."
        actions={<Button variant="outline" icon="arrow-clockwise" onClick={refreshList} disabled={listLoading}>Làm mới</Button>} />
      {import.meta.env.DEV && <div className={styles.sessionBar}>
        <span><i className="bi bi-shield-lock" aria-hidden="true" /> Phiên Admin tạm</span>
        <div><Button size="sm" variant="subtle" icon="key" onClick={() => { setTokenInput(''); setTokenInputError(''); setTokenDialogOpen(true); }}>Nhập token</Button>
          {getAdminAccessToken() && <Button size="sm" variant="subtle" onClick={() => { clearAdminAccessToken(); closeDetail(); refreshList(); }}>Xóa phiên</Button>}</div>
      </div>}
      <Notice title="Chỉ quán đã xác minh mới hiển thị công khai">Mỗi quyết định được ghi lịch sử quản trị và gửi thông báo đến chủ quán. Quán đã xử lý chỉ được xem lại kết quả.</Notice>
      <section className={styles.listSection} aria-label="Danh sách quán đăng ký">
        <Tabs items={statusTabs} value={verificationStatus} onChange={changeStatus} label="Lọc trạng thái xác minh" />
        <div className={styles.toolbar}>
          <SearchInput className={styles.search} value={searchInput} onChange={setSearchInput} onSearch={submitSearch} maxLength={200} placeholder="Nhập tên quán và nhấn Enter…" label="Tìm theo tên quán" loading={listLoading} />
          <span className={styles.total} aria-live="polite">{listLoading ? 'Đang tải…' : `${pagination.total} quán`}</span>
        </div>
        {listError ? <div className={styles.errorBox}><Notice tone="alert" title="Không tải được danh sách" action={{ label: 'Thử lại', onClick: refreshList }}>{listError.message}</Notice></div> :
          <DataTable columns={columns} rows={shops} rowKey="shop_id" loading={listLoading} caption="Danh sách quán đăng ký cần xác minh"
            empty={{ icon: 'shop', title: search ? 'Không tìm thấy quán phù hợp' : 'Chưa có quán trong danh sách này', children: search ? 'Thử tên khác hoặc xóa từ khóa tìm kiếm.' : 'Các quán có trạng thái tương ứng sẽ xuất hiện tại đây.' }}
            footer={!listLoading && pagination.totalPages > 1 ? <Pagination page={page} totalPages={pagination.totalPages} totalItems={pagination.total} pageSize={pageSize} itemLabel="quán" onChange={setPage} /> : null} />}
      </section>
    </div>
    <Modal open={selectedShopId !== null && decision === null} onClose={closeDetail} title="Thông tin đăng ký quán" size="lg"
      footer={<><Button variant="subtle" onClick={closeDetail}>Đóng</Button>{!detailLoading && !detailError && selectedShop?.verification_status === 'pending' && <><Button variant="alert" icon="x-circle" onClick={() => startDecision('rejected')}>Từ chối</Button><Button icon="patch-check" onClick={() => startDecision('verified')}>Xác minh quán</Button></>}</>}>
      {detailLoading ? <div className={styles.loading}><Spinner /><span>Đang tải thông tin quán…</span></div> : detailError ? <Notice tone="alert" title="Không tải được chi tiết" action={{ label: 'Thử lại', onClick: () => setDetailVersion((value) => value + 1) }}>{detailError.message}</Notice> : selectedShop && <ShopDetails shop={selectedShop} />}
    </Modal>
    <ConfirmDialog open={decision !== null} title={decision === 'rejected' ? 'Từ chối đăng ký quán?' : 'Xác minh quán này?'}
      message={<><span>{decision === 'rejected' ? `Chủ quán "${selectedShop?.name || ''}" sẽ nhận được lý do từ chối.` : `Quán "${selectedShop?.name || ''}" sẽ được hiển thị công khai sau khi xác minh.`}</span>{decisionError && <span className={styles.decisionError} role="alert">{decisionError}</span>}</>}
      confirmLabel={decision === 'rejected' ? 'Từ chối đăng ký' : 'Xác minh quán'} tone={decision === 'rejected' ? 'alert' : 'primary'}
      reason={decision === 'rejected' ? { label: 'Lý do từ chối', required: true, placeholder: 'Nêu rõ thông tin chưa phù hợp để chủ quán biết.' } : false}
      loading={saving} onConfirm={confirmDecision} onCancel={() => { if (!savingReference.current) { setDecision(null); setDecisionError(''); } }} />
    {import.meta.env.DEV && <Modal open={tokenDialogOpen} onClose={() => { setTokenDialogOpen(false); setTokenInput(''); }} title="Phiên Admin tạm" description="Dùng token tạo từ script local trong thời gian chức năng đăng nhập chưa hoàn thiện."
      footer={<><Button variant="subtle" onClick={() => { setTokenDialogOpen(false); setTokenInput(''); }}>Hủy</Button><Button type="submit" form="admin-token-form">Sử dụng token</Button></>}>
      <form id="admin-token-form" onSubmit={saveTemporaryToken} className={styles.tokenForm}>
        <label htmlFor="admin-access-token" className="form-label">Access token</label>
        <input id="admin-access-token" type="password" className="form-control" value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} autoComplete="off" spellCheck={false} required aria-describedby="token-help" />
        <p id="token-help" className="form-text">Paste JWT nguyên bản, không thêm “Bearer”. Token chỉ lưu trong phiên của tab hiện tại.</p>
        {tokenInputError && <Notice tone="alert">{tokenInputError}</Notice>}
      </form>
    </Modal>}
  </AdminLayout>;
}
