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
const listReports = handle((req) => model.listReports(parseListQuery(req.query, 'report')));
const getReport = handle((req) => model.getReport(parseId(req.params.reportId)));
const decideReport = handle((req) => model.decideReport(
  parseId(req.params.reportId), parseDecision(req.body, 'report'), actor(req),
));

module.exports = { listPosts, getPost, decidePost, listReports, getReport, decideReport };
