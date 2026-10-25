const pool = require('../config/db');
const { formatIngredientName } = require('../utils/ingredientName');

class IngredientProposalError extends Error {
  constructor(status, message) { super(message); this.name = 'IngredientProposalError'; this.status = status; }
}

function cleanName(rawName) {
  if (typeof rawName !== 'string') throw new IngredientProposalError(400, 'Tên nguyên liệu không hợp lệ.');
  const name = formatIngredientName(rawName);
  if (!name || [...name].length > 120) throw new IngredientProposalError(400, 'Tên nguyên liệu phải có từ 1 đến 120 ký tự.');
  return name;
}

async function submit(accountId, rawName) {
  const name = cleanName(rawName);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const known = await client.query('SELECT 1 FROM public.ingredient WHERE lower(btrim(name)) = lower($1::varchar(120)) LIMIT 1', [name]);
    if (known.rowCount) throw new IngredientProposalError(409, 'Nguyên liệu này đã có trong kho. Hãy chọn nguyên liệu trong kết quả.');
    await client.query('INSERT INTO public.profile (account_id) VALUES ($1) ON CONFLICT (account_id) DO NOTHING', [accountId]);
    await client.query(`
      INSERT INTO public.allergy (profile_id, name)
      SELECT p.profile_id, $2 FROM public.profile p
      WHERE p.account_id = $1 AND NOT EXISTS (
        SELECT 1 FROM public.allergy a
        WHERE a.profile_id = p.profile_id AND lower(btrim(a.name)) = lower($2::varchar(120))
      )
    `, [accountId, name]);
    await client.query('COMMIT');
    return { name, status: 'pending' };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* preserve original error */ }
    throw error;
  } finally { client.release(); }
}

async function listMine(accountId) {
  const { rows } = await pool.query(`
    SELECT a.allergy_id::text AS id, a.name,
      CASE WHEN EXISTS (SELECT 1 FROM public.ingredient i WHERE lower(btrim(i.name)) = lower(btrim(a.name))) THEN 'approved'
           WHEN EXISTS (SELECT 1 FROM public.admin_log l WHERE l.action = 'ingredient_proposal_removed'
             AND COALESCE(l.after_value->>'sourceType', 'all') IN ('health_profile', 'all')
             AND lower(COALESCE(l.after_value->>'name', '')) = lower(btrim(a.name))) THEN 'removed'
           WHEN EXISTS (SELECT 1 FROM public.admin_log l WHERE l.action = 'ingredient_proposal_rejected'
             AND COALESCE(l.after_value->>'sourceType', 'all') IN ('health_profile', 'all')
             AND lower(COALESCE(l.after_value->>'name', '')) = lower(btrim(a.name))) THEN 'rejected'
           ELSE 'pending' END AS status,
      (SELECT l.reason FROM public.admin_log l WHERE l.action IN ('ingredient_proposal_rejected', 'ingredient_proposal_removed')
        AND COALESCE(l.after_value->>'sourceType', 'all') IN ('health_profile', 'all')
        AND lower(COALESCE(l.after_value->>'name', '')) = lower(btrim(a.name))
        ORDER BY l.created_at DESC LIMIT 1) AS "reviewNote",
      a.allergy_id AS "createdAt"
    FROM public.allergy a JOIN public.profile p ON p.profile_id = a.profile_id
    WHERE p.account_id = $1
    ORDER BY a.allergy_id DESC LIMIT 100
  `, [accountId]);
  const { rows: rejectedRows } = await pool.query(`
    SELECT ('rejected-' || n.notification_id::text) AS id, n.metadata->>'name' AS name,
      'rejected'::text AS status, n.metadata->>'note' AS "reviewNote", n.created_at AS "createdAt"
    FROM public.notification n
    WHERE n.account_id = $1
      AND n.type::text = 'post_rejected'
      AND n.metadata->>'sourceType' = 'health_profile'
      AND n.metadata->>'name' IS NOT NULL
    ORDER BY n.notification_id DESC
    LIMIT 100
  `, [accountId]);
  return [...rows, ...rejectedRows];
}

