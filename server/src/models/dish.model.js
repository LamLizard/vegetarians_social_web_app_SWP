const pool = require('../config/db');
const { getDishDecision } = require('../utils/dish');

// Duy's code: Dùng chung các cột Dish và JSON danh mục cho các truy vấn danh sách.
const DISH_FIELDS = `
  d.dish_id AS id, d.name, d.description, d.thumbnail_url AS "thumbnailUrl",
  d.status::text AS status, d.moderation_note AS "moderationNote",
  d.created_by AS "createdBy", d.moderated_by AS "moderatedBy",
  d.moderated_at AS "moderatedAt", d.created_at AS "createdAt",
  COALESCE((
    SELECT json_agg(json_build_object('id', c.category_id, 'name', c.name) ORDER BY c.name)
    FROM public.dish_category dc
    JOIN public.category c ON c.category_id = dc.category_id
    WHERE dc.dish_id = d.dish_id
  ), '[]'::json) AS categories
`;

// Duy's code: Gắn HTTP status vào lỗi nghiệp vụ phát sinh khi truy vấn Dish.
class DishModelError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'DishModelError';
    this.status = status;
  }
}

// Duy's code: Đảm bảo các thao tác tạo/duyệt và log được commit hoặc rollback cùng nhau.
async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
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

// Duy's code: Trả về danh mục hiện đang cho phép gắn vào Dish.
async function listActiveCategories() {
  const { rows } = await pool.query(`
    SELECT category_id AS id, name
    FROM public.category
    WHERE is_active = true
    ORDER BY name, category_id
  `);
  return rows;
}

// Duy's code: Lấy hàng chờ pending theo thứ tự gửi để Admin xử lý tuần tự.
async function listPendingDishes() {
  const { rows } = await pool.query(`
    SELECT ${DISH_FIELDS}, COALESCE(recipe_creator.full_name, creator.full_name) AS "creatorName",
      COALESCE(recipe_creator.email, creator.email) AS "creatorEmail",
      COALESCE(reviewer.full_name, CASE WHEN recipe_creator.account_id IS NOT NULL THEN creator.full_name END) AS "reviewerName",
      COALESCE(reviewer.email, CASE WHEN recipe_creator.account_id IS NOT NULL THEN creator.email END) AS "reviewerEmail"
    FROM public.dish d
    LEFT JOIN public.account creator ON creator.account_id = d.created_by
    LEFT JOIN public.account reviewer ON reviewer.account_id = d.moderated_by
    LEFT JOIN LATERAL (
      SELECT a.account_id, a.full_name, a.email
      FROM public.recipe r JOIN public.account a ON a.account_id = r.author_id
      WHERE r.dish_id = d.dish_id AND r.created_at <= d.created_at
      ORDER BY r.created_at, r.recipe_id
      LIMIT 1
    ) recipe_creator ON true
    WHERE d.status = 'pending'
    ORDER BY d.created_at ASC, d.dish_id ASC
  `);
  return rows;
}

// Duy's Code : Nhóm danh mục món chung với các công thức đã được duyệt bên trong.
async function listAdminDishes() {
  const { rows } = await pool.query(`
    SELECT d.dish_id::text AS id, d.name, d.description,
      COALESCE((SELECT json_agg(json_build_object('id', c.category_id, 'name', c.name) ORDER BY c.name)
        FROM public.dish_category dc JOIN public.category c ON c.category_id = dc.category_id
        WHERE dc.dish_id = d.dish_id), '[]'::json) AS categories,
      COALESCE((
        SELECT json_agg(json_build_object(
          'id', r.recipe_id::text, 'title', r.title, 'thumbnailUrl', r.thumbnail_url,
          'servings', r.servings, 'prepTimeMinutes', r.prep_time_minutes,
          'cookTimeMinutes', r.cook_time_minutes, 'instructions', r.instructions,
          'createdAt', r.created_at,
          'ingredients', COALESCE((
            SELECT json_agg(json_build_object('name', i.name, 'amount', ri.amount, 'unit', ri.unit) ORDER BY i.name)
            FROM public.recipe_ingredient ri
            JOIN public.ingredient i ON i.ingredient_id = ri.ingredient_id
            WHERE ri.recipe_id = r.recipe_id
          ), '[]'::json)
        ) ORDER BY r.created_at DESC, r.recipe_id DESC)
        FROM public.recipe r
        WHERE r.dish_id = d.dish_id AND r.status = 'approved'
      ), '[]'::json) AS recipes
    FROM public.dish d
    WHERE d.status = 'active'
    ORDER BY d.name, d.dish_id
  `);
  return rows;
}

