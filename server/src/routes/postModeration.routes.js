// Mount tại /api/admin/moderation sau khi điểm tích hợp được duyệt.
const express = require('express');
const controller = require('../controllers/postModeration.controller');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get('/posts', controller.listPosts);
router.get('/posts/:postId', controller.getPost);
router.patch('/posts/:postId', controller.decidePost);

// Tung's code: Kiểm duyệt theo case cho cả post và comment; vẫn nằm sau
// requireAuth + requireAdmin, không cho Member gọi API quản trị trực tiếp.
router.get('/cases', controller.listCases);
router.get('/cases/:caseId', controller.getCase);
router.patch('/cases/:caseId', controller.decideCase);

// Tung's code: Client cũ có thể còn tab đang mở. Trả 410 thay vì tiếp tục xử lý
// từng report, vì cập nhật riêng lẻ sẽ làm report lệch trạng thái với case.
const retiredReports = (_req, res) => res.status(410).json({
  message: 'Luồng báo cáo đã chuyển sang xử lý theo nhóm. Vui lòng tải lại trang.',
});
router.all('/reports', retiredReports);
router.all('/reports/:reportId', retiredReports);

module.exports = router;
