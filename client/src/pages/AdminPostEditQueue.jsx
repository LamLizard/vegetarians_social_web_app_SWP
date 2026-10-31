import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Avatar, Button, Checkbox, Chip, ConfirmDialog, DataTable, Modal, Notice,
  Pagination, Photo, Panel, SearchInput, Select, Skeleton, formatDate, timeAgo,
  useToast, YouTubeEmbed,
} from '../components';
import postModerationService from '../services/postModeration.service';
import postEditModerationService from '../services/postEditModeration.service';
import { getYouTubeId } from '../utils/validate';
import styles from './AdminPostEditQueue.module.css';
import pageStyles from './AdminModerationPage.module.css';

const POST_TYPES = [
  { value: 'all', label: 'Blog và Video' },
  { value: 'blog', label: 'Blog' },
  { value: 'video', label: 'Video' },
];
const EMPTY_LIST = { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 1 };

function parseListResponse(data) {
  if (!data || !Array.isArray(data.items)
    || !Number.isSafeInteger(data.page) || data.page < 1
    || !Number.isSafeInteger(data.pageSize) || data.pageSize < 1
    || !Number.isSafeInteger(data.totalItems) || data.totalItems < 0
    || !Number.isSafeInteger(data.totalPages) || data.totalPages < 1
    || (data.totalItems > 0 && data.items.length === 0)) {
    throw new Error('API trả về danh sách bản sửa sai định dạng hoặc không nhất quán. Hãy tải lại.');
  }
  return data;
}

function dateLabel(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN');
}

function same(left, right) {
  return (left ?? '') === (right ?? '');
}

function Value({ label, before, after, className }) {
  const changed = !same(before, after);
  return (
    <section className={`${styles.value} ${changed ? styles.changed : ''} ${className || ''}`}>
      <h4>{label}{changed && <span className={styles.changedLabel}>Có thay đổi</span>}</h4>
      {after ? <p>{after}</p> : <p className={styles.emptyValue}>Để trống</p>}
    </section>
  );
}

function CategoryValues({ before = [], after = [] }) {
  const oldIds = new Set(before.map((item) => String(item.id)));
  const newIds = new Set(after.map((item) => String(item.id)));
  const changed = oldIds.size !== newIds.size || [...oldIds].some((id) => !newIds.has(id));
  return (
    <section className={`${styles.value} ${changed ? styles.changed : ''}`}>
      <h4>Chủ đề{changed && <span className={styles.changedLabel}>Có thay đổi</span>}</h4>
      <div className={styles.chips}>{after.length ? after.map((item) => <Chip key={item.id}>{item.name}</Chip>) : <span className={styles.emptyValue}>Để trống</span>}</div>
    </section>
  );
}

function MediaValue({ label, before, after, video = false }) {
  const changed = !same(before, after);
  const newVideoId = video ? getYouTubeId(after || '') : null;
  return (
    <section className={`${styles.value} ${changed ? styles.changed : ''}`}>
      <h4>{label}{changed && <span className={styles.changedLabel}>Có thay đổi</span>}</h4>
      {video ? <>
        {newVideoId ? <YouTubeEmbed videoId={newVideoId} title="Video" /> : <p className={styles.emptyValue}>Không có link video</p>}
        {after && <a href={after} target="_blank" rel="noreferrer">Mở link video</a>}
      </> : after ? <Photo src={after} alt={label} ratio="16/9" className={styles.image} /> : <p className={styles.emptyValue}>Không có ảnh</p>}
    </section>
  );
}

