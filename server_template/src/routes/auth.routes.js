import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.js';

// Gắn ở server.js với tiền tố /api/auth
const router = Router();

router.post('/register', auth.register);
router.post('/login', auth.login);
router.get('/me', requireAuth, auth.me);
router.patch('/password', requireAuth, auth.changePassword);
router.post('/logout', requireAuth, auth.logout);

export default router;
