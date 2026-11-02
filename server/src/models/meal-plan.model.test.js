const test = require('node:test');
const assert = require('node:assert/strict');

const pool = { connect: async () => { throw new Error('Test database was not configured.'); } };
const dbModulePath = require.resolve('../config/db');
require.cache[dbModulePath] = {
  id: dbModulePath,
  filename: dbModulePath,
  loaded: true,
  exports: pool,
};

const { MealPlanError, randomizePlanItems } = require('./meal-plan.model');

function makeDatabase({ plan, existingItems = [], recipes = [], profileAllergies = [] }) {
  const calls = [];
  const insertedItems = [];
  let released = false;
  const client = {
    async query(sql, values = []) {
      const compactSql = sql.replace(/\s+/gu, ' ').trim();
      calls.push({ sql: compactSql, values });

      if (/^(BEGIN|COMMIT|ROLLBACK)$/u.test(compactSql)) return { rows: [] };
      if (/FROM public\.meal_plan[\s\S]*FOR UPDATE/u.test(sql)) {
        return { rows: plan ? [plan] : [] };
      }
      if (/WHERE i\.item_id = ANY/u.test(compactSql)) {
        return {
          rows: insertedItems.map((item) => ({
            mealPlanId: item.planId,
            id: item.id,
            mealSlot: item.mealSlot,
            recipeId: item.recipeId,
            recipeName: item.recipeName,
            description: item.description,
            caloriesKcal: item.caloriesKcal,
            nutritionGroup: null,
            ingredients: JSON.parse(item.ingredients),
            imageUrl: null,
          })),
        };
      }
      if (/FROM public\.meal_plan_item i/u.test(compactSql)) return { rows: existingItems };
      if (/FROM public\.profile p/u.test(compactSql)) return { rows: [{ allergies: profileAllergies }] };
      if (/FROM public\.recipe r/u.test(compactSql)) {
        const usedIds = new Set((values[0] ?? []).map(String));
        return { rows: recipes.filter((recipe) => !usedIds.has(String(recipe.id))) };
      }
      if (/INSERT INTO public\.meal_plan_item/u.test(compactSql)) {
        const [planId, mealSlot, recipeId, recipeName, description, caloriesKcal, ingredients] = values;
        const inserted = {
          id: String(insertedItems.length + 100),
          planId: String(planId),
          mealSlot,
          recipeId: String(recipeId),
          recipeName,
          description,
          caloriesKcal,
          ingredients,
        };
        insertedItems.push(inserted);
        return { rows: [{ id: inserted.id }] };
      }
      if (/UPDATE public\.meal_plan SET updated_at/u.test(compactSql)) return { rows: [] };
      throw new Error(`Unexpected SQL in test: ${compactSql}`);
    },
    release() {
      released = true;
    },
  };
  pool.connect = async () => client;

  return {
    calls,
    insertedItems,
    verify() {
      assert.equal(released, true);
      assert.equal(calls.at(-1).sql, 'COMMIT');
    },
  };
}

const validPlan = {
  id: '42',
  planDate: '2099-01-01',
  targetCaloriesKcal: 1000,
  allergySnapshot: [],
};

function recipe(id, caloriesKcal, ingredients = [{ name: 'Cà chua' }]) {
  return {
    id: String(id),
    recipeName: `Món ${id}`,
    description: '',
    caloriesKcal,
    imageUrl: null,
    ingredients,
  };
}

test('randomizes all empty slots with unique recipes and keeps the total below target', async () => {
  const db = makeDatabase({
    plan: validPlan,
    recipes: [
      recipe('1', 150),
      recipe('2', 200),
      recipe('3', 220),
      recipe('4', 250),
      recipe('5', 300),
    ],
  });

  const result = await randomizePlanItems('7', '42');

  assert.equal(result.items.length, 4);
  assert.deepEqual(new Set(result.items.map((item) => item.mealSlot)).size, 4);
  assert.deepEqual(new Set(result.items.map((item) => item.recipeId)).size, 4);
  assert.ok(result.items.reduce((sum, item) => sum + Number(item.caloriesKcal), 0) < validPlan.targetCaloriesKcal);
  assert.equal(db.insertedItems.length, 4);
  assert.match(db.calls.find((call) => /FOR UPDATE/u.test(call.sql)).sql, /account_id = \$2 FOR UPDATE/u);
  db.verify();
});

