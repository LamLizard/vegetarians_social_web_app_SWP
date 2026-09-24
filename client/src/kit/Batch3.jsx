import { useState } from 'react';
import {
  Avatar, Button, Chip, CommentSection, IconButton, LoginPrompt, Menu, Photo, PostCard, PostComposer, ReportDialog,
  StatusBadge, TextField, VoteButton, YouTubeEmbed, useToast, getYouTubeId, rules, timeAgo, formatNumber,
} from '../components';
import Section, { DemoLabel } from './Section';
import { mockUpload, wait } from './mock';
import styles from './kit.module.css';

// ---------------- Dữ liệu mẫu ----------------
const ago = (min) => new Date(Date.now() - min * 60_000).toISOString();
const ME = { name: 'Lâm Anh Khôi' };
const CATS = [{ id: 1, name: 'Món nước' }, { id: 14, name: 'Chay miền Nam' }];

const BLOG = {
  postType: 'blog',
  title: 'Bún riêu chay nấm rơm, nước dùng ngọt từ cà chua và me',
  excerpt: 'Công thức cho 4 người, không dùng bột nêm có nguồn gốc động vật. Chả làm từ đậu hũ non trộn nấm rơm băm, hấp 15 phút rồi thả vào nồi. Nước dùng nấu từ củ cải, bắp và su su trong 45 phút.',
  href: '#3-08',
  author: { name: 'Dương Vĩ Lâm' },
  createdAt: ago(135),
  categories: CATS,
  voteCount: 67,
  commentCount: 12,
  viewCount: 1250,
};
const VIDEO = {
  postType: 'video',
  title: 'Cách làm chả lụa chay dai giòn không cần hàn the',
  excerpt: 'Video 8 phút hướng dẫn từng bước, dùng tàu hũ ky và bột năng.',
  href: '#3-08',
  youtubeVideoId: 'dQw4w9WgXcQ',
  author: { name: 'Mai Khương Duy' },
  createdAt: ago(60 * 26),
  categories: [{ id: 5, name: 'Món hấp' }, { id: 14, name: 'Chay miền Nam' }, { id: 11, name: 'Bánh' }, { id: 16, name: 'Chay miền Trung' }],
  voteCount: 1840,
  commentCount: 96,
  viewCount: 24500,
};
const MY_POSTS = [
  { ...BLOG, title: 'Salad đậu gà rang, sốt mè rang', author: ME, createdAt: ago(3), status: 'pending', voteCount: 0, commentCount: 0, thumbnailUrl: undefined },
  { ...BLOG, author: ME, status: 'public', viewCount: 312 },
  { ...VIDEO, title: 'Review quán chay mới mở ở Quận 3', author: ME, status: 'rejected', moderationNote: 'Video là review quán, không phải hướng dẫn nấu món chay. Vui lòng đăng lại đúng chủ đề.' },
  { ...BLOG, title: 'Mẹo làm nước tương tỏi ớt', author: ME, status: 'hidden', moderationNote: 'Bài bị nhiều người báo cáo có chứa link quảng cáo.' },
];

const INITIAL_COMMENTS = [
  { id: 3, author: { name: 'Mai Khương Duy' }, content: 'Mình thử nấu cuối tuần rồi, thêm chút sả đập dập vào nồi nước dùng thơm hơn hẳn!', createdAt: ago(40) },
  { id: 2, author: ME, content: 'Chả hấp 15 phút có bị bở không bạn?', createdAt: ago(90), edited: true, isOwner: true },
  { id: 1, author: { name: 'Người dùng' }, content: '', createdAt: ago(120), status: 'hidden' },
];

const CATEGORY_OPTIONS = [
  'Món nước', 'Món khô', 'Món xào', 'Món chiên', 'Món hấp', 'Món nướng', 'Canh & súp', 'Gỏi & salad',
  'Cơm', 'Bún & phở', 'Bánh', 'Tráng miệng', 'Đồ uống', 'Chay miền Nam', 'Chay miền Bắc', 'Chay miền Trung',
].map((label, i) => ({ value: i + 1, label }));

