const express = require('express');
const controller = require('../controllers/adminCategory.controller');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get('/', controller.list);
router.post('/', controller.create);
router.patch('/:id', controller.rename);
router.patch('/:id/status', controller.setStatus);

module.exports = router;
