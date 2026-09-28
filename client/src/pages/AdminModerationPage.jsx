import { useEffect, useRef, useState } from 'react';
import {
  AdminLayout, Avatar, Button, Checkbox, ConfirmDialog, DataTable, Notice,
  Modal, PageHeader, Pagination, Panel, SearchInput, Select, Skeleton,
  Tabs, formatDate, timeAgo, useToast,
} from '../components';
import { REPORT_REASON } from '../constants/domain';
import useAuth from '../hooks/useAuth';
import postModerationService from '../services/postModeration.service';
import AdminModerationDetails from './AdminModerationDetails';
import { PostModerationStatus, ReportModerationStatus } from './postModerationPresentation';
import styles from './AdminModerationPage.module.css';

const NAV = [
  { key: 'dashboard', label: 'Bảng điều khiển', icon: 'speedometer2', href: '/admin' },
  { key: 'moderation', label: 'Kiểm duyệt', icon: 'clipboard2-check', href: '/admin/moderation' },
  // Cùng danh sách điều hướng với dashboard của Lâm; không đổi code dashboard.
  { key: 'appeals', label: 'Khiếu nại', icon: 'envelope-paper', href: '/admin/appeals' },
  { key: 'accounts', label: 'Tài khoản', icon: 'people', href: '/admin/accounts' },
  { key: 'categories', label: 'Danh mục', icon: 'tags', href: '/admin/categories' },
  { divider: true },
  { key: 'site', label: 'Xem trang người dùng', icon: 'box-arrow-up-right', href: '/' },
];
const TABS = [
  { key: 'post', label: 'Duyệt bài viết', icon: 'journal-text' },
  { key: 'report', label: 'Báo cáo bài viết', icon: 'flag' },
];
const POST_STATUSES = [
  { value: 'pending', label: 'Chờ duyệt' }, { value: 'public', label: 'Công khai' },
  { value: 'deleted', label: 'Đã xóa' },
  { value: 'all', label: 'Tất cả trạng thái' },
];
const REPORT_STATUSES = [
  { value: 'pending', label: 'Chờ xử lý' }, { value: 'accepted', label: 'Đã chấp nhận gỡ bài' },
  { value: 'rejected', label: 'Đã từ chối gỡ bài' }, { value: 'all', label: 'Tất cả trạng thái' },
];
const POST_TYPES = [
  { value: 'all', label: 'Blog và Video' }, { value: 'blog', label: 'Blog' }, { value: 'video', label: 'Video' },
];
const EMPTY_LIST = { items: [], page: 1, totalPages: 1, totalItems: 0, pageSize: 20 };
const DECISIONS = {
  'post:approve': { title: 'Duyệt bài viết?', label: 'Duyệt bài', tone: 'primary',
    message: 'Bài sẽ được công khai. Tác giả nhận thông báo và thao tác được ghi vào nhật ký.' },
  'post:reject': { title: 'Từ chối bài viết?', label: 'Từ chối bài', tone: 'alert',
    message: 'Bài chuyển sang Đã xóa. Tác giả nhận lý do từ chối; dữ liệu và nhật ký được giữ lại.', reason: 'Lý do từ chối' },
  'report:accept': { title: 'Chấp nhận gỡ bài?', label: 'Chấp nhận gỡ bài', tone: 'alert',
    message: 'Chấp nhận gỡ bài theo báo cáo này: bài chuyển sang Đã xóa. Bài đã xóa được giữ nguyên. Quyết định được ghi vào nhật ký và gửi thông báo.', reason: 'Lý do chấp nhận gỡ bài' },
  'report:reject': { title: 'Từ chối gỡ bài?', label: 'Từ chối gỡ bài', tone: 'primary',
    message: 'Từ chối gỡ bài theo báo cáo này. Bài công khai tiếp tục hiển thị, kể cả khi còn báo cáo khác đang chờ xử lý. Bài đã xóa không tự khôi phục.', reason: 'Lý do từ chối gỡ bài' },
};

