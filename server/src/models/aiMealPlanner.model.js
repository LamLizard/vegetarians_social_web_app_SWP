const { createHmac, timingSafeEqual } = require('node:crypto');
const pool = require('../config/db');
const { generateMealSelections } = require('../utils/groq');
const { lockMealPlanConfirm } = require('../utils/mealPlanWriteLock');

class AIPlannerError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const normalize = (value) => String(value ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLOTS = ['breakfast', 'lunch', 'dinner'];

function dateAt(weekStart, offset) {
  const date = new Date(`${weekStart}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

// Canonicalize before entering the transactional save or checking replay.
function prepareConfirmInput(accountId, input) {
  const invalid = () => { throw new AIPlannerError('INVALID_INPUT'); };
  if (!accountId || !input || typeof input !== 'object' || Array.isArray(input)
    || typeof input.operationId !== 'string' || !UUID.test(input.operationId)
    || typeof input.weekStart !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.weekStart)
    || typeof input.version !== 'string' || !/^[0-9a-f]{64}$/.test(input.version)
    || typeof input.replaceConfirmed !== 'boolean' || !Array.isArray(input.days) || input.days.length !== 7) invalid();
  const monday = new Date(`${input.weekStart}T12:00:00.000Z`);
  if (Number.isNaN(monday.getTime()) || monday.toISOString().slice(0, 10) !== input.weekStart
    || monday.getUTCDay() !== 1) invalid();
  let selectedCount = 0;
  const days = input.days.map((day, index) => {
    const expectedDate = dateAt(input.weekStart, index);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expectedDate)
      || !day || typeof day !== 'object' || day.date !== expectedDate
      || !day.meals || typeof day.meals !== 'object' || Array.isArray(day.meals)
      || Object.keys(day.meals).length !== SLOTS.length
      || !SLOTS.every((slot) => Object.hasOwn(day.meals, slot))) invalid();
    const meals = {};
    for (const slot of SLOTS) {
      const id = day.meals[slot];
      if (id !== null) {
        if (typeof id !== 'string' || !/^[1-9]\d{0,18}$/.test(id)
          || BigInt(id) > 9223372036854775807n) invalid();
        selectedCount += 1;
      }
      meals[slot] = id;
    }
    return { date: day.date, meals };
  });
  if (!selectedCount) invalid();
  const operationId = input.operationId.toLowerCase();
  const canonical = { weekStart: input.weekStart, days, version: input.version,
    replaceConfirmed: input.replaceConfirmed };
  const key = process.env.CHATBOT_REQUEST_HMAC_KEY?.trim();
  if (!key) throw new AIPlannerError('STORE_UNAVAILABLE');
  const payloadHash = createHmac('sha256', key).update(JSON.stringify({
    purpose: 'ai-meal-confirm', accountId: String(accountId), operationId, ...canonical,
  })).digest('hex');
  return { operationId, ...canonical, payloadHash };
}

async function readSnapshot(accountId, weekStart, transactionClient = null, recipeIds = null) {
  const db = transactionClient ?? await pool.connect();
  const ownsTransaction = !transactionClient;
  try {
    if (ownsTransaction) await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const profileResult = await db.query(`
      SELECT profile_id, gender, date_of_birth::text AS "dateOfBirth",
        height_cm AS "heightCm", weight_kg AS "weightKg", bmi,
        bmi_category AS "bmiCategory", activity_level AS "activityLevel",
        health_goal AS "healthGoal", tdee_kcal AS "tdeeKcal",
        target_calories_kcal AS "targetCaloriesKcal"
      FROM public.profile WHERE account_id = $1
    `, [accountId]);
    const profile = profileResult.rows[0] ?? null;
    const allergyResult = profile
      ? await db.query('SELECT name FROM public.allergy WHERE profile_id = $1 ORDER BY name, allergy_id', [profile.profile_id])
      : { rows: [] };
    const allergies = allergyResult.rows.map((row) => row.name);
    const recipes = await db.query(`
      SELECT r.recipe_id::text AS id, r.title AS name, r.description, r.thumbnail_url AS "imageUrl",
        r.calories_kcal AS "caloriesKcal",
        COALESCE((SELECT json_agg(i.name ORDER BY i.name)
          FROM public.recipe_ingredient ri JOIN public.ingredient i ON i.ingredient_id = ri.ingredient_id
          WHERE ri.recipe_id = r.recipe_id), '[]'::json) AS ingredients,
        COALESCE((SELECT json_agg(json_build_object(
          'id', i.ingredient_id::text, 'name', i.name, 'amount', ri.amount, 'unit', ri.unit
        ) ORDER BY i.ingredient_id)
          FROM public.recipe_ingredient ri JOIN public.ingredient i ON i.ingredient_id = ri.ingredient_id
          WHERE ri.recipe_id = r.recipe_id), '[]'::json) AS "ingredientData"
      FROM public.recipe r
      JOIN public.dish d ON d.dish_id = r.dish_id AND d.status = 'active'
      WHERE r.status = 'approved' AND ($1::bigint[] IS NULL OR r.recipe_id = ANY($1::bigint[]))
      ORDER BY r.recipe_id
    `, [recipeIds]);
    const plans = await db.query(`
      SELECT p.meal_plan_id::text AS id, p.plan_date::text AS date,
        p.updated_at::text AS updated, p.status, p.meals_per_day AS "mealsPerDay",
        p.target_calories_kcal AS "targetCaloriesKcal",
        COALESCE((SELECT json_agg(json_build_object(
          'id', mi.item_id::text, 'slot', mi.meal_slot::text,
          'recipeId', mi.recipe_id::text, 'recipeName', mi.recipe_name,
          'description', mi.description, 'caloriesKcal', mi.calories_kcal,
          'nutritionGroup', mi.nutrition_group::text, 'ingredients', mi.ingredients,
          'currentRecipeStatus', r.status::text, 'currentRecipeName', r.title,
          'currentRecipeCalories', r.calories_kcal, 'currentDishStatus', d.status::text,
          'currentDishName', d.name,
          'currentIngredients', COALESCE((SELECT json_agg(ing.name ORDER BY ing.name)
            FROM public.recipe_ingredient ri JOIN public.ingredient ing ON ing.ingredient_id = ri.ingredient_id
            WHERE ri.recipe_id = mi.recipe_id), '[]'::json),
          'currentIngredientData', COALESCE((SELECT json_agg(json_build_object(
            'id', ing.ingredient_id::text, 'name', ing.name, 'amount', ri.amount, 'unit', ri.unit
          ) ORDER BY ing.ingredient_id)
            FROM public.recipe_ingredient ri JOIN public.ingredient ing ON ing.ingredient_id = ri.ingredient_id
            WHERE ri.recipe_id = mi.recipe_id), '[]'::json)
        ) ORDER BY mi.meal_slot::text, mi.item_id)
          FROM public.meal_plan_item mi
          LEFT JOIN public.recipe r ON r.recipe_id = mi.recipe_id
          LEFT JOIN public.dish d ON d.dish_id = r.dish_id
          WHERE mi.meal_plan_id = p.meal_plan_id), '[]'::json) AS items
      FROM public.meal_plan p
      WHERE p.account_id = $1 AND p.plan_date >= $2::date AND p.plan_date < $2::date + 7
      ORDER BY p.plan_date, p.meal_plan_id
    `, [accountId, weekStart]);
    if (ownsTransaction) await db.query('COMMIT');
    return { profile, allergies, recipes: recipes.rows, plans: plans.rows };
  } catch (error) {
    if (ownsTransaction) {
      try { await db.query('ROLLBACK'); } catch { /* Preserve original failure. */ }
    }
    throw error;
  } finally {
    if (ownsTransaction) db.release();
  }
}

function eligibleRecipes(snapshot) {
  const allergies = snapshot.allergies.map(normalize).filter(Boolean);
  return snapshot.recipes.filter((recipe) => Array.isArray(recipe.ingredients)
    && !recipe.ingredients.some((ingredient) => {
      const name = normalize(ingredient);
      return name && allergies.some((allergy) => name.includes(allergy) || allergy.includes(name));
    }));
}

function previewVersion(key, accountId, weekStart, snapshot, selected) {
  return createHmac('sha256', key).update(JSON.stringify({
    purpose: 'ai-meal-preview', accountId: String(accountId), weekStart,
    profile: snapshot.profile, allergies: snapshot.allergies, plans: snapshot.plans, selected,
  })).digest('hex');
}

// Caller must use prepareConfirmInput and obtain the snapshot in the same
// protected transaction as the save; a matching version does not lock writers.
function verifyConfirmSnapshot(accountId, request, snapshot) {
  const key = process.env.CHATBOT_REQUEST_HMAC_KEY?.trim();
  if (!key) throw new AIPlannerError('STORE_UNAVAILABLE');
  if (!request || typeof request.version !== 'string' || !/^[0-9a-f]{64}$/.test(request.version)
    || !Array.isArray(request.days) || request.days.length !== 7) return false;
  const candidates = new Map(eligibleRecipes(snapshot).map((recipe) => [recipe.id, recipe]));
  const selected = request.days.map((day) => SLOTS.map((slot) => {
    const id = day.meals[slot];
    return id === null ? null : candidates.get(id) ?? undefined;
  }));
  if (selected.some((day) => day.some((recipe) => recipe === undefined))) return false;
  const expected = Buffer.from(previewVersion(key, accountId, request.weekStart, snapshot, selected), 'hex');
  const received = Buffer.from(request.version, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

// Build the requested slot actions without writing. The caller must first
// validate the request and verify the snapshot inside a protected transaction.
function planConfirmChanges(request, snapshot) {
  if (snapshot.plans.length && !request.replaceConfirmed) throw new AIPlannerError('REPLACE_CONFIRM_REQUIRED');
  const allergies = snapshot.allergies.map(normalize).filter(Boolean);
  const plansByDate = new Map(snapshot.plans.map((plan) => [plan.date, plan]));
  const changes = [];
  let allergyUnchecked = false;
  for (const day of request.days) {
    const plan = plansByDate.get(day.date);
    const oldItems = new Map((plan?.items ?? []).map((item) => [item.slot, item]));
    for (const slot of SLOTS) {
      const recipeId = day.meals[slot];
      const oldItem = oldItems.get(slot);
      if (recipeId !== null) {
        changes.push({ date: day.date, slot, action: 'replace', recipeId });
        continue;
      }
      if (!oldItem) {
        changes.push({ date: day.date, slot, action: 'empty' });
        continue;
      }
      const current = Array.isArray(oldItem.currentIngredients) ? oldItem.currentIngredients : [];
      const saved = Array.isArray(oldItem.ingredients) ? oldItem.ingredients : [];
      const names = (current.length ? current : saved.map((item) => typeof item === 'string' ? item : item?.name))
        .map(normalize).filter(Boolean);
      if (!snapshot.profile || !current.length || current.some((name) => !normalize(name))) allergyUnchecked = true;
      const conflicts = names.some((name) => allergies.some((allergy) => name.includes(allergy) || allergy.includes(name)));
      changes.push({ date: day.date, slot, action: conflicts ? 'remove' : 'keep' });
    }
  }
  return { changes, allergyUnchecked };
}

function selectRecipes(selection, candidates) {
  if (!Array.isArray(selection?.days) || selection.days.length !== 7) throw new AIPlannerError('MODEL_UNAVAILABLE');
  const byId = new Map(candidates.map((recipe) => [recipe.id, recipe]));
  let selectedCount = 0;
  const selected = selection.days.map((day) => {
    if (!Array.isArray(day) || day.length !== 3) throw new AIPlannerError('MODEL_UNAVAILABLE');
    return day.map((id) => {
      if (id === null) return null;
      if (typeof id !== 'string' || !byId.has(id)) throw new AIPlannerError('MODEL_UNAVAILABLE');
      selectedCount += 1;
      return byId.get(id);
    });
  });
  if (!selectedCount) throw new AIPlannerError('NO_RECIPES');
  return selected;
}

async function preview(accountId, weekStart, continueWithoutProfile) {
  const key = process.env.CHATBOT_REQUEST_HMAC_KEY?.trim();
  if (!key) throw new AIPlannerError('STORE_UNAVAILABLE');
  const initial = await readSnapshot(accountId, weekStart);
  if (!initial.profile && !continueWithoutProfile) throw new AIPlannerError('PROFILE_MISSING');
  const candidates = eligibleRecipes(initial);
  if (!candidates.length) throw new AIPlannerError('NO_RECIPES');

  // No DB transaction is held while waiting for Groq.
  const profileForModel = initial.profile ? {
    gender: initial.profile.gender, dateOfBirth: initial.profile.dateOfBirth,
    heightCm: initial.profile.heightCm, weightKg: initial.profile.weightKg,
    bmi: initial.profile.bmi, bmiCategory: initial.profile.bmiCategory,
    activityLevel: initial.profile.activityLevel, healthGoal: initial.profile.healthGoal,
    tdeeKcal: initial.profile.tdeeKcal, targetCaloriesKcal: initial.profile.targetCaloriesKcal,
    allergies: initial.allergies,
  } : null;
  const selection = await generateMealSelections(profileForModel, candidates.map((recipe) => ({
    id: recipe.id, name: recipe.name, caloriesKcal: recipe.caloriesKcal, ingredients: recipe.ingredients,
  })));
  const selected = selectRecipes(selection, candidates);

  // Re-read after the provider call; reject stale profile or selected recipe data.
  const latest = await readSnapshot(accountId, weekStart);
  if (JSON.stringify([initial.profile, initial.allergies]) !== JSON.stringify([latest.profile, latest.allergies])) {
    throw new AIPlannerError('PROFILE_CHANGED');
  }
  const currentById = new Map(eligibleRecipes(latest).map((recipe) => [recipe.id, recipe]));
  for (const recipe of selected.flat().filter(Boolean)) {
    if (JSON.stringify(recipe) !== JSON.stringify(currentById.get(recipe.id))) throw new AIPlannerError('RECIPE_CHANGED');
  }

  const allergyUnchecked = (recipe) => !initial.profile || recipe.ingredients.length === 0
    || recipe.ingredients.some((ingredient) => !normalize(ingredient));
  const warnings = [];
  if (!initial.profile) warnings.push('Chưa kiểm tra dị ứng vì chưa có hồ sơ sức khỏe.');
  if (selected.flat().some((recipe) => recipe && allergyUnchecked(recipe))) {
    warnings.push('Một số công thức chưa đủ thông tin để kiểm tra dị ứng.');
  }
  if (selected.flat().some((recipe) => recipe === null)) warnings.push('Một số bữa chưa có món gợi ý.');
  const days = selected.map((meals, day) => {
    const meal = (recipe) => recipe ? {
      id: recipe.id, name: recipe.name, imageUrl: recipe.imageUrl, allergyUnchecked: allergyUnchecked(recipe),
    } : null;
    return { date: dateAt(weekStart, day), meals: {
      breakfast: meal(meals[0]), lunch: meal(meals[1]), dinner: meal(meals[2]),
    } };
  });
  const version = previewVersion(key, accountId, weekStart, latest, selected);
  return { weekStart, days, warnings, version };
}

async function confirm(accountId, input) {
  const request = prepareConfirmInput(accountId, input);
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await lockMealPlanConfirm(db);
    const { rows: [previous] } = await db.query(`
      SELECT payload_hash AS "payloadHash", week_start::text AS "weekStart"
      FROM public.ai_meal_confirm_request
      WHERE account_id = $1 AND operation_id = $2::uuid
    `, [accountId, request.operationId]);
    if (previous) {
      if (previous.payloadHash !== request.payloadHash) throw new AIPlannerError('IDEMPOTENCY_CONFLICT');
      await db.query('COMMIT');
      return { saved: true, days: request.days.map(({ date }) => ({ date })), replayed: true };
    }

    const recipeIds = [...new Set(request.days.flatMap((day) => SLOTS.map((slot) => day.meals[slot]))
      .filter((id) => id !== null))];
    const snapshot = await readSnapshot(accountId, request.weekStart, db, recipeIds);
    if (!verifyConfirmSnapshot(accountId, request, snapshot)) throw new AIPlannerError('PLAN_CHANGED');
    const { changes, allergyUnchecked } = planConfirmChanges(request, snapshot);
    const plans = new Map(snapshot.plans.map((plan) => [plan.date, plan.id]));
    const recipes = new Map(eligibleRecipes(snapshot).map((recipe) => [recipe.id, recipe]));
    const updatedPlans = new Set();

    for (const change of changes) {
      if (change.action === 'empty' || change.action === 'keep') continue;
      let planId = plans.get(change.date);
      if (!planId && change.action === 'replace') {
        await db.query(`
          INSERT INTO public.meal_plan (account_id, title, plan_date, meals_per_day, source,
            bmi_snapshot, target_calories_kcal, goal_snapshot, allergy_snapshot, status)
          VALUES ($1, $2, $3::date, 3, 'ai', $4, $5, $6, $7::jsonb, 'saved')
          ON CONFLICT (account_id, plan_date) DO NOTHING
        `, [accountId, `Thực đơn ${change.date}`, change.date, snapshot.profile?.bmi ?? null,
          snapshot.profile?.targetCaloriesKcal ?? null, snapshot.profile?.healthGoal ?? null,
          snapshot.profile ? JSON.stringify(snapshot.allergies) : null]);
        const result = await db.query(`
          SELECT meal_plan_id::text AS id FROM public.meal_plan WHERE account_id = $1 AND plan_date = $2::date
        `, [accountId, change.date]);
        planId = result.rows[0]?.id;
        if (!planId) throw new AIPlannerError('STORE_UNAVAILABLE');
        plans.set(change.date, planId);
      }
      if (!planId) throw new AIPlannerError('STORE_UNAVAILABLE');
      if (change.action === 'remove') {
        await db.query('DELETE FROM public.meal_plan_item WHERE meal_plan_id = $1 AND meal_slot = $2::meal_slot_enum',
          [planId, change.slot]);
      } else {
        const recipe = recipes.get(change.recipeId);
        if (!recipe) throw new AIPlannerError('RECIPE_CHANGED');
        const ingredients = recipe.ingredientData.map(({ name, amount, unit }) => ({ name, amount, unit }));
        await db.query(`
          INSERT INTO public.meal_plan_item (meal_plan_id, meal_slot, recipe_id, recipe_name,
            description, calories_kcal, nutrition_group, ingredients)
          VALUES ($1, $2::meal_slot_enum, $3::bigint, $4, $5, $6, NULL, $7::jsonb)
          ON CONFLICT (meal_plan_id, meal_slot) DO UPDATE SET recipe_id = EXCLUDED.recipe_id,
            recipe_name = EXCLUDED.recipe_name, description = EXCLUDED.description,
            calories_kcal = EXCLUDED.calories_kcal, nutrition_group = NULL, ingredients = EXCLUDED.ingredients
        `, [planId, change.slot, recipe.id, recipe.name, recipe.description, recipe.caloriesKcal,
          JSON.stringify(ingredients)]);
      }
      updatedPlans.add(planId);
    }
    if (updatedPlans.size) {
      await db.query('UPDATE public.meal_plan SET updated_at = now() WHERE meal_plan_id = ANY($1::bigint[])',
        [[...updatedPlans]]);
    }
    await db.query(`
      INSERT INTO public.ai_meal_confirm_request (account_id, operation_id, payload_hash, week_start)
      VALUES ($1, $2::uuid, $3, $4::date)
    `, [accountId, request.operationId, request.payloadHash, request.weekStart]);
    await db.query('COMMIT');
    return { saved: true, days: request.days.map(({ date }) => ({ date })), replayed: false, allergyUnchecked };
  } catch (error) {
    try { await db.query('ROLLBACK'); } catch { /* Preserve the original failure. */ }
    throw error;
  } finally {
    db.release();
  }
}

// A missing record cannot distinguish a request still in flight from one that
// never arrived. It is deliberately reported as unknown, not failed.
async function confirmStatus(accountId, operationId) {
  if (!accountId || typeof operationId !== 'string' || !UUID.test(operationId)) throw new AIPlannerError('INVALID_INPUT');
  const { rowCount } = await pool.query(`SELECT 1 FROM public.ai_meal_confirm_request
    WHERE account_id = $1 AND operation_id = $2::uuid`, [accountId, operationId]);
  return { state: rowCount ? 'saved' : 'unknown' };
}

module.exports = { AIPlannerError, preview, prepareConfirmInput, verifyConfirmSnapshot, planConfirmChanges, confirm, confirmStatus };
