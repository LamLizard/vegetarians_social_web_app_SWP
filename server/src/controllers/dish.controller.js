const dishModel = require('../models/dish.model');
const { normalizeDishInput } = require('../utils/dish');
const { parseRecipeInput, RecipeInputError } = require('../utils/recipeInput');
// Khoi's code: Ảnh món/công thức Admin tải qua API upload ảnh bìa (POST /api/uploads/image) → kiểm tra theo cùng cloud đó.
const { POST_CLOUD_NAME } = require('../config/cloudinary');

// Duy's code: Trả lỗi nghiệp vụ cho client và chuyển lỗi hệ thống qua middleware.
function respondWithError(error, res, next) {
  if (Number.isInteger(error.status)) {
    return res.status(error.status).json({ message: error.message });
  }
  return next(error);
}

// Duy's code: Cung cấp danh mục hoạt động cho các form tạo/đề xuất Dish.
async function getCategories(req, res, next) {
  try {
    return res.json(await dishModel.listActiveCategories());
  } catch (error) {
    return next(error);
  }
}

// Duy's code: Cho phép Admin tạo Dish trực tiếp ở trạng thái active.
async function createAdminDish(req, res, next) {
  try {
    const input = normalizeDishInput(req.body);
    const dish = await dishModel.createDish(input, { id: req.account.id, ip: req.ip }, 'active');
    return res.status(201).json(dish);
  } catch (error) {
    return respondWithError(error, res, next);
  }
}

async function createAdminDishWithRecipe(req, res, next) {
  try {
    const dish = normalizeDishInput(req.body);
    const recipe = parseRecipeInput({
      ...req.body?.recipe,
      proposedDishName: req.body?.name,
      thumbnailUrl: dish.thumbnailUrl,
    }, { cloudName: POST_CLOUD_NAME });
    const created = await dishModel.createAdminDishWithRecipe(dish, recipe, { id: req.account.id, ip: req.ip });
    return res.status(201).json(created);
  } catch (error) {
    if (error instanceof RecipeInputError) return res.status(400).json({ message: error.message });
    return respondWithError(error, res, next);
  }
}

// Duy's Code : Cấp các danh mục món và công thức đã duyệt cho trang quản lý theo nhóm.
async function getAdminDishes(req, res, next) {
  try {
    return res.json(await dishModel.listAdminDishes());
  } catch (error) {
    return next(error);
  }
}

async function searchAdminDishes(req, res, next) {
  try {
    const query = String(req.query.q || '').trim();
    if (!query) return res.json([]);
    return res.json(await dishModel.searchAdminDishes(query));
  } catch (error) {
    return next(error);
  }
}

module.exports = { createAdminDish, createAdminDishWithRecipe, getAdminDishes, getCategories, searchAdminDishes };
