// Duy's Code: M-07 Bài của tôi, dùng chung layout thành viên và PostCard đang có.
import { useCallback, useEffect, useRef, useState } from 'react';
import Button from '../components/Button/Button';
import ConfirmDialog from '../components/ConfirmDialog/ConfirmDialog';
import EmptyState from '../components/EmptyState/EmptyState';
import MemberLayout from '../components/MemberLayout/MemberLayout';
import Notice from '../components/Notice/Notice';
import PageHeader from '../components/PageHeader/PageHeader';
import Pagination from '../components/Pagination/Pagination';
import Skeleton from '../components/Skeleton/Skeleton';
import { useToast } from '../components/Toast/Toast';
import PostDetailModal from '../components/PostDetailModal/PostDetailModal';
import postService from '../services/post.service';
import { canEdit, canInteractWithManagedPost, getMyPostDisplayStatus, getMyPostModerationMessage } from '../utils/userPostManagement';
import {
  findNotificationPost, getMyPostListOptions, getNotificationPostId, removeNotificationPostId,
  resolveNotificationPost, shouldLoadNotificationPost,
} from '../utils/userPostManagementNavigation';
import MyPostRow from './MyPostRow';
import MyPostTabs from './MyPostTabs';
import styles from './UserPostManagementPage.module.css';

// Duy's Code: Bộ lọc khớp enum post_status_enum của database hiện tại.
const STATUS_TABS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'public', label: 'Công khai' },
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'edit_pending', label: 'Chờ cập nhật' },
  { value: 'deleted', label: 'Đã gỡ / đã xóa' },
];

const normalizeSearch = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi');

function sortMyPosts(posts, sort) {
  return [...posts].sort((left, right) => {
    const difference = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    return sort === 'oldest' ? difference : -difference;
  });
}

