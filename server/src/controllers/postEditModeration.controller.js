const model = require('../models/postEditModeration.model');
const { ModerationError, parseId, parseDecision } = require('../utils/postModeration');

function handle(work) {
  return async (req, res) => {
    try {
      return res.json(await work(req));
    } catch (error) {
      if (error instanceof ModerationError) {
        return res.status(error.status).json({ message: error.message, ...(error.code ? { code: error.code } : {}) });
      }
      console.error('[postEditModeration]', error.code || error.name || 'UnexpectedError');
      return res.status(500).json({ message: 'Không thể xử lý bản sửa. Vui lòng thử lại sau.' });
    }
  };
}

const listPending = handle((req) => {
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  const limit = req.query.limit === undefined ? 20 : Number(req.query.limit);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000
    || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new ModerationError(400, 'Tham số phân trang không hợp lệ.');
  }
  return model.listPending({ page, limit });
});

const getPending = handle((req) => model.getPending(parseId(req.params.editRequestId)));
const decide = handle((req) => model.decide(
  parseId(req.params.editRequestId), parseDecision(req.body, 'post'), { id: req.account.id, ip: req.ip },
));

module.exports = { listPending, getPending, decide };
