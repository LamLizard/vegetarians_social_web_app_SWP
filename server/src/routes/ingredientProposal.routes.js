const express = require('express');
const controller = require('../controllers/ingredientProposal.controller');
const { requireAuth, requireAdmin, requireMember } = require('../middlewares/auth');

const router = express.Router();

// Duy's Code : Bảo vệ gửi đề cử cho thành viên và các thao tác duyệt cho Admin.
router.post('/', requireAuth, requireMember, controller.submit);
router.get('/mine', requireAuth, requireMember, controller.listMine);
router.get('/admin/pending', requireAuth, requireAdmin, controller.listPending);
// Duy's Code: Các trang tra cứu từ khóa và lịch sử chỉ dành cho Admin.
router.get('/admin/keywords', requireAuth, requireAdmin, controller.listBannedKeywords);
router.get('/admin/history', requireAuth, requireAdmin, controller.listHistory);
router.post('/admin/decision', requireAuth, requireAdmin, controller.decide);

module.exports = router;
