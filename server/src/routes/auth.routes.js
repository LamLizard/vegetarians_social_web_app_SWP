// POST /register · POST /login · GET /me
// Mount ở app.js với '/api/auth' nên đường dẫn thật là /api/auth/...
const express = require('express');
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.post('/register', authController.register);
router.post('/register/verify', authController.verifyRegisterOtp);
router.post('/register/resend', authController.resendRegisterOtp);
router.post('/login', authController.login);
router.get('/me', requireAuth, authController.getMe);
module.exports = router;