// Mount tại /api/admin/moderation sau khi điểm tích hợp được duyệt.
const express = require('express');
const controller = require('../controllers/postModeration.controller');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get('/posts', controller.listPosts);
router.get('/posts/:postId', controller.getPost);
router.patch('/posts/:postId', controller.decidePost);

// Module này chỉ xử lý report target_type=post; không nhận comment/recipe.
router.get('/reports', controller.listReports);
router.get('/reports/:reportId', controller.getReport);
router.patch('/reports/:reportId', controller.decideReport);

module.exports = router;
