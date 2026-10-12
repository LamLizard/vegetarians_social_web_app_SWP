// Khoi's code: Bảng chỉ đường trang Tạo công thức — KHÔNG viết logic ở đây.
// Gắn ở app.js:  app.use('/api/recipes', require('./src/routes/recipe.routes'));
//
//  Ai cũng gọi được:  GET  /dishes  ·  GET /ingredients        (tên món/nguyên liệu không phải dữ liệu riêng tư)
//  Cần đăng nhập:     POST /ingredients/check  ·  GET /mine  ·  POST /  (gửi công thức → 'pending')
// Phần Admin duyệt công thức (Duy) đặt ở route admin riêng, không nằm ở đây.
const express = require('express');
const recipeController = require('../controllers/recipe.controller');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

router.get('/dishes', recipeController.getDishes);
router.get('/ingredients', recipeController.getIngredients);
router.post('/ingredients/check', requireAuth, recipeController.checkIngredients);
router.get('/mine', requireAuth, recipeController.getMine);
router.post('/', requireAuth, recipeController.createRecipe);
// Duy's Code : Trang Admin dùng endpoint này để lọc công thức theo cả ba trạng thái.
router.get('/admin/all', requireAuth, requireAdmin, recipeController.getAllAdmin);
router.get('/admin/pending', requireAuth, requireAdmin, recipeController.getPendingAdmin);
router.post('/admin/:recipeId/decision', requireAuth, requireAdmin, recipeController.decideAdmin);
router.get('/admin/dishes/search', requireAuth, requireAdmin, recipeController.searchAdminDishes);
router.patch('/admin/:recipeId/dish-name', requireAuth, requireAdmin, recipeController.renameRecipeDish);
router.put('/admin/:recipeId/dish', requireAuth, requireAdmin, recipeController.linkRecipeDish);

module.exports = router;