async function listPending() {
  const { rows } = await pool.query(`
    WITH pending_sources AS (
      SELECT a.name, p.account_id, ac.full_name AS member_name, NULL::text AS recipe_id, NULL::text AS recipe_title, 'health_profile'::text AS source_type
      FROM public.allergy a JOIN public.profile p ON p.profile_id = a.profile_id JOIN public.account ac ON ac.account_id = p.account_id
      UNION ALL
      SELECT pi.name, r.author_id, ac.full_name, r.recipe_id::text, r.title, 'recipe'::text
      FROM public.recipe_proposed_ingredient pi JOIN public.recipe r ON r.recipe_id = pi.recipe_id
      JOIN public.account ac ON ac.account_id = r.author_id WHERE r.status = 'pending'
    )
    SELECT min(s.name) AS name, s.source_type AS "sourceType",
      count(DISTINCT s.account_id) FILTER (WHERE s.source_type = 'health_profile')::int AS "memberCount",
      string_agg(DISTINCT s.member_name, ', ' ORDER BY s.member_name) FILTER (WHERE s.source_type = 'health_profile') AS "memberNames",
      json_agg(DISTINCT jsonb_build_object('type', s.source_type, 'memberName', s.member_name,
        'recipeId', s.recipe_id, 'recipeTitle', s.recipe_title)) AS sources
    FROM pending_sources s
    WHERE NOT EXISTS (SELECT 1 FROM public.ingredient i WHERE lower(btrim(i.name)) = lower(btrim(s.name)))
      AND NOT EXISTS (SELECT 1 FROM public.admin_log l WHERE l.action IN ('ingredient_proposal_rejected', 'ingredient_proposal_removed')
        AND COALESCE(l.after_value->>'sourceType', 'all') IN (s.source_type, 'all')
        AND lower(COALESCE(l.after_value->>'name', '')) = lower(btrim(s.name)))
    GROUP BY s.source_type, lower(btrim(s.name))
    ORDER BY CASE WHEN s.source_type = 'health_profile' THEN 0 ELSE 1 END, lower(btrim(min(s.name)))
  `);
  return rows.map((row) => ({ ...row, name: formatIngredientName(row.name) }));
}

// Duy's Code: Đọc danh sách Banned Keyword từ bảng hiện có; lấy category an toàn nếu schema đang có thuộc tính đó.
async function listBannedKeywords() {
  const { rows } = await pool.query(`
    SELECT bk.keyword_id::text AS id, bk.keyword, bk.normalized_keyword AS "normalizedKeyword",
      to_jsonb(bk)->>'category' AS category
    FROM public.banned_keyword bk
    ORDER BY category NULLS LAST, bk.normalized_keyword, bk.keyword_id
  `);
  return rows;
}

// Duy's Code: Phân trang lịch sử duyệt từ admin_log, không tạo bảng lưu lịch sử riêng.
async function listHistory(page = 1, pageSize = 20) {
  const countResult = await pool.query(`
    SELECT count(*)::int AS total
    FROM public.admin_log l
    WHERE l.target_type = 'ingredient'
      AND l.action IN ('ingredient_proposal_approved', 'ingredient_proposal_rejected', 'ingredient_proposal_removed')
  `);
  const totalItems = countResult.rows[0].total;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const { rows } = await pool.query(`
    SELECT l.admin_log_id::text AS id, l.action, l.reason,
      l.after_value->>'name' AS name,
      COALESCE(l.after_value->>'status', CASE
        WHEN l.action = 'ingredient_proposal_approved' THEN 'approved'
        WHEN l.action = 'ingredient_proposal_rejected' THEN 'rejected'
        ELSE 'removed' END) AS status,
      COALESCE(l.after_value->>'sourceType', 'unknown') AS "sourceType",
      l.created_at AS "createdAt", a.full_name AS "adminName", a.email AS "adminEmail"
    FROM public.admin_log l
    JOIN public.account a ON a.account_id = l.admin_id
    WHERE l.target_type = 'ingredient'
      AND l.action IN ('ingredient_proposal_approved', 'ingredient_proposal_rejected', 'ingredient_proposal_removed')
    ORDER BY l.created_at DESC, l.admin_log_id DESC
    LIMIT $1 OFFSET $2
  `, [pageSize, (currentPage - 1) * pageSize]);
  return { items: rows, page: currentPage, pageSize, totalItems, totalPages };
}

