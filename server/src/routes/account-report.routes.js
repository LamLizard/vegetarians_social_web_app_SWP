const express = require('express');
const { createAccountReport } = require('../controllers/account-report.controller');
const { requireAuth, requireMember } = require('../middlewares/auth');

const router = express.Router();
router.post('/:accountId/report', requireAuth, requireMember, createAccountReport);

module.exports = router;
