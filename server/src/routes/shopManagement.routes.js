// Tùng — Sprint 2: literal /my-shop không ảnh hưởng public Shop router của Lâm.
const router = require('express').Router();
const { requireAuth } = require('../middlewares/auth');
const { requireMember } = require('../utils/shopWorkflow');
const controller = require('../controllers/shopManagement.controller');
const protect = [requireAuth, requireMember];

router.get('/my-shop', ...protect, controller.getMine);
router.patch('/my-shop', ...protect, controller.updateSchedule);
router.post('/my-shop/submissions', ...protect, controller.requestIdentity);
router.get('/my-shop/menu', ...protect, controller.listMenu);
router.post('/my-shop/menu', ...protect, controller.addMenu);
router.post('/my-shop/menu/image-upload/signature', ...protect, controller.prepareMenuImageUpload);
router.patch('/my-shop/menu/:shopDishId', ...protect, controller.updateMenu);
router.delete('/my-shop/menu/:shopDishId', ...protect, controller.removeMenu);
router.get('/my-shop/dishes', ...protect, controller.listDishes);
module.exports = router;
