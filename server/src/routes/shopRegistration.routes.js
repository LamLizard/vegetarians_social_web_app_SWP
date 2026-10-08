// Tùng — Sprint 2: mount /api/shops trong BRIDGE-01 hoặc server tự test riêng.
const router = require('express').Router();
const { requireAuth } = require('../middlewares/auth');
const { requireMember } = require('../utils/shopWorkflow');
const controller = require('../controllers/shopRegistration.controller');

// Không router.use(): tránh bắt các public Shop paths được mount sau router này.
router.get('/registration-context', requireAuth, requireMember, controller.getContext);
router.post('/registration', requireAuth, requireMember, controller.register);
router.put('/registration', requireAuth, requireMember, controller.resubmit);
module.exports = router;
