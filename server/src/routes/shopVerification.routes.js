// Tùng — Sprint 2: toàn bộ đường hồ sơ đều requireAuth + requireAdmin.
const router = require('express').Router();
const { requireAuth, requireAdmin } = require('../middlewares/auth');
const controller = require('../controllers/shopVerification.controller');

router.get('/submissions', requireAuth, requireAdmin, controller.list);
router.get('/submissions/:submissionId', requireAuth, requireAdmin, controller.detail);
router.post('/submissions/:submissionId/decision', requireAuth, requireAdmin, controller.decide);
module.exports = router;
