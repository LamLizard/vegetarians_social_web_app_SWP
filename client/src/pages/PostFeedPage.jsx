// Trang Bảng tin (User Post Page · ID01) — lướt bài kiểu mạng xã hội.
//  - Khách: chỉ xem 3 bài cố định (3 bài đầu tiên của ngày gần nhất trước hôm nay), read-only.
//           Bấm Thích / Bình luận / Báo cáo / Tìm kiếm → mời đăng nhập.
//  - Thành viên: lướt vô hạn, thích (toggle), bình luận, báo cáo bài & bình luận, tìm theo tiêu đề.
//  - Chỉ hiện bài status 'public' và 'reported' (BE lọc).
//
// Cây component:
//   PostFeedPage
//   ├── AppShell (thanh trên có SearchInput)
//   ├── Notice (khách) · SkeletonCard (đang tải) · EmptyState (trống / hết lượt khách)
//   ├── PostCard × N  ── VoteButton (bên trong)
//   ├── PostDetailModal ── YouTubeEmbed | Photo, VoteButton, CommentSection
//   ├── ReportDialog
//   └── LoginPrompt
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppShell, Avatar, Button, Chip, CommentSection, EmptyState, LoginPrompt, Modal, Notice, Photo, PostCard,
  ReportDialog, SearchInput, SkeletonCard, Spinner, VoteButton, YouTubeEmbed, getYouTubeId, timeAgo, useToast,
} from '../components';
import postService from '../services/post.service';
import styles from './PostFeedPage.module.css';

// TODO: chuyển lên App khi nhóm có react-router (mỗi trang đang tự dựng AppShell)
const NAV = [
  { key: 'feed', label: 'Bảng tin', icon: 'house', iconActive: 'house-fill', href: '/' },
  { key: 'dishes', label: 'Món chay', icon: 'egg-fried', href: '#' },
  { key: 'meal-plan', label: 'Thực đơn', icon: 'calendar-week', href: '#' },
  { key: 'shops', label: 'Quán chay', icon: 'shop', href: '#' },
];

/** user của BE ({ fullName }) → dạng component cần ({ name }) */
const toPerson = (u) => (u ? { name: u.fullName, avatarUrl: u.avatarUrl ?? null } : null);

/**
 * @param {{id, fullName, avatarUrl?}|null} user   null = khách (lấy từ useAuth() ở App)
 * @param {() => void} [onLogin] · [onRegister]
 * @param {{icon?, label, onClick}[]} [accountMenu]  vd Đăng xuất
 */