// Duy's Code: Trang cá nhân chỉ gọi API; quyền sở hữu luôn được xác thực lại ở server.
export default function UserPostManagementPage({ user, accountMenu = [], shopAction }) {
  const toast = useToast();
  // Tùng: vô hiệu hóa phản hồi của tài khoản cũ kể cả khi modal đã được thay thế.
  const viewerId = String(user?.id ?? 'guest');
  const viewerRef = useRef({ id: viewerId });
  if (viewerRef.current.id !== viewerId) viewerRef.current = { id: viewerId };
  const viewerContext = viewerRef.current;
  const isViewerCurrent = useCallback((context) => viewerRef.current === context, []);
  const detailRequest = useRef(0);
  const [postId, setPostId] = useState(() => getNotificationPostId(window.location.search));
  const handledTarget = useRef(null);
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [details, setDetails] = useState(null);

  const clearNotificationTarget = useCallback(() => {
    detailRequest.current += 1;
    const nextUrl = removeNotificationPostId(window.location);
    if (nextUrl !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(window.history.state, '', nextUrl);
    }
    handledTarget.current = null;
    setPostId(null);
  }, []);

  // Keep notification targets in sync with browser back/forward navigation without remounting the page.
  useEffect(() => {
    const syncNotificationTarget = () => {
      const nextPostId = getNotificationPostId(window.location.search);
      if (nextPostId === postId) return;
      detailRequest.current += 1;
      handledTarget.current = null;
      setDetails(null);
      setPostId(nextPostId);
    };
    window.addEventListener('popstate', syncNotificationTarget);
    window.addEventListener('pageshow', syncNotificationTarget);
    return () => {
      window.removeEventListener('popstate', syncNotificationTarget);
      window.removeEventListener('pageshow', syncNotificationTarget);
    };
  }, [postId]);

  // The visible list is always fetched using only its active filters and page.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    postService.getMyPosts(getMyPostListOptions({ status, type, page }))
      .then((data) => { if (active) { setResult({ ...data, requestedStatus: status, requestedType: type }); setPage(data.page); } })
      .catch((err) => { if (active) setError(err.message || 'Không tải được bài viết.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [status, type, page, reloadKey]);

  // Duy's Code: Hiện toast sau khi chuyển trang trở lại từ form sửa.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editResult = params.get('editResult');
    if (!editResult) return;
    if (editResult === 'success') toast('Đã gửi bản sửa. Bản sửa đang chờ quản trị viên duyệt.', { tone: 'info' });
    if (editResult === 'conflict') toast('Bài viết hiện chưa thể chỉnh sửa hoặc xóa.', { tone: 'info' });
    params.delete('editResult');
    const query = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  }, [toast]);

  // A notification target is loaded separately so it can open even when outside the visible page/filter.
  useEffect(() => {
    if (!shouldLoadNotificationPost(postId, handledTarget.current)) {
      if (!postId) handledTarget.current = null;
      return undefined;
    }

    handledTarget.current = postId;
    const requestId = detailRequest.current + 1;
    detailRequest.current = requestId;
    let active = true;
    setDetails({ status: 'loading', summary: { id: postId, title: '' }, post: null });
    postService.getMyPosts({ status: 'all', type: 'all', page: 1, postId })
      .then((data) => {
        if (!active || detailRequest.current !== requestId) return;
        const { post: item, missing } = resolveNotificationPost(data.items, postId);
        if (missing) {
          setDetails(null);
          toast('Nội dung không còn tồn tại', { tone: 'info' });
          clearNotificationTarget();
          return;
        }
        setDetails({
          status: 'ready',
          summary: item,
          post: {
            ...item,
            type: item.postType,
            author: item.author || { id: String(user?.id ?? ''), fullName: user?.fullName || user?.email, avatarUrl: user?.avatarUrl },
          },
        });
      })
      .catch(() => {
        if (!active || detailRequest.current !== requestId) return;
        setDetails(null);
        toast('Nội dung không còn tồn tại', { tone: 'info' });
        clearNotificationTarget();
      });
    return () => {
      active = false;
      if (detailRequest.current === requestId) {
        detailRequest.current += 1;
        if (handledTarget.current === postId) handledTarget.current = null;
      }
    };
  }, [clearNotificationTarget, postId, toast, user?.avatarUrl, user?.email, user?.fullName, user?.id]);

  // Duy's Code: Cuộn và làm nổi bật bài đích sau khi danh sách đã tải xong.
  useEffect(() => {
    if (!postId || !result?.items.some((post) => String(post.id) === postId)) return;
    document.querySelector(`[data-post-id="${CSS.escape(postId)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [postId, result]);

  // Duy's Code: Server chỉ cho sửa public và xóa pending/public; UI đồng bộ để tránh thao tác không hợp lệ.
  const canDelete = (post) => ['pending', 'public', 'reported'].includes(post.status);

  // Duy's Code: Cập nhật số liệu ở card và popup cùng lúc sau like/bình luận.
  const patchPost = useCallback((id, patch) => {
    setResult((current) => current && ({
      ...current,
      items: current.items.map((post) => (String(post.id) === String(id) ? { ...post, ...patch } : post)),
    }));
    setDetails((current) => current?.post && String(current.post.id) === String(id)
      ? { ...current, post: { ...current.post, ...patch } }
      : current);
  }, []);

  // Duy's Code: Chi tiết được lấy lại theo postId từ API chủ bài để có đủ nội dung và vẫn kiểm tra ownership.
  const openPost = async (summary) => {
    const requestId = detailRequest.current + 1;
    detailRequest.current = requestId;
    setDetails({ status: 'loading', summary, post: null });
    try {
      const data = await postService.getMyPosts({ status: 'all', type: 'all', page: 1, postId: summary.id });
      const item = findNotificationPost(data.items, summary.id);
      if (!item || typeof item.content !== 'string') throw new Error('missing-post-content');
      if (detailRequest.current !== requestId) return;
      const post = {
        ...item,
        type: item.postType,
        author: item.author || { id: String(user?.id ?? ''), fullName: user?.fullName || user?.email, avatarUrl: user?.avatarUrl },
      };
      setDetails({ status: 'ready', summary, post });
    } catch {
      if (detailRequest.current !== requestId) return;
      setDetails(null);
      toast('Nội dung không còn tồn tại', { tone: 'info' });
    }
  };

  // Duy's Code: Đóng popup vô hiệu hóa yêu cầu cũ và trả focus về đúng tiêu đề đã bấm.
  const closeDetails = () => {
    detailRequest.current += 1;
    setDetails(null);
    clearNotificationTarget();
  };

  // Duy's Code: Like chỉ bật cho bài public/reported và cập nhật lạc quan, có rollback khi API lỗi.
  const toggleManagedVote = async (post) => {
    if (!canInteractWithManagedPost(post)) return;
    const before = { isVoted: post.isVoted, voteCount: post.voteCount };
    patchPost(post.id, { isVoted: !post.isVoted, voteCount: post.voteCount + (post.isVoted ? -1 : 1) });
    try {
      const resultVote = await postService.toggleVote(post.id);
      patchPost(post.id, { isVoted: resultVote.voted, voteCount: resultVote.voteCount });
    } catch (err) {
      patchPost(post.id, before);
      toast(err.message || 'Chưa thích được bài, thử lại sau.', { tone: 'alert' });
    }
  };

  // Tùng: dùng số công khai từ server; refusal và replay không tự cộng vào số đếm.
  const onCommentCountChange = useCallback((id, count) => {
    patchPost(id, { commentCount: count });
  }, [patchPost]);

  const confirmDelete = async () => {
    if (!deleting || saving) return;
    setSaving(true);
    try {
      await postService.deleteMyPost(deleting.id);
      toast('Đã chuyển bài viết vào mục đã xóa.');
      setDeleting(null);
      setReloadKey((key) => key + 1);
    } catch (err) {
      const unavailable = deleting.status === 'reported' || [403, 404, 409].includes(err.status);
      toast(unavailable ? 'Bài viết hiện chưa thể chỉnh sửa hoặc xóa.' : err.message || 'Không thể xóa bài viết.',
        { tone: unavailable ? 'info' : 'alert' });
    } finally { setSaving(false); }
  };

  const posts = result?.items ?? [];
  const normalizedSearch = normalizeSearch(search.trim());
  const visiblePosts = sortMyPosts(posts.filter((post) => !normalizedSearch || normalizeSearch(post.title).includes(normalizedSearch)), sort);
  return (
    <MemberLayout user={user} activeKey="" accountMenu={accountMenu} shopAction={shopAction}>
      <main className={styles.page}>
        <PageHeader title="Bài của tôi" description="Theo dõi bài đang chờ duyệt, bài đã đăng và kết quả kiểm duyệt."
          breadcrumb={[{ label: 'Bảng tin', href: '/' }, { label: 'Bài của tôi' }]}
          actions={<Button icon="plus-lg" onClick={() => window.location.assign('/?compose=1')}>Viết bài</Button>} />

        <MyPostTabs tabs={STATUS_TABS} value={status} onChange={(nextStatus) => {
          clearNotificationTarget(); setStatus(nextStatus); setPage(1);
        }} />

        <section className={styles.filters} aria-label="Tìm và sắp xếp bài viết">
          <label className={styles.filter}>
            <span>Tìm theo tiêu đề</span>
            <input className="form-control" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm bài viết..." />
          </label>
          <label className={styles.filter}>
            <span>Loại bài</span>
            <select className="form-select" value={type} onChange={(event) => { clearNotificationTarget(); setType(event.target.value); setPage(1); }}>
              <option value="all">Blog và Video</option><option value="blog">Blog</option><option value="video">Video</option>
            </select>
          </label>
          <label className={styles.filter}>
            <span>Sắp xếp</span>
            <select className="form-select" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="newest">Mới nhất</option><option value="oldest">Cũ nhất</option>
            </select>
          </label>
          {result?.requestedStatus === status && result?.requestedType === type && <span className={styles.count}>
            {normalizedSearch ? `${visiblePosts.length} kết quả trên trang` : `${result.totalItems} bài viết`}
          </span>}
          <p className={styles.limitNote}>Tìm kiếm và sắp xếp chỉ áp dụng trên trang dữ liệu hiện tại.</p>
        </section>

        {error && <Notice tone="alert" title="Không tải được bài viết" action={{ label: 'Thử lại', onClick: () => setReloadKey((key) => key + 1) }}>{error}</Notice>}
        {loading && <div className={styles.skeletons} aria-label="Đang tải bài viết"><Skeleton lines={3} /><Skeleton lines={3} /><Skeleton lines={3} /></div>}
        <div id="my-post-panel" role="tabpanel" aria-labelledby={`my-post-tab-${status}`}>
          {!loading && !error && visiblePosts.length === 0 && (
            <EmptyState icon={normalizedSearch ? 'search' : 'journal-plus'} title={normalizedSearch ? 'Không tìm thấy bài viết phù hợp trên trang này' : 'Chưa có bài viết nào ở mục này.'}
              action={!normalizedSearch ? <Button onClick={() => window.location.assign('/?compose=1')}>Viết bài</Button> : undefined}>
              {normalizedSearch ? 'Thử từ khóa khác hoặc chuyển trang để tìm thêm.' : undefined}
            </EmptyState>
          )}
          {!loading && !error && visiblePosts.length > 0 && <div className={styles.list}>
            {visiblePosts.map((post) => (
              <MyPostRow key={post.id} post={post} highlighted={postId === String(post.id)} onOpen={() => openPost(post)}
                canEdit={canEdit(post)} canDelete={canDelete(post)}
                onEdit={() => {
                  if (post.hasPendingEdit) {
                    toast('Bản sửa đang chờ quản trị viên duyệt. Bài viết hiện tại vẫn công khai.', { tone: 'info' });
                    return;
                  }
                  window.location.assign(`/posts/${encodeURIComponent(post.id)}/edit`);
                }}
                onDelete={() => setDeleting(post)} />
            ))}
          </div>}
        </div>
        {!loading && !error && result && <Pagination page={result.page} totalPages={result.totalPages}
          totalItems={result.totalItems} pageSize={result.pageSize} itemLabel="bài viết" onChange={setPage} />}
      </main>
      <ConfirmDialog open={Boolean(deleting)} title="Xóa bài viết này?"
        message="Bài sẽ không còn xuất hiện trên Bảng tin. Bản ghi vẫn được giữ để bảo toàn lịch sử."
        confirmLabel="Xóa bài viết" loading={saving} onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />
      <PostDetailModal
        key={`${user?.id ?? 'guest'}:${details?.post?.id ?? details?.summary?.id ?? ''}`}
        post={details?.post}
        loading={details?.status === 'loading'}
        loadingTitle={details?.summary?.title}
        user={user}
        isMine
        readOnly={!canInteractWithManagedPost(details?.post)}
        showComments={canInteractWithManagedPost(details?.post)}
        statusBanner={details?.post && ['rejected', 'removed', 'deleted'].includes(getMyPostDisplayStatus(details.post)) ? {
          label: getMyPostDisplayStatus(details.post) === 'rejected' ? (details.post.moderationSource === 'ai' ? 'AI từ chối bài viết' : 'Quản trị viên từ chối bài viết')
            : getMyPostDisplayStatus(details.post) === 'removed' ? 'Bài viết đã bị gỡ' : 'Bài viết đã bị xóa',
          reason: getMyPostModerationMessage(details.post),
        } : null}
        onClose={closeDetails}
        onVote={toggleManagedVote}
        viewerContext={viewerContext}
        isViewerCurrent={isViewerCurrent}
        onCommentCountChange={onCommentCountChange}
      />
    </MemberLayout>
  );
}