const STATUS_POST = {
  postType: 'blog',
  title: 'Các bạn gợi ý cho mình hôm nay ăn gì với ạ? Nhà còn đậu hũ, nấm đông cô với một bó rau muống.',
  href: '#3-09',
  author: { name: 'Lê Nguyễn Minh Thắng' },
  createdAt: ago(18),
  categories: [{ id: 9, name: 'Cơm' }, { id: 3, name: 'Món xào' }],
  voteCount: 14,
  commentCount: 3,
  viewCount: 96,
};
const STATUS_COMMENTS = [
  { id: 13, author: { name: 'Dương Vĩ Lâm' }, content: 'Đậu hũ kho nấm đông cô + rau muống xào tỏi (bỏ tỏi nếu kiêng ngũ vị tân). 20 phút là xong một mâm!', createdAt: ago(12) },
  { id: 12, author: { name: 'Mai Khương Duy' }, content: 'Canh rau muống nấu chua với đậu hũ chiên cũng ngon nè, trời nóng ăn rất hợp.', createdAt: ago(9) },
  { id: 11, author: { name: 'Lê Nguyễn Minh Thắng' }, content: 'Cảm ơn mọi người, tối nay mình nấu đậu hũ kho nấm nha 😄', createdAt: ago(3) },
];

// ---------------- Trang mẫu M-03 ----------------
function BlogDetail() {
  const toast = useToast();
  const [loggedIn, setLoggedIn] = useState(true);
  const [voted, setVoted] = useState(false);
  const [votes, setVotes] = useState(67);
  const [comments, setComments] = useState(INITIAL_COMMENTS);
  const [report, setReport] = useState(null); // { type, title }
  const [login, setLogin] = useState(false);

  const requireLogin = (fn) => (...args) => (loggedIn ? fn(...args) : setLogin(true));

  const toggleVote = requireLogin(() => {
    setVoted((v) => !v);
    setVotes((n) => n + (voted ? -1 : 1));
  });

  const create = async (content) => {
    await wait(700);
    if (/quảng cáo|xxx/i.test(content)) throw new Error('Bình luận chứa từ ngữ không phù hợp. Vui lòng sửa lại.');
    setComments((list) => [{ id: Date.now(), author: ME, content, createdAt: new Date().toISOString(), isOwner: true }, ...list]);
  };
  const update = async (id, content) => {
    await wait(600);
    setComments((list) => list.map((c) => (c.id === id ? { ...c, content, edited: true } : c)));
  };
  const remove = async (id) => {
    await wait(600);
    setComments((list) => list.filter((c) => c.id !== id));
    toast('Đã xoá bình luận');
  };

  return (
    <div className={styles.detail}>
      <div className={styles.row}>
        <Button size="sm" variant={loggedIn ? 'outline' : 'primary'} icon={loggedIn ? 'person-check' : 'person'} onClick={() => setLoggedIn((v) => !v)}>
          {loggedIn ? 'Đang xem với vai: Thành viên' : 'Đang xem với vai: Khách'}
        </Button>
      </div>

      <article className={styles.article}>
        <div className={styles.chipsRow}>{CATS.map((c) => <Chip key={c.id}>{c.name}</Chip>)}</div>
        <h2 className={styles.articleTitle}>{BLOG.title}</h2>
        <div className={styles.byline}>
          <Avatar name={BLOG.author.name} size={44} />
          <div>
            <b>{BLOG.author.name}</b>
            <span>{timeAgo(BLOG.createdAt)} · {formatNumber(BLOG.viewCount)} lượt xem</span>
          </div>
          <span className={styles.spacer} />
          <Menu
            renderTrigger={(p) => <IconButton icon="three-dots" label="Tuỳ chọn bài viết" variant="soft" {...p} />}
            items={[
              { icon: 'link-45deg', label: 'Sao chép liên kết', onClick: () => toast('Đã sao chép liên kết') },
              { icon: 'flag', label: 'Báo cáo bài viết', onClick: requireLogin(() => setReport({ type: 'post', title: BLOG.title })) },
            ]}
          />
        </div>
        <Photo ratio="16/9" shape="rounded" alt="Tô bún riêu chay" />
        <div className={styles.prose}>
          <p>Bún riêu chay là món mình nấu mỗi rằm. Điểm mấu chốt là <b>nước dùng</b> phải ngọt thanh từ rau củ, và <b>riêu</b> phải xốp mà không bở.</p>
          <h3>Nguyên liệu (4 người)</h3>
          <ul><li>300g đậu hũ non, 150g nấm rơm</li><li>4 quả cà chua chín, 2 muỗng me chua</li><li>1 củ cải trắng, 2 trái bắp, 1 trái su su</li></ul>
          <h3>Cách làm</h3>
          <p>Hầm củ cải, bắp, su su 45 phút lấy nước dùng. Tán đậu hũ non với nấm rơm băm, nêm muối tiêu, hấp 15 phút rồi cắt miếng thả vào nồi.</p>
        </div>
        <div className={styles.articleActions}>
          <VoteButton voted={voted} count={votes} onToggle={toggleVote} />
          <Button variant="subtle" size="sm" icon="chat" as="a" href="#binh-luan">Bình luận</Button>
          <Button variant="subtle" size="sm" icon="share" onClick={() => toast('Đã sao chép liên kết')}>Chia sẻ</Button>
        </div>
      </article>

      <CommentSection
        comments={comments}
        total={comments.filter((c) => c.status !== 'hidden').length}
        currentUser={loggedIn ? ME : null}
        onCreate={create}
        onUpdate={update}
        onDelete={remove}
        onReport={requireLogin((id) => setReport({ type: 'comment', title: comments.find((c) => c.id === id)?.content.slice(0, 60) }))}
        onRequireLogin={() => setLogin(true)}
        hasMore
        onLoadMore={() => toast('Tải thêm bình luận (trang sau gọi API)', { tone: 'info' })}
      />

      <ReportDialog
        open={!!report}
        targetType={report?.type}
        targetTitle={report?.title}
        onSubmit={async ({ reasonCode }) => { await wait(700); toast(`Đã gửi báo cáo (${reasonCode}). Admin sẽ xem xét.`, { tone: 'info' }); }}
        onClose={() => setReport(null)}
      />
      <LoginPrompt open={login} reason="action" onLogin={() => { setLogin(false); setLoggedIn(true); }} onRegister={() => setLogin(false)} onClose={() => setLogin(false)} />
    </div>
  );
}


