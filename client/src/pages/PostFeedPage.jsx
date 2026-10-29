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
  Button, EmptyState, LoginPrompt, Notice,
  ReportDialog, SkeletonCard, Spinner, getYouTubeId, useToast,
} from '../components';
// Khoi's code: Đăng bài (Sprint 2) + hiện **đậm** *nghiêng* trong nội dung bài
import CreatePostModal from '../components/CreatePostModal/CreatePostModal';
import { stripMarks } from '../components/PostRichText/PostRichText';
import FeedComposer from '../components/FeedComposer/FeedComposer';
import FeedFilter from '../components/FeedFilter/FeedFilter';
import FeedGreeting from '../components/FeedGreeting/FeedGreeting';
import FeedPostCard from '../components/FeedPostCard/FeedPostCard';
import MemberLayout, { toPerson } from '../components/MemberLayout/MemberLayout';
import PostDetailModal from '../components/PostDetailModal/PostDetailModal';
import FeedTopbar from '../components/FeedTopbar/FeedTopbar';
import FadeContent from '../components/reactbits/FadeContent';
import postService from '../services/post.service';
import styles from './PostFeedPage.module.css';

// Khoi's code: menu, thu gọn thanh bên, ngăn kéo điện thoại đã chuyển sang components/MemberLayout (11/10/2026)

/** Đọc 1 tham số trên URL lúc mở trang (?q=…, ?compose=1) */
const initialParam = (key) => new URLSearchParams(window.location.search).get(key)?.slice(0, 100) ?? '';

