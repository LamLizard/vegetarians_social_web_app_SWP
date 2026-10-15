// Khoi's code: Truy vấn cho trang Tạo công thức (Sprint 2, phương án B).
// Bảng: recipe (status/proposed_dish_name...), dish, ingredient, recipe_ingredient,
//       recipe_proposed_ingredient (nguyên liệu chưa có trong kho, chờ Admin duyệt).
// Model không kiểm tra dữ liệu form — việc đó ở utils/recipeInput.js.
const pool = require('../config/db');
const { findAnimalWord, animalWarnings } = require('../utils/animalWords');
const { getKeywords } = require('./bannedKeyword.model');

/** Lỗi nghiệp vụ có mã HTTP — controller trả nguyên message cho FE */
class RecipeError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'RecipeError';
    this.status = status;
  }
}

async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* kết nối hỏng — giữ lỗi gốc */ }
    throw error;
  } finally {
    client.release();
  }
}

// =====================================================================
//  ĐỌC
// =====================================================================

/** Món đang hiện (status = 'active') cho ô chọn món, sắp theo tên */
async function findActiveDishes() {
  const { rows } = await pool.query(`
    SELECT dish_id::text AS id, name
    FROM dish
    WHERE status = 'active'
    ORDER BY name
  `);
  return rows;
}

// Duy's Code : Tìm ingredient đã duyệt theo từ khóa để chọn dị ứng trong hồ sơ.
/** Tên nguyên liệu trong kho (bảng ingredient) để gợi ý khi gõ */
async function findIngredientNames(query = '') {
  const term = String(query).normalize('NFC').trim();
  const { rows } = term
    ? await pool.query(`
      SELECT name FROM ingredient
      WHERE position(lower($1) in lower(name)) > 0
      ORDER BY (lower(name) = lower($1)) DESC, name
      LIMIT 20
    `, [term])
    : await pool.query('SELECT name FROM ingredient ORDER BY name');
  return rows.map((r) => r.name);
}

/**
 * Soi từng tên nguyên liệu (giữ đúng thứ tự):
 *  - known: tên có trong kho ingredient (so không phân biệt hoa/thường)
 *  - isAnimalDerived: kho đánh dấu có nguồn gốc động vật
 *  - keyword: tên CHƯA có trong kho mà chứa từ động vật (vd "cá" trong "chả cá chay") — từ lấy ở banned_keyword (category 'animal')
 *             — CHỈ cảnh báo, Admin xem lại. Có trong kho rồi thì tin isAnimalDerived, không soi tên.
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {string[]} names  đã làm sạch (recipeInput)
 */
async function inspectIngredients(db, names) {
  if (names.length === 0) return [];
  const { rows } = await db.query(`
    SELECT n.ord,
           i.ingredient_id::text AS "ingredientId",
           COALESCE(i.is_animal_derived, false) AS "isAnimalDerived"
    FROM unnest($1::text[]) WITH ORDINALITY AS n(name, ord)
    LEFT JOIN LATERAL (
      SELECT ingredient.ingredient_id, ingredient.is_animal_derived
      FROM ingredient
      WHERE lower(btrim(ingredient.name)) = lower(n.name)
      ORDER BY ingredient.ingredient_id
      LIMIT 1
    ) i ON true
    ORDER BY n.ord
  `, [names]);
  const keywords = await getKeywords('animal', db);
  return rows.map((r, idx) => ({
    name: names[idx],
    ingredientId: r.ingredientId,
    known: r.ingredientId !== null,
    isAnimalDerived: r.isAnimalDerived,
    keyword: r.ingredientId === null ? findAnimalWord(names[idx], keywords) : null,
  }));
}

/** Bỏ id kho trước khi trả cho FE (FE chỉ cần biết có/không) */
const publicCheck = ({ ingredientId, ...rest }) => { void ingredientId; return rest; };

const checkIngredients = async (names) => (await inspectIngredients(pool, names)).map(publicCheck);

