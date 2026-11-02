const express = require('express');
const { requireAuth, requireMember } = require('../middlewares/auth');
const chatbotController = require('../controllers/chatbot.controller');

const router = express.Router();

function optionalMember(req, res, next) {
  if (req.headers.authorization === undefined) return next();
  return requireAuth(req, res, () => requireMember(req, res, next));
}

// Tùng: khóa các route legacy trước quota/provider để không dùng rule cũ.
function removed(req, res) {
  res.set('Cache-Control', 'no-store');
  return res.status(410).json({ code: 'FEATURE_REMOVED', message: 'Chức năng này không còn khả dụng.' });
}

// Tùng: deadline bắt đầu trước auth/parser, không đoán admission khi DB đang commit.
function turnDeadline(req, res, next) {
  const controller = new AbortController();
  req.turnSignal = controller.signal;
  req.turnDeadlineAt = Date.now() + 20000;
  const timer = setTimeout(() => {
    controller.abort();
    if (res.destroyed || res.writableEnded) return;
    const turnId = typeof req.body?.turnId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.body.turnId)
      ? req.body.turnId : undefined;
    if (!res.headersSent) {
      return res.status(503).json({ code: req.admissionStarted ? 'OUTCOME_UNKNOWN' : 'DEADLINE_EXCEEDED',
        message: 'Hết thời gian chờ. Trạng thái lượt có thể chưa rõ.',
        ...(!req.admissionStarted ? { admitted: false } : {}), ...(turnId ? { turnId } : {}) });
    }
    if (turnId) res.write(`event: error\ndata: ${JSON.stringify({ turnId, code: 'DEADLINE_EXCEEDED', message: 'Hết thời gian chờ.', partial: true })}\n\n`);
    return res.end();
  }, 20000);
  const finish = () => { clearTimeout(timer); controller.abort(); };
  res.once('finish', finish);
  res.once('close', finish);
  return next();
}

router.get('/quota', requireAuth, requireMember, chatbotController.getQuota);
router.get('/quota/simple', requireAuth, requireMember, chatbotController.getSimpleQuota);
router.get('/availability', chatbotController.availability);
router.get('/discovery/post/:id', optionalMember, chatbotController.getDiscoveryPost);
// Tùng: chi tiết riêng yêu cầu member, giữ nguyên route preview của bảng tin.
router.get('/posts/:id', requireAuth, requireMember, chatbotController.getMemberPost);
router.post('/session/verify', optionalMember, chatbotController.verifyChatSession);
router.post('/session/simple/verify', optionalMember, chatbotController.verifySimpleChatSession);
router.post('/requests/status', optionalMember, removed);
router.post('/turns/prepare', optionalMember, removed);
router.post('/discovery/status', optionalMember, removed);
router.post('/turns/stream', turnDeadline, (req, res, next) => optionalMember(req, res, () => {
  if (!req.turnSignal.aborted && !res.headersSent) next();
}), (req, res, next) => {
  if (!req.is('text/plain')) return res.status(415).json({ code: 'INVALID_INPUT', message: 'Dữ liệu câu hỏi không hợp lệ.' });
  return express.text({ type: 'text/plain', limit: '2mb' })(req, res, (error) => {
    if (req.turnSignal.aborted || res.headersSent) return undefined;
    if (error) return res.status(error.status === 413 ? 413 : 400)
      .json({ code: 'INVALID_INPUT', message: 'Dữ liệu câu hỏi không hợp lệ.' });
    try { req.body = JSON.parse(req.body); } catch {
      return res.status(400).json({ code: 'INVALID_INPUT', message: 'Dữ liệu câu hỏi không hợp lệ.' });
    }
    return next();
  });
}, (req, res, next) => {
  if (req.body?.protocol !== 3) {
    return res.status(400).json({ code: 'INVALID_INPUT', message: 'Dữ liệu câu hỏi không hợp lệ.' });
  }
  return next();
}, chatbotController.turnV3);
router.post('/discovery/stream', optionalMember, removed);
router.post('/messages/stream', optionalMember, removed);
router.post('/messages', optionalMember, removed);

module.exports = router;
