const express = require('express');
const controller = require('../controllers/notification.controller');
const { requireAuth, requireMember } = require('../middlewares/auth');

const router = express.Router();
router.use(requireAuth, requireMember);
router.get('/', controller.listMine);
router.post('/read-all', controller.markAllRead);
router.post('/:notificationId/read', controller.markRead);

module.exports = router;