// Cột trả về cho tab "Công thức đã gửi" — đúng dạng MyRecipe ở client/src/services/recipe.service.js
const MY_RECIPE_COLUMNS = `
  r.recipe_id::text           AS id,
  r.title,
  r.dish_id::text             AS "dishId",
  d.name                      AS "dishName",
  r.proposed_dish_name        AS "proposedDishName",
  r.thumbnail_url             AS "thumbnailUrl",
  r.servings,
  r.prep_time_minutes         AS "prepTimeMinutes",
  r.cook_time_minutes         AS "cookTimeMinutes",
  r.status,
  r.moderation_note           AS "moderationNote",
  r.created_at                AS "createdAt",
  (SELECT count(*)::int FROM recipe_ingredient ri WHERE ri.recipe_id = r.recipe_id)
    + (SELECT count(*)::int FROM recipe_proposed_ingredient p WHERE p.recipe_id = r.recipe_id) AS "ingredientCount",
  (SELECT count(*)::int FROM recipe_proposed_ingredient p WHERE p.recipe_id = r.recipe_id)     AS "proposedIngredientCount"
`;

/** Công thức của chính mình, mới nhất trước (dùng idx_recipe_author_created). Tối đa 50 — chưa phân trang. */
async function findMine(authorId) {
  const { rows } = await pool.query(`
    SELECT ${MY_RECIPE_COLUMNS}
    FROM recipe r
    LEFT JOIN dish d ON d.dish_id = r.dish_id
    WHERE r.author_id = $1
    ORDER BY r.created_at DESC, r.recipe_id DESC
    LIMIT 50
  `, [authorId]);
  return rows;
}

// Khoi's code: 6 cột dinh dưỡng (tính cho 1 người) — database-seed/SWP_PostgreSQL_15_10_recipe_nutrition_up.sql
const NUTRIENT_KEYS = ['proteinG', 'carbG', 'fatG', 'fiberG', 'sugarG', 'sodiumMg'];
/** pg trả NUMERIC dạng chuỗi ("12.5") → đổi sang số để FE tính toán/hiển thị */
function toNutritionNumbers(recipe) {
  NUTRIENT_KEYS.forEach((k) => { if (recipe[k] !== null && recipe[k] !== undefined) recipe[k] = Number(recipe[k]); });
}
const nutritionValues = (input) => NUTRIENT_KEYS.map((k) => input[k] ?? null);

/**
 * Khoi's code: 1 công thức CỦA CHÍNH MÌNH, đủ nội dung để mở lại form "Sửa và gửi lại".
 * Không phải tác giả → null (controller trả 404, không lộ công thức người khác có tồn tại hay không).
 * ingredients: nguyên liệu trong kho + nguyên liệu đề xuất (proposed: true), sắp theo tên.
 */
async function findMineDetail(authorId, recipeId) {
  const { rows: [recipe] } = await pool.query(`
    SELECT ${MY_RECIPE_COLUMNS},
      r.instructions, r.description, r.youtube_url AS "youtubeUrl", r.calories_kcal AS "caloriesKcal",
      r.protein_g AS "proteinG", r.carb_g AS "carbG", r.fat_g AS "fatG",
      r.fiber_g AS "fiberG", r.sugar_g AS "sugarG", r.sodium_mg AS "sodiumMg",
      COALESCE((SELECT json_agg(x ORDER BY x.proposed, x.name) FROM (
        SELECT i.name, ri.amount, ri.unit, false AS proposed
        FROM recipe_ingredient ri JOIN ingredient i ON i.ingredient_id = ri.ingredient_id
        WHERE ri.recipe_id = r.recipe_id
        UNION ALL
        SELECT p.name, p.amount, p.unit, true AS proposed
        FROM recipe_proposed_ingredient p WHERE p.recipe_id = r.recipe_id
      ) x), '[]'::json) AS ingredients
    FROM recipe r
    LEFT JOIN dish d ON d.dish_id = r.dish_id
    WHERE r.recipe_id = $1 AND r.author_id = $2
  `, [recipeId, authorId]);
  if (!recipe) return null;
  toNutritionNumbers(recipe);
  // NUMERIC trong json_agg ra số; vẫn ép kiểu cho chắc (amount có thể null với đơn vị "ít", "vừa đủ")
  recipe.ingredients = recipe.ingredients.map((i) => ({ ...i, amount: i.amount === null ? null : Number(i.amount) }));
  return recipe;
}

/**
 * Khoi's code: trang xem công thức (/recipes/:id) — AI CŨNG XEM ĐƯỢC, kể cả khách.
 * Chỉ công thức 'approved' của món đang 'active'; còn lại → null (404) để không lộ bản nháp / bị từ chối.
 * Công thức đã duyệt không còn nguyên liệu đề xuất (Admin duyệt hết trước khi approve) → chỉ đọc recipe_ingredient.
 */
