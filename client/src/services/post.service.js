// Gọi API cho trang Bảng tin (User Post Page · ID01).
// BE CHƯA CÓ endpoint → đang chạy MOCK. Khi BE xong: đổi USE_MOCK = false, KHÔNG phải sửa trang.
//
// Hợp đồng API (BE làm đúng như vậy):
//   GET  /posts/preview                  → { items: Post[] }             khách, 3 bài cố định
//   GET  /posts?cursor=&limit=&q=         → { items: Post[], nextCursor }  thành viên, lướt vô hạn
//   POST /posts/:id/vote                  → { voted, voteCount }           toggle
//   GET  /posts/:id/comments              → { items: Comment[] }
//   POST /posts/:id/comments  { content } → Comment
//   POST /reports { targetType, targetId, reasonCode, reasonText } → { id }
//
// Post    = { id, type, title, content, thumbnailUrl, youtubeUrl, status, voteCount, commentCount,
//             createdAt, author: { id, fullName, avatarUrl }, categories: [{ id, name }], isVoted }
// Comment = { id, content, createdAt, author: { id, fullName, avatarUrl }, isOwner }
import { apiFetch } from './api';

const USE_MOCK = true; // TODO: tắt khi BE có /api/posts
const MOCK_DELAY_MS = 450;
export const FEED_PAGE_SIZE = 5;

// =====================================================================
//  API THẬT
// =====================================================================
const real = {
  getPreview: () => apiFetch('/posts/preview'),
  getFeed: ({ cursor, q, limit = FEED_PAGE_SIZE } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    if (q) params.set('q', q);
    return apiFetch(`/posts?${params}`);
  },
  toggleVote: (postId) => apiFetch(`/posts/${postId}/vote`, { method: 'POST' }),
  getComments: (postId) => apiFetch(`/posts/${postId}/comments`),
  addComment: (postId, content) => apiFetch(`/posts/${postId}/comments`, {
    method: 'POST', body: JSON.stringify({ content }),
  }),
  report: (payload) => apiFetch('/reports', { method: 'POST', body: JSON.stringify(payload) }),
};

// =====================================================================
//  MOCK — dữ liệu nằm trong bộ nhớ, F5 là về như cũ
// =====================================================================
const wait = () => new Promise((r) => { setTimeout(r, MOCK_DELAY_MS); });
const clone = (x) => JSON.parse(JSON.stringify(x));

/** Mốc giờ theo NGÀY LOCAL: at(-1, 8) = 8h sáng hôm qua */
const at = (dayOffset, hour, minute = 0) => {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString();
};

const ME = { id: '1', fullName: 'Lâm Anh Khôi', avatarUrl: null };
const LAM = { id: '2', fullName: 'Dương Vi Lâm', avatarUrl: null };
const DUY = { id: '3', fullName: 'Mai Khương Duy', avatarUrl: null };
const TUNG = { id: '4', fullName: 'Nguyễn Hoàng Tùng', avatarUrl: null };
const CAT = {
  nuoc: { id: '1', name: 'Món nước' },
  kho: { id: '2', name: 'Món khô' },
  trangMieng: { id: '3', name: 'Tráng miệng' },
};

