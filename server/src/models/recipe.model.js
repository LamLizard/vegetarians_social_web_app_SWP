// Khoi's code: Truy vấn cho trang Tạo công thức (Sprint 2, phương án B).
// Bảng: recipe (status/proposed_dish_name...), dish, ingredient, recipe_ingredient,
//       recipe_proposed_ingredient (nguyên liệu chưa có trong kho, chờ Admin duyệt).
// Model không kiểm tra dữ liệu form — việc đó ở utils/recipeInput.js.
const pool = require('../config/db');
const { findAnimalWord } = require('../utils/animalWords');

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

/** Tên nguyên liệu trong kho (bảng ingredient) để gợi ý khi gõ */
async function findIngredientNames() {
  const { rows } = await pool.query('SELECT name FROM ingredient ORDER BY name');
  return rows.map((r) => r.name);
}

/**
 * Soi từng tên nguyên liệu (giữ đúng thứ tự):
 *  - known: tên có trong kho ingredient (so không phân biệt hoa/thường)
 *  - isAnimalDerived: kho đánh dấu có nguồn gốc động vật
 *  - keyword: tên CHƯA có trong kho mà chứa từ động vật (vd "cá" trong "chả cá chay", xem utils/animalWords.js)
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
  return rows.map((r, idx) => ({
    name: names[idx],
    ingredientId: r.ingredientId,
    known: r.ingredientId !== null,
    isAnimalDerived: r.isAnimalDerived,
    keyword: r.ingredientId === null ? findAnimalWord(names[idx]) : null,
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
async function createRecipe(authorId, input) {
  return transaction(async (client) => {
    let dishName = null;
    if (input.dishId) {
      // FOR SHARE: Admin không đổi trạng thái món này giữa lúc kiểm tra và lúc INSERT
      const { rows: [dish] } = await client.query(
        "SELECT name FROM dish WHERE dish_id = $1 AND status = 'active' FOR SHARE",
        [input.dishId],
      );
      if (!dish) throw new RecipeError(409, 'Món đã chọn không còn hoạt động, hãy chọn món khác.');
      dishName = dish.name;
    } else {
      const { rows: [same] } = await client.query(
        "SELECT name FROM dish WHERE status = 'active' AND lower(btrim(name)) = lower($1) LIMIT 1",
        [input.proposedDishName],
      );
      if (same) throw new RecipeError(409, `Món “${same.name}” đã có sẵn, hãy chọn món này thay vì đề xuất.`);
    }

    const checked = await inspectIngredients(client, input.ingredients.map((i) => i.name));

    const { rows: [recipe] } = await client.query(`
      INSERT INTO recipe (dish_id, proposed_dish_name, author_id, title, thumbnail_url,
                          servings, prep_time_minutes, cook_time_minutes, instructions, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
      RETURNING recipe_id::text AS id, status, created_at AS "createdAt"
    `, [
      input.dishId, input.proposedDishName, authorId, input.title, input.thumbnailUrl,
      input.servings, input.prepTimeMinutes, input.cookTimeMinutes, input.instructions,
    ]);

    const known = [];
    const proposed = [];
    input.ingredients.forEach((ing, idx) => {
      if (checked[idx].known) known.push({ ...ing, ingredientId: checked[idx].ingredientId });
      else proposed.push(ing);
    });

    if (known.length) {
      await client.query(`
        INSERT INTO recipe_ingredient (recipe_id, ingredient_id, amount, unit)
        SELECT $1, x.ingredient_id, x.amount, x.unit
        FROM unnest($2::bigint[], $3::numeric[], $4::text[]) AS x(ingredient_id, amount, unit)
      `, [recipe.id, known.map((k) => k.ingredientId), known.map((k) => k.amount), known.map((k) => k.unit)]);
    }
    if (proposed.length) {
      await client.query(`
        INSERT INTO recipe_proposed_ingredient (recipe_id, name, amount, unit)
        SELECT $1, x.name, x.amount, x.unit
        FROM unnest($2::text[], $3::numeric[], $4::text[]) AS x(name, amount, unit)
      `, [recipe.id, proposed.map((p) => p.name), proposed.map((p) => p.amount), proposed.map((p) => p.unit)]);
    }

    return {
      recipe: {
        id: recipe.id,
        title: input.title,
        dishId: input.dishId,
        dishName,
        proposedDishName: input.proposedDishName,
        thumbnailUrl: input.thumbnailUrl,
        servings: input.servings,
        prepTimeMinutes: input.prepTimeMinutes,
        cookTimeMinutes: input.cookTimeMinutes,
        status: recipe.status,
        moderationNote: null,
        createdAt: recipe.createdAt,
        ingredientCount: input.ingredients.length,
        proposedIngredientCount: proposed.length,
      },
      ingredients: checked.map(publicCheck),
    };
  });
}

module.exports = {
  RecipeError, findActiveDishes, findIngredientNames, checkIngredients, findMine, createRecipe,
};
