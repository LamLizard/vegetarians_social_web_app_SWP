// Tung's code: Trang kiểm duyệt bài viết và nhóm báo cáo post/comment.
// Luồng: service gọi API cases -> chọn caseId -> xem mọi report -> quyết định
// cả nhóm -> tải lại danh sách. Tab duyệt bài vẫn dùng API posts hiện có.
import { useEffect, useRef, useState } from 'react';
import {
  AdminLayout, Avatar, Button, Checkbox, ConfirmDialog, DataTable, Notice,
  Modal, PageHeader, Pagination, Panel, SearchInput, Select, Skeleton,
  Tabs, formatDate, timeAgo, useToast,
} from '../components';
import useAuth from '../hooks/useAuth';
import postModerationService from '../services/postModeration.service';
import AdminModerationDetails from './AdminModerationDetails';
import { PostModerationStatus, ReportModerationStatus } from './postModerationPresentation';
import styles from './AdminModerationPage.module.css';

const TABS = [
  { key: 'post', label: 'Duyệt bài viết', icon: 'journal-text' },
  { key: 'report', label: 'Báo cáo bài viết', icon: 'flag' },
  // Tung's code: Giữ key report cho link dashboard; thêm tab comment riêng.
  { key: 'comment-report', label: 'Báo cáo bình luận', icon: 'chat-left-text' },
];
const POST_STATUSES = [
  { value: 'pending', label: 'Chờ duyệt' }, { value: 'public', label: 'Công khai' },
  { value: 'deleted', label: 'Đã xóa' },
  { value: 'all', label: 'Tất cả trạng thái' },
];
const REPORT_STATUSES = [
  { value: 'pending', label: 'Chờ xử lý' }, { value: 'accepted', label: 'Đã chấp nhận' },
  { value: 'rejected', label: 'Đã từ chối' }, { value: 'all', label: 'Tất cả trạng thái' },
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
    message: 'Chấp nhận toàn bộ báo cáo trong nhóm và gỡ bài. Bài đã xóa được giữ nguyên. Mỗi người báo cáo nhận kết quả xử lý.', reason: 'Lý do chấp nhận gỡ bài' },
  'report:reject': { title: 'Từ chối gỡ bài?', label: 'Từ chối gỡ bài', tone: 'primary',
    message: 'Từ chối toàn bộ báo cáo trong nhóm. Bài đang công khai tiếp tục hiển thị; bài đã xóa không tự khôi phục. Mỗi người báo cáo nhận kết quả xử lý.', reason: 'Lý do từ chối gỡ bài' },
  // Tung's code: Lời xác nhận đúng loại nội dung, tránh nhầm xóa comment với gỡ bài cha.
  'comment-report:accept': { title: 'Chấp nhận xóa bình luận?', label: 'Xóa bình luận', tone: 'alert',
    message: 'Chấp nhận toàn bộ báo cáo trong nhóm và xóa bình luận. Bài viết chứa bình luận được giữ nguyên. Mỗi người báo cáo nhận kết quả xử lý.', reason: 'Lý do xóa bình luận' },
  'comment-report:reject': { title: 'Từ chối xóa bình luận?', label: 'Từ chối xóa', tone: 'primary',
    message: 'Từ chối toàn bộ báo cáo trong nhóm, giữ nguyên trạng thái bình luận và gửi kết quả cho từng người báo cáo.', reason: 'Lý do từ chối xóa bình luận' },
};