async function findPublicDetail(recipeId) {
  const { rows: [recipe] } = await pool.query(`
    SELECT r.recipe_id::text AS id, r.title, r.description,
      r.dish_id::text AS "dishId", d.name AS "dishName",
      r.thumbnail_url AS "thumbnailUrl", r.youtube_url AS "youtubeUrl",
      r.servings, r.prep_time_minutes AS "prepTimeMinutes", r.cook_time_minutes AS "cookTimeMinutes",
      r.calories_kcal AS "caloriesKcal", r.instructions, r.created_at AS "createdAt",
      r.protein_g AS "proteinG", r.carb_g AS "carbG", r.fat_g AS "fatG",
      r.fiber_g AS "fiberG", r.sugar_g AS "sugarG", r.sodium_mg AS "sodiumMg",
      a.full_name AS "authorName", a.avatar_url AS "authorAvatarUrl",
      COALESCE((SELECT json_agg(json_build_object('name', i.name, 'amount', ri.amount, 'unit', ri.unit) ORDER BY i.name)
        FROM recipe_ingredient ri JOIN ingredient i ON i.ingredient_id = ri.ingredient_id
        WHERE ri.recipe_id = r.recipe_id), '[]'::json) AS ingredients
    FROM recipe r
    JOIN dish d ON d.dish_id = r.dish_id AND d.status = 'active'
    JOIN account a ON a.account_id = r.author_id
    WHERE r.recipe_id = $1 AND r.status = 'approved'
  `, [recipeId]);
  if (!recipe) return null;
  toNutritionNumbers(recipe);
  recipe.ingredients = recipe.ingredients.map((i) => ({ ...i, amount: i.amount === null ? null : Number(i.amount), unit: i.unit ?? '' }));
  return recipe;
}

// Admin queue: include the complete recipe and both known and proposed ingredients.
// Duy's Code : Trả toàn bộ công thức để trang Admin phân tab theo trạng thái.
async function listAdminRecipes(includeHistory = false) {
  const { rows } = await pool.query(`
    SELECT r.recipe_id::text AS id, r.title, r.dish_id::text AS "dishId",
      d.name AS "dishName", r.proposed_dish_name AS "proposedDishName",
      r.thumbnail_url AS "thumbnailUrl", r.servings,
      r.prep_time_minutes AS "prepTimeMinutes", r.cook_time_minutes AS "cookTimeMinutes",
      r.instructions, r.status, r.moderation_note AS "moderationNote", r.created_at AS "createdAt",
      a.full_name AS "authorName", a.email AS "authorEmail",
      -- Khoi's code: Admin xem cả mô tả, video, dinh dưỡng (video có thể quay đồ mặn → phải kiểm tra được)
      r.description, r.youtube_url AS "youtubeUrl", r.calories_kcal AS "caloriesKcal",
      r.protein_g AS "proteinG", r.carb_g AS "carbG", r.fat_g AS "fatG",
      r.fiber_g AS "fiberG", r.sugar_g AS "sugarG", r.sodium_mg AS "sodiumMg",
      COALESCE((SELECT json_agg(json_build_object('name', i.name, 'amount', ri.amount, 'unit', ri.unit,
          'isAnimalDerived', i.is_animal_derived) ORDER BY i.name)
        FROM recipe_ingredient ri JOIN ingredient i ON i.ingredient_id = ri.ingredient_id
        WHERE ri.recipe_id = r.recipe_id), '[]'::json) AS ingredients,
      COALESCE((SELECT json_agg(json_build_object('name', pi.name, 'amount', pi.amount, 'unit', pi.unit) ORDER BY pi.name)
        FROM recipe_proposed_ingredient pi WHERE pi.recipe_id = r.recipe_id), '[]'::json) AS "proposedIngredients"
    FROM recipe r LEFT JOIN dish d ON d.dish_id = r.dish_id
    JOIN account a ON a.account_id = r.author_id
    WHERE $1::boolean OR r.status = 'pending'
    ORDER BY r.created_at ASC, r.recipe_id ASC
  `, [includeHistory]);
  // Khoi's code: cảnh báo đồ động vật cho Admin (không chặn): chữ người dùng tự gõ + nguyên liệu kho ghi là động vật
  const keywords = await getKeywords('animal');
  rows.forEach(toNutritionNumbers);
  return rows.map((r) => ({
    ...r,
    animalWarnings: [
      ...animalWarnings([
        { field: 'title', label: 'Tên công thức', text: r.title },
        { field: 'proposedDishName', label: 'Món đề xuất', text: r.proposedDishName },
        ...r.proposedIngredients.map((i) => ({ field: 'proposedIngredient', label: 'Nguyên liệu mới', text: i.name })),
      ], keywords),
      ...r.ingredients.filter((i) => i.isAnimalDerived)
        .map((i) => ({ field: 'ingredient', label: 'Nguyên liệu trong kho', text: i.name, keyword: 'nguồn gốc động vật' })),
    ],
  }));
}

