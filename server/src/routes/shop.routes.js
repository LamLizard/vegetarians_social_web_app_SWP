// server/src/routes/shop.routes.js

const express = require('express');

const shopController = require('../controllers/shop.controller');
const {
  authenticate,
  requireAdmin,
} = require('../middlewares/auth');

const router = express.Router();

// Mọi route trong file này đều yêu cầu:
// 1. Đăng nhập hợp lệ.
// 2. Tài khoản có quyền Admin.
//
// Thứ tự quan trọng: xác thực trước, kiểm tra quyền sau.
router.use(authenticate);
router.use(requireAdmin);

// GET /api/admin/shops
// Lấy danh sách quán theo trạng thái, tên và phân trang.
router.get(
  '/',
  shopController.getShopsForVerification
);

// GET /api/admin/shops/:shopId
// Lấy thông tin chi tiết của một quán.
router.get(
  '/:shopId',
  shopController.getShopById
);

// PATCH /api/admin/shops/:shopId/verification
// Xác minh hoặc từ chối quán đang pending.
router.patch(
  '/:shopId/verification',
  shopController.updateShopVerification
);

// app.js sẽ import và mount router này.
module.exports = router;