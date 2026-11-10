const mealPlanModel = require('../models/meal-plan.model');

const MEAL_SLOTS = new Set(['breakfast', 'lunch', 'dinner', 'snack']);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const MAX_HOUSEHOLD_SIZE = 11; // bản thân + tối đa 10 người ăn chung
const MIN_PERSON_TARGET = 500;
const MAX_PERSON_TARGET = 8000;

class MealPlanInputError extends Error {}

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error instanceof MealPlanInputError) return res.status(400).json({ message: error.message });
    if (error instanceof mealPlanModel.MealPlanError) return res.status(error.status).json({ message: error.message });
    console.error(`[meal-plan.${fn.name}]`, error);
    return res.status(500).json({ message: 'Có lỗi xảy ra, vui lòng thử lại sau.' });
  }
};

function validateDateString(value, label) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    throw new MealPlanInputError(`${label} phải có định dạng YYYY-MM-DD.`);
  }

  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new MealPlanInputError(`${label} không hợp lệ.`);
  }

  return value;
}

function validateWeekStart(value) {
  const normalized = validateDateString(value, 'Ngày bắt đầu tuần');
  const date = new Date(`${normalized}T12:00:00.000Z`);
  if (date.getUTCDay() !== 1) {
    throw new MealPlanInputError('Ngày bắt đầu tuần phải là thứ Hai hợp lệ.');
  }
  return normalized;
}

function validatePlanDate(value) {
  return validateDateString(value, 'Ngày thực đơn');
}

function validateId(value, label) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,17}$/u.test(value)) {
    throw new MealPlanInputError(`${label} không hợp lệ.`);
  }
  return value;
}

function normalizeMealSlot(value) {
  const slot = String(value ?? '');
  if (!MEAL_SLOTS.has(slot)) throw new MealPlanInputError('Bữa ăn không hợp lệ.');
  return slot;
}

function getRecipeIdFromBody(body) {
  const recipeId = String(body?.recipeId ?? body?.recipe_id ?? '');
  if (!recipeId) throw new MealPlanInputError('Mã công thức không hợp lệ.');
  return recipeId;
}

/** householdSize: không gửi → giữ cấu hình đang lưu của thực đơn. */
function readHouseholdSize(body) {
  const raw = body?.householdSize ?? body?.household_size;
  if (raw === undefined || raw === null || raw === '') return null;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > MAX_HOUSEHOLD_SIZE) {
    throw new MealPlanInputError(`Số người phải là số nguyên từ 1 đến ${MAX_HOUSEHOLD_SIZE}.`);
  }
  return value;
}

/** personTargets: mảng kcal của từng người, phải khớp householdSize. */
function readPersonTargets(body, householdSize) {
  const raw = body?.personTargets ?? body?.person_targets;
  if (raw === undefined || raw === null) return null;
  if (!Array.isArray(raw)) {
    throw new MealPlanInputError('Mục tiêu calo từng người phải là một mảng số.');
  }
  if (householdSize === null) {
    throw new MealPlanInputError('Cần chọn số người trước khi nhập mục tiêu calo từng người.');
  }
  if (raw.length !== householdSize) {
    throw new MealPlanInputError('Số mục tiêu calo phải khớp với số người.');
  }

  const targets = raw.map((entry) => Number(entry));
  if (targets.some((entry) => !Number.isInteger(entry) || entry < MIN_PERSON_TARGET || entry > MAX_PERSON_TARGET)) {
    throw new MealPlanInputError(`Mục tiêu calo mỗi người phải từ ${MIN_PERSON_TARGET} đến ${MAX_PERSON_TARGET} kcal.`);
  }
  return targets;
}

async function getCurrent(req, res) {
  const weekStart = validateWeekStart(req.query.weekStart ?? req.query.planDate ?? req.query.date);
  const days = await mealPlanModel.getWeekPlan(req.account.id, weekStart);
  res.json({ days });
}

async function getWeek(req, res) {
  return getCurrent(req, res);
}

async function create(req, res) {
  const planDate = validatePlanDate(req.body?.planDate ?? req.body?.startDate ?? req.body?.date ?? req.body?.plan_date);
  const mealsPerDay = Number(req.body?.mealsPerDay ?? req.body?.meals_per_day ?? 3);
  if (!Number.isInteger(mealsPerDay) || mealsPerDay < 1 || mealsPerDay > 4) {
    throw new MealPlanInputError('Số bữa ăn mỗi ngày không hợp lệ.');
  }

  const plan = await mealPlanModel.createDayPlan(req.account.id, planDate, mealsPerDay);
  res.status(201).json({ plan });
}

/** Thêm món vào bữa — một bữa được phép nhiều món. */
async function appendItem(req, res) {
  const planId = validateId(req.params.planId ?? req.params.id, 'Mã thực đơn');
  const mealSlot = normalizeMealSlot(req.body?.mealSlot ?? req.body?.meal_slot ?? req.params.mealSlot);
  const recipeId = validateId(getRecipeIdFromBody(req.body), 'Mã công thức');

  const item = await mealPlanModel.addDailyPlanItem(req.account.id, planId, mealSlot, recipeId);
  res.status(201).json({ item });
}

/** Đặt lại bữa bằng đúng 1 món (giữ contract cũ của PUT). */
async function saveItem(req, res) {
  const planId = validateId(req.params.planId ?? req.params.id, 'Mã thực đơn');
  const mealSlot = normalizeMealSlot(req.params.mealSlot);
  const recipeId = getRecipeIdFromBody(req.body);
  validateId(recipeId, 'Mã công thức');

  const item = await mealPlanModel.saveDailyPlanItem(req.account.id, planId, mealSlot, recipeId);
  res.json({ item });
}

/**
 * DELETE .../items/:target
 *   target là tên bữa (breakfast/lunch/dinner/snack) → xoá cả bữa (route cũ)
 *   target là số (item_id) → xoá đúng 1 món
 */
async function deleteItem(req, res) {
  const planId = validateId(req.params.planId ?? req.params.id, 'Mã thực đơn');
  const target = String(req.params.itemId ?? req.params.mealSlot ?? '');

  if (MEAL_SLOTS.has(target)) {
    await mealPlanModel.deleteDailyPlanItem(req.account.id, planId, target);
  } else {
    const itemId = validateId(target, 'Mã món');
    await mealPlanModel.deletePlanItem(req.account.id, planId, itemId);
  }

  res.status(204).end();
}

async function randomize(req, res) {
  const planId = validateId(req.params.planId ?? req.params.id, 'Mã thực đơn');
  const householdSize = readHouseholdSize(req.body);
  const personTargets = readPersonTargets(req.body, householdSize);
  const rawReplace = req.body?.replace ?? req.body?.replaceExisting;
  const replace = rawReplace === true || rawReplace === 'true';

  const payload = await mealPlanModel.randomizePlanItems(req.account.id, planId, {
    householdSize,
    personTargets,
    replace,
  });
  res.json(payload);
}

module.exports = {
  getCurrent: handle(getCurrent),
  getWeek: handle(getWeek),
  create: handle(create),
  appendItem: handle(appendItem),
  saveItem: handle(saveItem),
  deleteItem: handle(deleteItem),
  randomize: handle(randomize),
};
