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

const {
  MealPlanError, randomizePlanItems, addDailyPlanItem,
} = require('./meal-plan.model');

function makeDatabase({
  plan, existingItems = [], recipes = [], profileAllergies = [], approvedRecipe = null, insertError = null,
}) {
  const calls = [];
  const insertedItems = [];
  let released = false;
  const client = {
    async query(sql, values = []) {
      const compactSql = sql.replace(/\s+/gu, ' ').trim();
      calls.push({ sql: compactSql, values });

      if (/^(BEGIN|COMMIT|ROLLBACK)$/u.test(compactSql)) return { rows: [] };
      if (/pg_advisory_xact_lock/u.test(compactSql)) return { rows: [] };
      if (/FROM public\.meal_plan WHERE meal_plan_id = \$1 AND account_id = \$2 LIMIT 1/u.test(compactSql)) {
        return { rows: plan ? [{ id: String(plan.id), planDate: plan.planDate }] : [] };
      }
      if (/FROM public\.meal_plan[\s\S]*FOR UPDATE/u.test(sql)) {
        return { rows: plan ? [plan] : [] };
      }
      if (/FROM public\.recipe r WHERE r\.recipe_id = \$1/u.test(compactSql)) {
        return { rows: approvedRecipe ? [approvedRecipe] : [] };
      }
      if (/WHERE i\.item_id = ANY/u.test(compactSql)) {
        return {
          rows: insertedItems
            .filter((item) => (values[0] ?? []).map(String).includes(String(item.id)))
            .map((item) => ({
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
      if (/FROM public\.meal_plan_item i/u.test(compactSql)) {
        return { rows: [...existingItems, ...insertedItems.map((item) => ({
          mealSlot: item.mealSlot, recipeId: item.recipeId, caloriesKcal: item.caloriesKcal, id: item.id,
        }))] };
      }
      if (/FROM public\.profile p/u.test(compactSql)) return { rows: [{ allergies: profileAllergies }] };
      if (/FROM public\.recipe r/u.test(compactSql)) {
        const usedIds = new Set((values[0] ?? []).map(String));
        return { rows: recipes.filter((recipe) => !usedIds.has(String(recipe.id))) };
      }
      if (/INSERT INTO public\.meal_plan_item/u.test(compactSql)) {
        if (insertError) throw insertError;
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
      if (/UPDATE public\.meal_plan SET (target_calories_kcal|updated_at)/u.test(compactSql)) return { rows: [] };
      if (/DELETE FROM public\.meal_plan_item/u.test(compactSql)) return { rows: [] };
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
  householdSize: 1,
  personTargets: null,
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

const dishesPerSlot = (items) => items.reduce((acc, item) => {
  acc[item.mealSlot] = (acc[item.mealSlot] ?? 0) + 1;
  return acc;
}, {});

test('randomizes every empty slot with 1..3 dishes and unique recipes near the target', async () => {
  const db = makeDatabase({
    plan: validPlan,
    recipes: [
      recipe('1', 150),
      recipe('2', 200),
      recipe('3', 220),
      recipe('4', 250),
      recipe('5', 300),
      recipe('6', 330),
    ],
  });

  const result = await randomizePlanItems('7', '42');

  const perSlot = dishesPerSlot(result.items);
  assert.deepEqual(Object.keys(perSlot).sort(), ['breakfast', 'dinner', 'lunch', 'snack']);
  Object.values(perSlot).forEach((count) => assert.ok(count >= 1 && count <= 3, 'mỗi bữa 1..3 món'));
  assert.equal(new Set(result.items.map((item) => item.recipeId)).size, result.items.length, 'không lặp món');
  const total = result.items.reduce((sum, item) => sum + Number(item.caloriesKcal), 0);
  assert.ok(Math.abs(total - validPlan.targetCaloriesKcal) <= 200, `tổng calo sát mục tiêu (đang ${total})`);
  assert.equal(db.insertedItems.length, result.items.length);
  assert.match(db.calls.find((call) => /FOR UPDATE/u.test(call.sql)).sql, /account_id = \$2 FOR UPDATE/u);
  db.verify();
});

test('keeps the day budget on the per-person average when several people share the menu', async () => {
  const personTargets = [1600, 1600, 1600, 1500];
  const db = makeDatabase({
    plan: validPlan,
    recipes: [
      recipe('1', 350), recipe('2', 360), recipe('3', 380),
      recipe('4', 400), recipe('5', 420), recipe('6', 450), recipe('7', 480),
    ],
  });

  const result = await randomizePlanItems('7', '42', { householdSize: 4, personTargets });

  assert.equal(result.targetCaloriesKcal, 1575, 'ngân sách mỗi suất = trung bình 4 người');
  assert.deepEqual(result.personTargets, personTargets);
  assert.equal(result.householdSize, 4);
  const total = result.items.reduce((sum, item) => sum + Number(item.caloriesKcal), 0);
  assert.ok(Math.abs(total - 1575) <= 200, `tổng calo quanh 1575 (đang ${total})`);

  const persisted = db.calls.find((call) => /SET target_calories_kcal/u.test(call.sql));
  assert.deepEqual(persisted.values, ['42', 1575, 4, JSON.stringify(personTargets)]);
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

test('appends a second dish into a slot instead of replacing the first one', async () => {
  const approvedRecipe = {
    id: '31',
    recipeName: 'Món mới',
    description: '',
    caloriesKcal: 210,
    imageUrl: null,
    ingredients: [],
  };
  const db = makeDatabase({ plan: validPlan, approvedRecipe });

  const item = await addDailyPlanItem('7', '42', 'lunch', '31');

  assert.equal(item.mealSlot, 'lunch');
  assert.equal(item.recipeId, '31');
  const insert = db.calls.find((call) => /INSERT INTO public\.meal_plan_item/u.test(call.sql));
  assert.equal(insert.values[1], 'lunch', 'giữ nguyên bữa đang thêm');
  assert.doesNotMatch(insert.sql, /ON CONFLICT/u, 'không ghi đè món cũ của bữa');
  assert.equal(db.insertedItems.length, 1);
  db.verify();
});

test('returns 409 when the dish is already in that meal', async () => {
  const duplicate = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
  const db = makeDatabase({
    plan: validPlan,
    approvedRecipe: {
      id: '31', recipeName: 'Món', description: '', caloriesKcal: 210, imageUrl: null, ingredients: [],
    },
    insertError: duplicate,
  });

  await assert.rejects(addDailyPlanItem('7', '42', 'lunch', '31'), (error) => {
    assert.equal(error.status, 409);
    assert.match(error.message, /đã có trong bữa/u);
    return true;
  });
  assert.equal(db.calls.at(-1).sql, 'ROLLBACK');
});
