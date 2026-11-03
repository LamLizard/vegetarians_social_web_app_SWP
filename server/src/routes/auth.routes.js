// POST /register · POST /login · GET /me
// Quên mật khẩu: POST /forgot-password · /forgot-password/verify · /forgot-password/reset · /forgot-password/resend
// Mount ở app.js với '/api/auth' nên đường dẫn thật là /api/auth/...
const express = require('express');
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.post('/register', authController.register);
router.post('/register/verify', authController.verifyRegisterOtp);
router.post('/register/resend', authController.resendRegisterOtp);
router.post('/forgot-password', authController.forgotPassword);
router.post('/forgot-password/verify', authController.verifyResetOtp);
router.post('/forgot-password/reset', authController.resetPassword);
router.post('/forgot-password/resend', authController.resendResetOtp);
router.post('/login', authController.login);
router.get('/me', requireAuth, authController.getMe);
module.exports = router;
