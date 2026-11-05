const pool = require('../config/db');
const { fold, VI_FROM, VI_TO } = require('../utils/postSearch');
const { shopOpenInfo, shopStatusText } = require('../utils/shopOpen');
// Khoi's code (08/11/2026): gom lịch theo ngày bằng đúng helper mà API quán đang dùng.
const { groupScheduleRows } = require('./shop.model');

// Khoi's code (05/11/2026): dữ liệu thật của Green Bowl cho câu trả lời (chỉ SELECT).
const RECIPE_SCAN_LIMIT = 30; // quét rộng rồi lọc dị ứng ở JS, vẫn giữ tối đa `limit` kết quả
const SHOP_SCAN_LIMIT = 50;
const SLOT_LABEL = { breakfast: 'Bữa sáng', lunch: 'Bữa trưa', dinner: 'Bữa tối', snack: 'Bữa phụ' };

// Bỏ dấu ở JS dùng đúng bảng chữ của postSearch.fold (translate) — không cần extension unaccent.
const FOLD_MAP = new Map([...VI_FROM].map((char, index) => [char, [...VI_TO][index]]));
const plain = (value) => [...String(value ?? '').toLowerCase()].map((char) => FOLD_MAP.get(char) ?? char).join('');

/** Loại công thức có nguyên liệu trùng dị ứng (so khớp không dấu, giống cách cảnh báo dị ứng của app). */
function excludeAllergens(items = [], allergies = []) {
  const needles = [...new Set((Array.isArray(allergies) ? allergies : []).map(plain).filter(Boolean))];
  if (!needles.length) return items;
  return items.filter((item) => {
    const haystack = (item.ingredientNames ?? []).map(plain);
    return !needles.some((needle) => haystack.some((name) => name.includes(needle)));
  });
}

/**
 * Công thức đã duyệt (món active) khớp không dấu theo tiêu đề / tên món / tên nguyên liệu.
 * Không có keyword → trả công thức nhiều tim nhất. Dị ứng: loại ở JS trước khi cắt `limit`.
 */
async function findRecipesForChat(keywords = [], { limit = 3, excludeAllergies = [] } = {}) {
  const terms = [...new Set((Array.isArray(keywords) ? keywords : [keywords])
    .map((keyword) => String(keyword ?? '').trim()).filter(Boolean))].slice(0, 4);
  const params = [];
  const match = terms.length
    ? `AND (${terms.map((term) => {
      params.push(term);
      const index = params.length;
      const needle = fold(`$${index}`);
      return `(position(${needle} in ${fold('r.title')}) > 0
        OR position(${needle} in ${fold('d.name')}) > 0
        OR EXISTS (SELECT 1 FROM public.recipe_ingredient ri
            JOIN public.ingredient ing ON ing.ingredient_id = ri.ingredient_id
          WHERE ri.recipe_id = r.recipe_id AND position(${needle} in ${fold('ing.name')}) > 0))`;
    }).join(' OR ')})`
    : '';
  const { rows } = await pool.query(`
    SELECT r.recipe_id::text AS id, r.title, d.name AS "dishName",
      r.thumbnail_url AS "thumbnailUrl", r.calories_kcal AS "caloriesKcal",
      (COALESCE(r.prep_time_minutes, 0) + COALESCE(r.cook_time_minutes, 0))::int AS minutes,
      (SELECT count(*)::int FROM public.recipe_like l WHERE l.recipe_id = r.recipe_id) AS "likeCount",
      COALESCE((SELECT json_agg(ing.name)
        FROM public.recipe_ingredient ri JOIN public.ingredient ing ON ing.ingredient_id = ri.ingredient_id
        WHERE ri.recipe_id = r.recipe_id), '[]'::json) AS "ingredientNames"
    FROM public.recipe r
    JOIN public.dish d ON d.dish_id = r.dish_id AND d.status = 'active'
    WHERE r.status = 'approved' ${match}
    ORDER BY "likeCount" DESC, r.recipe_id DESC
    LIMIT ${RECIPE_SCAN_LIMIT}
  `, params);
  return excludeAllergens(rows, excludeAllergies)
    .slice(0, limit)
    .map(({ ingredientNames, ...item }) => item);
}

