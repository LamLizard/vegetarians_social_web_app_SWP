// Trang Bảng tin: đọc request → KIỂM TRA dữ liệu → gọi post.model → trả JSON.
// Controller không viết SQL. Câu lỗi trả về là tiếng Việt vì FE hiện nguyên văn lên UI.
const postModel = require('../models/post.model');
// Khoi's code: Kiểm tra dữ liệu form Đăng bài (Sprint 2).
const { parsePostInput, PostInputError } = require('../utils/postInput');
// Khoi's code: kiểm tra video YouTube có phát được trên trang khác không (15/10/2026)
const { checkYouTubeVideo, youTubeRejectMessage } = require('../utils/youtubeCheck');
// Khoi's code: Cloud lưu ảnh bìa (bộ CLOUDINARY_POST_*), khớp với nơi API upload đẩy ảnh lên.
const { POST_CLOUD_NAME } = require('../config/cloudinary');
const { createHash } = require('node:crypto');
const { parseRequestId, submissionFingerprint } = require('../utils/postContentInput');
const { moderate } = require('../utils/aiModeration');
const { evaluateRules } = require('../utils/postContentRules');
const { getConfig } = require('../models/aiConfig.model');

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
    if (error instanceof PostError) return res.status(error.status).json({ message: error.message, ...(error.code ? { code: error.code } : {}) });
    if (fn.name === 'updateMyPost') console.error('[post.updateMyPost]', error.code || error.name || 'UNEXPECTED');
    else console.error(`[post.${fn.name}]`, error);
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

