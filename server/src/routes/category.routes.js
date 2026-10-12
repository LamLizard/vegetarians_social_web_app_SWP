// Khoi's code: Gắn ở app.js: app.use('/api/categories', ...)
//   GET /   → { items: [{ id, name }] }   ai cũng gọi được (tên tag không phải dữ liệu riêng tư)
const express = require('express');
const categoryController = require('../controllers/category.controller');

const router = express.Router();

router.get('/', categoryController.getCategories);

module.exports = router;
