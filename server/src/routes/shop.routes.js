// Bảng chỉ đường của trang Khám phá quán chay (M-08).
// Chỉ thành viên đã đăng nhập mới gọi được các endpoint này.
// Gắn ở app.js:  app.use('/api/shops', require('./src/routes/shop.routes'));
const express = require('express');
const shopController = require('../controllers/shop.controller');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.get('/categories', requireAuth, shopController.getCategories);
router.get('/', requireAuth, shopController.getShops);
router.get('/:id', requireAuth, shopController.getShop);

module.exports = router;