// ---------------- Trang mẫu 3-09: Đăng nhanh trên bảng tin ----------------
function QuickPostFeed() {
  const toast = useToast();
  const [loggedIn, setLoggedIn] = useState(true);
  const [mine, setMine] = useState([]);
  const [login, setLogin] = useState(false);
  const [comments, setComments] = useState(STATUS_COMMENTS);

  const submit = async (post) => {
    await wait(800);
    if (/quảng cáo|xxx/i.test(`${post.title} ${post.content}`)) throw new Error('Bài có từ ngữ không phù hợp ("quảng cáo"). Vui lòng sửa lại.');
    if (mine.length >= 3) throw new Error('Bạn đã đăng 3 bài trong 1 giờ. Thử lại sau nhé (BR-05).');
    const cats = CATEGORY_OPTIONS.filter((c) => post.categoryIds.includes(c.value)).map((c) => ({ id: c.value, name: c.label }));
    setMine((list) => [{
      ...post, id: Date.now(), excerpt: post.content, href: '#3-09', author: ME, createdAt: new Date().toISOString(),
      categories: cats, status: 'pending', voteCount: 0, commentCount: 0,
    }, ...list]);
    toast('Đã gửi bài. Bài sẽ hiện công khai sau khi Admin duyệt.');
  };

  return (
    <div className={styles.detail}>
      <div className={styles.row}>
        <Button size="sm" variant={loggedIn ? 'outline' : 'primary'} icon={loggedIn ? 'person-check' : 'person'} onClick={() => setLoggedIn((v) => !v)}>
          {loggedIn ? 'Đang xem với vai: Thành viên' : 'Đang xem với vai: Khách'}
        </Button>
      </div>

      <PostComposer
        currentUser={loggedIn ? ME : null}
        categories={CATEGORY_OPTIONS}
        onSubmit={submit}
        onUpload={mockUpload(false)}
        onOpenBlogEditor={(draft) => toast(draft.title ? `Sang form Viết Blog (M-05), điền sẵn: "${draft.title.slice(0, 40)}"` : 'Sang form Viết Blog (M-05)', { tone: 'info' })}
        onOpenVideoEditor={() => toast('Sang form Đăng Video (M-06)', { tone: 'info' })}
        onRequireLogin={() => setLogin(true)}
      />

      {mine.map((p) => (
        <PostCard key={p.id} {...p} isOwner onEdit={() => toast('Mở trang sửa bài', { tone: 'info' })}
          onDelete={() => setMine((list) => list.filter((x) => x.id !== p.id))} />
      ))}
      <PostCard {...STATUS_POST} commentCount={comments.length} onVote={() => (loggedIn ? toast('Đã thích') : setLogin(true))} onReport={() => toast('Mở ReportDialog', { tone: 'info' })} />

      <div className={styles.stackSm}>
        <DemoLabel>Mở bài trên (M-03): mọi người gợi ý món trong bình luận</DemoLabel>
        <CommentSection
          id="binh-luan-status"
          comments={comments}
          currentUser={loggedIn ? ME : null}
          onCreate={async (content) => { await wait(500); setComments((l) => [...l, { id: Date.now(), author: ME, content, createdAt: new Date().toISOString(), isOwner: true }]); }}
          onUpdate={async (id, content) => { await wait(400); setComments((l) => l.map((c) => (c.id === id ? { ...c, content, edited: true } : c))); }}
          onDelete={async (id) => { await wait(400); setComments((l) => l.filter((c) => c.id !== id)); }}
          onReport={() => toast('Mở ReportDialog', { tone: 'info' })}
          onRequireLogin={() => setLogin(true)}
        />
      </div>

      <LoginPrompt open={login} reason="action" onLogin={() => { setLogin(false); setLoggedIn(true); }} onRegister={() => setLogin(false)} onClose={() => setLogin(false)} />
    </div>
  );
}

