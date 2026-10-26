// Trang Bảng tin (User Post Page · ID01) — lướt bài kiểu mạng xã hội.
//  - Khách: chỉ xem 3 bài nhiều lượt thả tim nhất, read-only.
//           Bấm Thích / Bình luận / Báo cáo / Tìm kiếm → mời đăng nhập.
//  - Thành viên: lướt vô hạn, thích (toggle), bình luận, báo cáo bài & bình luận, tìm theo tiêu đề.
//  - Chỉ hiện bài status 'public' và 'reported' (BE lọc).
//
// Giao diện theo prototype UI v2 (bảng 6 màu ở styles/theme.scss, bố cục ở styles/feed-theme.css).
// Cột phải của prototype (Hoạt động, Quán chay, Sôi nổi) và thẻ Mầm gợi ý chưa có dữ liệu thật → ẩn (09/10/2026).
//
// Cây component:
//   PostFeedPage
//   ├── MemberLayout (khung chung: FeedSidebar + thanh tab điện thoại — components/MemberLayout)
//   ├── FeedTopbar (ô tìm kiếm, thẳng cột giữa)
//   ├── FeedGreeting (cột trái: lời chào)
//   ├── FeedComposer (ô đăng nhanh → mở CreatePostModal) · FeedFilter (lọc theo danh mục)
//   ├── Notice (khách) · SkeletonCard (đang tải) · EmptyState (trống / hết lượt khách)
//   ├── FadeContent → FeedPostCard × N (hiện dần khi cuộn tới)
//   ├── PostDetailModal ── YouTubeEmbed | Photo, VoteButton, CommentSection
//   ├── CreatePostModal · ReportDialog
//   └── LoginPrompt
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Avatar, Button, CommentSection, EmptyState, LoginPrompt, Modal, Notice, Photo,
  ReportDialog, SkeletonCard, Spinner, VoteButton, YouTubeEmbed, getYouTubeId, timeAgo, useToast,
} from '../components';
// Khoi's code: Đăng bài (Sprint 2) + hiện **đậm** *nghiêng* trong nội dung bài
import CreatePostModal from '../components/CreatePostModal/CreatePostModal';
import PostRichText, { stripMarks } from '../components/PostRichText/PostRichText';
import FeedComposer from '../components/FeedComposer/FeedComposer';
import FeedFilter from '../components/FeedFilter/FeedFilter';
import FeedGreeting from '../components/FeedGreeting/FeedGreeting';
import FeedPostCard from '../components/FeedPostCard/FeedPostCard';
import cardStyles from '../components/FeedPostCard/FeedPostCard.module.css'; // dùng chung kiểu thẻ #chủ đề với thẻ bài
import MemberLayout, { toPerson } from '../components/MemberLayout/MemberLayout';
import FeedTopbar from '../components/FeedTopbar/FeedTopbar';
import FadeContent from '../components/reactbits/FadeContent';
import postService from '../services/post.service';
// Tùng: I-AI-01 — chỉ create/comment dùng contract Moderation; feed/vote/report giữ service cũ.
import postContentService from '../services/postContent.service';
import styles from './PostFeedPage.module.css';

// Khoi's code: menu, thu gọn thanh bên, ngăn kéo điện thoại đã chuyển sang components/MemberLayout (11/10/2026)

/** Đọc 1 tham số trên URL lúc mở trang (?q=…, ?compose=1) */
const initialParam = (key) => new URLSearchParams(window.location.search).get(key)?.slice(0, 100) ?? '';

// Người dùng tắt hiệu ứng trong hệ điều hành → thẻ bài hiện ngay, không mờ dần
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * @param {{id, fullName, avatarUrl?}|null} user   null = khách (lấy từ useAuth() ở App)
 * @param {() => void} [onLogin] · [onRegister]
 * @param {{icon?, label, onClick}[]} [accountMenu]  vd Đăng xuất
 */