function readLocation() {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('type') === 'report' ? 'report' : 'post';
  const options = tab === 'post' ? POST_STATUSES : REPORT_STATUSES;
  const stale = params.get('stale') === '1';
  const status = !stale && options.some(item => item.value === params.get('status'))
    ? params.get('status') : 'pending';
  return { tab, status, postType: 'all', search: '', page: 1, stale };
}

export default function AdminModerationPage() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === 'admin';
  const [query, setQuery] = useState(readLocation);
  const [searchInput, setSearchInput] = useState('');
  const [list, setList] = useState(EMPTY_LIST);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [detailReload, setDetailReload] = useState(0);
  const [decision, setDecision] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState(null);
  const saveInFlight = useRef(false);
  const pageAlive = useRef(true);

  useEffect(() => {
    pageAlive.current = true;
    return () => { pageAlive.current = false; };
  }, []);

  useEffect(() => {
    if (!isAdmin) return undefined;
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    const fetchList = query.tab === 'post' ? postModerationService.listPosts : postModerationService.listReports;
    fetchList(query, controller.signal)
      .then(data => { if (active) setList(data); })
      .catch(err => { if (active && err.name !== 'AbortError') setError(err); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [query, reload, isAdmin]);

  useEffect(() => {
    if (!selected || !isAdmin) return undefined;
    const controller = new AbortController();
    let active = true;
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    const fetchDetail = selected.entity === 'post' ? postModerationService.getPost : postModerationService.getReport;
    fetchDetail(selected.id, controller.signal)
      .then(data => { if (active) setDetail(data); })
      .catch(err => { if (active && err.name !== 'AbortError') setDetailError(err); })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [selected, detailReload, isAdmin]);

  const changeFilters = (patch) => setQuery(current => ({ ...current, ...patch, page: 1 }));
  const changeTab = (tab) => {
    setSearchInput('');
    setSelected(null);
    setQuery({ tab, status: 'pending', postType: 'all', search: '', page: 1, stale: false });
    const params = new URLSearchParams({ type: tab });
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`);
  };
  const openDetail = (row) => {
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    setSelected({ entity: query.tab, id: row.id });
  };
  const openDecision = (action) => {
    setActionError(null);
    setDecision({ entity: selected.entity, id: selected.id, action });
  };

  const confirmDecision = async (note) => {
    if (!decision || saveInFlight.current) return;
    saveInFlight.current = true;
    setSaving(true);
    setActionError(null);
    try {
      const save = decision.entity === 'post' ? postModerationService.decidePost : postModerationService.decideReport;
      const result = await save(decision.id, decision.action, note);
      if (!pageAlive.current) return;
      let message = decision.entity === 'post'
        ? (decision.action === 'approve' ? 'Đã duyệt bài viết.' : 'Đã từ chối bài viết; bài chuyển sang Đã xóa.')
        : (decision.action === 'accept' ? 'Đã chấp nhận gỡ bài; bài ở trạng thái Đã xóa.' : 'Đã từ chối gỡ bài theo báo cáo này.');
      if (decision.entity === 'report' && decision.action === 'reject') {
        if (result.postStatus === 'deleted') message += ' Bài đã xóa được giữ nguyên.';
        else if (result.postStatus === 'reported') message += ' Bài vẫn công khai và giữ trạng thái có báo cáo.';
        else if (result.postStatus === 'public') message += ' Bài tiếp tục công khai.';
        else if (result.postStatus === 'pending') message += ' Bài vẫn chờ duyệt.';
        else if (result.postStatus === null) message += ' Bài không còn tồn tại.';
      }
      toast(message);
      setDecision(null);
      setSelected(null);
      setDetail(null);
      setReload(value => value + 1);
    } catch (err) {
      if (!pageAlive.current) return;
      if (err.status === 409) {
        toast(err.message, { tone: 'info' });
        setDecision(null);
        setDetailReload(value => value + 1);
        setReload(value => value + 1);
      } else {
        // Giữ ConfirmDialog mở để lý do vừa nhập không bị mất khi request lỗi.
        setActionError(err.message || 'Không thể lưu quyết định. Vui lòng thử lại.');
      }
    } finally {
      saveInFlight.current = false;
      if (pageAlive.current) setSaving(false);
    }
  };

  if (!isAdmin) return <Notice tone="alert" title="Không có quyền quản trị">Chỉ Admin được truy cập trang này.</Notice>;

  const post = selected?.entity === 'report' ? detail?.post : detail;
  const report = selected?.entity === 'report' ? detail?.report : null;
  const config = decision ? DECISIONS[`${decision.entity}:${decision.action}`] : null;
  const canDecide = !detailLoading && !detailError
    && (selected?.entity === 'post' ? post?.status === 'pending' : report?.status === 'pending');
  const canRemove = post && ['public', 'reported', 'deleted'].includes(post.status);
  const columns = query.tab === 'post' ? [
    { key: 'title', header: 'Bài viết', primary: true },
    { key: 'postType', header: 'Loại', render: row => row.postType === 'video' ? 'Video' : 'Blog', width: 85 },
    { key: 'authorName', header: 'Tác giả', render: row => (
      <span className={styles.metadata}><Avatar name={row.authorName || row.authorEmail} src={row.authorAvatarUrl} size={28} />
        {row.authorName || row.authorEmail}</span>
    ) },
    { key: 'status', header: 'Trạng thái', render: row => <PostModerationStatus status={row.status} /> },
    { key: 'createdAt', header: 'Ngày gửi', render: row => formatDate(row.createdAt) },
  ] : [
    { key: 'postTitle', header: 'Bài bị báo cáo', primary: true, render: row => row.postTitle || `Bài #${row.targetId} không còn tồn tại` },
    { key: 'reporterName', header: 'Người báo cáo', render: row => row.reporterName || row.reporterEmail },
    { key: 'reasonCode', header: 'Lý do', render: row => REPORT_REASON[row.reasonCode] || row.reasonCode },
    { key: 'status', header: 'Quyết định gỡ bài', render: row => <ReportModerationStatus status={row.status} /> },
    { key: 'createdAt', header: 'Ngày báo cáo', render: row => formatDate(row.createdAt) },
  ];
  columns.push(
    { key: 'waiting', header: 'Thời gian chờ', hideOnMobile: true, render: row => row.status === 'pending'
      ? <span className={Date.now() - new Date(row.createdAt).getTime() > 48 * 3600000 ? 'text-danger' : undefined}>{timeAgo(row.createdAt)}</span>
      : 'Đã xử lý' },
    { key: 'actions', header: 'Thao tác', align: 'right', render: row => (
      <Button size="sm" variant="outline" icon="eye" onClick={() => openDetail(row)}>Xem chi tiết</Button>
    ) },
  );

  return (
    <AdminLayout nav={NAV} activeKey="moderation" title="Quản lý bài viết"
      user={{ name: user.fullName || user.email, avatarUrl: user.avatarUrl }}
      accountMenu={[{ icon: 'box-arrow-right', label: 'Đăng xuất', tone: 'alert', onClick: logout }]}>
      <PageHeader title="Quản lý bài viết" description="Duyệt bài blog/video và xử lý báo cáo vi phạm của bài viết."
        actions={<Button variant="outline" icon="arrow-clockwise" onClick={() => setReload(value => value + 1)} disabled={loading}>Tải lại</Button>} />
      <Tabs items={TABS} value={query.tab} onChange={changeTab} label="Chọn danh sách quản trị bài viết" />
      <Panel className="my-3" title="Bộ lọc" icon="funnel">
        <div className={styles.filters}>
          <div className={styles.search}>
            <SearchInput value={searchInput} onChange={setSearchInput}
              onSearch={search => changeFilters({ search })} maxLength={255}
              placeholder={query.tab === 'post' ? 'Tiêu đề, tác giả — nhấn Enter' : 'Tiêu đề, người báo cáo — nhấn Enter'} />
          </div>
          <Select label="Trạng thái" options={query.tab === 'post' ? POST_STATUSES : REPORT_STATUSES}
            value={query.status} onChange={status => changeFilters({ status, stale: false })} />
          <Select label="Loại bài" options={POST_TYPES} value={query.postType}
            onChange={postType => changeFilters({ postType })} />
        </div>
        <div className={styles.tools}>
          <Checkbox checked={query.stale} onChange={stale => changeFilters({ stale, ...(stale ? { status: 'pending' } : {}) })}>
            Chỉ mục chờ quá 48 giờ
          </Checkbox>
          <Button variant="subtle" size="sm" onClick={() => {
            setSearchInput('');
            changeFilters({ status: 'pending', postType: 'all', search: '', stale: false });
          }}>Đặt lại bộ lọc</Button>
        </div>
      </Panel>
      {error ? (
        <Notice tone="alert" title="Không tải được danh sách" action={{ label: 'Thử lại', onClick: () => setReload(value => value + 1) }}>
          {error.message}
        </Notice>
      ) : (
        <Panel flush title={`${query.tab === 'post' ? 'Bài viết' : 'Báo cáo bài viết'}${loading ? '' : ` · ${list.totalItems} mục`}`}>
          <DataTable columns={columns} rows={list.items} loading={loading}
            caption={query.tab === 'post' ? 'Danh sách bài viết để duyệt' : 'Danh sách báo cáo bài viết để xử lý'}
            empty={{ icon: 'check2-circle', title: 'Không có mục phù hợp', children: 'Đổi bộ lọc hoặc tải lại để xem dữ liệu mới.' }}
            footer={!loading && <Pagination page={list.page} totalPages={list.totalPages} totalItems={list.totalItems}
              pageSize={list.pageSize} onChange={page => setQuery(current => ({ ...current, page }))} />} />
        </Panel>
      )}

      <Modal open={Boolean(selected) && !decision} onClose={() => setSelected(null)} size="lg"
        title={selected?.entity === 'report' ? 'Chi tiết báo cáo bài viết' : 'Chi tiết bài viết'}
        footer={(
          <div className={styles.actions}>
            <Button variant="subtle" onClick={() => setSelected(null)}>Đóng</Button>
            {canDecide && selected.entity === 'post' && <>
              <Button variant="alert" icon="x-lg" onClick={() => openDecision('reject')}>Từ chối</Button>
              <Button icon="check-lg" onClick={() => openDecision('approve')}>Duyệt bài</Button>
            </>}
            {canDecide && selected.entity === 'report' && <>
              <Button variant="outline" onClick={() => openDecision('reject')}>Từ chối gỡ bài</Button>
              <Button variant="alert" disabled={!canRemove} onClick={() => openDecision('accept')}>Chấp nhận gỡ bài</Button>
            </>}
          </div>
        )}>
        {detailLoading ? <Skeleton lines={8} /> : detailError ? (
          <Notice tone="alert" title="Không tải được chi tiết" action={{ label: 'Thử lại', onClick: () => setDetailReload(value => value + 1) }}>
            {detailError.message}
          </Notice>
        ) : (post || report) && <>
          {report && !post && (
            <Notice tone="info" title="Bài viết không còn tồn tại">
              Báo cáo trỏ tới bài #{report.targetId}. Có thể từ chối gỡ bài để kết thúc báo cáo đang chờ xử lý; không thể chấp nhận gỡ bài.
            </Notice>
          )}
          {post && report?.status === 'pending' && !canRemove && (
            <Notice tone="info" title="Bài chưa xuất bản">Có thể từ chối gỡ bài theo báo cáo này; việc duyệt hoặc từ chối bài thực hiện ở tab Duyệt bài viết.</Notice>
          )}
          <AdminModerationDetails post={post} report={report} />
        </>}
      </Modal>

      <ConfirmDialog open={Boolean(decision)} title={config?.title} confirmLabel={config?.label}
        tone={config?.tone} loading={saving}
        reason={config?.reason ? { label: config.reason, required: true } : false}
        message={<>{config?.message}{actionError && <><br /><strong role="alert" className="text-danger">Chưa lưu được quyết định: {actionError}</strong></>}</>}
        onConfirm={confirmDecision} onCancel={() => { if (!saveInFlight.current) setDecision(null); }} />
    </AdminLayout>
  );
}