export default function AdminPostEditQueue({ refreshKey = 0 }) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [list, setList] = useState(EMPTY_LIST);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [localReload, setLocalReload] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [postType, setPostType] = useState('all');
  const [stale, setStale] = useState(false);
  const [now, setNow] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [detailReload, setDetailReload] = useState(0);
  const [reviewError, setReviewError] = useState('');
  const [decision, setDecision] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setListError(null);
    postEditModerationService.listPending({ page, limit: 20 }, controller.signal)
      .then((data) => {
        const normalized = parseListResponse(data);
        if (active) { setList(normalized); setPage(normalized.page); }
      })
      .catch((error) => { if (active && error.name !== 'AbortError') setListError(error); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [page, refreshKey, localReload]);

  useEffect(() => {
    if (!selectedId) return undefined;
    const controller = new AbortController();
    let active = true;
    setDetail(null);
    setDetailError(null);
    setReviewError('');
    setDetailLoading(true);
    postEditModerationService.getPending(selectedId, controller.signal)
      .then(async (editRequest) => {
        const post = await postModerationService.getPost(editRequest.postId, controller.signal);
        if (active) setDetail({ editRequest, post });
      })
      .catch((error) => { if (active && error.name !== 'AbortError') setDetailError(error); })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [selectedId, detailReload]);

  const refreshList = useCallback(() => setLocalReload((value) => value + 1), []);
  const closeDetail = () => { setSelectedId(null); setDetail(null); setDecision(null); };
  const canDecide = detail?.post?.status === 'public' && Boolean(detail?.editRequest);
  const editCategories = detail?.editRequest?.categories ?? [];
  const currentCategories = detail?.post?.categories ?? [];

  const decisionConfig = useMemo(() => decision?.action === 'reject' ? {
    title: 'Từ chối bản sửa này?', label: 'Từ chối bản sửa', tone: 'alert',
    message: 'Bản sửa sẽ bị xóa khỏi hàng chờ. Bài gốc giữ nguyên; thành viên nhận thông báo kèm lý do.',
    reason: { label: 'Lý do từ chối', required: true, placeholder: 'Lý do này sẽ được gửi cho thành viên' },
  } : {
    title: 'Duyệt bản sửa này?', label: 'Duyệt bản sửa', tone: 'primary',
    message: 'Nội dung bản sửa sẽ được áp dụng lên bài viết hiện tại.',
  }, [decision]);

  const confirmDecision = async (note) => {
    if (!decision || saving) return;
    setSaving(true);
    setReviewError('');
    try {
      const result = await postEditModerationService.decide(selectedId, decision.action, note);
      const expectedOutcome = decision.action === 'approve' ? 'approved' : 'rejected';
      if (String(result?.id) !== String(selectedId)
        || String(result?.postId) !== String(detail?.post?.id)
        || result?.outcome !== expectedOutcome) {
        throw new Error('Máy chủ chưa xác nhận kết quả xử lý bản sửa.');
      }
      toast(decision.action === 'approve' ? 'Đã duyệt bản sửa.' : 'Đã từ chối bản sửa; lý do đã được gửi cho thành viên.');
      closeDetail();
      refreshList();
    } catch (error) {
      if (error.status === 409) {
        const code = error.details?.code;
        if (code === 'POST_REPORTED') {
          setReviewError('Bài gốc đang bị báo cáo. Cả duyệt và từ chối đều bị chặn cho tới khi xử lý xong báo cáo.');
          setDecision(null);
          setDetailReload((value) => value + 1);
          refreshList();
        } else if (code === 'POST_NOT_EDITABLE') {
          setReviewError('Bài gốc đã bị gỡ hoặc xóa nên không thể quyết định bản sửa.');
          setDecision(null);
          setDetailReload((value) => value + 1);
          refreshList();
        } else if (code === 'EDIT_REQUEST_NOT_PENDING') {
          toast('Bản sửa đã bị hủy hoặc được Admin khác xử lý. Danh sách đã được làm mới.', { tone: 'info' });
          closeDetail();
          refreshList();
        } else {
          setReviewError(error.message || 'Dữ liệu đã thay đổi; hãy tải lại trước khi quyết định.');
          setDecision(null);
          refreshList();
        }
      } else if (error.status === 404) {
        toast('Bản sửa đã bị hủy hoặc không còn trong hàng chờ. Danh sách đã được làm mới.', { tone: 'info' });
        closeDetail();
        refreshList();
      } else {
        setReviewError(error.message || 'Chưa xử lý được bản sửa. Vui lòng thử lại.');
      }
    } finally {
      setSaving(false);
    }
  };

  const visibleItems = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('vi');
    const cutoff = now - (48 * 60 * 60 * 1000);
    return list.items.filter((row) => {
      const matchesSearch = !needle || [row.title, row.authorName, row.authorEmail]
        .some((value) => String(value ?? '').toLocaleLowerCase('vi').includes(needle));
      const matchesType = postType === 'all' || row.postType === postType;
      const matchesStale = !stale || new Date(row.submittedAt).getTime() < cutoff;
      return matchesSearch && matchesType && matchesStale;
    });
  }, [list.items, search, postType, stale, now]);

  const resetFilters = () => {
    setSearchInput('');
    setSearch('');
    setPostType('all');
    setStale(false);
    setPage(1);
  };

  const columns = [
    { key: 'title', header: 'Tiêu đề', primary: true, render: (row) => <span>{row.title}</span> },
    { key: 'authorName', header: 'Người sửa', render: (row) => <span className={styles.author}><Avatar name={row.authorName || row.authorEmail} size={28} />{row.authorName || row.authorEmail || `Tài khoản #${row.accountId}`}</span> },
    { key: 'submittedAt', header: 'Ngày gửi', render: (row) => {
      const isStale = now > 0 && now - new Date(row.submittedAt).getTime() > 48 * 60 * 60 * 1000;
      return <span className={isStale ? 'text-danger' : undefined}>{formatDate(row.submittedAt)}<small className="d-block">{timeAgo(row.submittedAt)}</small></span>;
    } },
    { key: 'kind', header: 'Loại', render: () => <span className="badge text-bg-info">Bản sửa</span>, width: 110 },
    { key: 'actions', header: 'Thao tác', align: 'right', render: (row) => <Button size="sm" variant="outline" icon="eye" onClick={() => setSelectedId(row.id)}>Xem chi tiết</Button> },
  ];

  return (
    <>
      <Panel className="my-3" title="Bộ lọc" icon="funnel">
        <div className={pageStyles.filters}>
          <div className={pageStyles.search}>
            <SearchInput value={searchInput} onChange={setSearchInput}
              onSearch={(value) => { setSearch(value); setPage(1); }} maxLength={255}
              placeholder="Tiêu đề, người sửa — nhấn Enter" label="Tìm theo tiêu đề hoặc người sửa" />
          </div>
          <Select label="Loại bài" options={POST_TYPES} value={postType} onChange={(value) => { setPostType(value); setPage(1); }} />
        </div>
        <div className={pageStyles.tools}>
          <Checkbox checked={stale} onChange={(value) => { setStale(value); setPage(1); }}>
            Chỉ mục chờ quá 48 giờ
          </Checkbox>
          <Button variant="subtle" size="sm" onClick={resetFilters}>Đặt lại bộ lọc</Button>
        </div>
      </Panel>

      {listError ? <Notice tone="alert" title="Không tải được bản sửa" action={{ label: 'Tải lại', onClick: refreshList }}>
        {listError.message || 'Không nhận được phản hồi hợp lệ từ máy chủ. Vui lòng tải lại.'}
      </Notice> : (
        <Panel flush title={`Bản sửa chờ duyệt · ${visibleItems.length} bản`}>
          <DataTable columns={columns} rows={visibleItems} loading={loading} caption="Danh sách bản sửa chờ duyệt"
            empty={{ icon: 'check2-circle', title: search || postType !== 'all' || stale ? 'Không có bản sửa phù hợp bộ lọc' : 'Không có bản sửa chờ duyệt', children: 'Các bản sửa mới sẽ xuất hiện ở đây.' }}
            footer={!loading && <Pagination page={list.page} totalPages={list.totalPages} totalItems={list.totalItems} pageSize={list.pageSize} onChange={setPage} />} />
        </Panel>
      )}

      <Modal open={Boolean(selectedId)} onClose={closeDetail} size="lg" title="So sánh bài viết và bản sửa"
        description={detail?.editRequest ? `${detail.editRequest.title} · ${detail.editRequest.authorName || detail.editRequest.authorEmail || 'Thành viên'} · gửi ${dateLabel(detail.editRequest.submittedAt)}` : undefined}
        footer={<div className={styles.actions}>
          <Button variant="subtle" onClick={closeDetail}>Đóng</Button>
          <Button variant="alert" onClick={() => setDecision({ action: 'reject' })} disabled={!canDecide || detailLoading}>Từ chối</Button>
          <Button onClick={() => setDecision({ action: 'approve' })} disabled={!canDecide || detailLoading}>Duyệt</Button>
        </div>}>
        {detailLoading ? <Skeleton lines={8} /> : detailError ? (
          <Notice tone="alert" title={detailError.status === 404 ? 'Bản sửa không còn trong hàng chờ' : 'Không tải được chi tiết'}
            action={{ label: 'Tải lại danh sách', onClick: () => { closeDetail(); refreshList(); } }}>
            {detailError.message}
          </Notice>
        ) : detail && <>
          <div className={styles.meta}>
            <span className="badge text-bg-info">Bản sửa</span>
            <span>Bài gốc #{detail.post.id} · {dateLabel(detail.editRequest.submittedAt)}</span>
            <span>Người sửa: {detail.editRequest.authorName || detail.editRequest.authorEmail || `Tài khoản #${detail.editRequest.accountId}`}</span>
          </div>
          {detail.post.status === 'reported' && <Notice tone="alert" title="Bài gốc đang bị báo cáo">Cả duyệt và từ chối bản sửa đều bị khóa cho tới khi báo cáo được xử lý.</Notice>}
          {detail.post.status !== 'public' && detail.post.status !== 'reported' && <Notice tone="alert" title="Bài gốc đã gỡ hoặc không còn công khai">Không thể duyệt hay từ chối bản sửa khi bài gốc không còn ở trạng thái công khai.</Notice>}
          {reviewError && <Notice tone="alert" title="Chưa xử lý được bản sửa">{reviewError}</Notice>}
          <div className={styles.comparison}>
            <section className={styles.version}>
              <h3>Bài đang công khai</h3>
              <p className={styles.status}>Trạng thái: {detail.post.status}</p>
              <Value label="Tiêu đề" before={detail.post.title} after={detail.post.title} />
              <Value label="Nội dung" before={detail.post.content} after={detail.post.content} className={styles.contentValue} />
              <MediaValue label="Ảnh bìa" before={detail.post.thumbnailUrl} after={detail.post.thumbnailUrl} />
              {detail.post.postType === 'video' && <MediaValue label="Link video" before={detail.post.youtubeUrl} after={detail.post.youtubeUrl} video />}
              <CategoryValues before={currentCategories} after={currentCategories} />
            </section>
            <section className={styles.version}>
              <h3>Bản sửa đề xuất</h3>
              <p className={styles.status}>Nhãn: Bản sửa · trạng thái: edited</p>
              <Value label="Tiêu đề" before={detail.post.title} after={detail.editRequest.title} />
              <Value label="Nội dung" before={detail.post.content} after={detail.editRequest.content} className={styles.contentValue} />
              <MediaValue label="Ảnh bìa" before={detail.post.thumbnailUrl} after={detail.editRequest.thumbnailUrl} />
              {(detail.post.postType === 'video' || detail.editRequest.postType === 'video') && <MediaValue label="Link video" before={detail.post.youtubeUrl} after={detail.editRequest.youtubeUrl} video />}
              <CategoryValues before={currentCategories} after={editCategories} />
            </section>
          </div>
        </>}
      </Modal>

      <ConfirmDialog open={Boolean(decision)} title={decisionConfig.title} confirmLabel={decisionConfig.label}
        tone={decisionConfig.tone} message={<>{decisionConfig.message}{reviewError && <><br /><strong role="alert" className="text-danger">{reviewError}</strong></>}</>}
        reason={decisionConfig.reason || false} loading={saving} onConfirm={confirmDecision}
        onCancel={() => { if (!saving) setDecision(null); }} />
    </>
  );
}