// Tùng — Sprint 2: shopAction là prop tùy chọn, giữ nguyên các consumer feed/guest khác.
export default function PostFeedPage({ user, onLogin, onRegister, accountMenu = [], shopAction }) {
  const toast = useToast();
  const isGuest = !user;
  const viewerId = String(user?.id ?? 'guest');
  const viewerRef = useRef({ id: viewerId });
  if (viewerRef.current.id !== viewerId) viewerRef.current = { id: viewerId };
  const viewerContext = viewerRef.current;
  const isViewerCurrent = useCallback((context) => viewerRef.current === context, []);

  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Khoi's code: trang khác (vd Tạo công thức) chuyển về Bảng tin kèm ?q=… để tìm luôn
  const [searchText, setSearchText] = useState(() => (isGuest ? '' : initialParam('q'))); // đang gõ
  const [query, setQuery] = useState(() => (isGuest ? '' : initialParam('q')));           // đã bấm Enter
  const [categoryId, setCategoryId] = useState(null); // Khoi's code: lọc theo danh mục (null = Tất cả)

  const [opened, setOpened] = useState(null);       // { id, toComments }
  const [reportTarget, setReportTarget] = useState(null); // { type, id, title }
  const [loginOpen, setLoginOpen] = useState(false);

  const requireLogin = () => setLoginOpen(true);

  // ---------- Khoi's code: Đăng bài (Sprint 2) ----------
  const [createOpen, setCreateOpen] = useState(false);
  const [categories, setCategories] = useState({ status: 'idle', items: [] }); // idle | loading | ready | error

  const loadCategories = async () => {
    setCategories((c) => ({ ...c, status: 'loading' }));
    try {
      const { items: list } = await postService.getCategories();
      setCategories({ status: 'ready', items: list });
    } catch (err) {
      setCategories({ status: 'error', items: [], error: err.message || 'Vui lòng thử lại sau.' });
    }
  };

  const openCreate = () => {
    if (isGuest) { requireLogin(); return; }
    if (categories.status !== 'ready' && categories.status !== 'loading') loadCategories(); // tải tag 1 lần, lỗi thì lần mở sau tải lại
    setCreateOpen(true);
  };

  // Thành viên: tải danh mục ngay để dựng hàng lọc (hộp Đăng bài dùng lại danh sách này)
  useEffect(() => {
    if (!isGuest) loadCategories();
  }, [isGuest]);

  // Khoi's code: bấm "+ Đăng bài" ở trang khác → về Bảng tin với ?compose=1 → mở hộp Đăng bài, rồi xoá tham số khỏi URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('compose') && !params.has('q')) return;
    if (params.get('compose') === '1' && !isGuest) setCreateOpen(true);
    window.history.replaceState(null, '', window.location.pathname);
  }, [isGuest]);

  /** D-10: đăng xong ở lại trang, báo "đang chờ duyệt". Bài pending chưa hiện trên Bảng tin nên không cần tải lại. */
  const submitPost = async (data) => {
    // Tùng: giữ flow cũ để đối chiếu:
    // await postService.createPost(data); // lỗi → CreatePostModal tự hiện câu lỗi, giữ nháp
    // toast('Bài viết đã được gửi và đang chờ Admin duyệt.', { tone: 'info' });
    const context = viewerRef.current;
    const result = await postContentService.createPost(data);
    if (!isViewerCurrent(context)) throw new Error('Tài khoản đã thay đổi. Vui lòng mở lại bản nháp.');
    if (result.outcome === 'approved') {
      toast('Bài viết đã được duyệt và công khai.');
      setReloadKey((key) => key + 1);
    } else if (result.outcome === 'rejected') {
      toast(result.post.moderationNote || 'Bài viết đã bị từ chối.', { tone: 'alert', duration: 6000 });
    } else {
      toast('Bài viết đã được gửi và đang chờ Admin duyệt.', { tone: 'info' });
    }
    result.warnings.forEach((warning) => toast(warning.message, { tone: 'info' }));
  };

  // Tùng: server trả public count; không cộng cho refusal/replay.
  // Cũ: onCommentAdded={(id) => setItems((list) => list.map((p) => (p.id === id ? { ...p, commentCount: p.commentCount + 1 } : p)))}
  const updatePublicCommentCount = useCallback((id, count) => {
    setItems((list) => list.map((post) => (post.id === id ? { ...post, commentCount: count } : post)));
  }, []);

  // ---------- Tải trang đầu (đổi khách/thành viên, đổi từ khoá, bấm Thử lại) ----------
  useEffect(() => {
    let ignore = false; // bỏ kết quả cũ nếu người dùng tìm liên tục
    setStatus('loading');
    (async () => {
      try {
        const res = isGuest ? await postService.getPreview() : await postService.getFeed({ q: query, categoryId });
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
  }, [isGuest, query, categoryId, reloadKey]);

  // ---------- Lướt vô hạn ----------
  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await postService.getFeed({ cursor: nextCursor, q: query, categoryId });
      setItems((list) => [...list, ...res.items]);
      setNextCursor(res.nextCursor ?? null);
    } catch (err) {
      toast(err.message || 'Không tải thêm được bài', { tone: 'alert' });
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, query, categoryId, toast]);

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

  const clearSearch = () => { setSearchText(''); setQuery(''); };

  return (
    <MemberLayout
      activeKey="feed"
      user={user}
      accountMenu={accountMenu}
      shopAction={shopAction}
      onCreate={openCreate}
      onLogin={onLogin}
      onRegister={onRegister}
      renderTopbar={({ openMenu }) => (
        <FeedTopbar
          value={searchText}
          onChange={setSearchText}
          onSearch={(value) => (value ? search(value) : clearSearch())}
          onOpenMenu={openMenu}
          onLogin={isGuest ? onLogin : undefined}
        />
      )}
    >
        {/* 3 cột (lưới --v-cols chung với thanh trên): lời chào | bảng tin | (cột phải để trống) */}
        <div className={styles.layout}>
        <aside className={styles.left} aria-label="Lời chào">
          <FeedGreeting user={toPerson(user)} />
        </aside>

        <main className={styles.feed} aria-labelledby="feed-title">
          {/* Khoi's code: ô đăng nhanh → mở hộp Đăng bài đầy đủ (Sprint 2) */}
          {!isGuest && !query && <FeedComposer user={toPerson(user)} onCompose={openCreate} />}

          <div className={styles.feedHead}>
            <h1 id="feed-title" className={styles.feedTitle}>{query ? 'Kết quả tìm kiếm' : 'Bảng tin'}</h1>
            {/* Khách chỉ xem 3 bài cố định → không có lọc */}
            {!isGuest && categories.status === 'ready' && categories.items.length > 0 && (
              <FeedFilter options={categories.items} value={categoryId} onChange={setCategoryId} />
            )}
          </div>

          {isGuest && (
            <Notice tone="info" title="Bạn đang xem với tư cách khách">
              Đây là 3 bài nổi bật gần nhất. Đăng nhập để lướt tiếp, thích, bình luận và báo cáo bài viết.
            </Notice>
          )}

          {query && status !== 'error' && (
            <div className={styles.searchBar}>
              <span>Bài có tiêu đề chứa <b>“{query}”</b></span>
              <Button size="sm" variant="subtle" icon="x-lg" onClick={clearSearch}>Xoá tìm kiếm</Button>
            </div>
          )}

          {status === 'loading' && (
            <div className={styles.list} aria-busy="true">
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
            query || categoryId
              ? <EmptyState icon="search" title="Không tìm thấy bài viết nào">{query ? 'Thử từ khoá khác, ví dụ “canh” hoặc “chè”.' : 'Danh mục này chưa có bài nào. Chọn “Tất cả” để xem mọi bài.'}</EmptyState>
              : <EmptyState icon="flower3" title="Chưa có bài viết nào">Bài mới sẽ hiện ở đây sau khi được Admin duyệt.</EmptyState>
          )}

          {status === 'ready' && items.map((post, i) => {
            const card = (
              <FeedPostCard
                postType={post.type}
                title={post.title}
                excerpt={stripMarks(post.content)}
                href={`#bai-${post.id}`}
                thumbnailUrl={post.thumbnailUrl}
                youtubeVideoId={post.type === 'video' ? getYouTubeId(post.youtubeUrl ?? '') : undefined}
                author={toPerson(post.author)}
                createdAt={post.publishedAt ?? post.createdAt}
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
            );
            // Hiện dần khi cuộn tới (React Bits · FadeContent); 2 bài đầu so le cho mượt
            return reduceMotion() ? <div key={post.id}>{card}</div> : (
              <FadeContent key={post.id} blur duration={800} delay={i < 2 ? i * 120 : 0} threshold={0.12}>
                {card}
              </FadeContent>
            );
          })}

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
            <p className={styles.end}>Bạn đã xem hết bài viết</p>
          )}
        </main>
        </div>

      <PostDetailModal
        key={`${viewerId}:${openedPost?.id ?? ''}`}
        post={openedPost}
        toComments={opened?.toComments}
        user={user}
        onClose={() => setOpened(null)}
        onVote={vote}
        onReport={askReport}
        isMine={openedPost ? isMine(openedPost) : false}
        onRequireLogin={requireLogin}
        viewerContext={viewerContext}
        isViewerCurrent={isViewerCurrent}
        onCommentCountChange={updatePublicCommentCount}
      />

      <ReportDialog
        open={reportTarget != null}
        targetType={reportTarget?.type}
        targetTitle={reportTarget?.title}
        onSubmit={submitReport}
        onClose={() => setReportTarget(null)}
      />

      {/* Khoi's code: hộp Đăng bài (Sprint 2) */}
      <CreatePostModal
        key={viewerId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        categories={categories}
        onRetryCategories={loadCategories}
        onSubmit={submitPost}
        onUpload={postService.uploadImage}
      />

      <LoginPrompt
        open={loginOpen}
        reason="action"
        onLogin={() => { setLoginOpen(false); onLogin?.(); }}
        onRegister={() => { setLoginOpen(false); onRegister?.(); }}
        onClose={() => setLoginOpen(false)}
      />
    </MemberLayout>
  );
}