test('uses the allergy snapshot and excludes Vietnamese ingredient-name matches', async () => {
  const db = makeDatabase({
    plan: { ...validPlan, allergySnapshot: ['Đậu phộng'] },
    existingItems: [
      { mealSlot: 'breakfast', recipeId: '10', caloriesKcal: 100 },
      { mealSlot: 'lunch', recipeId: '11', caloriesKcal: 100 },
      { mealSlot: 'dinner', recipeId: '12', caloriesKcal: 100 },
    ],
    recipes: [
      recipe('13', 200, [{ name: 'Bo dau phong' }]),
      recipe('14', 250, [{ name: 'Cà chua' }]),
    ],
  });

  const result = await randomizePlanItems('7', '42');

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].mealSlot, 'snack');
  assert.equal(result.items[0].recipeId, '14');
  assert.equal(db.calls.some((call) => /FROM public\.profile p/u.test(call.sql)), false);
  db.verify();
});

test('falls back to profile allergies when the plan snapshot is null', async () => {
  const db = makeDatabase({
    plan: { ...validPlan, allergySnapshot: null },
    existingItems: [
      { mealSlot: 'breakfast', recipeId: '10', caloriesKcal: 100 },
      { mealSlot: 'lunch', recipeId: '11', caloriesKcal: 100 },
      { mealSlot: 'dinner', recipeId: '12', caloriesKcal: 100 },
    ],
    profileAllergies: ['đậu nành'],
    recipes: [
      recipe('13', 200, [{ name: 'Sua dau nanh' }]),
      recipe('14', 250, [{ name: 'Nấm' }]),
    ],
  });

  const result = await randomizePlanItems('7', '42');

  assert.equal(result.items[0].recipeId, '14');
  assert.equal(db.calls.some((call) => /FROM public\.profile p/u.test(call.sql)), true);
  db.verify();
});

test('rolls back without inserting when no calorie combination fits', async () => {
  const db = makeDatabase({
    plan: { ...validPlan, targetCaloriesKcal: 399 },
    recipes: [
      recipe('1', 100),
      recipe('2', 200),
      recipe('3', 300),
      recipe('4', 400),
    ],
  });

  await assert.rejects(randomizePlanItems('7', '42'), (error) => {
    assert.ok(error instanceof MealPlanError);
    assert.equal(error.status, 409);
    assert.match(error.message, /Không tìm được bộ món phù hợp/u);
    return true;
  });
  assert.equal(db.insertedItems.length, 0);
  assert.equal(db.calls.at(-1).sql, 'ROLLBACK');
});

test('rejects a plan without empty slots and rolls back', async () => {
  const db = makeDatabase({
    plan: validPlan,
    existingItems: ['breakfast', 'lunch', 'dinner', 'snack'].map((mealSlot, index) => ({
      mealSlot,
      recipeId: String(index + 1),
      caloriesKcal: 100,
    })),
  });

  await assert.rejects(randomizePlanItems('7', '42'), (error) => {
    assert.equal(error.status, 409);
    assert.match(error.message, /Không còn bữa trống/u);
    return true;
  });
  assert.equal(db.insertedItems.length, 0);
  assert.equal(db.calls.at(-1).sql, 'ROLLBACK');
});

test('rejects plans with no target calories before reading or writing items', async () => {
  const db = makeDatabase({
    plan: { ...validPlan, targetCaloriesKcal: null },
  });

  await assert.rejects(randomizePlanItems('7', '42'), (error) => {
    assert.equal(error.status, 400);
    return true;
  });
  assert.equal(db.calls.some((call) => /FROM public\.meal_plan_item/u.test(call.sql)), false);
  assert.equal(db.calls.at(-1).sql, 'ROLLBACK');
});

test('rejects past plans according to the Vietnam calendar', async () => {
  const db = makeDatabase({
    plan: { ...validPlan, planDate: '2000-01-01' },
  });

  await assert.rejects(randomizePlanItems('7', '42'), (error) => {
    assert.equal(error.status, 403);
    return true;
  });
  assert.equal(db.calls.some((call) => /FROM public\.meal_plan_item/u.test(call.sql)), false);
  assert.equal(db.calls.at(-1).sql, 'ROLLBACK');
});

test('does not randomize when an existing item has unknown calories', async () => {
  const db = makeDatabase({
    plan: validPlan,
    existingItems: [{ mealSlot: 'breakfast', recipeId: '10', caloriesKcal: null }],
  });

  await assert.rejects(randomizePlanItems('7', '42'), (error) => {
    assert.equal(error.status, 400);
    assert.match(error.message, /Không thể xác định tổng calo/u);
    return true;
  });
  assert.equal(db.insertedItems.length, 0);
  assert.equal(db.calls.at(-1).sql, 'ROLLBACK');
});
