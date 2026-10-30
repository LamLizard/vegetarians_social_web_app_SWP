// Duy's Code: M-07 Bài của tôi, dùng chung layout thành viên và PostCard đang có.
import { useCallback, useEffect, useRef, useState } from 'react';
import Button from '../components/Button/Button';
import ConfirmDialog from '../components/ConfirmDialog/ConfirmDialog';
import EmptyState from '../components/EmptyState/EmptyState';
import MemberLayout from '../components/MemberLayout/MemberLayout';
import Notice from '../components/Notice/Notice';
import PageHeader from '../components/PageHeader/PageHeader';
import Pagination from '../components/Pagination/Pagination';
import PostCard from '../components/PostCard/PostCard';
import Skeleton from '../components/Skeleton/Skeleton';
import StatusBadge from '../components/StatusBadge/StatusBadge';
import { useToast } from '../components/Toast/Toast';
import PostDetailModal from '../components/PostDetailModal/PostDetailModal';
import postService from '../services/post.service';
import { canEdit, canInteractWithManagedPost, getMyPostDisplayStatus, getMyPostModerationMessage } from '../utils/userPostManagement';
import {
  findNotificationPost, getMyPostListOptions, getNotificationPostId, removeNotificationPostId,
  resolveNotificationPost, shouldLoadNotificationPost,
} from '../utils/userPostManagementNavigation';
import { getYouTubeId } from '../utils/validate';
import styles from './UserPostManagementPage.module.css';

// Duy's Code: Bộ lọc khớp enum post_status_enum của database hiện tại.
const STATUS_OPTIONS = [
  ['all', 'Tất cả trạng thái'], ['pending', 'Chờ duyệt'], ['public', 'Công khai'],
  ['reported', 'Đang bị báo cáo'], ['deleted', 'Đã gỡ / đã xóa'],
];

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
      .then((data) => { if (active) { setResult(data); setPage(data.page); } })
      .catch((err) => { if (active) setError(err.message || 'Không tải được bài viết.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [status, type, page, reloadKey]);

  // Duy's Code: Hiện toast sau khi chuyển trang trở lại từ form sửa.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editResult = params.get('editResult');
    if (!editResult) return;
    if (editResult === 'success') toast('Đã gửi bài chỉnh sửa, đang chờ duyệt', { tone: 'info' });
    if (editResult === 'conflict') toast('Bài viết đã thay đổi trạng thái, không thể sửa', { tone: 'alert' });
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
  const canDelete = (post) => ['pending', 'public'].includes(post.status);

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
      toast(err.message || 'Không thể xóa bài viết.', { tone: 'alert' });
    } finally { setSaving(false); }
  };

  const posts = result?.items ?? [];
  return (
    <MemberLayout user={user} activeKey="" accountMenu={accountMenu} shopAction={shopAction}>
      <main className={styles.page}>
        <PageHeader title="Bài của tôi" description="Theo dõi bài đang chờ duyệt, bài đã đăng và kết quả kiểm duyệt."
          breadcrumb={[{ label: 'Bảng tin', href: '/' }, { label: 'Bài của tôi' }]}
          actions={<Button icon="plus-lg" onClick={() => window.location.assign('/?compose=1')}>Viết bài</Button>} />

        <section className={styles.filters} aria-label="Lọc bài viết">
          <label className={styles.filter}>
            <span>Trạng thái</span>
            <select className="form-select" value={status} onChange={(event) => { clearNotificationTarget(); setStatus(event.target.value); setPage(1); }}>
              {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className={styles.filter}>
            <span>Loại bài</span>
            <select className="form-select" value={type} onChange={(event) => { clearNotificationTarget(); setType(event.target.value); setPage(1); }}>
              <option value="all">Blog và Video</option><option value="blog">Blog</option><option value="video">Video</option>
            </select>
          </label>
          {result && <span className={styles.count}>{result.totalItems} bài viết</span>}
        </section>

        {error && <Notice tone="alert" title="Không tải được bài viết" action={{ label: 'Thử lại', onClick: () => setReloadKey((key) => key + 1) }}>{error}</Notice>}
        {loading && <div className={styles.skeletons} aria-label="Đang tải bài viết"><Skeleton lines={3} /><Skeleton lines={3} /><Skeleton lines={3} /></div>}
        {!loading && !error && posts.length === 0 && (
          <EmptyState icon="journal-plus" title="Chưa có bài viết phù hợp" action={<Button onClick={() => window.location.assign('/?compose=1')}>Viết bài đầu tiên</Button>}>
            Bài bạn gửi sẽ xuất hiện ở đây cùng trạng thái xử lý.
          </EmptyState>
        )}
        {!loading && !error && posts.length > 0 && <div className={styles.list}>
          {posts.map((post) => (
            <article className={`${styles.item} ${postId === String(post.id) ? styles.targetPost : ''}`} data-post-id={post.id} key={post.id}>
              <div className={styles.itemHead}>
                <div className={styles.labels}>
                  {(() => {
                    const displayStatus = getMyPostDisplayStatus(post);
                    const redStatus = ['rejected', 'removed', 'deleted'].includes(displayStatus);
                    const badgeStatus = displayStatus === 'removed' || displayStatus === 'deleted' ? 'deleted' : displayStatus;
                    const label = displayStatus === 'rejected' ? 'Bị từ chối'
                      : displayStatus === 'removed' ? 'Đã gỡ' : displayStatus === 'deleted' ? 'Đã xóa' : undefined;
                    return <StatusBadge entity="post" status={badgeStatus} label={label} toneOverride={redStatus ? 'bad' : undefined} size="sm" />;
                  })()}
                  <span className={styles.type}>{post.postType === 'video' ? 'Video' : 'Blog'}</span>
                  <time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleDateString('vi-VN')}</time>
                </div>
                {(() => {
                  const displayStatus = getMyPostDisplayStatus(post);
                  const redStatus = ['rejected', 'removed', 'deleted'].includes(displayStatus);
                  if (!redStatus && !post.moderationNote) return null;
                  const label = displayStatus === 'rejected' ? 'Bài viết bị từ chối'
                    : displayStatus === 'removed' ? 'Bài viết đã bị gỡ'
                      : displayStatus === 'deleted' ? 'Bài viết đã bị xóa' : 'Ghi chú kiểm duyệt';
                  const message = getMyPostModerationMessage(post);
                  return <p className={redStatus ? styles.removedNote : styles.note}><b>{label}</b>{message && `: ${message}`}</p>;
                })()}
              </div>
              <PostCard layout="row" postType={post.postType} title={post.title} excerpt={post.content}
                thumbnailUrl={post.thumbnailUrl} youtubeVideoId={getYouTubeId(post.youtubeUrl ?? '')} categories={post.categories}
                author={{ name: user?.fullName || user?.email, avatarUrl: user?.avatarUrl }} createdAt={post.createdAt}
                voteCount={post.voteCount} commentCount={post.commentCount} viewCount={post.viewCount}
                titleOnlyOpen onOpen={() => openPost(post)} titleLinkClassName={styles.titleLink}
                isOwner onEdit={canEdit(post) ? () => window.location.assign(`/posts/${encodeURIComponent(post.id)}/edit`) : undefined}
                onDelete={canDelete(post) ? () => setDeleting(post) : undefined} />
              {post.status === 'reported' && <p className={styles.policy}>Bài đang được xem xét theo báo cáo nên tạm thời không thể sửa hoặc xóa.</p>}
            </article>
          ))}
        </div>}
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
          label: getMyPostDisplayStatus(details.post) === 'rejected' ? 'Bài viết bị từ chối'
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