function readLocation() {
  const params = new URLSearchParams(window.location.search);
  // Tung's code: Nhận đủ ba tab khi mở URL trực tiếp hoặc từ dashboard.
  const tab = TABS.some(item => item.key === params.get('type')) ? params.get('type') : 'post';
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
    // Tung's code: Chỉ tab duyệt bài đọc posts. Hai tab còn lại đọc case,
    // với targetType rõ ràng để backend lọc trước khi sắp xếp/phân trang.
    const fetchList = query.tab === 'post' ? postModerationService.listPosts
      : (filters, signal) => postModerationService.listCases({
        ...filters, targetType: query.tab === 'comment-report' ? 'comment' : 'post',
      }, signal);
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
    const fetchDetail = selected.entity === 'post' ? postModerationService.getPost : postModerationService.getCase;
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
    // Tung's code: Không dùng tên tab/reportId làm loại thực thể. Dòng báo cáo
    // luôn chứa caseId; targetType đi cùng để nút quyết định có đúng nhãn.
    setSelected(query.tab === 'post' ? { entity: 'post', id: row.id }
      : { entity: 'case', id: row.id, targetType: row.targetType });
  };
  const openDecision = (action) => {
    setActionError(null);
    setDecision({ ...selected, action });
  };

  const confirmDecision = async (note) => {
    if (!decision || saveInFlight.current) return;
    saveInFlight.current = true;
    setSaving(true);
    setActionError(null);
    try {
      // Tung's code: Một PATCH theo caseId xử lý cả nhóm; không lặp PATCH từng report.
      const save = decision.entity === 'post' ? postModerationService.decidePost : postModerationService.decideCase;
      const result = await save(decision.id, decision.action, note);
      if (!pageAlive.current) return;
      let message = decision.entity === 'post'
        ? (decision.action === 'approve' ? 'Đã duyệt bài viết.' : 'Đã từ chối bài viết; bài chuyển sang Đã xóa.')
        : decision.targetType === 'comment'
          ? (decision.action === 'accept' ? 'Đã xử lý nhóm báo cáo và xóa bình luận.' : 'Đã từ chối nhóm báo cáo; giữ nguyên trạng thái bình luận.')
          : (decision.action === 'accept' ? 'Đã xử lý nhóm báo cáo và gỡ bài.' : 'Đã từ chối gỡ bài theo nhóm báo cáo này.');
      if (decision.entity === 'case' && decision.targetType === 'post' && decision.action === 'reject') {
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
        // Tung's code: Admin khác đã xử lý hoặc dữ liệu đổi; tải lại cả detail
        // và list, không giữ nút quyết định dựa trên trạng thái pending cũ.
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

  // Tung's code: Case status quyết định quyền thao tác. Khi xem case comment,
  // post chỉ là bài cha; đối tượng cần xóa là comment, không phải post.
  const post = selected?.entity === 'case' ? detail?.post : detail;
  const reportCase = selected?.entity === 'case' ? detail?.case : null;
  const comment = selected?.entity === 'case' ? detail?.comment : null;
  const isCommentCase = selected?.targetType === 'comment';
  const target = isCommentCase ? comment : post;
  const decisionKey = decision?.entity === 'case'
    ? (decision.targetType === 'comment' ? 'comment-report' : 'report') : 'post';
  const config = decision ? DECISIONS[`${decisionKey}:${decision.action}`] : null;
  const canDecide = !detailLoading && !detailError
    && (selected?.entity === 'post' ? post?.status === 'pending' : reportCase?.status === 'pending');
  const canRemove = target && (isCommentCase ? ['public', 'hidden', 'deleted'] : ['public', 'reported', 'deleted']).includes(target.status);
  const handleLogout = () => { logout(); window.location.assign('/'); };
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
    // Tung's code: Một dòng đại diện cả case, không lấy một reporter/lý do
    // để đại diện nhóm. Mọi người gửi và lý do nằm trong modal chi tiết.
    { key: 'targetLabel', header: query.tab === 'comment-report' ? 'Bình luận bị báo cáo' : 'Bài bị báo cáo', primary: true,
      render: row => <div className={styles.targetCell}>
        <span>{row.targetLabel}</span>
        <small className={styles.muted}>Tác giả: {row.authorName || 'Không còn thông tin'}
          {row.targetType === 'comment' && <> · Bài viết: {row.postTitle || 'Không còn tồn tại'}</>}
        </small>
      </div> },
    { key: 'reportCount', header: 'Số báo cáo', width: 110 },
    { key: 'status', header: 'Trạng thái nhóm', render: row => <ReportModerationStatus status={row.status} targetType={row.targetType} /> },
    { key: 'latestReportAt', header: 'Báo cáo gần nhất', render: row => formatDate(row.latestReportAt) },
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
    <AdminLayout activeKey="moderation" title="Quản lý bài viết" user={user} onLogout={handleLogout}>
      <PageHeader title="Quản lý bài viết" description="Duyệt bài blog/video và xử lý nhóm báo cáo bài viết, bình luận."
        actions={<Button variant="outline" icon="arrow-clockwise" onClick={() => setReload(value => value + 1)} disabled={loading}>Tải lại</Button>} />
      <Tabs items={TABS} value={query.tab} onChange={changeTab} label="Chọn danh sách quản trị bài viết" />
      <Panel className="my-3" title="Bộ lọc" icon="funnel">
        <div className={styles.filters}>
          <div className={styles.search}>
            <SearchInput value={searchInput} onChange={setSearchInput}
              onSearch={search => changeFilters({ search })} maxLength={255}
              placeholder={query.tab === 'post' ? 'Tiêu đề, tác giả — nhấn Enter'
                : query.tab === 'comment-report' ? 'Bình luận, bài viết, người báo cáo' : 'Tiêu đề, người báo cáo — nhấn Enter'} />
          </div>
          <Select label="Trạng thái" options={query.tab === 'post' ? POST_STATUSES : REPORT_STATUSES}
            value={query.status} onChange={status => changeFilters({ status, stale: false })} />
          {/* Tung's code: Loại blog/video chỉ dùng ở tab bài viết và case post. */}
          {query.tab !== 'comment-report' && <Select label="Loại bài" options={POST_TYPES} value={query.postType}
            onChange={postType => changeFilters({ postType })} />}
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
        <Panel flush title={`${TABS.find(tab => tab.key === query.tab).label}${loading ? '' : ` · ${list.totalItems} ${query.tab === 'post' ? 'bài' : 'nhóm'}`}`}>
          <DataTable columns={columns} rows={list.items} loading={loading}
            caption={query.tab === 'post' ? 'Danh sách bài viết để duyệt' : 'Danh sách nhóm báo cáo để xử lý'}
            empty={{ icon: 'check2-circle', title: 'Không có mục phù hợp', children: 'Đổi bộ lọc hoặc tải lại để xem dữ liệu mới.' }}
            footer={!loading && <Pagination page={list.page} totalPages={list.totalPages} totalItems={list.totalItems}
              pageSize={list.pageSize} onChange={page => setQuery(current => ({ ...current, page }))} />} />
        </Panel>
      )}

      <Modal open={Boolean(selected) && !decision} onClose={() => setSelected(null)} size="lg"
        title={selected?.entity === 'case' ? (isCommentCase ? 'Nhóm báo cáo bình luận' : 'Nhóm báo cáo bài viết') : 'Chi tiết bài viết'}
        footer={(
          <div className={styles.actions}>
            <Button variant="subtle" onClick={() => setSelected(null)}>Đóng</Button>
            {canDecide && selected.entity === 'post' && <>
              <Button variant="alert" icon="x-lg" onClick={() => openDecision('reject')}>Từ chối</Button>
              <Button icon="check-lg" onClick={() => openDecision('approve')}>Duyệt bài</Button>
            </>}
            {canDecide && selected.entity === 'case' && <>
              <Button variant="outline" onClick={() => openDecision('reject')}>{isCommentCase ? 'Từ chối xóa bình luận' : 'Từ chối gỡ bài'}</Button>
              <Button variant="alert" disabled={!canRemove} onClick={() => openDecision('accept')}>{isCommentCase ? 'Chấp nhận xóa bình luận' : 'Chấp nhận gỡ bài'}</Button>
            </>}
          </div>
        )}>
        {detailLoading ? <Skeleton lines={8} /> : detailError ? (
          <Notice tone="alert" title="Không tải được chi tiết" action={{ label: 'Thử lại', onClick: () => setDetailReload(value => value + 1) }}>
            {detailError.message}
          </Notice>
        ) : (post || reportCase) && <>
          {reportCase && !target && (
            <Notice tone="info" title={isCommentCase ? 'Bình luận không còn tồn tại' : 'Bài viết không còn tồn tại'}>
              Nội dung #{reportCase.targetId} không còn tồn tại. Có thể từ chối để đóng nhóm báo cáo; không thể chấp nhận gỡ nội dung.
            </Notice>
          )}
          {target && reportCase?.status === 'pending' && !canRemove && (
            <Notice tone="info" title="Nội dung chưa ở trạng thái cho phép gỡ">Có thể từ chối để đóng nhóm báo cáo. Bài chưa xuất bản cần được xử lý ở tab Duyệt bài viết.</Notice>
          )}
          <AdminModerationDetails post={post} reportCase={reportCase} reports={detail?.reports || []} comment={comment} />
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
