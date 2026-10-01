const { createPostModerationModel } = require('../models/postModeration.model');
const { ModerationError, parseId, parseListQuery, parseDecision } = require('../utils/postModeration');

const model = createPostModerationModel();

function handle(work) {
  return async (req, res) => {
    try {
      const result = await work(req);
      return res.json(result);
    } catch (error) {
      if (error instanceof ModerationError) {
        return res.status(error.status).json({ message: error.message });
      }
      // Không trả SQL, nội dung bài hoặc dữ liệu kết nối ra response/log.
      console.error('[postModeration]', error.code || error.name || 'UnexpectedError');
      return res.status(500).json({ message: 'Không thể xử lý yêu cầu. Vui lòng thử lại sau.' });
    }
  };
}

// ID Admin luôn lấy từ requireAuth; không tin adminId do client gửi lên.
const actor = (req) => ({ id: req.account.id, ip: req.ip });

const listPosts = handle((req) => model.listPosts(parseListQuery(req.query, 'post')));
const getPost = handle((req) => model.getPost(parseId(req.params.postId)));
const decidePost = handle((req) => model.decidePost(
  parseId(req.params.postId), parseDecision(req.body, 'post'), actor(req),
));
// Tung's code: Hai tab báo cáo dùng chung API case, phân biệt bằng targetType.
// Chỉ nhận post/comment; không cho client mở rộng sang recipe hoặc đối tượng khác.
function parseTargetType(value) {
  if (value !== 'post' && value !== 'comment') {
    throw new ModerationError(400, 'Loại đối tượng báo cáo không hợp lệ.');
  }
  return value;
}

const listCases = handle((req) => model.listCases({
  ...parseListQuery(req.query, 'report'),
  targetType: parseTargetType(req.query.targetType),
}));
// Tung's code: URL chứa caseId, không phải reportId; action/note giữ bộ kiểm tra
// accept/reject và lý do 1–255 ký tự. Admin lấy từ tài khoản đã xác thực phía trên.
const getCase = handle((req) => model.getCase(parseId(req.params.caseId)));
const decideCase = handle((req) => model.decideCase(
  parseId(req.params.caseId), parseDecision(req.body, 'report'), actor(req),
));

module.exports = { listPosts, getPost, decidePost, listCases, getCase, decideCase };
