// Tùng — Sprint 2: toàn bộ đường hồ sơ đều requireAuth + requireAdmin.
const router = require('express').Router();
const { requireAuth, requireAdmin } = require('../middlewares/auth');
const controller = require('../controllers/shopVerification.controller');

router.get('/submissions', requireAuth, requireAdmin, controller.list);
router.get('/submissions/:submissionId', requireAuth, requireAdmin, controller.detail);
router.post('/submissions/:submissionId/decision', requireAuth, requireAdmin, controller.decide);
// Các literal /submissions ở trên phải đi trước route Shop ID.
router.get('/', requireAuth, requireAdmin, controller.listShops);
router.get('/:shopId/history', requireAuth, requireAdmin, controller.history);
router.patch('/:shopId/status', requireAuth, requireAdmin, controller.updateStatus);
router.get('/:shopId', requireAuth, requireAdmin, controller.shopDetail);
module.exports = router;
