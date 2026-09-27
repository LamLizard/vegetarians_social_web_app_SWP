const express = require('express');
const { listMembers, setMemberStatus } = require('../controllers/admin-member.controller');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

const router = express.Router();
router.use(requireAuth, requireAdmin);
router.get('/', listMembers);
router.patch('/:accountId/status', setMemberStatus);

module.exports = router;