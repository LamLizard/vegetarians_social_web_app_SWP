const { createHmac } = require('node:crypto');
const pool = require('../config/db');

class AIPlannerError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const normalize = (value) => String(value ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function dateAt(weekStart, offset) {
  const date = new Date(`${weekStart}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

async function preview(accountId, weekStart, continueWithoutProfile) {
  const key = process.env.CHATBOT_REQUEST_HMAC_KEY?.trim();
  if (!key) throw new AIPlannerError('STORE_UNAVAILABLE');
  const db = await pool.connect();
  try {
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const profileResult = await db.query('SELECT profile_id FROM public.profile WHERE account_id = $1', [accountId]);
    const profile = profileResult.rows[0];
    if (!profile && !continueWithoutProfile) throw new AIPlannerError('PROFILE_MISSING');
    const allergyResult = profile
      ? await db.query('SELECT name FROM public.allergy WHERE profile_id = $1 ORDER BY allergy_id', [profile.profile_id])
      : { rows: [] };
    const allergies = allergyResult.rows.map((row) => normalize(row.name)).filter(Boolean);
    const recipes = await db.query(`
      SELECT r.recipe_id::text AS id, r.title AS name, r.thumbnail_url AS "imageUrl",
        COALESCE((SELECT json_agg(i.name ORDER BY i.name)
          FROM public.recipe_ingredient ri JOIN public.ingredient i ON i.ingredient_id = ri.ingredient_id
          WHERE ri.recipe_id = r.recipe_id), '[]'::json) AS ingredients
      FROM public.recipe r WHERE r.status = 'approved'
    `);
    const candidates = shuffle(recipes.rows.filter((recipe) => {
      if (!Array.isArray(recipe.ingredients)) return false;
      return !recipe.ingredients.some((ingredient) => {
        const name = normalize(ingredient);
        return name && allergies.some((allergy) => name.includes(allergy) || allergy.includes(name));
      });
    }));
    if (!candidates.length) throw new AIPlannerError('NO_RECIPES');
    const plans = await db.query(`
      SELECT meal_plan_id::text AS id, plan_date::text AS date, updated_at::text AS updated
      FROM public.meal_plan WHERE account_id = $1 AND plan_date >= $2::date AND plan_date < $2::date + 7
      ORDER BY plan_date, meal_plan_id
    `, [accountId, weekStart]);
    const warnings = [];
    if (!profile) warnings.push('Chưa kiểm tra dị ứng vì chưa có hồ sơ sức khỏe.');
    const selected = candidates.slice(0, 21);
    const allergyUnchecked = (recipe) => recipe.ingredients.length === 0
      || recipe.ingredients.some((ingredient) => !normalize(ingredient));
    if (selected.some(allergyUnchecked)) {
      warnings.push('Một số công thức chưa đủ thông tin nguyên liệu để kiểm tra dị ứng.');
    }
    if (selected.length < 21) warnings.push('Không đủ công thức cho mọi bữa; các bữa còn thiếu để trống.');
    const days = Array.from({ length: 7 }, (_, day) => {
      const meal = (offset) => {
        const recipe = selected[day * 3 + offset];
        return recipe ? { id: recipe.id, name: recipe.name, imageUrl: recipe.imageUrl,
          allergyUnchecked: allergyUnchecked(recipe) } : null;
      };
      return { date: dateAt(weekStart, day), meals: {
        breakfast: meal(0), lunch: meal(1), dinner: meal(2),
      } };
    });
    const version = createHmac('sha256', key).update(JSON.stringify({
      purpose: 'ai-meal-preview', accountId: String(accountId), weekStart,
      allergies: [...allergies].sort(), plans: plans.rows, ids: selected.map((recipe) => recipe.id),
    })).digest('hex');
    await db.query('COMMIT');
    return { weekStart, days, warnings, version };
  } catch (error) {
    try { await db.query('ROLLBACK'); } catch { /* Preserve original failure. */ }
    throw error;
  } finally {
    db.release();
  }
}

module.exports = { AIPlannerError, preview };