/** Từ động vật (banned_keyword category 'animal') — trang Tạo công thức soi tên món, tên công thức ngay khi gõ */
const findAnimalWords = () => getKeywords('animal');
const listPendingForAdmin = () => listAdminRecipes(false);
const listAllAdminRecipes = () => listAdminRecipes(true);

async function searchAdminDishes(query) {
  const { rows } = await pool.query(`
    SELECT dish_id::text AS id, name
    FROM dish WHERE status = 'active' AND name ILIKE '%' || $1 || '%'
    ORDER BY CASE WHEN lower(name) = lower($1) THEN 0 ELSE 1 END, name
    LIMIT 20
  `, [query]);
  return rows;
}

async function renameRecipeDish(recipeId, name, admin) {
  return transaction(async (client) => {
    const { rows } = await client.query(`SELECT recipe_id::text AS id, proposed_dish_name AS name, status
      FROM recipe WHERE recipe_id = $1 FOR UPDATE`, [recipeId]);
    const before = rows[0];
    if (!before) throw new RecipeError(404, 'Không tìm thấy công thức.');
    if (before.status !== 'pending' || !before.name) throw new RecipeError(409, 'Tên món này không còn chờ xử lý.');
    const { rows: [updated] } = await client.query(`UPDATE recipe SET proposed_dish_name = $2
      WHERE recipe_id = $1 RETURNING recipe_id::text AS id, proposed_dish_name AS name`, [recipeId, name]);
    await client.query(`INSERT INTO admin_log (admin_id, action, target_type, target_id, before_value, after_value, ip_address)
      VALUES ($1, 'recipe_dish_renamed', 'recipe', $2, $3::jsonb, $4::jsonb, $5)`,
    [admin.id, recipeId, JSON.stringify({ proposedDishName: before.name }), JSON.stringify({ proposedDishName: name }), admin.ip]);
    return updated;
  });
}

async function linkRecipeDish(recipeId, dishId, admin, { createdFromRecipe = false } = {}) {
  return transaction(async (client) => {
    const { rows } = await client.query(`SELECT recipe_id::text AS id, author_id AS "authorId", proposed_dish_name AS proposedDishName, status
      FROM recipe WHERE recipe_id = $1 FOR UPDATE`, [recipeId]);
    const recipe = rows[0];
    if (!recipe) throw new RecipeError(404, 'Không tìm thấy công thức.');
    if (recipe.status !== 'pending') throw new RecipeError(409, 'Công thức không còn chờ duyệt.');
    const { rows: [dish] } = await client.query("SELECT dish_id::text AS id, name FROM dish WHERE dish_id = $1 AND status = 'active' FOR SHARE", [dishId]);
    if (!dish) throw new RecipeError(404, 'Không tìm thấy món đang hoạt động.');
    await client.query('UPDATE recipe SET dish_id = $2, proposed_dish_name = NULL WHERE recipe_id = $1', [recipeId, dishId]);
    if (createdFromRecipe) {
      await client.query(`UPDATE dish SET created_by = $2, moderated_by = $3, moderated_at = NOW(), updated_at = NOW()
        WHERE dish_id = $1`, [dishId, recipe.authorId, admin.id]);
    }
    await client.query(`INSERT INTO admin_log (admin_id, action, target_type, target_id, before_value, after_value, ip_address)
      VALUES ($1, 'recipe_dish_linked', 'recipe', $2, $3::jsonb, $4::jsonb, $5)`,
    [admin.id, recipeId, JSON.stringify({ proposedDishName: recipe.proposedDishName }), JSON.stringify({ dishId: dish.id, dishName: dish.name }), admin.ip]);
    return { dishId: dish.id, dishName: dish.name };
  });
}

