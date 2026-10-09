// Khoi's code: API danh sách tag (category) cho form Đăng bài.
const categoryModel = require('../models/category.model');

/** GET /api/categories → { items: [{ id, name }] } */
async function getCategories(req, res) {
  try {
    res.json({ items: await categoryModel.findActive() });
  } catch (error) {
    console.error('[category.getCategories]', error);
    res.status(500).json({ message: 'Không tải được danh sách tag, vui lòng thử lại.' });
  }
}

module.exports = { getCategories };
