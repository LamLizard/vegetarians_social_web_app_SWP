const express = require('express');
const { requireAuth, requireMember } = require('../middlewares/auth');
const controller = require('../controllers/aiMealPlanner.controller');

const router = express.Router();
router.use(requireAuth, requireMember);
router.post('/preview', controller.preview);
router.post('/confirm', controller.confirm);

module.exports = router;