/** GET /api/posts?cursor=&limit=&q=&categoryId= — thành viên */
async function getFeed(req, res) {
  const cursor = req.query.cursor ? parseCursor(req.query.cursor) : null;
  const limit = parseLimit(req.query.limit);
  const q = String(req.query.q ?? '').trim();
  if (q.length > 100) throw new PostError(400, 'Từ khoá tối đa 100 ký tự.');
  // Khoi's code: lọc theo danh mục (Sprint 2) — bỏ trống = tất cả
  const categoryId = req.query.categoryId ? parseId(req.query.categoryId, 'Mã danh mục') : null;
  res.json(await postModel.findFeed({ viewerId: viewerId(req), cursor, q, categoryId, limit }));
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

// Khoi's code: Đăng bài (Sprint 2).
/** POST /api/posts  { postType, title, content, thumbnailUrl?, youtubeUrl?, categoryIds[] } → 201 bài 'pending' */
async function createPost(req, res) {
  let input;
  try {
    input = parsePostInput(req.body, { cloudName: POST_CLOUD_NAME });
  } catch (error) {
    if (error instanceof PostInputError) throw new PostError(400, error.message);
    throw error;
  }
  // Khoi's code: bài video — chặn video chủ kênh tắt nhúng / đã xoá (YouTube trục trặc thì vẫn cho đăng)
  if (input.youtubeUrl) {
    const rejected = await youTubeRejectMessage(input.youtubeUrl);
    if (rejected) throw new PostError(400, rejected);
  }
  // D-03: từ khoá cấm KHÔNG chặn đăng bài — bài nào cũng chờ duyệt, Admin thấy từ vi phạm ở trang kiểm duyệt.
  const post = await postModel.createPost({ ...input, authorId: viewerId(req) });
  res.status(201).json({ message: 'Bài viết đã được gửi và đang chờ duyệt.', post });
}

// Duy's Code: Bộ lọc danh sách cá nhân dùng đúng enum post hiện có, không nhận accountId từ client.
async function getMyPosts(req, res) {
  const allowedStatuses = ['all', 'pending', 'public', 'reported', 'deleted'];
  const allowedTypes = ['all', 'blog', 'video'];
  const status = req.query.status ?? 'all';
  const postType = req.query.type ?? 'all';
  const page = Number(req.query.page ?? 1);
  // Duy's Code: Nhận ID bài từ deep link thông báo để lọc đúng bài thuộc phiên hiện tại.
  const postId = req.query.postId ? parseId(req.query.postId, 'Mã bài viết') : null;
  if (!allowedStatuses.includes(status)) throw new PostError(400, 'Trạng thái bài viết không hợp lệ.');
  if (!allowedTypes.includes(postType)) throw new PostError(400, 'Loại bài viết không hợp lệ.');
  if (!Number.isInteger(page) || page < 1 || page > 1000000) throw new PostError(400, 'Số trang không hợp lệ.');
  res.json(await postModel.findMyPosts({ accountId: req.account.id, status, postType, page, limit: 20, postId }));
}

// Duy's Code: Form sửa chỉ nhận bài đang chờ duyệt và thuộc tài khoản đã xác thực.
async function getMyPost(req, res) {
  const postId = parseId(req.params.id, 'Mã bài viết');
  res.json({ post: await postModel.findMyPost(req.account.id, postId) });
}

// Duy's Code: Endpoint sửa chỉ nhận dữ liệu bài; danh tính luôn lấy từ phiên đăng nhập.
async function updateMyPost(req, res) {
  res.set('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  const postId = parseId(req.params.id, 'Mã bài viết');
  let input;
  let requestId;
  try {
    input = parsePostInput(req.body, { cloudName: POST_CLOUD_NAME });
    requestId = parseRequestId(req.body?.requestId);
  }
  catch (error) {
    if (error instanceof PostInputError) throw new PostError(400, error.message);
    throw error;
  }
  const fingerprint = createHash('sha256').update(`${postId}|${submissionFingerprint('post', input)}`).digest('hex');
  const precheck = await postModel.precheckMyPostEdit({ accountId: req.account.id, postId,
    categoryIds: input.categoryIds, requestId, fingerprint });
  if (precheck.replay) return res.json(precheck.replay);
  if (input.youtubeUrl) {
    const rejected = await youTubeRejectMessage(input.youtubeUrl);
    if (rejected) throw new PostError(400, rejected);
  }
  let config;
  try { config = await getConfig(); } catch {
    throw Object.assign(new PostError(503, 'Không thể đọc cấu hình AI.'), { code: 'CONFIG_UNAVAILABLE' });
  }
  const text = `${input.title}\n\n${input.content}`;
  const providerResult = await moderate({ kind: 'post', text, settings: config.post });
  const moderation = await evaluateRules({ kind: 'post', text, providerResult });
  res.json(await postModel.updateMyPost({ ...input, accountId: req.account.id, postId,
    revision: precheck.revision, requestId, fingerprint, moderation }));
}

// Duy's Code: Xóa mềm, model kiểm tra lại chủ sở hữu và trạng thái trước khi cập nhật.
async function deleteMyPost(req, res) {
  const postId = parseId(req.params.id, 'Mã bài viết');
  res.json(await postModel.deleteMyPost(req.account.id, postId));
}

/**
 * Khoi's code: POST /api/posts/youtube-check { url } → { status, videoId?, title?, author?, message? }
 * Form Đăng bài + Tạo công thức gọi khi người dùng dán link, để báo trước video có phát được không.
 * status: ok | invalid | blocked | missing | unknown (unknown = chưa hỏi được YouTube, vẫn cho gửi)
 */
async function checkYouTube(req, res) {
  const url = req.body?.url;
  if (typeof url !== 'string' || !url.trim() || url.length > 500) throw new PostError(400, 'Link YouTube không hợp lệ.');
  res.json(await checkYouTubeVideo(url.trim()));
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
  createPost: handle(createPost),
  checkYouTube: handle(checkYouTube),
  getFeed: handle(getFeed),
  getMyPosts: handle(getMyPosts),
  getMyPost: handle(getMyPost),
  updateMyPost: handle(updateMyPost),
  deleteMyPost: handle(deleteMyPost),
  toggleVote: handle(toggleVote),
  getComments: handle(getComments),
  addComment: handle(addComment),
  reportPost: handle(report('post')),
  reportComment: handle(report('comment')),
};