// Search active dishes so Admin can compare a pending suggestion before creating a duplicate.
async function searchActiveDishes(query) {
  const { rows } = await pool.query(`
    SELECT d.dish_id AS id, d.name, d.description, d.thumbnail_url AS "thumbnailUrl",
      d.status::text AS status
    FROM public.dish d
    WHERE d.status = 'active' AND d.name ILIKE '%' || $1 || '%'
    ORDER BY CASE WHEN lower(d.name) = lower($1) THEN 0 ELSE 1 END, d.name
    LIMIT 20
  `, [query]);
  return rows;
}

// Search all registered Dish records for the Admin create form, including non-active records.
async function searchAdminDishes(query) {
  const { rows } = await pool.query(`
    SELECT d.dish_id::text AS id, d.name, d.status::text AS status
    FROM public.dish d
    WHERE d.name ILIKE '%' || $1 || '%'
      OR EXISTS (
        SELECT 1 FROM regexp_split_to_table(btrim($1), '\\s+') AS token
        WHERE char_length(token) > 1 AND d.name ILIKE '%' || token || '%'
      )
    ORDER BY CASE WHEN lower(btrim(d.name)) = lower(btrim($1)) THEN 0 ELSE 1 END,
      d.name, d.dish_id
    LIMIT 20
  `, [query]);
  return rows;
}

// Rename a pending suggestion while preserving the submitter's record and moderation state.
async function renamePendingDish(dishId, name, admin) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(`
      SELECT dish_id AS id, name, status::text AS status
      FROM public.dish WHERE dish_id = $1 FOR UPDATE
    `, [dishId]);
    const before = rows[0];
    if (!before) throw new DishModelError(404, 'Không tìm thấy món ăn.');
    if (before.status !== 'pending') throw new DishModelError(409, 'Đề xuất không còn chờ duyệt. Hãy tải lại danh sách.');
    const updated = await client.query(`
      UPDATE public.dish SET name = $2, updated_at = NOW()
      WHERE dish_id = $1 RETURNING dish_id AS id, name
    `, [dishId, name]);
    await client.query(`
      INSERT INTO public.admin_log
        (admin_id, action, target_type, target_id, before_value, after_value, ip_address)
      VALUES ($1, 'dish_suggestion_renamed', 'dish', $2, $3::jsonb, $4::jsonb, $5)
    `, [admin.id, dishId, JSON.stringify({ name: before.name }), JSON.stringify({ name }), admin.ip]);
    return updated.rows[0];
  });
}

// Duy's code: Lọc danh sách Dish của Member đăng nhập, không lộ Dish của tài khoản khác.
async function listMyDishes(accountId) {
  const { rows } = await pool.query(`
    SELECT ${DISH_FIELDS}
    FROM public.dish d
    WHERE d.created_by = $1 AND d.status IN ('pending', 'active', 'rejected')
    ORDER BY d.created_at DESC, d.dish_id DESC
  `, [accountId]);
  return rows;
}

// Duy's code: Tạo Dish, liên kết danh mục và ghi AdminLog nếu Admin tạo active.
async function createDish(input, actor, status) {
  return withTransaction(async (client) => {
    if (status === 'active') {
      const { rows: [existing] } = await client.query(`
        SELECT dish_id FROM public.dish
        WHERE lower(btrim(name)) = lower(btrim($1))
        LIMIT 1 FOR SHARE
      `, [input.name]);
      if (existing) throw new DishModelError(409, 'Tên món này đã có trong Database. Hãy tìm và liên kết Recipe với món đang có.');
    }
    // Duy's code: Khóa và kiểm tra category để tránh liên kết danh mục đã bị tắt.
    const { rows: categories } = await client.query(`
      SELECT category_id
      FROM public.category
      WHERE is_active = true AND category_id = ANY($1::bigint[])
      FOR SHARE
    `, [input.categoryIds]);
    if (categories.length !== input.categoryIds.length) {
      throw new DishModelError(400, 'Một hoặc nhiều danh mục không còn hoạt động. Hãy tải lại danh sách.');
    }

    // Duy's code: Lưu Dish với trạng thái được controller chọn theo vai trò người tạo.
    const { rows } = await client.query(`
      INSERT INTO public.dish (name, description, thumbnail_url, status, created_by)
      VALUES ($1, $2, $3, $4::dish_status_enum, $5)
      RETURNING dish_id AS id, name, description, thumbnail_url AS "thumbnailUrl",
        status::text AS status, created_by AS "createdBy", created_at AS "createdAt"
    `, [input.name, input.description, input.thumbnailUrl, status, actor.id]);
    const dish = rows[0];
    // Duy's code: Lưu liên kết Dish-category sau khi category IDs đã qua kiểm tra.
    for (const categoryId of input.categoryIds) {
      await client.query(
        'INSERT INTO public.dish_category (dish_id, category_id) VALUES ($1, $2)',
        [dish.id, categoryId],
      );
    }

    if (status === 'active') {
      await client.query(`
        INSERT INTO public.admin_log
          (admin_id, action, target_type, target_id, after_value, ip_address)
        VALUES ($1, 'dish_created', 'dish', $2, $3::jsonb, $4)
      `, [actor.id, dish.id, JSON.stringify({ status, name: dish.name }), actor.ip]);
    }

    const result = await client.query(`SELECT ${DISH_FIELDS} FROM public.dish d WHERE d.dish_id = $1`, [dish.id]);
    return result.rows[0];
  });
}

