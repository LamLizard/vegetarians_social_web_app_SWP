const express = require('express');
const dishController = require('../controllers/dish.controller');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

const router = express.Router();
router.get('/categories', requireAuth, dishController.getCategories);

// Duy's code: Giới hạn tạo, xem hàng chờ và quyết định Dish cho Admin đã xác thực.
router.post('/admin', requireAuth, requireAdmin, dishController.createAdminDish);
router.post('/admin/with-recipe', requireAuth, requireAdmin, dishController.createAdminDishWithRecipe);
router.get('/admin/search', requireAuth, requireAdmin, dishController.searchAdminDishes);
router.get('/admin/all', requireAuth, requireAdmin, dishController.getAdminDishes);

module.exports = router;
