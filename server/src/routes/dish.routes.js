const express = require('express');
const dishController = require('../controllers/dish.controller');
const { requireAuth, requireAdmin, requireMember } = require('../middlewares/auth');

const router = express.Router();
// Duy's code: Cho Member đã đăng nhập đọc danh mục, đề xuất Dish và xem đề xuất của mình.
router.get('/categories', requireAuth, dishController.getCategories);
router.get('/mine', requireAuth, requireMember, dishController.getMyDishes);
router.post('/', requireAuth, requireMember, dishController.suggestDish);

// Duy's code: Giới hạn tạo, xem hàng chờ và quyết định Dish cho Admin đã xác thực.
router.post('/admin', requireAuth, requireAdmin, dishController.createAdminDish);
// Duy's Code: Chỉ Admin được xem danh sách món đã duyệt và bị từ chối.
router.get('/admin/all', requireAuth, requireAdmin, dishController.getAdminDishes);
router.get('/admin/pending', requireAuth, requireAdmin, dishController.getPendingDishes);
router.post('/admin/:dishId/decision', requireAuth, requireAdmin, dishController.decideDish);

module.exports = router;
