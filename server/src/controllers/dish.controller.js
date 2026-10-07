const dishModel = require('../models/dish.model');
const { DishInputError, getDishDecision, normalizeDishInput } = require('../utils/dish');

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

// Duy's code: Chỉ đọc các đề xuất của Member đang đăng nhập.
async function getMyDishes(req, res, next) {
  try {
    return res.json(await dishModel.listMyDishes(req.account.id));
  } catch (error) {
    return next(error);
  }
}

// Duy's code: Kiểm tra nội dung và tạo đề xuất mới ở trạng thái pending.
async function suggestDish(req, res, next) {
  try {
    const input = normalizeDishInput(req.body);
    const dish = await dishModel.createDish(input, { id: req.account.id }, 'pending');
    return res.status(201).json(dish);
  } catch (error) {
    return respondWithError(error, res, next);
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

// Duy's code: Nạp hàng chờ để Admin duyệt hoặc từ chối đề xuất.
async function getPendingDishes(req, res, next) {
  try {
    return res.json(await dishModel.listPendingDishes());
  } catch (error) {
    return next(error);
  }
}

// Duy's Code: Tải món đã duyệt và bị từ chối để Admin tra cứu trạng thái sau kiểm duyệt.
async function getAdminDishes(req, res, next) {
  try {
    return res.json(await dishModel.listAdminDishes());
  } catch (error) {
    return next(error);
  }
}

// Duy's code: Kiểm tra quyết định và lý do trước khi thay đổi trạng thái Dish.
async function decideDish(req, res, next) {
  try {
    const dishId = Number(req.params.dishId);
    if (!Number.isSafeInteger(dishId) || dishId < 1) {
      throw new DishInputError('Mã món ăn không hợp lệ.');
    }
    const { action } = req.body || {};
    const decision = getDishDecision(action);
    const note = String(req.body?.note ?? '').normalize('NFC').trim();
    if (note.length > 255) throw new DishInputError('Lý do không được vượt quá 255 ký tự.');
    if (decision.status === 'rejected' && !note) {
      throw new DishInputError('Cần nhập lý do từ chối đề xuất món ăn.');
    }
    const dish = await dishModel.decideDish(dishId, action, note, { id: req.account.id, ip: req.ip });
    return res.json(dish);
  } catch (error) {
    return respondWithError(error, res, next);
  }
}

module.exports = {
  createAdminDish, decideDish, getAdminDishes, getCategories, getMyDishes, getPendingDishes, suggestDish,
};
