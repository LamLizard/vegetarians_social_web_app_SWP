const pool = require('../config/db');
const { formatIngredientName } = require('../utils/ingredientName');

// Duy's Code : Dùng allergy hiện có làm nguồn đề cử, không thay đổi schema DB.
class IngredientProposalError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'IngredientProposalError';
    this.status = status;
  }
}

async function submit(accountId, rawName) {
  if (typeof rawName !== 'string') throw new IngredientProposalError(400, 'Tên nguyên liệu không hợp lệ.');
  const name = formatIngredientName(rawName);
  if (!name || [...name].length > 120) {
    throw new IngredientProposalError(400, 'Tên nguyên liệu phải có từ 1 đến 120 ký tự.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const known = await client.query(
      'SELECT 1 FROM public.ingredient WHERE lower(btrim(name)) = lower($1::varchar(120)) LIMIT 1',
      [name],
    );
    if (known.rowCount) throw new IngredientProposalError(409, 'Nguyên liệu này đã có trong kho. Hãy chọn nguyên liệu trong kết quả.');
    const rejected = await client.query(`
      SELECT 1 FROM public.admin_log
      WHERE action = 'ingredient_proposal_rejected'
        AND lower(COALESCE(after_value->>'name', '')) = lower($1::varchar(120))
      LIMIT 1
    `, [name]);
    if (rejected.rowCount) throw new IngredientProposalError(409, 'Đề xuất nguyên liệu này đã bị Admin từ chối.');

    // Duy's Code : Gắn đề cử với allergy của chính thành viên qua profile có sẵn.
    await client.query(`
      INSERT INTO public.profile (account_id)
      VALUES ($1)
      ON CONFLICT (account_id) DO NOTHING
    `, [accountId]);
    await client.query(`
      INSERT INTO public.allergy (profile_id, name)
      SELECT p.profile_id, $2
      FROM public.profile p
      WHERE p.account_id = $1
        AND NOT EXISTS (
          SELECT 1 FROM public.allergy a
          WHERE a.profile_id = p.profile_id AND lower(btrim(a.name)) = lower($2::varchar(120))
        )
    `, [accountId, name]);
    await client.query('COMMIT');
    return { name, status: 'pending' };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* preserve the original failure */ }
    throw error;
  } finally {
    client.release();
  }
}

// Duy's Code : Gom dị ứng do thành viên khai báo nhưng chưa có trong ingredient thành hàng đợi Admin.
async function listPending() {
  const { rows } = await pool.query(`
    SELECT min(a.name) AS name,
           count(DISTINCT p.account_id)::int AS "memberCount",
           string_agg(DISTINCT ac.full_name, ', ' ORDER BY ac.full_name) AS "memberNames"
    FROM public.allergy a
    JOIN public.profile p ON p.profile_id = a.profile_id
    JOIN public.account ac ON ac.account_id = p.account_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.ingredient i
      WHERE lower(btrim(i.name)) = lower(btrim(a.name))
    )
      AND NOT EXISTS (
        SELECT 1 FROM public.admin_log l
        WHERE l.action = 'ingredient_proposal_rejected'
          AND lower(COALESCE(l.after_value->>'name', '')) = lower(btrim(a.name))
      )
    GROUP BY lower(btrim(a.name))
    ORDER BY lower(btrim(min(a.name)))
  `);
  return rows.map((row) => ({ ...row, name: formatIngredientName(row.name) }));
}

// Duy's Code : Duyệt sẽ thêm đúng một hàng ingredient; từ chối dùng admin_log hiện có.
async function decide(rawName, adminId, action, note = '', classification = {}, ipAddress = null) {
  const name = formatIngredientName(rawName);
  if (!name || [...name].length > 120) throw new IngredientProposalError(400, 'Tên nguyên liệu không hợp lệ.');
  if (!['approve', 'reject'].includes(action)) throw new IngredientProposalError(400, 'Quyết định không hợp lệ.');
  if (action === 'reject' && !note.trim()) throw new IngredientProposalError(400, 'Cần nhập lý do từ chối.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext(lower($1::text)))', [name]);
    const proposal = await client.query(`
      SELECT 1 FROM public.allergy a
      WHERE lower(btrim(a.name)) = lower($1::varchar(120))
        AND NOT EXISTS (SELECT 1 FROM public.ingredient i WHERE lower(btrim(i.name)) = lower($1::varchar(120)))
      LIMIT 1
    `, [name]);
    if (!proposal.rowCount) throw new IngredientProposalError(409, 'Đề xuất này không còn chờ xử lý.');

    if (action === 'approve') {
      await client.query(`
        INSERT INTO public.ingredient (name, is_animal_derived, is_ngu_vi_tan, is_common_allergen)
        VALUES ($1, $2, $3, $4)
      `, [name, Boolean(classification.isAnimalDerived), Boolean(classification.isNguViTan), Boolean(classification.isCommonAllergen)]);
    }
    const status = action === 'approve' ? 'approved' : 'rejected';
    await client.query(`
      INSERT INTO public.admin_log (admin_id, action, target_type, reason, after_value, ip_address)
      VALUES ($1, $2, 'ingredient', $3, $4::jsonb, $5)
    `, [adminId, `ingredient_proposal_${status}`, note || null, JSON.stringify({ name, status }), ipAddress]);
    await client.query('COMMIT');
    return { name, status };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* preserve the original failure */ }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { IngredientProposalError, submit, listPending, decide };
