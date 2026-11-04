const express = require('express');
const mealPlanController = require('../controllers/meal-plan.controller');
const { requireAuth, requireMember } = require('../middlewares/auth');

const router = express.Router();

router.use(requireAuth, requireMember);

router.get('/week', mealPlanController.getWeek);
router.get('/current', mealPlanController.getCurrent);
router.post('/', mealPlanController.create);
// Thêm món vào bữa: một bữa được nhiều món.
router.post('/:planId/items', mealPlanController.appendItem);
router.put('/:planId/items/:mealSlot', mealPlanController.saveItem);
// :itemId = tên bữa (xoá cả bữa) hoặc item_id (xoá 1 món).
router.delete('/:planId/items/:itemId', mealPlanController.deleteItem);
router.post('/:planId/randomize', mealPlanController.randomize);

router.put('/:id/items/:dayNo/:mealSlot', mealPlanController.saveItem);
router.delete('/:id/items/:dayNo/:mealSlot', mealPlanController.deleteItem);

module.exports = router;
