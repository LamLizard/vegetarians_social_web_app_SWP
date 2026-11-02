const mealPlanModel = require('../models/meal-plan.model');

const MEAL_SLOTS = new Set(['breakfast', 'lunch', 'dinner', 'snack']);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

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

async function saveItem(req, res) {
  const planId = validateId(req.params.planId ?? req.params.id, 'Mã thực đơn');
  const mealSlot = normalizeMealSlot(req.params.mealSlot);
  const recipeId = getRecipeIdFromBody(req.body);
  validateId(recipeId, 'Mã công thức');

  const item = await mealPlanModel.saveDailyPlanItem(req.account.id, planId, mealSlot, recipeId);
  res.json({ item });
}

async function deleteItem(req, res) {
  const planId = validateId(req.params.planId ?? req.params.id, 'Mã thực đơn');
  const mealSlot = normalizeMealSlot(req.params.mealSlot);
  await mealPlanModel.deleteDailyPlanItem(req.account.id, planId, mealSlot);
  res.status(204).end();
}

async function randomize(req, res) {
  const planId = validateId(req.params.planId ?? req.params.id, 'Mã thực đơn');
  const payload = await mealPlanModel.randomizePlanItems(req.account.id, planId);
  res.json(payload);
}

module.exports = {
  getCurrent: handle(getCurrent),
  getWeek: handle(getWeek),
  create: handle(create),
  saveItem: handle(saveItem),
  deleteItem: handle(deleteItem),
  randomize: handle(randomize),
};
