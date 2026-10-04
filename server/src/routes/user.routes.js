const express = require('express');
const {
  getMyProfile, saveMyProfile, getMyAvatarUploadSignature, saveMyAvatar, removeMyAvatar,
  getMyHealthProfile, saveMyHealthProfile, withdrawMyHealthConsent,
} = require('../controllers/user.controller');
const { requireAuth, requireMember } = require('../middlewares/auth');

const router = express.Router();
router.get('/me', requireAuth, getMyProfile);
router.put('/me', requireAuth, saveMyProfile);
router.post('/me/avatar-upload-signature', requireAuth, getMyAvatarUploadSignature);
router.put('/me/avatar', requireAuth, saveMyAvatar);
router.delete('/me/avatar', requireAuth, removeMyAvatar);
router.get('/me/health-profile', requireAuth, requireMember, getMyHealthProfile);
router.put('/me/health-profile', requireAuth, requireMember, saveMyHealthProfile);
router.delete('/me/health-profile/consent', requireAuth, requireMember, withdrawMyHealthConsent);

module.exports = router;