// id tăng dần theo thời gian tạo (giống BIGINT identity trong DB)
let posts = [
  { id: '1', type: 'blog', title: 'Đậu hũ sốt cà chua 15 phút cho người mới ăn chay', content: 'Đậu hũ chiên vàng, sốt cà chua với hành boa rô. Món đầu tiên mình nấu khi bắt đầu ăn chay, dễ mà ai cũng khen.', thumbnailUrl: null, youtubeUrl: null, status: 'public', voteCount: 21, commentCount: 1, createdAt: at(-3, 10), author: TUNG, categories: [CAT.kho] },
  // --- Hôm kia: 4 bài (khách sẽ thấy 2 bài SỚM NHẤT của ngày này) ---
  { id: '2', type: 'blog', title: 'Canh nấm chay thanh ngọt từ củ cải và bắp', content: 'Nước dùng hầm củ cải, bắp và su su trong 45 phút, không dùng bột nêm có nguồn gốc động vật. Thả nấm rơm, nấm đông cô vào cuối cùng để giữ độ giòn.', thumbnailUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800', youtubeUrl: null, status: 'public', voteCount: 34, commentCount: 2, createdAt: at(-2, 7), author: LAM, categories: [CAT.nuoc] },
  { id: '3', type: 'video', title: 'Cách làm chả lụa chay dai giòn tại nhà', content: 'Video hướng dẫn từng bước làm chả lụa chay từ đậu hũ ky và bột năng.', thumbnailUrl: null, youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', status: 'reported', voteCount: 12, commentCount: 0, createdAt: at(-2, 9), author: DUY, categories: [CAT.kho] },
  { id: '4', type: 'blog', title: 'Chè đậu xanh nước cốt dừa', content: 'Đậu xanh cà vỏ ngâm 2 tiếng, nấu nhừ với đường phèn. Nước cốt dừa thêm chút muối cho đậm vị.', thumbnailUrl: null, youtubeUrl: null, status: 'public', voteCount: 8, commentCount: 0, createdAt: at(-2, 12), author: ME, categories: [CAT.trangMieng] },
  { id: '5', type: 'blog', title: 'Ăn chay có đủ đạm không? Mình đã thử 3 tháng', content: 'Chia sẻ thực đơn một ngày của mình: đậu phụ, đậu lăng, hạt chia và sữa đậu nành. Kèm vài lưu ý khi mới chuyển sang ăn chay.', thumbnailUrl: null, youtubeUrl: null, status: 'public', voteCount: 45, commentCount: 0, createdAt: at(-2, 20), author: TUNG, categories: [] },
  // --- Hôm qua: 1 bài ---
  { id: '6', type: 'blog', title: 'Bún riêu chay nấm rơm', content: 'Chả làm từ đậu hũ non trộn nấm rơm băm, hấp 15 phút rồi thả vào nồi. Nước dùng nấu từ cà chua và me cho vị chua thanh.', thumbnailUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800', youtubeUrl: null, status: 'public', voteCount: 67, commentCount: 0, createdAt: at(-1, 8), author: LAM, categories: [CAT.nuoc] },
  // --- Hôm nay: KHÔNG vào 3 bài của khách ---
  { id: '7', type: 'blog', title: 'Salad rau mầm sốt mè rang', content: 'Rau mầm, dưa leo, cà chua bi trộn sốt mè rang tự làm.', thumbnailUrl: null, youtubeUrl: null, status: 'public', voteCount: 3, commentCount: 0, createdAt: at(0, 7, 30), author: DUY, categories: [CAT.kho] },
  { id: '8', type: 'blog', title: 'Bài đang chờ duyệt (không được hiện)', content: 'status = pending → feed phải bỏ qua.', thumbnailUrl: null, youtubeUrl: null, status: 'pending', voteCount: 0, commentCount: 0, createdAt: at(0, 8), author: ME, categories: [] },
  { id: '9', type: 'video', title: 'Mì Quảng chay chuẩn vị miền Trung', content: 'Nước nhưn từ nấm, đậu hũ chiên và củ sắn, ăn kèm bánh tráng mè.', thumbnailUrl: null, youtubeUrl: 'https://youtu.be/ysz5S6PUM-U', status: 'public', voteCount: 19, commentCount: 0, createdAt: at(0, 9), author: TUNG, categories: [CAT.nuoc] },
];
let votedIds = new Set(['2']); // bài ME đã thích
let comments = {
  1: [{ id: 'c1', content: 'Nhà mình làm thử, rất đưa cơm!', createdAt: at(-3, 12), author: LAM, isOwner: false }],
  2: [
    { id: 'c2', content: 'Thêm vài lát cà rốt tỉa hoa cho đẹp nè.', createdAt: at(-2, 8), author: DUY, isOwner: false },
    { id: 'c3', content: 'Cảm ơn công thức, nước ngọt thật sự.', createdAt: at(-2, 10), author: ME, isOwner: true },
  ],
};
const reportedKeys = new Set();
let seq = 100;

const VISIBLE = ['public', 'reported'];
const withVote = (p) => ({ ...clone(p), isVoted: votedIds.has(p.id) });

/** Giống SQL ở BE: bài trước hôm nay, ngày gần nhất trước, trong ngày thì bài sớm nhất trước, lấy 3 */
function mockPreview() {
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const dayKey = (iso) => new Date(iso).toDateString();
  const dayStart = (iso) => { const d = new Date(iso); d.setHours(0, 0, 0, 0); return d.getTime(); };
  return posts
    .filter((p) => VISIBLE.includes(p.status) && new Date(p.createdAt) < startOfToday)
    .sort((a, b) => (dayKey(a.createdAt) === dayKey(b.createdAt)
      ? new Date(a.createdAt) - new Date(b.createdAt)   // cùng ngày: sớm → muộn
      : dayStart(b.createdAt) - dayStart(a.createdAt)))  // khác ngày: gần → xa
    .slice(0, 3)
    .map((p) => ({ ...withVote(p), isVoted: false })); // khách chưa vote gì
}

const mock = {
  async getPreview() {
    await wait();
    return { items: mockPreview() };
  },

  async getFeed({ cursor, q, limit = FEED_PAGE_SIZE } = {}) {
    await wait();
    const keyword = (q ?? '').trim().toLowerCase();
    const list = posts
      .filter((p) => VISIBLE.includes(p.status))
      .filter((p) => !keyword || p.title.toLowerCase().includes(keyword))
      .sort((a, b) => Number(b.id) - Number(a.id))             // mới nhất trước
      .filter((p) => !cursor || Number(p.id) < Number(cursor)); // cursor = id bài cuối trang trước
    const items = list.slice(0, limit).map(withVote);
    return { items, nextCursor: list.length > limit ? items[items.length - 1].id : null };
  },

  async toggleVote(postId) {
    await wait();
    const post = posts.find((p) => p.id === String(postId));
    if (!post) throw new Error('Bài viết không còn tồn tại');
    const voted = !votedIds.has(post.id);
    if (voted) votedIds.add(post.id); else votedIds.delete(post.id);
    post.voteCount += voted ? 1 : -1;
    return { voted, voteCount: post.voteCount };
  },

  async getComments(postId) {
    await wait();
    return { items: clone(comments[postId] ?? []) };
  },

  async addComment(postId, content) {
    await wait();
    if (/đồ ngu|lừa đảo/i.test(content)) throw new Error('Bình luận chứa từ ngữ không phù hợp, vui lòng sửa lại');
    const comment = { id: `c${seq += 1}`, content, createdAt: new Date().toISOString(), author: ME, isOwner: true };
    comments[postId] = [comment, ...(comments[postId] ?? [])];
    const post = posts.find((p) => p.id === String(postId));
    if (post) post.commentCount += 1;
    return clone(comment);
  },

  async report({ targetType, targetId }) {
    await wait();
    const key = `${targetType}:${targetId}`;
    if (reportedKeys.has(key)) throw new Error('Bạn đã báo cáo nội dung này rồi, Admin đang xem xét.');
    reportedKeys.add(key);
    return { id: String(seq += 1) };
  },
};

const postService = USE_MOCK ? mock : real;
export default postService;
