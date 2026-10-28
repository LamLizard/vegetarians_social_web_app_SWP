const express = require('express');
const { requireAuth, requireMember } = require('../middlewares/auth');
const chatbotController = require('../controllers/chatbot.controller');

const router = express.Router();

function optionalMember(req, res, next) {
  if (req.headers.authorization === undefined) return next();
  return requireAuth(req, res, () => requireMember(req, res, next));
}

router.get('/quota', requireAuth, requireMember, chatbotController.getQuota);
router.get('/availability', chatbotController.availability);
router.post('/session/verify', optionalMember, chatbotController.verifyChatSession);
router.post('/requests/status', optionalMember, chatbotController.getRequestState);
router.post('/messages/stream', optionalMember, (req, res, next) => {
  if (!req.is('text/plain')) return res.status(415).json({ code: 'INVALID_INPUT', message: 'Dữ liệu câu hỏi không hợp lệ.' });
  return express.text({ type: 'text/plain', limit: '2mb' })(req, res, (error) => {
    if (error) return res.status(error.status === 413 ? 413 : 400)
      .json({ code: 'INVALID_INPUT', message: 'Dữ liệu câu hỏi không hợp lệ.' });
    try { req.body = JSON.parse(req.body); } catch {
      return res.status(400).json({ code: 'INVALID_INPUT', message: 'Dữ liệu câu hỏi không hợp lệ.' });
    }
    return next();
  });
}, chatbotController.streamMessage);
router.post('/messages', optionalMember, chatbotController.sendMessage);

module.exports = router;