// Khoi's code 28/10: phạm vi tìm trên thanh trên (server: ?in=, xem server/src/utils/postSearch.js). Tìm không phân biệt dấu.
const SEARCH_SCOPES = [
  { value: 'all', label: 'Tất cả', icon: 'grid', placeholder: 'Tìm bài viết, tác giả hoặc chủ đề…', result: 'Bài có tiêu đề, tác giả hoặc chủ đề khớp' },
  { value: 'title', label: 'Tiêu đề', icon: 'card-heading', hint: 'Tiêu đề bài viết', placeholder: 'Tìm theo tiêu đề bài viết…', result: 'Bài có tiêu đề chứa' },
  { value: 'author', label: 'Tác giả', icon: 'person', hint: 'Tên người đăng', placeholder: 'Tìm theo tên tác giả…', result: 'Bài của tác giả có tên chứa' },
  // 29/10: bỏ Hashtag (DB chưa có) → Chủ đề = danh mục gắn cho bài
  { value: 'topic', label: 'Chủ đề', icon: 'bookmark', hint: 'Ví dụ: Kinh nghiệm, Món chính', placeholder: 'Tìm theo chủ đề, ví dụ: kinh nghiệm', result: 'Bài thuộc chủ đề có tên chứa' },
];
const scopeOf = (v) => SEARCH_SCOPES.find((o) => o.value === v) ?? SEARCH_SCOPES[0];

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

  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Khoi's code: trang khác (vd Tạo công thức) chuyển về Bảng tin kèm ?q=… để tìm luôn
  const [searchText, setSearchText] = useState(() => (isGuest ? '' : initialParam('q'))); // đang gõ
  const [query, setQuery] = useState(() => (isGuest ? '' : initialParam('q')));           // đã bấm Enter
  const [scope, setScope] = useState(() => scopeOf(initialParam('in')).value); // Khoi's code 28/10: phạm vi tìm (?in=)
  const searchScope = query ? scope : 'all'; // chưa tìm thì đổi phạm vi không cần tải lại bảng tin
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
    if (!params.has('compose') && !params.has('q') && !params.has('in')) return;
    if (params.get('compose') === '1' && !isGuest) setCreateOpen(true);
    window.history.replaceState(null, '', window.location.pathname);
  }, [isGuest]);

  /** D-10: đăng xong ở lại trang, báo "đang chờ duyệt". Bài pending chưa hiện trên Bảng tin nên không cần tải lại. */
  const submitPost = async (data) => {
    await postService.createPost(data); // lỗi → CreatePostModal tự hiện câu lỗi, giữ nháp
    toast('Bài viết đã được gửi và đang chờ Admin duyệt.', { tone: 'info' });
  };

  // ---------- Tải trang đầu (đổi khách/thành viên, đổi từ khoá, bấm Thử lại) ----------
  useEffect(() => {
    let ignore = false; // bỏ kết quả cũ nếu người dùng tìm liên tục
    setStatus('loading');
    (async () => {
      try {
        const res = isGuest ? await postService.getPreview() : await postService.getFeed({ q: query, scope: searchScope, categoryId });
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
  }, [isGuest, query, searchScope, categoryId, reloadKey]);

  // ---------- Lướt vô hạn ----------
  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await postService.getFeed({ cursor: nextCursor, q: query, scope: searchScope, categoryId });
      setItems((list) => [...list, ...res.items]);
      setNextCursor(res.nextCursor ?? null);
    } catch (err) {
      toast(err.message || 'Không tải thêm được bài', { tone: 'alert' });
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, query, searchScope, categoryId, toast]);

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
  // Khoi's code 28/10: đổi phạm vi khi đang có kết quả → tìm lại ngay theo phạm vi mới
  const changeScope = setScope;
  // Thẻ bài hiện chủ đề dạng "#Món chính" → gõ "#…" ở Tất cả cũng là tìm chủ đề (giống server)
  const topicQuery = searchScope === 'topic' || (searchScope === 'all' && query.startsWith('#'));
  const scopeInfo = scopeOf(topicQuery ? 'topic' : searchScope);
  const shownQuery = topicQuery ? query.replace(/^#+/, '').trim() : query;

  const openedPost = opened && items.find((p) => p.id === opened.id);

  // Khoi's code 29/10: hàng lọc xếp chủ đề theo số bài đang hiện (nhiều nhất trước) → 4 nút đầu là chủ đề hay dùng nhất
  const topicsByUse = [...categories.items].sort((a, b) => (b.postCount ?? 0) - (a.postCount ?? 0) || a.name.localeCompare(b.name, 'vi'));
  // Bấm chip chủ đề trên thẻ bài / trong bài → lọc Bảng tin theo chủ đề đó, cuộn lên đầu
  const filterByTopic = (topic) => {
    if (isGuest) { requireLogin(); return; }
    setOpened(null);
    setCategoryId(topic.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
          scopes={SEARCH_SCOPES}
          scope={scope}
          onScopeChange={changeScope}
          placeholder={scopeOf(scope).placeholder}
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
              <FeedFilter options={topicsByUse} value={categoryId} onChange={setCategoryId} />
            )}
          </div>

          {isGuest && (
            <Notice tone="info" title="Bạn đang xem với tư cách khách">
              Đây là 3 bài nổi bật gần nhất. Đăng nhập để lướt tiếp, thích, bình luận và báo cáo bài viết.
            </Notice>
          )}

          {query && status !== 'error' && (
            <div className={styles.searchBar}>
              <span>
                {scopeInfo.result} <b>“{shownQuery}”</b>
              </span>
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
              ? <EmptyState icon="search" title="Không tìm thấy bài viết nào">{query ? (topicQuery ? 'Không có chủ đề nào khớp. Thử “kinh nghiệm”, “món chính” hoặc chọn “Tất cả”.' : 'Thử từ khoá khác, ví dụ “canh” hoặc “chè”, hoặc đổi phạm vi tìm.') : 'Chủ đề này chưa có bài nào. Chọn “Tất cả” để xem mọi bài.'}</EmptyState>
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
                onTopicClick={filterByTopic}
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
        post={openedPost}
        toComments={opened?.toComments}
        user={user}
        onClose={() => setOpened(null)}
        onVote={vote}
        onReport={askReport}
        isMine={openedPost ? isMine(openedPost) : false}
        onRequireLogin={requireLogin}
        onTopicClick={filterByTopic}
        onCommentAdded={(id) => setItems((list) => list.map((p) => (p.id === id ? { ...p, commentCount: p.commentCount + 1 } : p)))}
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