/**
 * Khoi's code: báo cho tác giả khi công thức được duyệt / bị từ chối (cùng transaction với quyết định).
 * Cần enum recipe_approved, recipe_rejected và ref_type 'recipe' (database-seed/SWP_PostgreSQL_15_10_recipe_notification_up.sql).
 * DB chưa chạy file đó → bỏ qua thông báo, KHÔNG làm hỏng việc duyệt của Admin.
 */
async function notifyRecipeAuthor(client, recipe, status, note) {
  const { rows: [enumCheck] } = await client.query(`
    SELECT count(*)::int AS found FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE (t.typname = 'notification_type_enum' AND e.enumlabel IN ('recipe_approved', 'recipe_rejected'))
       OR (t.typname = 'notification_ref_type_enum' AND e.enumlabel = 'recipe')
  `);
  if (enumCheck.found < 3) {
    console.warn('[recipe.notify] Chưa có enum thông báo công thức — chạy database-seed/SWP_PostgreSQL_15_10_recipe_notification_up.sql. Bỏ qua thông báo.');
    return;
  }
  const approved = status === 'approved';
  await client.query(`
    INSERT INTO notification (account_id, type, title, content, ref_type, ref_id, metadata)
    VALUES ($1, $2::notification_type_enum, $3, $4, 'recipe'::notification_ref_type_enum, $5, $6::jsonb)
  `, [
    recipe.authorId,
    approved ? 'recipe_approved' : 'recipe_rejected',
    approved ? 'Công thức của bạn đã được duyệt' : 'Công thức của bạn bị từ chối',
    approved
      ? `Công thức “${recipe.title}” đã được duyệt và hiển thị với mọi người.`
      : `Công thức “${recipe.title}” bị từ chối: ${note}. Bạn có thể sửa và gửi lại.`,
    recipe.id,
    JSON.stringify({ href: approved ? `/recipes/${recipe.id}` : '/recipes/new?tab=sent', recipeId: recipe.id }),
  ]);
}

async function decideRecipe(recipeId, action, note, admin) {
  if (!['approve', 'reject'].includes(action)) throw new RecipeError(400, 'Quyết định công thức không hợp lệ.');
  const status = action === 'approve' ? 'approved' : 'rejected';
  return transaction(async (client) => {
    const { rows } = await client.query(`
      SELECT recipe_id::text AS id, title, author_id AS "authorId", status,
        dish_id AS "dishId", proposed_dish_name AS "proposedDishName"
      FROM recipe WHERE recipe_id = $1 FOR UPDATE
    `, [recipeId]);
    const before = rows[0];
    if (!before) throw new RecipeError(404, 'Không tìm thấy công thức.');
    if (before.status !== 'pending') throw new RecipeError(409, 'Công thức không còn chờ duyệt. Hãy tải lại danh sách.');
    if (action === 'approve' && (!before.dishId || before.proposedDishName)) {
      throw new RecipeError(409, 'Hãy liên kết công thức với một món trong Database trước khi duyệt.');
    }
    if (action === 'approve') {
      const { rows: [pendingIngredients] } = await client.query(`
        SELECT count(*)::int AS count
        FROM public.recipe_proposed_ingredient
        WHERE recipe_id = $1
      `, [recipeId]);
      if (pendingIngredients.count > 0) {
        throw new RecipeError(409, 'Công thức còn nguyên liệu chưa được duyệt vào kho. Hãy xử lý các đề nghị nguyên liệu trước.');
      }
    }
    const { rows: [updated] } = await client.query(`
      UPDATE recipe SET status = $2, moderation_note = $3
      WHERE recipe_id = $1
      RETURNING recipe_id::text AS id, status, moderation_note AS "moderationNote"
    `, [recipeId, status, action === 'reject' ? note : null]);
    await client.query(`
      INSERT INTO admin_log (admin_id, action, target_type, target_id, before_value, after_value, reason, ip_address)
      VALUES ($1, $2, 'recipe', $3, $4::jsonb, $5::jsonb, $6, $7)
    `, [admin.id, `recipe_${status}`, recipeId, JSON.stringify({ status: before.status }), JSON.stringify({ status }), note || null, admin.ip]);
    await notifyRecipeAuthor(client, { ...before, id: String(recipeId) }, status, note);
    return updated;
  });
}

