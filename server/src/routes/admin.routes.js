const express = require('express');
const adminController = require('../controllers/admin.controller');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

router.get('/dashboard', requireAuth, requireAdmin, adminController.getDashboard);
router.get('/dashboard/alerts', requireAuth, requireAdmin, adminController.getAlerts);
router.get('/dashboard/queue', requireAuth, requireAdmin, adminController.getQueue);
router.get('/dashboard/audit', requireAuth, requireAdmin, adminController.getAudit);

module.exports = router;