// Create an Admin-owned Dish and its already-approved Recipe atomically.
async function createAdminDishWithRecipe(dishInput, recipeInput, actor) {
  return withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext(lower(btrim($1))))', [dishInput.name]);
    const { rows: [existing] } = await client.query(`
      SELECT dish_id FROM public.dish
      WHERE lower(btrim(name)) = lower(btrim($1))
      LIMIT 1 FOR SHARE
    `, [dishInput.name]);
    if (existing) throw new DishModelError(409, 'Tên món này đã có trong Database. Hãy kiểm tra và chọn tên khác.');

    const { rows: categories } = await client.query(`
      SELECT category_id FROM public.category
      WHERE is_active = true AND category_id = ANY($1::bigint[])
      FOR SHARE
    `, [dishInput.categoryIds]);
    if (categories.length !== dishInput.categoryIds.length) {
      throw new DishModelError(400, 'Một hoặc nhiều danh mục không còn hoạt động. Hãy tải lại danh sách.');
    }

    const { rows: [dish] } = await client.query(`
      INSERT INTO public.dish (name, description, thumbnail_url, status, created_by, moderated_by, moderated_at)
      VALUES ($1, $2, $3, 'active', $4, $4, NOW())
      RETURNING dish_id::text AS id, name
    `, [dishInput.name, dishInput.description, dishInput.thumbnailUrl, actor.id]);
    for (const categoryId of dishInput.categoryIds) {
      await client.query('INSERT INTO public.dish_category (dish_id, category_id) VALUES ($1, $2)', [dish.id, categoryId]);
    }

    const { rows: [recipe] } = await client.query(`
      INSERT INTO public.recipe (dish_id, proposed_dish_name, author_id, title, thumbnail_url,
        servings, prep_time_minutes, cook_time_minutes, instructions, status)
      VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, 'approved')
      RETURNING recipe_id::text AS id, title, status, created_at AS "createdAt"
    `, [dish.id, actor.id, recipeInput.title, dishInput.thumbnailUrl, recipeInput.servings,
      recipeInput.prepTimeMinutes, recipeInput.cookTimeMinutes, recipeInput.instructions]);

    const { rows: ingredientRows } = await client.query(`
      SELECT n.ord, i.ingredient_id::text AS "ingredientId"
      FROM unnest($1::text[]) WITH ORDINALITY AS n(name, ord)
      LEFT JOIN LATERAL (
        SELECT ingredient_id FROM public.ingredient
        WHERE lower(btrim(name)) = lower(n.name)
        ORDER BY ingredient_id LIMIT 1
      ) i ON true
      ORDER BY n.ord
    `, [recipeInput.ingredients.map((ingredient) => ingredient.name)]);
    const known = [];
    const proposed = [];
    recipeInput.ingredients.forEach((ingredient, index) => {
      const ingredientId = ingredientRows[index]?.ingredientId;
      if (ingredientId) known.push({ ...ingredient, ingredientId });
      else proposed.push(ingredient);
    });
    if (known.length) {
      await client.query(`
        INSERT INTO public.recipe_ingredient (recipe_id, ingredient_id, amount, unit)
        SELECT $1, x.ingredient_id, x.amount, x.unit
        FROM unnest($2::bigint[], $3::numeric[], $4::text[]) AS x(ingredient_id, amount, unit)
      `, [recipe.id, known.map((item) => item.ingredientId), known.map((item) => item.amount), known.map((item) => item.unit)]);
    }
    if (proposed.length) {
      await client.query(`
        INSERT INTO public.recipe_proposed_ingredient (recipe_id, name, amount, unit)
        SELECT $1, x.name, x.amount, x.unit
        FROM unnest($2::text[], $3::numeric[], $4::text[]) AS x(name, amount, unit)
      `, [recipe.id, proposed.map((item) => item.name), proposed.map((item) => item.amount), proposed.map((item) => item.unit)]);
    }

    await client.query(`
      INSERT INTO public.admin_log (admin_id, action, target_type, target_id, after_value, ip_address)
      VALUES ($1, 'dish_created', 'dish', $2, $3::jsonb, $4)
    `, [actor.id, dish.id, JSON.stringify({ status: 'active', name: dish.name }), actor.ip]);
    await client.query(`
      INSERT INTO public.admin_log (admin_id, action, target_type, target_id, before_value, after_value, ip_address)
      VALUES ($1, 'recipe_approved', 'recipe', $2, NULL, $3::jsonb, $4)
    `, [actor.id, recipe.id, JSON.stringify({ status: 'approved', createdByAdmin: true }), actor.ip]);

    return { dish: { ...dish, status: 'active' }, recipe };
  });
}

