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
  household_size::int AS "householdSize",
  person_targets AS "personTargets",
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

const SLOT_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];

// Tỉ lệ calo gợi ý cho từng bữa khi chia mục tiêu trong ngày.
const SLOT_CALORIE_WEIGHT = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.3,
  snack: 0.1,
};

const MAX_DISHES_PER_SLOT = 3;
const MIN_DISHES_PER_SLOT = 1;
const RANDOM_ATTEMPTS = 60;

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

function normalizePersonTargets(value) {
  if (!Array.isArray(value)) return null;
  const targets = value.map((entry) => Number(entry));
  if (targets.some((entry) => !Number.isInteger(entry) || entry <= 0)) return null;
  return targets;
}

function sumPersonTargets(targets) {
  if (!Array.isArray(targets) || targets.length === 0) return null;
  const total = targets.reduce((sum, entry) => sum + entry, 0);
  return Number.isFinite(total) && total > 0 ? total : null;
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
    END,
    i.item_id ASC
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
        mealsPerDay: Number(plan.mealsPerDay ?? 3),
        householdSize: Number(plan.householdSize ?? 1),
        personTargets: normalizePersonTargets(plan.personTargets),
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

async function requirePlan(client, accountId, planId, missingMessage) {
  const { rows: [plan] } = await client.query(
    'SELECT meal_plan_id::text AS id, plan_date::text AS "planDate" FROM public.meal_plan WHERE meal_plan_id = $1 AND account_id = $2 LIMIT 1',
    [planId, accountId],
  );

  if (!plan) throw new MealPlanError(404, missingMessage);
  return plan;
}

async function touchPlan(client, planId) {
  await client.query('UPDATE public.meal_plan SET updated_at = NOW() WHERE meal_plan_id = $1', [planId]);
}

async function fetchApprovedRecipe(client, recipeId) {
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

  return recipe ?? null;
}

async function insertPlanItem(client, planId, mealSlot, recipe) {
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
    RETURNING item_id::text AS id
  `, [
    planId,
    mealSlot,
    recipe.id,
    recipe.recipeName,
    recipe.description,
    recipe.caloriesKcal,
    JSON.stringify(Array.isArray(recipe.ingredients) ? recipe.ingredients : []),
  ]);

  return saved.id;
}

async function loadItemsByIds(client, itemIds) {
  if (!itemIds.length) return [];
  const { rows } = await client.query(`
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
    END,
    i.item_id ASC
  `, [itemIds]);

  return rows.map((item) => normalizeItem(item));
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
        householdSize: Number(existing.householdSize ?? 1),
        personTargets: normalizePersonTargets(existing.personTargets),
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
      householdSize: Number(inserted.householdSize ?? 1),
      personTargets: normalizePersonTargets(inserted.personTargets),
      status: inserted.status ?? 'saved',
    };
  });
}

/**
 * Thêm 1 món vào bữa (giữ các món đã có). Một bữa được phép nhiều món.
 */
async function addDailyPlanItem(accountId, planId, mealSlot, recipeId) {
  return withMealPlanWrite(async (client) => {
    await requirePlan(client, accountId, planId, 'Không tìm thấy thực đơn để lưu công thức.');

    const recipe = await fetchApprovedRecipe(client, recipeId);
    if (!recipe) {
      throw new MealPlanError(404, 'Không tìm thấy công thức đã duyệt.');
    }

    let itemId;
    try {
      itemId = await insertPlanItem(client, planId, mealSlot, recipe);
    } catch (error) {
      if (error?.code === '23505') {
        throw new MealPlanError(409, 'Món này đã có trong bữa.');
      }
      throw error;
    }

    const [item] = await loadItemsByIds(client, [itemId]);
    await touchPlan(client, planId);
    return item;
  });
}

/**
 * Đặt lại toàn bộ bữa bằng 1 món duy nhất (dùng cho route cũ PUT .../items/:mealSlot).
 */
async function saveDailyPlanItem(accountId, planId, mealSlot, recipeId) {
  return withMealPlanWrite(async (client) => {
    await requirePlan(client, accountId, planId, 'Không tìm thấy thực đơn để lưu công thức.');

    const recipe = await fetchApprovedRecipe(client, recipeId);
    if (!recipe) {
      throw new MealPlanError(404, 'Không tìm thấy công thức đã duyệt.');
    }

    await client.query(
      'DELETE FROM public.meal_plan_item WHERE meal_plan_id = $1 AND meal_slot = $2::meal_slot_enum',
      [planId, mealSlot],
    );

    const itemId = await insertPlanItem(client, planId, mealSlot, recipe);
    const [item] = await loadItemsByIds(client, [itemId]);
    await touchPlan(client, planId);
    return item;
  });
}

async function deleteDailyPlanItem(accountId, planId, mealSlot) {
  return withMealPlanWrite(async (client) => {
    await requirePlan(client, accountId, planId, 'Không tìm thấy thực đơn để xóa công thức.');

    await client.query(
      'DELETE FROM public.meal_plan_item WHERE meal_plan_id = $1 AND meal_slot = $2::meal_slot_enum',
      [planId, mealSlot],
    );

    await touchPlan(client, planId);
    return true;
  });
}

async function deletePlanItem(accountId, planId, itemId) {
  return withMealPlanWrite(async (client) => {
    await requirePlan(client, accountId, planId, 'Không tìm thấy thực đơn để xóa công thức.');

    const { rowCount } = await client.query(
      'DELETE FROM public.meal_plan_item WHERE item_id = $1 AND meal_plan_id = $2',
      [itemId, planId],
    );
    if (!rowCount) {
      throw new MealPlanError(404, 'Không tìm thấy món cần xóa.');
    }

    await touchPlan(client, planId);
    return true;
  });
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

/**
 * Sinh một phương án cho cả ngày:
 *   1) random tổng số món (mỗi bữa 1..3 món),
 *   2) chọn đúng số món đó sao cho tổng calo sát ngân sách (leo dốc bằng cách đổi món),
 *   3) chia món về từng bữa — bữa quan trọng (trưa/tối) nhận món đậm calo hơn.
 */
function buildRandomDay(validRecipes, targetSlots, budget) {
  if (!targetSlots.length) return null;

  const minDishes = targetSlots.length * MIN_DISHES_PER_SLOT;
  const maxDishes = Math.min(validRecipes.length, targetSlots.length * MAX_DISHES_PER_SLOT);
  if (maxDishes < minDishes) return null;

  const dishCount = minDishes + Math.floor(Math.random() * (maxDishes - minDishes + 1));
  const tolerance = Math.max(60, budget * 0.03);

  // Bắt đầu từ nhóm món nhẹ nhất rồi đổi dần sang món đậm hơn để tiến về ngân sách.
  let chosen = [...validRecipes]
    .sort((left, right) => left.calories - right.calories)
    .slice(0, dishCount);
  let total = chosen.reduce((sum, recipe) => sum + recipe.calories, 0);
  if (total > budget + tolerance) return null;

  const chosenIds = new Set(chosen.map((recipe) => recipe.id));
  for (let guard = 0; guard < 400 && Math.abs(budget - total) > tolerance; guard += 1) {
    const gap = budget - total;
    let bestSwap = null;

    for (let index = 0; index < chosen.length; index += 1) {
      for (const candidate of validRecipes) {
        if (chosenIds.has(candidate.id)) continue;
        const delta = candidate.calories - chosen[index].calories;
        const fits = gap > 0 ? (delta > 0 && delta <= gap) : (delta < 0 && -delta <= -gap);
        if (!fits) continue;
        if (!bestSwap || Math.abs(gap - delta) < Math.abs(gap - bestSwap.delta)) {
          bestSwap = { index, candidate, delta };
        }
      }
    }

    if (!bestSwap) break;
    chosenIds.delete(chosen[bestSwap.index].id);
    chosenIds.add(bestSwap.candidate.id);
    chosen[bestSwap.index] = bestSwap.candidate;
    total += bestSwap.delta;
  }

  // Chia số món cho từng bữa: mỗi bữa ít nhất 1, còn lại random thêm (tối đa 3).
  const counts = new Map(targetSlots.map((slot) => [slot, MIN_DISHES_PER_SLOT]));
  let spare = dishCount - minDishes;
  while (spare > 0) {
    const open = targetSlots.filter((slot) => counts.get(slot) < MAX_DISHES_PER_SLOT);
    if (!open.length) break;
    const slot = open[Math.floor(Math.random() * open.length)];
    counts.set(slot, counts.get(slot) + 1);
    spare -= 1;
  }

  const slotsByAppetite = [...targetSlots]
    .sort((left, right) => (SLOT_CALORIE_WEIGHT[right] ?? 0.25) - (SLOT_CALORIE_WEIGHT[left] ?? 0.25));
  const dishesByCalories = [...chosen].sort((left, right) => right.calories - left.calories);
  const picked = [];
  let cursor = 0;
  slotsByAppetite.forEach((slot) => {
    const count = counts.get(slot);
    picked.push({ slot, recipes: dishesByCalories.slice(cursor, cursor + count) });
    cursor += count;
  });

  return { picked, total, dishCount };
}

async function randomizePlanItems(accountId, planId, options = {}) {
  const { householdSize = null, personTargets = null, replace = false } = options;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockMealPlanWriter(client);

    const { rows: [plan] } = await client.query(`
      SELECT meal_plan_id::text AS id,
        plan_date::text AS "planDate",
        target_calories_kcal AS "targetCaloriesKcal",
        household_size::int AS "householdSize",
        person_targets AS "personTargets",
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

    // Số người + mục tiêu calo: ưu tiên tham số của lần random này, sau đó tới bản đã lưu.
    const requestedTargets = normalizePersonTargets(personTargets);
    const storedTargets = normalizePersonTargets(plan.personTargets);
    const household = Number.isInteger(householdSize) && householdSize > 0
      ? householdSize
      : Number(plan.householdSize ?? 1);
    const targets = requestedTargets?.length === household ? requestedTargets : storedTargets;
    const householdTotalTargets = targets?.length === household ? sumPersonTargets(targets) : null;

    // Recipe lưu kcal MỖI SUẤT → ngân sách chọn món dùng mức trung bình mỗi người.
    // 1 người thì đúng bằng mục tiêu cũ; N người thì cả nhà = trung bình × N.
    const targetFromHousehold = householdTotalTargets
      ? Math.round(householdTotalTargets / household)
      : null;

    // Tổng calo cho cả hộ = tổng mục tiêu từng người; 1 người thì dùng mục tiêu của thực đơn.
    const targetCalories = targetFromHousehold
      ?? (Number.isFinite(Number(plan.targetCaloriesKcal)) && Number(plan.targetCaloriesKcal) > 0
        ? Number(plan.targetCaloriesKcal)
        : null);
    if (!targetCalories) {
      throw new MealPlanError(400, 'Thực đơn chưa có mục tiêu calo hợp lệ.');
    }

    if (replace) {
      await client.query('DELETE FROM public.meal_plan_item WHERE meal_plan_id = $1', [planId]);
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
      END,
      i.item_id ASC
    `, [planId]);

    const existingSlots = new Set(existingItems.map((item) => item.mealSlot));
    const emptySlots = SLOT_ORDER.filter((slot) => !existingSlots.has(slot));
    if (emptySlots.length === 0) {
      throw new MealPlanError(409, 'Không còn bữa trống để random. Bật "Xóa món hiện có" để random lại cả ngày.');
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
      throw new MealPlanError(400, 'Không đủ calo cho các bữa trống.');
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
      .map((recipe) => ({ ...recipe, calories: Number(recipe.caloriesKcal) }))
      .filter((recipe) => Number.isFinite(recipe.calories) && recipe.calories > 0);

    if (validRecipes.length < emptySlots.length) {
      throw new MealPlanError(409, 'Không đủ recipe phù hợp cho các bữa trống.');
    }

    // Thử nhiều lần rồi giữ phương án sát mục tiêu nhất nhưng không vượt quá.
    const tolerance = Math.max(200, budget * 0.15);
    const sortedCalories = validRecipes
      .map((recipe) => recipe.calories)
      .sort((left, right) => right - left);
    let best = null;
    let fallback = null;

    for (let attempt = 0; attempt < RANDOM_ATTEMPTS; attempt += 1) {
      const candidate = buildRandomDay(validRecipes, emptySlots, budget);
      if (!candidate) continue;

      // Nếu tổng món nhiều calo nhất vẫn không chạm được mục tiêu thì thiếu calo là điều không tránh khỏi.
      const maxReachable = sortedCalories
        .slice(0, Math.min(candidate.dishCount, sortedCalories.length))
        .reduce((sum, calories) => sum + calories, 0);
      const shortfallUnavoidable = maxReachable < budget;

      const deviation = Math.abs(candidate.total - budget);
      if (!fallback || deviation < fallback.deviation) fallback = { ...candidate, deviation };

      if (candidate.total > budget + tolerance) continue;
      if (!shortfallUnavoidable && candidate.total < budget - tolerance) continue;

      if (!best || deviation < best.deviation) best = { ...candidate, deviation };
      if (deviation <= Math.max(80, budget * 0.04)) break;
    }

    // Không đạt dải mong muốn nhưng vẫn có phương án không vượt calo → dùng phương án sát nhất.
    if (!best && fallback && fallback.total <= budget) best = fallback;

    if (!best) {
      throw new MealPlanError(409, 'Không tìm được bộ món phù hợp với mục tiêu calo.');
    }

    const insertedIds = [];
    for (const group of best.picked) {
      for (const recipe of group.recipes) {
        const itemId = await insertPlanItem(client, planId, group.slot, recipe);
        insertedIds.push(itemId);
      }
    }

    const newItems = await loadItemsByIds(client, insertedIds);
    await client.query(`
      UPDATE public.meal_plan
      SET target_calories_kcal = $2,
        household_size = $3,
        person_targets = $4::jsonb,
        updated_at = NOW()
      WHERE meal_plan_id = $1
    `, [planId, targetCalories, household, targets ? JSON.stringify(targets) : null]);

    await client.query('COMMIT');

    const dishCount = newItems.length;
    return {
      items: newItems,
      targetCaloriesKcal: targetCalories,
      householdSize: household,
      personTargets: targets,
      message: `Đã thêm ${dishCount} món cho ${emptySlots.length} bữa (mục tiêu ${targetCalories} kcal).`,
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
  addDailyPlanItem,
  saveDailyPlanItem,
  deleteDailyPlanItem,
  deletePlanItem,
  randomizePlanItems,
};
