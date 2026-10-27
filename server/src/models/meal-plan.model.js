const pool = require('../config/db');

class MealPlanError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'MealPlanError';
    this.status = status;
  }
}

const PLAN_COLUMNS = `
  meal_plan_id::text AS id,
  plan_date::text AS "planDate",
  meals_per_day::int AS "mealsPerDay",
  target_calories_kcal AS "targetCaloriesKcal",
  status
`;

const ITEM_COLUMNS = `
  i.meal_plan_id::text AS "mealPlanId",
  i.item_id::text AS id,
  i.meal_slot::text AS "mealSlot",
  i.recipe_id::text AS "recipeId",
  i.recipe_name AS "recipeName",
  i.description,
  i.calories_kcal AS "caloriesKcal",
  i.nutrition_group::text AS "nutritionGroup",
  i.ingredients,
  r.thumbnail_url AS "imageUrl"
`;

function toDateKey(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function addDaysToDate(dateKeyValue, offset) {
  const current = new Date(`${dateKeyValue}T12:00:00.000Z`);
  current.setUTCDate(current.getUTCDate() + offset);
  return current.toISOString().slice(0, 10);
}

function getWeekStart(dateKeyValue) {
  const current = new Date(`${dateKeyValue}T12:00:00.000Z`);
  const dayShift = (current.getUTCDay() + 6) % 7;
  current.setUTCDate(current.getUTCDate() - dayShift);
  return current.toISOString().slice(0, 10);
}

function normalizeItem(item = {}) {
  return {
    id: String(item.id ?? item.itemId ?? item.item_id ?? ''),
    mealSlot: item.mealSlot ?? item.meal_slot,
    recipeId: String(item.recipeId ?? item.recipe_id ?? item.id ?? ''),
    recipeName: item.recipeName ?? item.recipe_name ?? 'Chưa có món',
    description: item.description ?? '',
    caloriesKcal: item.caloriesKcal ?? item.calories_kcal ?? null,
    nutritionGroup: item.nutritionGroup ?? item.nutrition_group ?? null,
    ingredients: Array.isArray(item.ingredients) ? item.ingredients : [],
    imageUrl: item.imageUrl ?? item.thumbnailUrl ?? null,
  };
}

async function loadPlanItemsById(planIds) {
  if (!planIds.length) return {};
  const { rows } = await pool.query(`
    SELECT ${ITEM_COLUMNS}
    FROM public.meal_plan_item i
    LEFT JOIN public.recipe r ON r.recipe_id = i.recipe_id
    WHERE i.meal_plan_id = ANY($1::bigint[])
    ORDER BY CASE i.meal_slot
      WHEN 'breakfast' THEN 1
      WHEN 'lunch' THEN 2
      WHEN 'dinner' THEN 3
      WHEN 'snack' THEN 4
      ELSE 99
    END
  `, [planIds]);

  const byPlanId = {};
  rows.forEach((row) => {
    const key = String(row.mealPlanId ?? row.meal_plan_id ?? '');
    if (!key) return;
    if (!byPlanId[key]) byPlanId[key] = [];
    byPlanId[key].push(normalizeItem(row));
  });

  return byPlanId;
}

async function getWeekPlan(accountId, weekStart) {
  const normalizedWeekStart = toDateKey(weekStart);
  if (!normalizedWeekStart) return [];

  const weekStartDate = getWeekStart(normalizedWeekStart);
  const weekEndDate = addDaysToDate(weekStartDate, 5);
  const { rows: plans } = await pool.query(`
    SELECT ${PLAN_COLUMNS}
    FROM public.meal_plan
    WHERE account_id = $1
      AND plan_date >= $2::date
      AND plan_date <= $3::date
    ORDER BY plan_date ASC
  `, [accountId, weekStartDate, weekEndDate]);

  const planIds = plans.map((plan) => Number(plan.id));
  const itemsByPlanId = await loadPlanItemsById(planIds);

  return Array.from({ length: 6 }, (_, offset) => {
    const date = addDaysToDate(weekStartDate, offset);
    const plan = plans.find((entry) => entry.planDate === date) ?? null;

    if (!plan) {
      return { date, plan: null };
    }

    return {
      date,
      plan: {
        id: String(plan.id),
        planDate: date,
        items: (itemsByPlanId[String(plan.id)] ?? []).map((item) => ({ ...item })),
      },
    };
  });
}

async function getPlanByDate(accountId, planDate) {
  const { rows: [plan] } = await pool.query(`
    SELECT ${PLAN_COLUMNS}
    FROM public.meal_plan
    WHERE account_id = $1 AND plan_date = $2::date
    ORDER BY created_at DESC, meal_plan_id DESC
    LIMIT 1
  `, [accountId, planDate]);

  return plan ?? null;
}

async function createDayPlan(accountId, planDate, mealsPerDay = 3) {
  const normalizedPlanDate = toDateKey(planDate);
  if (!normalizedPlanDate) {
    throw new MealPlanError(400, 'Ngày thực đơn không hợp lệ.');
  }

  const existing = await getPlanByDate(accountId, normalizedPlanDate);
  if (existing) {
    const itemsByPlanId = await loadPlanItemsById([Number(existing.id)]);
    return {
      id: String(existing.id),
      planDate: normalizedPlanDate,
      items: itemsByPlanId[String(existing.id)] ?? [],
      mealsPerDay: Number(existing.mealsPerDay ?? mealsPerDay),
      status: existing.status ?? 'saved',
    };
  }

  let profile = null;
  try {
    const profileQuery = await pool.query(`
      SELECT p.bmi, p.target_calories_kcal, p.health_goal,
        COALESCE((
          SELECT json_agg(a.name ORDER BY a.name)
          FROM public.allergy a
          WHERE a.profile_id = p.profile_id
        ), '[]'::json) AS allergies
      FROM public.profile p
      WHERE p.account_id = $1
      LIMIT 1
    `, [accountId]);
    profile = profileQuery.rows[0] ?? null;
  } catch (error) {
    profile = null;
  }

  const { rows: [inserted] } = await pool.query(`
    INSERT INTO public.meal_plan (
      account_id,
      title,
      plan_date,
      meals_per_day,
      source,
      bmi_snapshot,
      target_calories_kcal,
      goal_snapshot,
      allergy_snapshot,
      status
    ) VALUES (
      $1,
      $2,
      $3::date,
      $4,
      'manual',
      $5,
      $6,
      $7,
      $8::jsonb,
      'saved'
    )
    RETURNING ${PLAN_COLUMNS}
  `, [
    accountId,
    `Thực đơn ${normalizedPlanDate}`,
    normalizedPlanDate,
    Number.isInteger(mealsPerDay) && mealsPerDay > 0 ? mealsPerDay : 3,
    profile?.bmi ?? null,
    profile?.target_calories_kcal ?? null,
    profile?.health_goal ?? null,
    JSON.stringify(profile?.allergies ?? []),
  ]);

  return {
    id: String(inserted.id),
    planDate: normalizedPlanDate,
    items: [],
    mealsPerDay: Number(inserted.mealsPerDay ?? mealsPerDay),
    status: inserted.status ?? 'saved',
  };
}

async function saveDailyPlanItem(accountId, planId, mealSlot, recipeId) {
  const plan = await pool.query(
    'SELECT meal_plan_id::text AS id, plan_date::text AS "planDate" FROM public.meal_plan WHERE meal_plan_id = $1 AND account_id = $2 LIMIT 1',
    [planId, accountId],
  );

  if (!plan.rows[0]) {
    throw new MealPlanError(404, 'Không tìm thấy thực đơn để lưu công thức.');
  }

  const { rows: [recipe] } = await pool.query(`
    SELECT r.recipe_id::text AS id,
      r.title AS "recipeName",
      r.description,
      r.calories_kcal AS "caloriesKcal",
      r.thumbnail_url AS "imageUrl",
      COALESCE((
        SELECT json_agg(json_build_object(
          'name', ing.name,
          'amount', ri.amount,
          'unit', ri.unit
        ) ORDER BY ing.name)
        FROM public.recipe_ingredient ri
        JOIN public.ingredient ing ON ing.ingredient_id = ri.ingredient_id
        WHERE ri.recipe_id = r.recipe_id
      ), '[]'::json) AS ingredients
    FROM public.recipe r
    WHERE r.recipe_id = $1 AND r.status = 'approved'
    LIMIT 1
  `, [recipeId]);

  if (!recipe) {
    throw new MealPlanError(404, 'Không tìm thấy công thức đã duyệt.');
  }

  const { rows: [saved] } = await pool.query(`
    INSERT INTO public.meal_plan_item (
      meal_plan_id,
      meal_slot,
      recipe_id,
      recipe_name,
      description,
      calories_kcal,
      nutrition_group,
      ingredients
    ) VALUES (
      $1,
      $2::meal_slot_enum,
      $3,
      $4,
      $5,
      $6,
      NULL,
      $7::jsonb
    )
    ON CONFLICT (meal_plan_id, meal_slot) DO UPDATE SET
      recipe_id = EXCLUDED.recipe_id,
      recipe_name = EXCLUDED.recipe_name,
      description = EXCLUDED.description,
      calories_kcal = EXCLUDED.calories_kcal,
      ingredients = EXCLUDED.ingredients
    RETURNING item_id
  `, [
    planId,
    mealSlot,
    recipe.id,
    recipe.recipeName,
    recipe.description,
    recipe.caloriesKcal,
    JSON.stringify(recipe.ingredients ?? []),
  ]);

  const { rows: [item] } = await pool.query(`
    SELECT
      p.meal_plan_id::text AS "mealPlanId",
      p.item_id::text AS id,
      p.meal_slot::text AS "mealSlot",
      p.recipe_id::text AS "recipeId",
      p.recipe_name AS "recipeName",
      p.description,
      p.calories_kcal AS "caloriesKcal",
      p.nutrition_group::text AS "nutritionGroup",
      p.ingredients,
      r.thumbnail_url AS "imageUrl"
    FROM public.meal_plan_item p
    LEFT JOIN public.recipe r ON r.recipe_id = p.recipe_id
    WHERE p.item_id = $1
  `, [saved.item_id]);

  await pool.query('UPDATE public.meal_plan SET updated_at = NOW() WHERE meal_plan_id = $1', [planId]);
  return normalizeItem(item);
}

async function deleteDailyPlanItem(accountId, planId, mealSlot) {
  const plan = await pool.query(
    'SELECT meal_plan_id::text AS id FROM public.meal_plan WHERE meal_plan_id = $1 AND account_id = $2 LIMIT 1',
    [planId, accountId],
  );

  if (!plan.rows[0]) {
    throw new MealPlanError(404, 'Không tìm thấy thực đơn để xóa công thức.');
  }

  await pool.query(
    'DELETE FROM public.meal_plan_item WHERE meal_plan_id = $1 AND meal_slot = $2::meal_slot_enum',
    [planId, mealSlot],
  );

  await pool.query('UPDATE public.meal_plan SET updated_at = NOW() WHERE meal_plan_id = $1', [planId]);
  return true;
}

async function randomizePlanItems(accountId, planId) {
  const { rows: [existing] } = await pool.query(
    'SELECT meal_plan_id::text AS id FROM public.meal_plan WHERE meal_plan_id = $1 AND account_id = $2 LIMIT 1',
    [planId, accountId],
  );

  if (!existing) {
    throw new MealPlanError(404, 'Không tìm thấy thực đơn để random.');
  }

  const { rows } = await pool.query(`
    SELECT ${ITEM_COLUMNS}
    FROM public.meal_plan_item i
    LEFT JOIN public.recipe r ON r.recipe_id = i.recipe_id
    WHERE i.meal_plan_id = $1
    ORDER BY CASE i.meal_slot
      WHEN 'breakfast' THEN 1
      WHEN 'lunch' THEN 2
      WHEN 'dinner' THEN 3
      WHEN 'snack' THEN 4
      ELSE 99
    END
  `, [planId]);

  return {
    items: rows.map((item) => normalizeItem(item)),
    message: 'Đã chọn món cho các bữa trống.',
  };
}

module.exports = {
  MealPlanError,
  getWeekPlan,
  createDayPlan,
  saveDailyPlanItem,
  deleteDailyPlanItem,
  randomizePlanItems,
};