// ---------------- Các mục đợt 3 ----------------
export default function Batch3() {
  const toast = useToast();
  const [votedA, setVotedA] = useState(false);
  const [videoUrl, setVideoUrl] = useState('https://youtu.be/dQw4w9WgXcQ');
  const [report, setReport] = useState(false);
  const [prompt, setPrompt] = useState(null);
  const videoError = rules.youtubeUrl()(videoUrl);

  return (
    <>
      <h2 className={styles.groupTitle}>Đợt 3 · Bài đăng <small>9 mục</small></h2>

      <Section
        code="3-01"
        title="PostCard · dạng thẻ"
        file="components/PostCard"
        when="bảng tin trang chủ (M-01), bài liên quan. Blog có ảnh bìa; Video tự lấy ảnh bìa YouTube và hiện nút Play."
        note="Trong trang xem trước này ảnh bìa YouTube bị chặn nên hiện nền lá dự phòng. Chạy npm run dev trên máy sẽ thấy ảnh thật."
        props={[
          ['layout', "'card'|'row'", "'card'", ''],
          ['postType', "'blog'|'video'", "'blog'", 'post.post_type'],
          ['title · excerpt', 'string', '', 'excerpt tối đa 3 dòng'],
          ['href · linkAs', 'string · Component', '', 'linkAs={Link} để dùng react-router'],
          ['thumbnailUrl · youtubeVideoId', 'string', '', ''],
          ['author', '{name, avatarUrl?}', '', ''],
          ['createdAt', 'ISO string', '', 'Hiện "2 giờ trước"'],
          ['categories', '{id, name}[]', '[]', 'Hiện tối đa 3 + "+1"'],
          ['voteCount · commentCount · viewCount', 'number', '', ''],
          ['voted · onVote', 'boolean · () => void', '', 'Không có onVote → ẩn nút thích'],
          ['isOwner · status · moderationNote', '', '', 'Chủ bài thấy trạng thái + lý do ẩn/từ chối'],
          ['onEdit · onDelete · onReport', '() => void', '', 'Menu "…" tự đổi theo isOwner'],
        ]}
        usage={`import { Link } from 'react-router-dom';

// Đổi dữ liệu API (snake_case) → props, viết 1 lần trong trang
const toCard = (p) => ({
  postType: p.post_type, title: p.title, excerpt: p.excerpt,
  href: \`/posts/\${p.post_id}\`, thumbnailUrl: p.thumbnail_url, youtubeVideoId: p.youtube_video_id,
  author: { name: p.author.full_name, avatarUrl: p.author.avatar_url },
  createdAt: p.created_at, categories: p.categories.map((c) => ({ id: c.category_id, name: c.name })),
  voteCount: p.vote_count, commentCount: p.comment_count, viewCount: p.view_count, voted: p.voted_by_me,
});

{posts.map((p) => (
  <PostCard key={p.post_id} {...toCard(p)} linkAs={Link}
    onVote={() => toggleVote(p.post_id)} onReport={() => openReport(p)} />
))}`}
      >
        <div className={styles.grid2}>
          <PostCard {...BLOG} voted={votedA} voteCount={BLOG.voteCount + (votedA ? 1 : 0)} onVote={() => setVotedA((v) => !v)}
            onReport={() => setReport(true)} />
          <PostCard {...VIDEO} onVote={() => toast('Đã thích video')} onReport={() => setReport(true)} />
        </div>
      </Section>

      <Section
        code="3-02"
        title="PostCard · dạng hàng"
        file="components/PostCard"
        when="kết quả tìm kiếm (M-02) và Bài của tôi (M-07). isOwner → hiện trạng thái, lý do bị từ chối/ẩn, menu Sửa/Xoá."
        usage={`<PostCard layout="row" {...toCard(p)} isOwner status={p.status} moderationNote={p.moderation_note}
  onEdit={() => navigate(\`/posts/\${p.post_id}/edit\`)} onDelete={() => setDeleting(p)} />`}
      >
        <div>
          <DemoLabel>Bài của tôi (M-07)</DemoLabel>
          <div className={styles.stackSm}>
            {MY_POSTS.map((p, i) => (
              <PostCard key={i} layout="row" {...p} isOwner onEdit={() => toast('Mở trang sửa bài', { tone: 'info' })} onDelete={() => toast('Mở hộp xác nhận xoá', { tone: 'info' })} />
            ))}
          </div>
        </div>
        <div>
          <DemoLabel>Kết quả tìm kiếm (M-02)</DemoLabel>
          <div className={styles.stackSm}>
            <PostCard layout="row" {...BLOG} onReport={() => setReport(true)} />
            <PostCard layout="row" {...VIDEO} onReport={() => setReport(true)} />
          </div>
        </div>
      </Section>

      <Section
        code="3-03"
        title="YouTubeEmbed"
        file="components/YouTubeEmbed"
        when="Chi tiết Video (M-04), xem trước khi Đăng Video (M-06). Chỉ tải trình phát khi người dùng bấm Play nên trang nhẹ. Link sai hoặc video bị gỡ → khung báo lỗi (NFR-07)."
        props={[
          ['videoId', 'string', '', 'post.youtube_video_id (ưu tiên)'],
          ['url', 'string', '', 'Hoặc link bất kỳ, tự lấy mã'],
          ['title', 'string', '', 'Cho trình đọc màn hình'],
          ['autoLoad', 'boolean', 'false', 'Hiện trình phát ngay'],
        ]}
        usage={`// M-06: xem trước khi đăng
<TextField label="Link YouTube" type="url" value={url} onChange={setUrl} error={rules.youtubeUrl()(url)} />
{getYouTubeId(url) && <YouTubeEmbed url={url} title={form.title} />}

// Gửi API: youtube_url = url, youtube_video_id = getYouTubeId(url)`}
      >
        <div className={styles.grid2}>
          <div className={styles.stackSm}>
            <DemoLabel>Đăng Video (M-06): dán link để xem trước</DemoLabel>
            <TextField label="Link YouTube" type="url" icon="youtube" value={videoUrl} onChange={setVideoUrl} error={videoError}
              hint={getYouTubeId(videoUrl) ? `youtube_video_id = ${getYouTubeId(videoUrl)}` : undefined} />
            {getYouTubeId(videoUrl) && <YouTubeEmbed url={videoUrl} title="Video xem trước" />}
          </div>
          <div className={styles.stackSm}>
            <DemoLabel>Link hỏng / video bị gỡ</DemoLabel>
            <YouTubeEmbed url="https://vimeo.com/123" title="Video lỗi" />
          </div>
        </div>
      </Section>

      <Section
        code="3-04"
        title="VoteButton"
        file="components/VoteButton"
        when="bình chọn một chiều cho bài (post_vote): bấm để thích, bấm lại để bỏ. Khách bấm → mở LoginPrompt."
        props={[
          ['voted · count', 'boolean · number', '', ''],
          ['onToggle', '() => void', '', 'Nên cập nhật giao diện ngay, API lỗi thì trả lại'],
          ['size', "'sm'|'md'", "'md'", ''],
          ['disabled', 'boolean', '', 'Bài chờ duyệt'],
        ]}
        usage={`const toggleVote = async () => {
  if (!user) return setLoginPrompt('action');
  setVoted(!voted); setCount(count + (voted ? -1 : 1));     // cập nhật ngay
  try { await api.toggleVote(postId); }
  catch { setVoted(voted); setCount(count); toast('Chưa bình chọn được', { tone: 'alert' }); }
};
<VoteButton voted={voted} count={count} onToggle={toggleVote} />`}
      >
        <div className={styles.row}>
          <VoteButton voted={votedA} count={67 + (votedA ? 1 : 0)} onToggle={() => setVotedA((v) => !v)} />
          <VoteButton voted count={1840} onToggle={() => {}} />
          <VoteButton count={12500} size="sm" onToggle={() => {}} />
          <VoteButton count={0} disabled />
        </div>
      </Section>

      <Section
        code="3-05"
        title="CommentSection · CommentItem · CommentComposer"
        file="components/Comment"
        when="khu bình luận dưới bài. Bình luận phẳng, không trả lời lồng nhau. Đã có sẵn: ô viết (Ctrl + Enter để gửi), sửa tại chỗ, hộp xác nhận xoá, trạng thái đang tải, trống, bị ẩn, Xem thêm."
        note="Thử ở trang mẫu 3-08 bên dưới: gõ bình luận có chữ 'quảng cáo' để thấy lỗi từ khoá cấm trả về từ Backend."
        props={[
          ['comments', '{id, author, content, createdAt, edited?, status?, isOwner?}[]', '', 'status hidden/deleted chỉ hiện 1 dòng'],
          ['total', 'number', '', 'post.comment_count'],
          ['currentUser', '{name, avatarUrl?}', '', 'Không có → hiện "Đăng nhập để bình luận"'],
          ['onCreate · onUpdate · onDelete', '(…) => Promise', '', 'Ném lỗi → hiện câu lỗi, giữ nội dung'],
          ['onReport · onRequireLogin', '() => void', '', ''],
          ['loading · hasMore · loadingMore · onLoadMore', '', '', ''],
        ]}
        usage={`<CommentSection
  comments={comments} total={post.comment_count} currentUser={user}
  onCreate={(text) => api.createComment(post.post_id, text).then(reload)}
  onUpdate={(id, text) => api.updateComment(id, text).then(reload)}
  onDelete={(id) => api.deleteComment(id).then(reload)}
  onReport={(id) => setReport({ type: 'comment', id })}
  onRequireLogin={() => setLoginPrompt('action')}
  hasMore={page < totalPages} onLoadMore={() => setPage(page + 1)} />`}
      >
        <p className="mb-0 small text-body-secondary">Demo đầy đủ nằm trong trang mẫu 3-08.</p>
      </Section>

      <Section
        code="3-06"
        title="ReportDialog"
        file="components/ReportDialog"
        when="báo cáo bài, bình luận, công thức (FR-24). Lý do lấy đúng report.reason_code; chọn 'Lý do khác' thì bắt buộc mô tả."
        props={[
          ['open · onClose', '', '', ''],
          ['targetType', "'post'|'comment'|'recipe'", "'post'", 'report.target_type'],
          ['targetTitle', 'string', '', 'Hiện dưới tiêu đề hộp'],
          ['onSubmit', '({reasonCode, reasonText}) => Promise', '', 'Ném lỗi → hiện trong hộp'],
        ]}
        usage={`<ReportDialog open={!!report} targetType={report?.type} targetTitle={report?.title}
  onSubmit={({ reasonCode, reasonText }) => api.createReport({
    target_type: report.type, target_id: report.id, reason_code: reasonCode, reason_text: reasonText })}
  onClose={() => setReport(null)} />`}
      >
        <div className={styles.row}>
          <Button variant="outline" icon="flag" onClick={() => setReport(true)}>Mở hộp báo cáo</Button>
        </div>
        <ReportDialog open={report} targetType="post" targetTitle={BLOG.title}
          onSubmit={async () => { await wait(700); toast('Đã gửi báo cáo. Admin sẽ xem xét.', { tone: 'info' }); }}
          onClose={() => setReport(false)} />
      </Section>

      <Section
        code="3-07"
        title="LoginPrompt"
        file="components/LoginPrompt"
        when="mời khách đăng nhập, chặn mềm (BR-04): bài thứ 4 trong ngày, hết 3 lượt chatbot, hoặc bấm Thích / Bình luận / Viết bài."
        props={[
          ['open · onClose', '', '', 'Luôn đóng được (chặn mềm)'],
          ['reason', "'posts'|'chat'|'action'", "'action'", 'Tự đổi câu chữ, số lượt lấy từ GUEST_LIMIT'],
          ['onLogin · onRegister', '() => void', '', ''],
        ]}
        usage={`// Backend trả 403 { code: 'GUEST_QUOTA_POSTS' } khi khách mở bài thứ 4
<LoginPrompt open={!!prompt} reason={prompt} onLogin={() => navigate('/login')}
  onRegister={() => navigate('/register')} onClose={() => setPrompt(null)} />`}
      >
        <div className={styles.row}>
          <Button variant="outline" size="sm" onClick={() => setPrompt('posts')}>Khách mở bài thứ 4</Button>
          <Button variant="outline" size="sm" onClick={() => setPrompt('chat')}>Khách hết lượt chat</Button>
          <Button variant="outline" size="sm" onClick={() => setPrompt('action')}>Khách bấm Thích</Button>
        </div>
        <LoginPrompt open={!!prompt} reason={prompt ?? 'action'} onLogin={() => setPrompt(null)} onRegister={() => setPrompt(null)} onClose={() => setPrompt(null)} />
      </Section>

      <Section
        code="3-08"
        title="Trang mẫu: Chi tiết Blog (M-03)"
        file="kit/Batch3.jsx › BlogDetail"
        when="tham khảo cách ghép: danh mục, tác giả, ảnh, nội dung, Thích, Báo cáo, khu bình luận, mời đăng nhập."
        note="Bấm nút vai trò ở đầu để chuyển Khách / Thành viên. Khách bấm Thích, Báo cáo hoặc ô bình luận sẽ thấy LoginPrompt."
      >
        <BlogDetail />
        <div className={styles.row}>
          <StatusBadge entity="post" status="public" />
          <span className="small text-body-secondary">Trang chi tiết chỉ mở được bài public (người khác) hoặc bài của chính mình.</span>
        </div>
      </Section>

      <Section
        code="3-09"
        title="PostComposer · Đăng nhanh trên bảng tin"
        file="components/PostComposer"
        when="đầu bảng tin (M-01), kiểu 'Bạn đang nghĩ gì?': hỏi nhanh 'Hôm nay ăn gì?', 'Nhà còn đậu hũ nấu gì?'. Report v4.0 không có loại bài status nên đây vẫn là Post blog: câu hỏi → title, chi tiết → content, đăng xong chờ Admin duyệt."
        note="Thử: bấm chip 'Hôm nay ăn gì?' → chọn danh mục → Đăng. Bấm ra ngoài hộp rồi mở lại: nháp vẫn còn. Viết chữ 'quảng cáo' hoặc đăng tới bài thứ 4 để thấy lỗi từ Backend. Chuyển sang vai Khách: bấm vào đâu cũng mời đăng nhập."
        props={[
          ['currentUser', '{name, avatarUrl?}', '', 'Không có → khách'],
          ['categories', '{value, label}[]', '[]', 'category_id, name'],
          ['onSubmit', '({postType, title, content, thumbnailUrl, categoryIds}) => Promise', '', 'postType luôn là blog. Ném lỗi → hiện trong hộp, giữ nháp'],
          ['onUpload', '(file, opts) => Promise<url>', '', 'Không truyền → ẩn nút Ảnh'],
          ['onOpenBlogEditor', '(draft) => void', '', 'Sang M-05, nhận nháp để điền sẵn'],
          ['onOpenVideoEditor · onRequireLogin', '() => void', '', ''],
          ['prompts', '{icon, label, text}[]', 'COMPOSER_PROMPTS', '[] → ẩn chip gợi ý'],
          ['maxCategories', 'number', '3', ''],
        ]}
        usage={`<PostComposer
  currentUser={user}
  categories={categories.map((c) => ({ value: c.category_id, label: c.name }))}
  onUpload={uploadImage}
  onSubmit={async (p) => {
    await api.createPost({ post_type: p.postType, title: p.title, content: p.content,
      thumbnail_url: p.thumbnailUrl, category_ids: p.categoryIds });   // lỗi 4xx: throw new Error(res.message)
    toast('Đã gửi bài. Bài sẽ hiện sau khi Admin duyệt.');
    reloadMyPendingPosts();
  }}
  onOpenBlogEditor={(draft) => navigate('/write/blog', { state: { draft } })}
  onOpenVideoEditor={() => navigate('/write/video')}
  onRequireLogin={() => setLoginPrompt('action')} />`}
      >
        <QuickPostFeed />
      </Section>
    </>
  );
}
