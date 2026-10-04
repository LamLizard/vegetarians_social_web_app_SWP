const express = require('express');
const dishController = require('../controllers/dish.controller');
const { requireAuth, requireAdmin, requireMember } = require('../middlewares/auth');

const router = express.Router();

router.get('/categories', requireAuth, dishController.getCategories);
router.get('/mine', requireAuth, requireMember, dishController.getMyDishes);
router.post('/', requireAuth, requireMember, dishController.suggestDish);

router.post('/admin', requireAuth, requireAdmin, dishController.createAdminDish);
router.get('/admin/pending', requireAuth, requireAdmin, dishController.getPendingDishes);
router.post('/admin/:dishId/decision', requireAuth, requireAdmin, dishController.decideDish);

module.exports = router;
