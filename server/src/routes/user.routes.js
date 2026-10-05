const express = require('express');
const {
  getMyProfile, saveMyProfile, getMyAvatarUploadSignature, saveMyAvatar, removeMyAvatar,
  getMyHealthProfile, saveMyHealthProfile,
} = require('../controllers/user.controller');
const { requireAuth, requireMember } = require('../middlewares/auth');

const router = express.Router();
// Duy's code: Bảo vệ xem/cập nhật hồ sơ và quản lý avatar cho tài khoản đăng nhập.
router.get('/me', requireAuth, getMyProfile);
router.put('/me', requireAuth, saveMyProfile);
router.post('/me/avatar-upload-signature', requireAuth, getMyAvatarUploadSignature);
router.put('/me/avatar', requireAuth, saveMyAvatar);
router.delete('/me/avatar', requireAuth, removeMyAvatar);

// Duy's code: Chỉ cho phép Member đọc và cập nhật hồ sơ sức khỏe của mình.
router.get('/me/health-profile', requireAuth, requireMember, getMyHealthProfile);
router.put('/me/health-profile', requireAuth, requireMember, saveMyHealthProfile);

module.exports = router;