// =====================================================================
//  Chi tiết bài (mở tại chỗ như Facebook) — chỉ trang này dùng nên để chung file
// =====================================================================
// Tùng: cũ nhận onCommentAdded và cộng 1; contract mới nhận count công khai từ server.
function PostDetailModal({ post, toComments, user, isMine, onClose, onVote, onReport, onRequireLogin,
  viewerContext, isViewerCurrent, onCommentCountChange }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const postId = post?.id;
  const sectionId = `binh-luan-${postId}`;
  const activeContextRef = useRef(null);
  const loadingRequestRef = useRef(null);

  // Mở bài nào thì tải bình luận của bài đó
  useEffect(() => {
    if (!postId) return undefined;
    // Tùng: cũ chỉ guard postId bằng `let ignore = false` và cleanup `ignore = true`.
    // postService.getComments(postId)
    //   .then((res) => { if (!ignore) setComments(res.items); })
    //   .catch(() => { if (!ignore) setComments([]); })
    //   .finally(() => { if (!ignore) setLoading(false); });
    const context = { postId, viewerContext };
    activeContextRef.current = context;
    const isCurrent = () => activeContextRef.current === context && isViewerCurrent(viewerContext);
    setComments([]);
    setLoading(true);
    loadingRequestRef.current = postContentService.getComments(postId)
      .then((res) => {
        if (!isCurrent()) return;
        setComments(res.items);
        onCommentCountChange(postId, res.publicCommentCount);
      })
      .catch(() => { if (isCurrent()) setComments([]); })
      .finally(() => { if (isCurrent()) setLoading(false); });
    return () => { if (activeContextRef.current === context) activeContextRef.current = null; };
  }, [postId, viewerContext, isViewerCurrent, onCommentCountChange]);

  // Bấm nút bình luận ở thẻ → cuộn thẳng xuống khu bình luận
  useEffect(() => {
    if (postId && toComments && !loading) document.getElementById(sectionId)?.scrollIntoView({ block: 'start' });
  }, [postId, toComments, loading, sectionId]);

  if (!post) return null;

  const addComment = async (content, options) => {
    // Tùng: cũ await postService.addComment(post.id, content), append mọi result rồi onCommentAdded(post.id).
    const context = activeContextRef.current;
    const isCurrent = () => context && activeContextRef.current === context && isViewerCurrent(viewerContext);
    if (!isCurrent()) throw new Error('Ngữ cảnh bình luận đã thay đổi. Vui lòng mở lại bài viết.');
    // Đợi GET đầu kết thúc để response cũ không ghi đè comment vừa gửi.
    await loadingRequestRef.current;
    if (!isCurrent()) throw new Error('Ngữ cảnh bình luận đã thay đổi. Vui lòng mở lại bài viết.');
    const created = await postContentService.addComment(post.id, content, options);
    if (!isCurrent()) throw new Error('Ngữ cảnh bình luận đã thay đổi. Vui lòng mở lại bài viết.');
    if (created.displayable) {
      setComments((list) => [created, ...list.filter((comment) => comment.id !== created.id)]);
    } else {
      setComments((list) => list.filter((comment) => comment.id !== created.id));
    }
    onCommentCountChange(post.id, created.publicCommentCount);
  };

  return (
    <Modal open onClose={onClose} title={post.title} size="lg">
      <article className={styles.detail}>
        <header className={styles.detailHead}>
          <Avatar src={post.author.avatarUrl} name={post.author.fullName} size={40} />
          <div>
            <b>{post.author.fullName}</b>
            <span className={styles.muted}> · <time dateTime={post.publishedAt ?? post.createdAt}>{timeAgo(post.publishedAt ?? post.createdAt)}</time></span>
          </div>
        </header>

        {/* Chữ → thẻ chủ đề → hình, giống thẻ bài ngoài Bảng tin */}
        {post.content && <div className={styles.content}><PostRichText text={post.content} /></div>}

        {post.categories?.length > 0 && (
          <div className={cardStyles.tags}>{post.categories.map((c) => <span key={c.id} className={cardStyles.tag}>#{c.name}</span>)}</div>
        )}

        {post.type === 'video'
          ? <YouTubeEmbed url={post.youtubeUrl} title={post.title} />
          : post.thumbnailUrl && <Photo src={post.thumbnailUrl} ratio="16/9" shape="rounded" />}

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
          key={`${postId}:${viewerContext.id}`}
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