// Duy's code: Khóa Dish chờ duyệt, cập nhật trạng thái và ghi log/thông báo nguyên tử.
async function decideDish(dishId, action, note, admin) {
  // Duy's code: Lấy trạng thái đích và hành động log/notification trước transaction.
  const decision = getDishDecision(action);
  return withTransaction(async (client) => {
    // Duy's code: Khóa dòng Dish để hai Admin không thể duyệt đồng thời cùng bản ghi.
    const { rows } = await client.query(`
      SELECT ${DISH_FIELDS}
      FROM public.dish d
      WHERE d.dish_id = $1
      FOR UPDATE OF d
    `, [dishId]);
    const before = rows[0];
    if (!before) throw new DishModelError(404, 'Không tìm thấy món ăn.');
    if (before.status !== 'pending') {
      throw new DishModelError(409, 'Món ăn không còn ở trạng thái chờ duyệt. Hãy tải lại danh sách.');
    }

    // Duy's code: Chỉ cập nhật Dish còn pending sang trạng thái được phép.
    const { rows: updatedRows } = await client.query(`
      UPDATE public.dish
      SET status = $2::dish_status_enum, moderation_note = $3,
        moderated_by = $4, moderated_at = NOW(), updated_at = NOW()
      WHERE dish_id = $1
      RETURNING dish_id AS id, name, description, thumbnail_url AS "thumbnailUrl",
        status::text AS status, moderation_note AS "moderationNote",
        created_by AS "createdBy", moderated_by AS "moderatedBy",
        moderated_at AS "moderatedAt", created_at AS "createdAt"
    `, [dishId, decision.status, note || null, admin.id]);
    const after = updatedRows[0];

    // Duy's code: Lưu audit log gồm trạng thái trước/sau và lý do quyết định.
    await client.query(`
      INSERT INTO public.admin_log
        (admin_id, action, target_type, target_id, before_value, after_value, reason, ip_address)
      VALUES ($1, $2, 'dish', $3, $4::jsonb, $5::jsonb, $6, $7)
    `, [
      admin.id, decision.logAction, dishId, JSON.stringify({ status: before.status }),
      JSON.stringify({ status: after.status }), note || null, admin.ip,
    ]);

    // Duy's code: Thông báo kết quả cho tác giả Member nếu Dish có người đề xuất.
    if (before.createdBy != null) {
      await client.query(`
        INSERT INTO public.notification (account_id, type, title, content, ref_type, ref_id)
        VALUES ($1, $2::notification_type_enum, $3, $4, 'dish'::notification_ref_type_enum, $5)
      `, [
        before.createdBy,
        decision.notificationType,
        decision.notificationTitle,
        action === 'approve'
          ? `Đề xuất “${before.name}” của bạn đã được duyệt.`
          : `Đề xuất “${before.name}” của bạn bị từ chối. Lý do: ${note}`,
        dishId,
      ]);
    }

    return { ...after, categories: before.categories };
  });
}

module.exports = {
  DishModelError,
  createDish,
  createAdminDishWithRecipe,
  decideDish,
  listActiveCategories,
  listAdminDishes,
  listMyDishes,
  listPendingDishes,
  renamePendingDish,
  searchActiveDishes,
  searchAdminDishes,
};
