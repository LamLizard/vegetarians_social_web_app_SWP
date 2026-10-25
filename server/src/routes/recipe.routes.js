// Khoi's code: Bảng chỉ đường trang Tạo công thức — KHÔNG viết logic ở đây.
// Gắn ở app.js:  app.use('/api/recipes', require('./src/routes/recipe.routes'));
//
//  Ai cũng gọi được:  GET  /  (trang Công thức: mọi công thức đã duyệt)  ·  GET  /dishes  ·  GET /ingredients  ·  GET /animal-words  ·  GET /:recipeId (công thức đã duyệt)        (tên món/nguyên liệu không phải dữ liệu riêng tư)
//  Cần đăng nhập:     POST / DELETE /:recipeId/like (thích / bỏ thích)  ·  POST /ingredients/check  ·  GET /mine  ·  POST /  (gửi công thức → 'pending')
//                     GET /mine/:recipeId  ·  PUT /:recipeId  (Sửa và gửi lại công thức bị từ chối → 'pending')
// Phần Admin duyệt công thức (Duy) đặt ở route admin riêng, không nằm ở đây.
const express = require('express');
const recipeController = require('../controllers/recipe.controller');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

/** Khoi's code: có token → kiểm như requireAuth (biết người xem đã thích chưa). Không có → cho qua như khách. */
const optionalAuth = (req, res, next) => (req.headers.authorization ? requireAuth(req, res, next) : next());

router.get('/dishes', recipeController.getDishes);
router.get('/ingredients', recipeController.getIngredients);
router.get('/animal-words', recipeController.getAnimalWords); // Khoi's code: banned_keyword category 'animal'
router.post('/ingredients/check', requireAuth, recipeController.checkIngredients);
router.get('/mine', requireAuth, recipeController.getMine);
router.get('/', optionalAuth, recipeController.getPublicList); // Khoi's code: trang Công thức (/recipes), khách cũng xem
router.post('/', requireAuth, recipeController.createRecipe);
// Khoi's code: Sửa và gửi lại — chỉ tác giả, công thức 'rejected' hoặc 'approved' (sửa xong về Chờ duyệt)
router.get('/mine/:recipeId', requireAuth, recipeController.getMineDetail);
router.put('/:recipeId', requireAuth, recipeController.resubmitRecipe);
// Duy's Code : Trang Admin dùng endpoint này để lọc công thức theo cả ba trạng thái.
router.get('/admin/all', requireAuth, requireAdmin, recipeController.getAllAdmin);
router.get('/admin/pending', requireAuth, requireAdmin, recipeController.getPendingAdmin);
router.post('/admin/:recipeId/decision', requireAuth, requireAdmin, recipeController.decideAdmin);
router.get('/admin/dishes/search', requireAuth, requireAdmin, recipeController.searchAdminDishes);
router.patch('/admin/:recipeId/dish-name', requireAuth, requireAdmin, recipeController.renameRecipeDish);
router.put('/admin/:recipeId/dish', requireAuth, requireAdmin, recipeController.linkRecipeDish);
// Khoi's code: xem công thức đã duyệt — đặt CUỐI để không nuốt /dishes, /mine, /admin/...
// Khoi's code 20/10: thích / bỏ thích công thức đã duyệt
router.post('/:recipeId/like', requireAuth, recipeController.likeRecipe);
router.delete('/:recipeId/like', requireAuth, recipeController.unlikeRecipe);
router.get('/:recipeId', optionalAuth, recipeController.getPublicDetail);

module.exports = router;
