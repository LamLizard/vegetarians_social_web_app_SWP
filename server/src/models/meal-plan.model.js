const pool = require('../config/db');

const { lockMealPlanWriter } = require('../utils/mealPlanWriteLock');

async function withMealPlanWrite(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockMealPlanWriter(client);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* preserve the original failure */ }
    throw error;
  } finally {
    client.release();
  }
}

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

async function loadPlanItemsById(planIds, db = pool) {
  if (!planIds.length) return {};
  const { rows } = await db.query(`
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
  const weekEndDate = addDaysToDate(weekStartDate, 6);
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

  return Array.from({ length: 7 }, (_, offset) => {
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
        targetCaloriesKcal: plan.targetCaloriesKcal ?? null,
        items: (itemsByPlanId[String(plan.id)] ?? []).map((item) => ({ ...item })),
      },
    };
  });
}

async function getPlanByDate(accountId, planDate, db = pool) {
  const { rows: [plan] } = await db.query(`
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

  return withMealPlanWrite(async (client) => {
    const existing = await getPlanByDate(accountId, normalizedPlanDate, client);
    if (existing) {
      const itemsByPlanId = await loadPlanItemsById([Number(existing.id)], client);
      return {
        id: String(existing.id),
        planDate: normalizedPlanDate,
        items: itemsByPlanId[String(existing.id)] ?? [],
        mealsPerDay: Number(existing.mealsPerDay ?? mealsPerDay),
        targetCaloriesKcal: existing.targetCaloriesKcal ?? null,
        status: existing.status ?? 'saved',
      };
    }

    let profile = null;
    await client.query('SAVEPOINT meal_plan_profile_lookup');
    try {
      const profileQuery = await client.query(`
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
      await client.query('ROLLBACK TO SAVEPOINT meal_plan_profile_lookup');
      profile = null;
    }
    await client.query('RELEASE SAVEPOINT meal_plan_profile_lookup');

    const { rows: [inserted] } = await client.query(`
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
      targetCaloriesKcal: inserted.targetCaloriesKcal ?? null,
      status: inserted.status ?? 'saved',
    };
  });
}

async function saveDailyPlanItem(accountId, planId, mealSlot, recipeId) {
  return withMealPlanWrite(async (client) => {
    const plan = await client.query(
      'SELECT meal_plan_id::text AS id, plan_date::text AS "planDate" FROM public.meal_plan WHERE meal_plan_id = $1 AND account_id = $2 LIMIT 1',
      [planId, accountId],
    );

    if (!plan.rows[0]) {
      throw new MealPlanError(404, 'Không tìm thấy thực đơn để lưu công thức.');
    }

    const { rows: [recipe] } = await client.query(`
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

    const { rows: [saved] } = await client.query(`
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

    const { rows: [item] } = await client.query(`
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

    await client.query('UPDATE public.meal_plan SET updated_at = NOW() WHERE meal_plan_id = $1', [planId]);
    return normalizeItem(item);
  });
}

async function deleteDailyPlanItem(accountId, planId, mealSlot) {
  return withMealPlanWrite(async (client) => {
    const plan = await client.query(
      'SELECT meal_plan_id::text AS id FROM public.meal_plan WHERE meal_plan_id = $1 AND account_id = $2 LIMIT 1',
      [planId, accountId],
    );

    if (!plan.rows[0]) {
      throw new MealPlanError(404, 'Không tìm thấy thực đơn để xóa công thức.');
    }

    await client.query(
      'DELETE FROM public.meal_plan_item WHERE meal_plan_id = $1 AND meal_slot = $2::meal_slot_enum',
      [planId, mealSlot],
    );

    await client.query('UPDATE public.meal_plan SET updated_at = NOW() WHERE meal_plan_id = $1', [planId]);
    return true;
  });
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function normalizeAllergen(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .trim();
}

function readAllergyNames(value) {
  let allergies = value;
  if (typeof allergies === 'string') {
    try {
      allergies = JSON.parse(allergies);
    } catch {
      throw new MealPlanError(409, 'Không thể xác định danh sách dị ứng của thực đơn.');
    }
  }
  if (!Array.isArray(allergies)) {
    throw new MealPlanError(409, 'Không thể xác định danh sách dị ứng của thực đơn.');
  }

  return allergies
    .map((allergy) => (typeof allergy === 'string' ? allergy : allergy?.name ?? allergy?.ingredient ?? ''))
    .map(normalizeAllergen)
    .filter(Boolean);
}

function readRecipeIngredients(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isSafeRecipe(recipe, allergyNames) {
  if (allergyNames.length === 0) return true;
  const ingredients = readRecipeIngredients(recipe.ingredients);
  if (!ingredients?.length) return false;

  const ingredientNames = ingredients.map((ingredient) => (
    normalizeAllergen(typeof ingredient === 'string' ? ingredient : ingredient?.name ?? ingredient?.ingredient)
  ));
  if (ingredientNames.some((name) => !name)) return false;
  return !ingredientNames.some((ingredientName) => allergyNames.some((allergyName) => (
    ingredientName.includes(allergyName) || allergyName.includes(ingredientName)
  )));
}

function chooseRecipes(emptySlots, recipes, budget, maxAttempts = 10000) {
  let attempts = 0;

  function backtrack(index, remainingBudget, chosen, usedIds) {
    if (index === emptySlots.length) return chosen;
    if (attempts >= maxAttempts) return null;

    const available = recipes.filter((recipe) => !usedIds.has(recipe.id));
    const caloriesLeft = available
      .map((recipe) => Number(recipe.caloriesKcal))
      .sort((left, right) => left - right);
    const remainingSlots = emptySlots.length - index;
    if (caloriesLeft.length < remainingSlots) return null;
    const minimumTotal = caloriesLeft.slice(0, remainingSlots).reduce((sum, calories) => sum + calories, 0);
    if (remainingBudget < minimumTotal) return null;

    for (const recipe of shuffle(available)) {
      const calories = Number(recipe.caloriesKcal);
      const minimumRest = available
        .filter((candidate) => candidate.id !== recipe.id)
        .map((candidate) => Number(candidate.caloriesKcal))
        .sort((left, right) => left - right)
        .slice(0, remainingSlots - 1)
        .reduce((sum, value) => sum + value, 0);
      if (calories > remainingBudget - minimumRest || attempts >= maxAttempts) continue;

      attempts += 1;
      chosen.push(recipe);
      usedIds.add(recipe.id);
      const result = backtrack(index + 1, remainingBudget - calories, chosen, usedIds);
      if (result) return result;
      usedIds.delete(recipe.id);
      chosen.pop();
    }
    return null;
  }

  return backtrack(0, budget, [], new Set());
}

async function randomizePlanItems(accountId, planId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockMealPlanWriter(client);

    const { rows: [plan] } = await client.query(`
      SELECT meal_plan_id::text AS id,
        plan_date::text AS "planDate",
        target_calories_kcal AS "targetCaloriesKcal",
        allergy_snapshot AS "allergySnapshot"
      FROM public.meal_plan
      WHERE meal_plan_id = $1 AND account_id = $2
      FOR UPDATE
    `, [planId, accountId]);

    if (!plan) throw new MealPlanError(404, 'Không tìm thấy thực đơn để random.');

    const today = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    if (String(plan.planDate) < today) {
      throw new MealPlanError(403, 'Không thể random thực đơn của ngày đã qua.');
    }

    const targetCalories = Number(plan.targetCaloriesKcal);
    if (!Number.isFinite(targetCalories) || targetCalories <= 0) {
      throw new MealPlanError(400, 'Thực đơn chưa có mục tiêu calo hợp lệ.');
    }

    const { rows: existingItems } = await client.query(`
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

    const slotOrder = ['breakfast', 'lunch', 'dinner', 'snack'];
    const existingSlots = new Set(existingItems.map((item) => item.mealSlot));
    const emptySlots = shuffle(slotOrder.filter((slot) => !existingSlots.has(slot)));
    if (emptySlots.length === 0) {
      throw new MealPlanError(409, 'Không còn bữa trống để random.');
    }

    const fixedCalories = existingItems.reduce((sum, item) => {
      const calories = item.caloriesKcal === null || item.caloriesKcal === undefined || item.caloriesKcal === ''
        ? Number.NaN
        : Number(item.caloriesKcal);
      return Number.isFinite(calories) && calories >= 0 ? sum + calories : Number.NaN;
    }, 0);
    if (!Number.isFinite(fixedCalories)) {
      throw new MealPlanError(400, 'Không thể xác định tổng calo của các món đã có.');
    }

    const budget = targetCalories - fixedCalories - 1;
    if (budget <= 0) {
      throw new MealPlanError(400, 'Không đủ calo cho bữa trống.');
    }

    let allergySnapshot = plan.allergySnapshot;
    if (allergySnapshot == null) {
      const { rows: [profile] } = await client.query(`
        SELECT COALESCE((
          SELECT json_agg(a.name ORDER BY a.name)
          FROM public.allergy a
          WHERE a.profile_id = p.profile_id
        ), '[]'::json) AS allergies
        FROM public.profile p
        WHERE p.account_id = $1
        LIMIT 1
      `, [accountId]);
      allergySnapshot = profile?.allergies ?? [];
    }
    const allergyNames = readAllergyNames(allergySnapshot);

    const usedIds = existingItems.map((item) => item.recipeId);
    const { rows: recipes } = await client.query(`
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
      WHERE r.status = 'approved'
        AND r.calories_kcal IS NOT NULL
        AND r.calories_kcal > 0
        AND NOT (r.recipe_id = ANY($1::bigint[]))
    `, [usedIds]);

    const validRecipes = recipes
      .filter((recipe) => isSafeRecipe(recipe, allergyNames))
      .filter((recipe) => Number.isFinite(Number(recipe.caloriesKcal)) && Number(recipe.caloriesKcal) > 0);
    if (validRecipes.length < emptySlots.length) {
      throw new MealPlanError(409, 'Không đủ recipe phù hợp cho các bữa trống.');
    }

    const chosenRecipes = chooseRecipes(emptySlots, validRecipes, budget);
    if (!chosenRecipes) {
      throw new MealPlanError(409, 'Không tìm được bộ món phù hợp với mục tiêu calo.');
    }

    const insertedIds = [];
    for (let index = 0; index < emptySlots.length; index += 1) {
      const recipe = chosenRecipes[index];
      const { rows: [inserted] } = await client.query(`
        INSERT INTO public.meal_plan_item (
          meal_plan_id,
          meal_slot,
          recipe_id,
          recipe_name,
          description,
          calories_kcal,
          nutrition_group,
          ingredients
        ) VALUES ($1, $2::meal_slot_enum, $3, $4, $5, $6, NULL, $7::jsonb)
        RETURNING item_id::text AS id
      `, [
        planId,
        emptySlots[index],
        recipe.id,
        recipe.recipeName,
        recipe.description,
        recipe.caloriesKcal,
        JSON.stringify(readRecipeIngredients(recipe.ingredients) ?? []),
      ]);
      insertedIds.push(inserted.id);
    }

    const { rows: newItems } = await client.query(`
      SELECT ${ITEM_COLUMNS}
      FROM public.meal_plan_item i
      LEFT JOIN public.recipe r ON r.recipe_id = i.recipe_id
      WHERE i.item_id = ANY($1::bigint[])
      ORDER BY CASE i.meal_slot
        WHEN 'breakfast' THEN 1
        WHEN 'lunch' THEN 2
        WHEN 'dinner' THEN 3
        WHEN 'snack' THEN 4
        ELSE 99
      END
    `, [insertedIds]);
    await client.query('UPDATE public.meal_plan SET updated_at = NOW() WHERE meal_plan_id = $1', [planId]);
    await client.query('COMMIT');

    return {
      items: newItems.map((item) => normalizeItem(item)),
      message: `Đã thêm ${newItems.length} món vào các bữa trống.`,
    };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* preserve the original failure */ }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  MealPlanError,
  getWeekPlan,
  createDayPlan,
  saveDailyPlanItem,
  deleteDailyPlanItem,
  randomizePlanItems,
};
