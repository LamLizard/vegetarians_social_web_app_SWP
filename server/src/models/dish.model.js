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
    SELECT ${DISH_FIELDS}, a.full_name AS "authorName", a.email AS "authorEmail"
    FROM public.dish d
    LEFT JOIN public.account a ON a.account_id = d.created_by
    WHERE d.status = 'pending'
    ORDER BY d.created_at ASC, d.dish_id ASC
  `);
  return rows;
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
  decideDish,
  listActiveCategories,
  listMyDishes,
  listPendingDishes,
};