// =====================================================================
//  GHI
// =====================================================================

/**
 * Gửi công thức → status 'pending'. KHÔNG tạo Dish, KHÔNG tạo Ingredient:
 *  - món đề xuất chỉ lưu chữ ở recipe.proposed_dish_name
 *  - nguyên liệu chưa có trong kho lưu ở recipe_proposed_ingredient, Admin duyệt cùng công thức
 * @param {string} authorId
 * @param {ReturnType<import('../utils/recipeInput').parseRecipeInput>} input
 * @returns {Promise<{ recipe: object, ingredients: object[] }>}
 */
/**
 * Món của công thức: chọn món có sẵn (phải đang 'active') hoặc đề xuất tên mới (không được trùng món đang có).
 * @returns {Promise<string|null>} tên món có sẵn (null nếu là món đề xuất)
 */
async function resolveDish(client, input) {
  if (input.dishId) {
    // FOR SHARE: Admin không đổi trạng thái món này giữa lúc kiểm tra và lúc ghi
    const { rows: [dish] } = await client.query(
      "SELECT name FROM dish WHERE dish_id = $1 AND status = 'active' FOR SHARE",
      [input.dishId],
    );
    if (!dish) throw new RecipeError(409, 'Món đã chọn không còn hoạt động, hãy chọn món khác.');
    return dish.name;
  }
  const { rows: [same] } = await client.query(
    "SELECT name FROM dish WHERE status = 'active' AND lower(btrim(name)) = lower($1) LIMIT 1",
    [input.proposedDishName],
  );
  if (same) throw new RecipeError(409, `Món “${same.name}” đã có sẵn, hãy chọn món này thay vì đề xuất.`);
  return null;
}

/**
 * Ghi nguyên liệu: có trong kho → recipe_ingredient · chưa có → recipe_proposed_ingredient (Admin duyệt).
 * @returns {Promise<{ checked: object[], proposedCount: number }>}
 */
async function saveIngredients(client, recipeId, ingredients) {
  const checked = await inspectIngredients(client, ingredients.map((i) => i.name));
  const known = [];
  const proposed = [];
  ingredients.forEach((ing, idx) => {
    if (checked[idx].known) known.push({ ...ing, ingredientId: checked[idx].ingredientId });
    else proposed.push(ing);
  });

  if (known.length) {
    await client.query(`
      INSERT INTO recipe_ingredient (recipe_id, ingredient_id, amount, unit)
      SELECT $1, x.ingredient_id, x.amount, x.unit
      FROM unnest($2::bigint[], $3::numeric[], $4::text[]) AS x(ingredient_id, amount, unit)
    `, [recipeId, known.map((k) => k.ingredientId), known.map((k) => k.amount), known.map((k) => k.unit)]);
  }
  if (proposed.length) {
    await client.query(`
      INSERT INTO recipe_proposed_ingredient (recipe_id, name, amount, unit)
      SELECT $1, x.name, x.amount, x.unit
      FROM unnest($2::text[], $3::numeric[], $4::text[]) AS x(name, amount, unit)
    `, [recipeId, proposed.map((p) => p.name), proposed.map((p) => p.amount), proposed.map((p) => p.unit)]);
  }
  return { checked, proposedCount: proposed.length };
}

/** Dạng MyRecipe trả về FE sau khi gửi / gửi lại (giống 1 dòng của findMine) */
const toMyRecipe = (id, input, { dishName, status, createdAt, proposedCount }) => ({
  id,
  title: input.title,
  dishId: input.dishId,
  dishName,
  proposedDishName: input.proposedDishName,
  thumbnailUrl: input.thumbnailUrl,
  servings: input.servings,
  prepTimeMinutes: input.prepTimeMinutes,
  cookTimeMinutes: input.cookTimeMinutes,
  status,
  moderationNote: null,
  createdAt,
  ingredientCount: input.ingredients.length,
  proposedIngredientCount: proposedCount,
});

/**
 * Gửi công thức → status 'pending'. KHÔNG tạo Dish, KHÔNG tạo Ingredient:
 *  - món đề xuất chỉ lưu chữ ở recipe.proposed_dish_name
 *  - nguyên liệu chưa có trong kho lưu ở recipe_proposed_ingredient, Admin duyệt cùng công thức
 * @param {string} authorId
 * @param {ReturnType<import('../utils/recipeInput').parseRecipeInput>} input
 * @returns {Promise<{ recipe: object, ingredients: object[] }>}
 */
