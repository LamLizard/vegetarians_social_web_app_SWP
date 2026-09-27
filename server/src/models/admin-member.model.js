const pool = require('../config/db');

async function findMembers({ showOnlyReported, keyword }) {
  const { rows } = await pool.query(
    `WITH member_rows AS (
       SELECT a.account_id AS id,
              a.full_name AS "fullName",
              a.email,
              a.status::text AS status,
              (
              SELECT count(*)
              FROM public.report r
              JOIN public.post p ON r.target_type::text = 'post' AND r.target_id = p.post_id
              WHERE p.account_id = a.account_id
            ) + (
              SELECT count(*)
              FROM public.report r
              JOIN public.comment c ON r.target_type::text = 'comment' AND r.target_id = c.comment_id
              WHERE c.author_id = a.account_id
            ) + (
              SELECT count(*)
              FROM public.report r
              JOIN public.recipe recipe ON r.target_type::text = 'recipe' AND r.target_id = recipe.recipe_id
              WHERE recipe.author_id = a.account_id
              ) AS "reportedCount",
              a.created_at AS "createdAt"
       FROM public.account a
       JOIN public.role role ON role.role_id = a.role_id
       WHERE role.name = 'member' AND a.status <> 'deleted'
     )
     SELECT *
     FROM member_rows
     WHERE (NOT $1::boolean OR "reportedCount" > 0)
       AND (
         $2::text = ''
         OR "fullName" ILIKE '%' || $2 || '%'
         OR email ILIKE '%' || $2 || '%'
       )
     ORDER BY "createdAt" DESC`,
    [showOnlyReported, keyword],
  );

  return rows;
}

async function updateMemberStatus({ adminId, accountId, status }) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const currentResult = await client.query(
      `SELECT a.status::text AS status
       FROM public.account a
       JOIN public.role role ON role.role_id = a.role_id
       WHERE a.account_id = $1 AND role.name = 'member' AND a.status <> 'deleted'
       FOR UPDATE OF a`,
      [accountId],
    );

    if (!currentResult.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }

    const previousStatus = currentResult.rows[0].status;
    if (status === 'locked' && previousStatus === 'locked') {
      await client.query('COMMIT');
      return { account_id: accountId, status: previousStatus };
    }
    if (status === 'active' && previousStatus !== 'locked') {
      await client.query('ROLLBACK');
      return { account_id: accountId, status: previousStatus };
    }

    let nextStatus = status;
    if (status === 'active') {
      const priorLock = await client.query(
        `SELECT before_value->>'status' AS status
         FROM public.admin_log
         WHERE target_type::text = 'account' AND target_id = $1 AND action = 'account_locked'
         ORDER BY created_at DESC
         LIMIT 1`,
        [accountId],
      );
      if (priorLock.rows[0]?.status === 'reported') nextStatus = 'reported';
    }

    const { rows } = await client.query(
      `UPDATE public.account
       SET status = $2, updated_at = NOW()
       WHERE account_id = $1
       RETURNING account_id, status::text AS status`,
      [accountId, nextStatus],
    );
    const action = status === 'locked' ? 'account_locked' : 'account_unlocked';
    await client.query(
      `INSERT INTO public.admin_log
         (admin_id, action, target_type, target_id, before_value, after_value)
       VALUES ($1, $2, 'account', $3, jsonb_build_object('status', $4), jsonb_build_object('status', $5))`,
      [adminId, action, accountId, previousStatus, nextStatus],
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { findMembers, updateMemberStatus };