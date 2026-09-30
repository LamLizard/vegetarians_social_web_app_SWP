// Trang Bảng tin: đọc request → KIỂM TRA dữ liệu → gọi post.model → trả JSON.
// Controller không viết SQL. Câu lỗi trả về là tiếng Việt vì FE hiện nguyên văn lên UI.
const postModel = require('../models/post.model');

const { PostError } = postModel;
const MAX_COMMENT = 1000;
const MAX_REASON_TEXT = 500;
const REASON_CODES = ['spam', 'wrong_topic', 'not_vegan', 'abusive', 'other'];

// ---------------- Hàm kiểm tra dùng chung ----------------

/** id trong URL phải là số nguyên dương (BIGINT) → trả chuỗi, sai thì 400 */
function parseId(value, label = 'ID') {
  const s = String(value ?? '');
  if (!/^[1-9]\d{0,17}$/.test(s)) throw new PostError(400, `${label} không hợp lệ.`);
  return s;
}

/** cursor = "<micro giây>_<post_id>" do chính BE trả ở trang trước */
function parseCursor(value) {
  const m = /^(\d{1,19})_([1-9]\d{0,17})$/.exec(String(value));
  if (!m) throw new PostError(400, 'cursor không hợp lệ.');
  return { time: m[1], id: m[2] };
}

function parseLimit(value) {
  if (value === undefined) return 10;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 20) throw new PostError(400, 'limit phải từ 1 đến 20.');
  return n;
}

/** Bọc mọi handler: lỗi nghiệp vụ → đúng mã HTTP, lỗi lạ → 500 + ghi log */
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error instanceof PostError) return res.status(error.status).json({ message: error.message });
    console.error(`[post.${fn.name}]`, error);
    return res.status(500).json({ message: 'Có lỗi xảy ra, vui lòng thử lại sau.' });
  }
};

/** requireAuth / optionalAuth đã gắn req.account (khách → undefined) */
const viewerId = (req) => req.account?.id ?? null;

// ---------------- Handler ----------------

/** GET /api/posts/preview — khách */
async function getPreview(req, res) {
  const items = await postModel.findPreview();
  res.json({ items });
}

/** GET /api/posts?cursor=&limit=&q= — thành viên */
async function getFeed(req, res) {
  const cursor = req.query.cursor ? parseCursor(req.query.cursor) : null;
  const limit = parseLimit(req.query.limit);
  const q = String(req.query.q ?? '').trim();
  if (q.length > 100) throw new PostError(400, 'Từ khoá tối đa 100 ký tự.');
  res.json(await postModel.findFeed({ viewerId: viewerId(req), cursor, q, limit }));
}

/** POST /api/posts/:id/vote — toggle */
async function toggleVote(req, res) {
  const postId = parseId(req.params.id, 'Mã bài viết');
  res.json(await postModel.toggleVote(postId, viewerId(req)));
}

/** GET /api/posts/:id/comments — ai cũng xem được */
async function getComments(req, res) {
  const postId = parseId(req.params.id, 'Mã bài viết');
  res.json({ items: await postModel.findComments(postId, viewerId(req)) });
}

/** POST /api/posts/:id/comments  { content } */
async function addComment(req, res) {
  const postId = parseId(req.params.id, 'Mã bài viết');
  const content = String(req.body?.content ?? '').trim();
  if (!content) throw new PostError(400, 'Bình luận không được để trống.');
  if ([...content].length > MAX_COMMENT) throw new PostError(400, `Bình luận tối đa ${MAX_COMMENT} ký tự.`);

  // Lọc từ khoá cấm (rule-based, không dùng AI) TRƯỚC khi lưu
  if (await postModel.findBlockedKeyword(content, 'comment')) {
    throw new PostError(422, 'Bình luận chứa từ ngữ không phù hợp, vui lòng sửa lại.');
  }
  res.status(201).json(await postModel.createComment(postId, viewerId(req), content));
}

/** Dùng chung cho báo cáo bài và bình luận */
const report = (targetType) => async function createReport(req, res) {
  const targetId = parseId(req.params.id, targetType === 'post' ? 'Mã bài viết' : 'Mã bình luận');
  const reasonCode = req.body?.reasonCode;
  if (!REASON_CODES.includes(reasonCode)) throw new PostError(400, 'Chọn lý do báo cáo hợp lệ.');
  const reasonText = String(req.body?.reasonText ?? '').trim() || null;
  if (reasonCode === 'other' && !reasonText) throw new PostError(400, 'Mô tả ngắn vấn đề bạn gặp.');
  if (reasonText && [...reasonText].length > MAX_REASON_TEXT) throw new PostError(400, `Mô tả tối đa ${MAX_REASON_TEXT} ký tự.`);

  const created = await postModel.createReport({ reporterId: viewerId(req), targetType, targetId, reasonCode, reasonText });
  res.status(201).json(created);
};

module.exports = {
  getPreview: handle(getPreview),
  getFeed: handle(getFeed),
  toggleVote: handle(toggleVote),
  getComments: handle(getComments),
  addComment: handle(addComment),
  reportPost: handle(report('post')),
  reportComment: handle(report('comment')),
};