async function decide(rawName, sourceType, adminId, action, note = '', classification = {}, ipAddress = null) {
  const name = cleanName(rawName);
  if (!['health_profile', 'recipe'].includes(sourceType)) throw new IngredientProposalError(400, 'Nguồn đề xuất không hợp lệ.');
  const allowedActions = ['approve', 'reject'];
  if (!allowedActions.includes(action)) throw new IngredientProposalError(400, 'Quyết định không hợp lệ cho nguồn này.');
  if (action === 'reject' && !note.trim()) throw new IngredientProposalError(400, 'Cần nhập lý do từ chối.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext(lower($1::text)))', [name]);
    const pending = await client.query(`
      SELECT 1 FROM (
        SELECT a.name, 'health_profile'::text AS source_type FROM public.allergy a
        UNION ALL
        SELECT pi.name, 'recipe'::text FROM public.recipe_proposed_ingredient pi
          JOIN public.recipe r ON r.recipe_id = pi.recipe_id WHERE r.status = 'pending'
      ) requests
      WHERE requests.source_type = $2 AND lower(btrim(requests.name)) = lower($1::varchar(120))
        AND NOT EXISTS (SELECT 1 FROM public.ingredient i WHERE lower(btrim(i.name)) = lower($1::varchar(120)))
        AND NOT EXISTS (SELECT 1 FROM public.admin_log l WHERE l.action IN ('ingredient_proposal_rejected', 'ingredient_proposal_removed')
          AND COALESCE(l.after_value->>'sourceType', 'all') IN ($2, 'all')
          AND lower(COALESCE(l.after_value->>'name', '')) = lower($1::varchar(120)))
      LIMIT 1
    `, [name, sourceType]);
    if (!pending.rowCount) throw new IngredientProposalError(409, 'Đề xuất này không còn chờ xử lý.');
    if (action === 'approve') {
      const known = await client.query('SELECT 1 FROM public.ingredient WHERE lower(btrim(name)) = lower($1::varchar(120)) LIMIT 1', [name]);
      if (!known.rowCount) await client.query(`
        INSERT INTO public.ingredient (name, is_animal_derived, is_ngu_vi_tan, is_common_allergen)
        VALUES ($1, $2, $3, $4)
      `, [name, Boolean(classification.isAnimalDerived), Boolean(classification.isNguViTan), Boolean(classification.isCommonAllergen)]);
      await client.query(`
        INSERT INTO public.recipe_ingredient (recipe_id, ingredient_id, amount, unit)
        SELECT pi.recipe_id, i.ingredient_id, pi.amount, pi.unit
        FROM public.recipe_proposed_ingredient pi JOIN public.ingredient i ON lower(btrim(i.name)) = lower($1::varchar(120))
        JOIN public.recipe r ON r.recipe_id = pi.recipe_id AND r.status = 'pending'
        WHERE lower(btrim(pi.name)) = lower($1::varchar(120))
        ON CONFLICT (recipe_id, ingredient_id) DO NOTHING
      `, [name]);
    }
    if (action === 'approve') await client.query(`DELETE FROM public.recipe_proposed_ingredient pi USING public.recipe r
      WHERE r.recipe_id = pi.recipe_id AND r.status = 'pending' AND lower(btrim(pi.name)) = lower($1::varchar(120))`, [name]);
    let rejectedAccounts = [];
    if (action === 'reject' && sourceType === 'health_profile') {
      const { rows } = await client.query(`
        DELETE FROM public.allergy a USING public.profile p
        WHERE a.profile_id = p.profile_id AND lower(btrim(a.name)) = lower($1::varchar(120))
        RETURNING p.account_id::text AS "accountId"
      `, [name]);
      rejectedAccounts = [...new Set(rows.map((row) => row.accountId))];
    }
    const status = action === 'approve' ? 'approved' : 'rejected';
    const logAction = `ingredient_proposal_${status}`;
    await client.query(`
      INSERT INTO public.admin_log (admin_id, action, target_type, reason, after_value, ip_address)
      VALUES ($1, $2, 'ingredient', $3, $4::jsonb, $5)
    `, [adminId, logAction, note || null, JSON.stringify({ name, status, sourceType }), ipAddress]);
    if (action === 'reject' && sourceType === 'health_profile') {
      for (const accountId of rejectedAccounts) {
        await client.query(`
          INSERT INTO public.notification (account_id, type, title, content, metadata)
          VALUES ($1, 'post_rejected'::notification_type_enum, $2, $3, $4::jsonb)
        `, [
          accountId,
          'Đề xuất nguyên liệu bị từ chối',
          `Đề xuất “${name}” bị từ chối: ${note}. Nguyên liệu này đã được gỡ khỏi danh sách dị ứng/thực phẩm cần kiêng.`,
          JSON.stringify({ href: '/profile', name, note, sourceType }),
        ]);
      }
    }
    await client.query('COMMIT');
    return { name, status };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* preserve original error */ }
    throw error;
  } finally { client.release(); }
}

module.exports = { IngredientProposalError, submit, listMine, listPending, listBannedKeywords, listHistory, decide };
