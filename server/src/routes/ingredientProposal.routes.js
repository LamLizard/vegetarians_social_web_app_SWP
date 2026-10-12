const express = require('express');
const controller = require('../controllers/ingredientProposal.controller');
const { requireAuth, requireAdmin, requireMember } = require('../middlewares/auth');

const router = express.Router();

// Duy's Code : Bảo vệ gửi đề cử cho thành viên và các thao tác duyệt cho Admin.
router.post('/', requireAuth, requireMember, controller.submit);
router.get('/admin/pending', requireAuth, requireAdmin, controller.listPending);
router.post('/admin/decision', requireAuth, requireAdmin, controller.decide);

module.exports = router;
