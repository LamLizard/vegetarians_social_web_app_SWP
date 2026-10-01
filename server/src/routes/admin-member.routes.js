const express = require('express');
const { listMembers, listAccountReports, decideAccountReport, setMemberStatus } = require('../controllers/admin-member.controller');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

const router = express.Router();
router.use(requireAuth, requireAdmin);
router.get('/', listMembers);
router.get('/reported', listAccountReports); // Duy's code: danh sách report_case target_type account.
router.patch('/reported/:caseId', decideAccountReport); // Duy's code: chấp nhận/từ chối case account.
router.patch('/:accountId/status', setMemberStatus);

module.exports = router;