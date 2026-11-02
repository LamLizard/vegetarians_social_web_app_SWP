const express = require('express');
const { requireAuth, requireAdmin } = require('../middlewares/auth');
const controller = require('../controllers/aiConfig.controller');
const groqUsageController = require('../controllers/groqUsage.controller');
const deepseekUsageController = require('../controllers/deepseekUsage.controller');

const router = express.Router();
router.use(requireAuth, requireAdmin);
router.get('/usage', groqUsageController.read);
router.get('/usage/moderation', groqUsageController.readModeration);
router.get('/usage/deepseek', deepseekUsageController.read);
router.get('/', controller.read);
router.put('/', controller.update);

module.exports = router;