/** Quán đã xác minh và không bị ẩn; xếp quán đang mở trước, kèm câu trạng thái theo giờ VN. */
async function findOpenShops({ limit = 3, now = new Date() } = {}) {
  const { rows } = await pool.query(`
    SELECT s.shop_id::text AS id, s.name, s.address, s.avt_shop_url AS "avatarUrl",
      COALESCE((SELECT json_agg(json_build_object('dayOfWeek', ss.day_of_week, 'isClosed', ss.is_closed,
          'openTime', to_char(ss.open_time, 'HH24:MI'), 'closeTime', to_char(ss.close_time, 'HH24:MI'))
          ORDER BY ss.day_of_week, ss.slot_no)
        FROM public.shop_schedule ss WHERE ss.shop_id = s.shop_id), '[]'::json) AS schedule
    FROM public.shop s
    WHERE s.verification_status = 'verified' AND s.status <> 'inactive'
    ORDER BY s.name
    LIMIT ${SHOP_SCAN_LIMIT}
  `);
  return rows
    .map((row) => {
      // Khoi's code (08/11/2026): SQL trả lịch dạng phẳng (mỗi ca một dòng) → gom theo ngày như API quán.
      const info = shopOpenInfo(groupScheduleRows(row.schedule ?? []), now);
      return { id: row.id, name: row.name, address: row.address, avatarUrl: row.avatarUrl,
        isOpen: info.isOpen, closeAt: info.closeAt, statusText: shopStatusText(info),
        minutesToOpen: Number.isFinite(info.minutesToOpen) ? info.minutesToOpen : null };
    })
    .sort((a, b) => (Number(b.isOpen) - Number(a.isOpen))
      || ((a.minutesToOpen ?? Number.MAX_SAFE_INTEGER) - (b.minutesToOpen ?? Number.MAX_SAFE_INTEGER))
      || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** Thực đơn hôm nay (giờ VN) của thành viên: tổng calo theo bữa. */
async function findTodayMealPlan(accountId) {
  const { rows: [plan] } = await pool.query(`
    SELECT p.meal_plan_id::text AS id, p.plan_date::text AS "planDate",
      p.target_calories_kcal AS "targetCaloriesKcal", p.meals_per_day::int AS "mealsPerDay"
    FROM public.meal_plan p
    WHERE p.account_id = $1 AND p.plan_date = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
    ORDER BY p.meal_plan_id DESC
    LIMIT 1
  `, [String(accountId)]);
  if (!plan) return null;
  const { rows: items } = await pool.query(`
    SELECT i.meal_slot::text AS slot, i.recipe_name AS name, i.calories_kcal AS "caloriesKcal"
    FROM public.meal_plan_item i
    WHERE i.meal_plan_id = $1::bigint
    ORDER BY i.item_id
  `, [plan.id]);
  const meals = [];
  for (const item of items) {
    let meal = meals.find((entry) => entry.slot === item.slot);
    if (!meal) {
      meal = { slot: item.slot, label: SLOT_LABEL[item.slot] ?? item.slot, totalKcal: 0, items: [] };
      meals.push(meal);
    }
    const kcal = Number(item.caloriesKcal) || 0;
    meal.totalKcal += kcal;
    meal.items.push({ name: item.name, caloriesKcal: kcal });
  }
  return { planDate: plan.planDate, targetCaloriesKcal: plan.targetCaloriesKcal,
    totalKcal: meals.reduce((sum, meal) => sum + meal.totalKcal, 0), meals };
}

module.exports = { findRecipesForChat, findOpenShops, findTodayMealPlan, excludeAllergens, plain };
