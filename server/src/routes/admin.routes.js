const express = require('express');
const adminController = require('../controllers/admin.controller');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

router.get('/dashboard', requireAuth, requireAdmin, adminController.getDashboard);

module.exports = router;