export default function PostFeedPage({ user, onLogin, onRegister, accountMenu = [] }) {
  const toast = useToast();
  const isGuest = !user;

  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [searchText, setSearchText] = useState(''); // đang gõ
  const [query, setQuery] = useState('');           // đã bấm Enter

  const [opened, setOpened] = useState(null);       // { id, toComments }
  const [reportTarget, setReportTarget] = useState(null); // { type, id, title }
  const [loginOpen, setLoginOpen] = useState(false);

  const requireLogin = () => setLoginOpen(true);

  // ---------- Tải trang đầu (đổi khách/thành viên, đổi từ khoá, bấm Thử lại) ----------
  useEffect(() => {
    let ignore = false; // bỏ kết quả cũ nếu người dùng tìm liên tục
    setStatus('loading');
    (async () => {
      try {
        const res = isGuest ? await postService.getPreview() : await postService.getFeed({ q: query });
        if (ignore) return;
        setItems(res.items);
        setNextCursor(isGuest ? null : res.nextCursor ?? null);
        setStatus('ready');
      } catch (err) {
        if (ignore) return;
        setError(err.message || 'Không tải được bảng tin');
        setStatus('error');
      }
    })();
    return () => { ignore = true; };
  }, [isGuest, query, reloadKey]);

  // ---------- Lướt vô hạn ----------
  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await postService.getFeed({ cursor: nextCursor, q: query });
      setItems((list) => [...list, ...res.items]);
      setNextCursor(res.nextCursor ?? null);
    } catch (err) {
      toast(err.message || 'Không tải thêm được bài', { tone: 'alert' });
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, query, toast]);

  const sentinelRef = useRef(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !nextCursor) return undefined;
    // Còn cách đáy 400px là tải trước → người dùng không phải chờ
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) loadMore(); }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [nextCursor, loadMore]);

  // ---------- Thao tác trên bài ----------
  const patchPost = (id, patch) => setItems((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const vote = async (post) => {
    if (isGuest) { requireLogin(); return; }
    const before = { isVoted: post.isVoted, voteCount: post.voteCount };
    // Cập nhật ngay cho mượt, lỗi thì trả lại như cũ
    patchPost(post.id, { isVoted: !post.isVoted, voteCount: post.voteCount + (post.isVoted ? -1 : 1) });
    try {
      const res = await postService.toggleVote(post.id);
      patchPost(post.id, { isVoted: res.voted, voteCount: res.voteCount });
    } catch (err) {
      patchPost(post.id, before);
      toast(err.message || 'Chưa thích được bài, thử lại sau', { tone: 'alert' });
    }
  };

  const askReport = (target) => (isGuest ? requireLogin() : setReportTarget(target));

  const submitReport = async ({ reasonCode, reasonText }) => {
    const { type, id } = reportTarget;
    try {
      await postService.report({ targetType: type, targetId: id, reasonCode, reasonText });
    } catch (err) {
      // 409 = đã báo cáo từ trước (vd ở tab khác) → vẫn đánh dấu để nút đổi thành "Đã báo cáo"
      if (err.status === 409 && type === 'post') patchPost(id, { hasReported: true });
      throw err; // ReportDialog tự hiện câu lỗi
    }
    // Bài bị báo cáo: BE đã đổi public → reported, FE đổi theo cho khớp mà không cần tải lại
    if (type === 'post') patchPost(id, { hasReported: true, status: 'reported' });
    toast('Đã gửi báo cáo. Admin sẽ xem xét sớm.');
  };

  /** Bài của chính mình → không có nút báo cáo (BE cũng chặn) */
  const isMine = (post) => !isGuest && post.author?.id === String(user.id);

  const search = (value) => {
    if (isGuest) { requireLogin(); return; }
    setQuery(value);
  };

  const openedPost = opened && items.find((p) => p.id === opened.id);

  return (
    <AppShell
      nav={NAV}
      activeKey="feed"
      width="feed"
      user={toPerson(user)}
      accountMenu={accountMenu}
      onLogin={onLogin}
      onRegister={onRegister}
      search={(
        <SearchInput
          value={searchText}
          onChange={setSearchText}
          onSearch={search}
          placeholder="Tìm bài viết theo tiêu đề..."
          loading={!isGuest && status === 'loading' && Boolean(query)}
        />
      )}
    >
      <div className={styles.feed}>
        {isGuest && (
          <Notice tone="info" title="Bạn đang xem với tư cách khách">
            Đây là 3 bài nổi bật gần nhất. Đăng nhập để lướt tiếp, thích, bình luận và báo cáo bài viết.
          </Notice>
        )}

        {query && status !== 'error' && (
          <div className={styles.searchBar}>
            <span>Kết quả cho <b>“{query}”</b></span>
            <Button size="sm" variant="subtle" icon="x-lg" onClick={() => { setSearchText(''); setQuery(''); }}>Xoá tìm kiếm</Button>
          </div>
        )}

        {status === 'loading' && (
          <div className={styles.feed} aria-busy="true">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {status === 'error' && (
          <Notice tone="alert" title="Không tải được bảng tin" action={{ label: 'Thử lại', onClick: () => setReloadKey((k) => k + 1) }}>
            {error}
          </Notice>
        )}

        {status === 'ready' && items.length === 0 && (
          query
            ? <EmptyState icon="search" title="Không tìm thấy bài viết nào">Thử từ khoá khác, ví dụ “canh” hoặc “chè”.</EmptyState>
            : <EmptyState icon="flower3" title="Chưa có bài viết nào">Bài mới sẽ hiện ở đây sau khi được Admin duyệt.</EmptyState>
        )}

        {status === 'ready' && items.map((post) => (
          <PostCard
            key={post.id}
            postType={post.type}
            title={post.title}
            excerpt={post.content}
            href={`#bai-${post.id}`}
            thumbnailUrl={post.thumbnailUrl}
            youtubeVideoId={post.type === 'video' ? getYouTubeId(post.youtubeUrl ?? '') : undefined}
            author={toPerson(post.author)}
            createdAt={post.createdAt}
            categories={post.categories}
            voteCount={post.voteCount}
            commentCount={post.commentCount}
            voted={post.isVoted}
            onVote={() => vote(post)}
            onOpen={() => setOpened({ id: post.id, toComments: false })}
            onComment={() => setOpened({ id: post.id, toComments: true })}
            onReport={isMine(post) ? undefined : () => askReport({ type: 'post', id: post.id, title: post.title })}
            reported={post.hasReported}
          />
        ))}

        {/* Khách: hết 3 bài → mời đăng nhập thay vì tải thêm */}
        {status === 'ready' && isGuest && items.length > 0 && (
          <EmptyState
            icon="person-check"
            title="Đăng nhập để xem thêm bài viết"
            action={(
              <div className={styles.guestActions}>
                <Button onClick={onLogin}>Đăng nhập</Button>
                <Button variant="outline" onClick={onRegister}>Tạo tài khoản miễn phí</Button>
              </div>
            )}
          >
            Thành viên được lướt không giới hạn và chia sẻ món chay của mình.
          </EmptyState>
        )}

        {/* Điểm neo: cuộn tới đây thì tải trang tiếp theo */}
        {status === 'ready' && nextCursor && (
          <div ref={sentinelRef} className={styles.sentinel}>
            {loadingMore && <Spinner label="Đang tải thêm bài..." showLabel />}
          </div>
        )}
        {status === 'ready' && !isGuest && !nextCursor && items.length > 0 && (
          <p className={styles.end}>Bạn đã xem hết bài viết 🌱</p>
        )}
      </div>

      <PostDetailModal
        post={openedPost}
        toComments={opened?.toComments}
        user={user}
        onClose={() => setOpened(null)}
        onVote={vote}
        onReport={askReport}
        isMine={openedPost ? isMine(openedPost) : false}
        onRequireLogin={requireLogin}
        onCommentAdded={(id) => setItems((list) => list.map((p) => (p.id === id ? { ...p, commentCount: p.commentCount + 1 } : p)))}
      />

      <ReportDialog
        open={reportTarget != null}
        targetType={reportTarget?.type}
        targetTitle={reportTarget?.title}
        onSubmit={submitReport}
        onClose={() => setReportTarget(null)}
      />

      <LoginPrompt
        open={loginOpen}
        reason="action"
        onLogin={() => { setLoginOpen(false); onLogin?.(); }}
        onRegister={() => { setLoginOpen(false); onRegister?.(); }}
        onClose={() => setLoginOpen(false)}
      />
    </AppShell>
  );
}

// =====================================================================
//  Chi tiết bài (mở tại chỗ như Facebook) — chỉ trang này dùng nên để chung file
// =====================================================================
function PostDetailModal({ post, toComments, user, isMine, onClose, onVote, onReport, onRequireLogin, onCommentAdded }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const postId = post?.id;
  const sectionId = `binh-luan-${postId}`;

  // Mở bài nào thì tải bình luận của bài đó
  useEffect(() => {
    if (!postId) return undefined;
    let ignore = false;
    setComments([]);
    setLoading(true);
    postService.getComments(postId)
      .then((res) => { if (!ignore) setComments(res.items); })
      .catch(() => { if (!ignore) setComments([]); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [postId]);

  // Bấm nút bình luận ở thẻ → cuộn thẳng xuống khu bình luận
  useEffect(() => {
    if (postId && toComments && !loading) document.getElementById(sectionId)?.scrollIntoView({ block: 'start' });
  }, [postId, toComments, loading, sectionId]);

  if (!post) return null;

  const addComment = async (content) => {
    const created = await postService.addComment(post.id, content); // lỗi → CommentComposer tự hiện câu lỗi
    setComments((list) => [created, ...list]);
    onCommentAdded(post.id);
  };

  return (
    <Modal open onClose={onClose} title={post.title} size="lg">
      <article className={styles.detail}>
        <header className={styles.detailHead}>
          <Avatar src={post.author.avatarUrl} name={post.author.fullName} size={40} />
          <div>
            <b>{post.author.fullName}</b>
            <span className={styles.muted}> · <time dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time></span>
          </div>
        </header>

        {post.categories?.length > 0 && (
          <div className={styles.chips}>{post.categories.map((c) => <Chip key={c.id}>{c.name}</Chip>)}</div>
        )}

        {post.type === 'video'
          ? <YouTubeEmbed url={post.youtubeUrl} title={post.title} />
          : post.thumbnailUrl && <Photo src={post.thumbnailUrl} ratio="16/9" shape="rounded" />}

        {post.content && <p className={styles.content}>{post.content}</p>}

        <div className={styles.detailActions}>
          <VoteButton voted={post.isVoted} count={post.voteCount} onToggle={() => onVote(post)} />
          {!isMine && (post.hasReported
            ? <Button size="sm" variant="subtle" icon="flag-fill" disabled>Đã báo cáo</Button>
            : (
              <Button size="sm" variant="subtle" icon="flag" onClick={() => onReport({ type: 'post', id: post.id, title: post.title })}>
                Báo cáo
              </Button>
            ))}
        </div>

        <CommentSection
          id={sectionId}
          comments={comments.map((c) => ({ ...c, author: toPerson(c.author) }))}
          total={post.commentCount}
          currentUser={toPerson(user)}
          loading={loading}
          onCreate={addComment}
          onReport={(commentId) => {
            const c = comments.find((x) => x.id === commentId);
            onReport({ type: 'comment', id: commentId, title: c?.content.slice(0, 60) });
          }}
          onRequireLogin={onRequireLogin}
        />
      </article>
    </Modal>
  );
}