async function createRecipe(authorId, input) {
  return transaction(async (client) => {
    const dishName = await resolveDish(client, input);

    const { rows: [recipe] } = await client.query(`
      INSERT INTO recipe (dish_id, proposed_dish_name, author_id, title, thumbnail_url,
                          servings, prep_time_minutes, cook_time_minutes, instructions, status,
                          description, youtube_url, calories_kcal,
                          protein_g, carb_g, fat_g, fiber_g, sugar_g, sodium_mg)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING recipe_id::text AS id, status, created_at AS "createdAt"
    `, [
      input.dishId, input.proposedDishName, authorId, input.title, input.thumbnailUrl,
      input.servings, input.prepTimeMinutes, input.cookTimeMinutes, input.instructions,
      input.description ?? null, input.youtubeUrl ?? null, input.caloriesKcal ?? null,
      ...nutritionValues(input),
    ]);

    const { checked, proposedCount } = await saveIngredients(client, recipe.id, input.ingredients);
    return {
      recipe: toMyRecipe(recipe.id, input, { dishName, status: recipe.status, createdAt: recipe.createdAt, proposedCount }),
      ingredients: checked.map(publicCheck),
    };
  });
}

/**
 * Khoi's code: "Sửa và gửi lại" — chỉ TÁC GIẢ, chỉ công thức đang 'rejected'.
 * Cập nhật CÙNG recipe_id: thay toàn bộ nội dung + nguyên liệu, status về 'pending', xoá lý do từ chối cũ.
 * Lịch sử từ chối lần trước vẫn còn ở admin_log (Admin ghi lúc từ chối).
 * @returns {Promise<{ recipe: object, ingredients: object[] }>}
 */
async function resubmitRecipe(authorId, recipeId, input) {
  return transaction(async (client) => {
    // FOR UPDATE: Admin không duyệt/từ chối đúng lúc tác giả đang gửi lại
    const { rows: [before] } = await client.query(
      'SELECT status, created_at AS "createdAt" FROM recipe WHERE recipe_id = $1 AND author_id = $2 FOR UPDATE',
      [recipeId, authorId],
    );
    if (!before) throw new RecipeError(404, 'Không tìm thấy công thức của bạn.');
    if (before.status !== 'rejected') {
      throw new RecipeError(409, 'Chỉ sửa và gửi lại được công thức bị từ chối. Hãy tải lại danh sách.');
    }

    const dishName = await resolveDish(client, input);
    await client.query(`
      UPDATE recipe
      SET dish_id = $2, proposed_dish_name = $3, title = $4, thumbnail_url = $5,
          servings = $6, prep_time_minutes = $7, cook_time_minutes = $8, instructions = $9,
          status = 'pending', moderation_note = NULL,
          description = $10, youtube_url = $11, calories_kcal = $12,
          protein_g = $13, carb_g = $14, fat_g = $15, fiber_g = $16, sugar_g = $17, sodium_mg = $18
      WHERE recipe_id = $1
    `, [
      recipeId, input.dishId, input.proposedDishName, input.title, input.thumbnailUrl,
      input.servings, input.prepTimeMinutes, input.cookTimeMinutes, input.instructions,
      input.description ?? null, input.youtubeUrl ?? null, input.caloriesKcal ?? null,
      ...nutritionValues(input),
    ]);

    // Thay nguyên liệu: xoá hết rồi ghi lại theo form mới
    await client.query('DELETE FROM recipe_ingredient WHERE recipe_id = $1', [recipeId]);
    await client.query('DELETE FROM recipe_proposed_ingredient WHERE recipe_id = $1', [recipeId]);
    const { checked, proposedCount } = await saveIngredients(client, recipeId, input.ingredients);

    return {
      recipe: toMyRecipe(String(recipeId), input, { dishName, status: 'pending', createdAt: before.createdAt, proposedCount }),
      ingredients: checked.map(publicCheck),
    };
  });
}

module.exports = {
  findAnimalWords,
  RecipeError, findActiveDishes, findIngredientNames, checkIngredients, findMine, createRecipe,
  findMineDetail, resubmitRecipe, findPublicDetail,
  listPendingForAdmin, listAllAdminRecipes, decideRecipe,
  searchAdminDishes, renameRecipeDish, linkRecipeDish,
};
