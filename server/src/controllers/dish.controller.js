const dishModel = require('../models/dish.model');
const { DishInputError, getDishDecision, normalizeDishInput } = require('../utils/dish');

function respondWithError(error, res, next) {
  if (Number.isInteger(error.status)) {
    return res.status(error.status).json({ message: error.message });
  }
  return next(error);
}

async function getCategories(req, res, next) {
  try {
    return res.json(await dishModel.listActiveCategories());
  } catch (error) {
    return next(error);
  }
}

async function getMyDishes(req, res, next) {
  try {
    return res.json(await dishModel.listMyDishes(req.account.id));
  } catch (error) {
    return next(error);
  }
}

async function suggestDish(req, res, next) {
  try {
    const input = normalizeDishInput(req.body);
    const dish = await dishModel.createDish(input, { id: req.account.id }, 'pending');
    return res.status(201).json(dish);
  } catch (error) {
    return respondWithError(error, res, next);
  }
}

async function createAdminDish(req, res, next) {
  try {
    const input = normalizeDishInput(req.body);
    const dish = await dishModel.createDish(input, { id: req.account.id, ip: req.ip }, 'active');
    return res.status(201).json(dish);
  } catch (error) {
    return respondWithError(error, res, next);
  }
}

async function getPendingDishes(req, res, next) {
  try {
    return res.json(await dishModel.listPendingDishes());
  } catch (error) {
    return next(error);
  }
}

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
  createAdminDish, decideDish, getCategories, getMyDishes, getPendingDishes, suggestDish,
};
