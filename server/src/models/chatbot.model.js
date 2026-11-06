const pool = require('../config/db');

const MEMBER_LIMIT = 20;
const SIMPLE_MEMBER_LIMIT = 50;
// Khoi's code (05/11/2026): khách đếm ở server — 5 lượt/thiết bị và 20 lượt/IP mỗi ngày.
const GUEST_DEVICE_LIMIT = 5;
const GUEST_IP_LIMIT = 20;

class ChatbotStoreError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
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
    try { await client.query('ROLLBACK'); } catch { /* keep original error */ }
    throw error;
  } finally {
    client.release();
  }
}

function quotaView(used, resetAt) {
  const count = Number(used);
  return { used: count, limit: MEMBER_LIMIT, remaining: Math.max(0, MEMBER_LIMIT - count), resetAt };
}

function simpleQuotaView(used, resetAt) {
  const count = Number(used);
  return { used: count, limit: SIMPLE_MEMBER_LIMIT, remaining: Math.max(0, SIMPLE_MEMBER_LIMIT - count), resetAt };
}

// Tùng: admission v3 khóa theo tài khoản và deadline để trừ lượt đúng ngày.
// Khoi's code (05/11/2026): tổng quát hoá cho mọi subject ('account' | 'device'), giữ nguyên advisory lock,
// statement_timeout, deadline và vòng lặp sang ngày; limit do nơi gọi quyết định.
// Legacy writers must be drained before rollout; this lock cannot fence old code.
async function admitTurn({ subjectType, subjectKey, limit }, { deadlineAt, signal } = {}) {
  const key = subjectKey === undefined || subjectKey === null ? '' : String(subjectKey);
  if (!['account', 'device'].includes(subjectType) || !key.trim() || !Number.isInteger(limit) || limit <= 0) {
    throw new ChatbotStoreError('INVALID_INPUT');
  }
  const remaining = () => {
    if (signal?.aborted) throw new ChatbotStoreError('DEADLINE_EXCEEDED');
    const ms = Math.floor(deadlineAt - Date.now());
    if (!Number.isFinite(ms) || ms <= 0) throw new ChatbotStoreError('DEADLINE_EXCEEDED');
    return ms;
  };
  remaining();
  const client = await pool.connect();
  let begun = false;
  let committing = false;
  try {
    remaining();
    await client.query('BEGIN');
    begun = true;
    const boundedQuery = async (sql, params = []) => {
      const timeout = `${remaining()}ms`;
      await client.query("SELECT set_config('statement_timeout', $1, true), set_config('lock_timeout', $1, true)", [timeout]);
      remaining();
      return client.query(sql, params);
    };
    await boundedQuery('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`chatbot-admission:${subjectType}:${key}`]);
    for (;;) {
      const { rows: [clock] } = await boundedQuery(`SELECT
        (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS day`);
      await boundedQuery(`INSERT INTO public.daily_quota (subject_type, subject_key, quota_date)
        VALUES ($1, $2, $3::date) ON CONFLICT DO NOTHING`, [subjectType, key, clock.day]);
      await boundedQuery(`SELECT 1 FROM public.daily_quota
        WHERE subject_type = $1 AND subject_key = $2 AND quota_date = $3::date FOR UPDATE`,
      [subjectType, key, clock.day]);
      const { rows: [row] } = await boundedQuery(`WITH admission_clock AS MATERIALIZED (
        SELECT clock_timestamp() AS admitted_at
      )
      UPDATE public.daily_quota q SET chat_turns = q.chat_turns + 1, updated_at = admission_clock.admitted_at
      FROM admission_clock
      WHERE q.subject_type = $1 AND q.subject_key = $2 AND q.quota_date = $3::date
        AND q.quota_date = (admission_clock.admitted_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
        AND q.chat_turns < $4
      RETURNING q.chat_turns AS used, admission_clock.admitted_at AS "admittedAt"`,
      [subjectType, key, clock.day, limit]);
      if (row) {
        remaining();
        committing = true;
        await boundedQuery('COMMIT');
        begun = false;
        const used = Number(row.used);
        return { used, limit, remaining: Math.max(0, limit - used),
          resetAt: new Date(`${clock.day}T17:00:00.000Z`), day: clock.day, admittedAt: row.admittedAt };
      }
      const { rows: [current] } = await boundedQuery(`SELECT
        (clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS day`);
      if (current.day === clock.day) throw new ChatbotStoreError('QUOTA_EXCEEDED');
    }
  } catch (error) {
    if (begun && !committing) {
      try { await client.query('ROLLBACK'); } catch { /* preserve the original failure */ }
    }
    throw error;
  } finally {
    client.release(committing && begun);
  }
}

// Khoi's code (05/11/2026): hoàn lượt đã trừ khi lượt lỗi trước khi gửi câu trả lời cho người dùng.
async function releaseTurn({ subjectType, subjectKey, day }) {
  const key = subjectKey === undefined || subjectKey === null ? '' : String(subjectKey);
  if (!['account', 'device'].includes(subjectType) || !key.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(String(day ?? ''))) {
    throw new ChatbotStoreError('INVALID_INPUT');
  }
  await pool.query(`UPDATE public.daily_quota
    SET chat_turns = GREATEST(chat_turns - 1, 0), updated_at = clock_timestamp()
    WHERE subject_type = $1 AND subject_key = $2 AND quota_date = $3::date`,
  [subjectType, key, day]);
}

// Khoi's code (05/11/2026): đọc quota hiện tại của một subject (account hoặc device) cho route khách.
async function turnQuota({ subjectType, subjectKey, limit }) {
  const key = subjectKey === undefined || subjectKey === null ? '' : String(subjectKey);
  if (!['account', 'device'].includes(subjectType) || !key.trim() || !Number.isInteger(limit) || limit <= 0) {
    throw new ChatbotStoreError('INVALID_INPUT');
  }
  const { rows: [row] } = await pool.query(`
    WITH local_day AS (
      SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS quota_date
    )
    SELECT COALESCE(q.chat_turns, 0) AS used, local_day.quota_date::text AS day,
      ((local_day.quota_date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AS "resetAt"
    FROM local_day LEFT JOIN public.daily_quota q
      ON q.subject_type = $1 AND q.subject_key = $2 AND q.quota_date = local_day.quota_date
  `, [subjectType, key]);
  const used = Number(row.used);
  return { used, limit, remaining: Math.max(0, limit - used), resetAt: row.resetAt, day: row.day };
}

async function getQuota(accountId) {
  const { rows: [row] } = await pool.query(`
    WITH local_day AS (
      SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS quota_date
    )
    SELECT COALESCE(q.chat_turns, 0) AS used, local_day.quota_date::text AS day,
      ((local_day.quota_date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AS "resetAt"
    FROM local_day LEFT JOIN public.daily_quota q
      ON q.subject_type = 'account' AND q.subject_key = $1 AND q.quota_date = local_day.quota_date
  `, [String(accountId)]);
  return { ...quotaView(row.used, row.resetAt), day: row.day };
}

async function getSimpleQuota(accountId) {
  const legacy = await getQuota(accountId);
  return { ...simpleQuotaView(legacy.used, legacy.resetAt), day: legacy.day };
}

async function deleteExpiredRequests() {
  // An abandoned reservation ends when its lease expires; live leases are never removed.
  await pool.query(`
    DELETE FROM public.chatbot_request
    WHERE (state IN ('success', 'failed') AND updated_at <= now() - interval '24 hours')
       OR (state = 'pending' AND lease_expires_at <= now() - interval '24 hours')
  `);
  const { rows: [schema] } = await pool.query(`SELECT
    to_regclass('public.chatbot_discovery_operation') IS NOT NULL
    AND to_regclass('public.chatbot_discovery_flow') IS NOT NULL AS available`);
  if (!schema.available) return;
  await transaction(async (client) => {
    // A pending worker may commit only before commit_by and only with its fence.
    await client.query(`UPDATE public.chatbot_discovery_operation
      SET state = 'failed', terminal_at = CASE WHEN state = 'prepared' THEN accept_until ELSE commit_by END,
        lease_id = NULL, lease_expires_at = NULL, fence_version = fence_version + 1, updated_at = clock_timestamp()
      WHERE flow_id IS NULL AND ((state = 'prepared' AND accept_until <= clock_timestamp())
        OR (state = 'pending' AND commit_by <= clock_timestamp()))`);
    // Lock/update flows before their choice operations, matching finishChoice order.
    await client.query(`UPDATE public.chatbot_discovery_flow
      SET stage = 'expired', charge_intent = false, terminal_at = choice_deadline, updated_at = clock_timestamp()
      WHERE stage = 'awaiting_choice' AND choice_deadline <= clock_timestamp()`);
    await client.query(`UPDATE public.chatbot_discovery_flow f
      SET stage = 'failed', charge_intent = false, terminal_at = o.commit_by, updated_at = clock_timestamp()
      FROM public.chatbot_discovery_operation o WHERE f.subject_type = o.subject_type AND f.subject_key = o.subject_key
        AND f.flow_id = o.flow_id AND f.stage = 'search_pending' AND o.state = 'pending'
        AND o.commit_by <= clock_timestamp()`);
    await client.query(`UPDATE public.chatbot_discovery_operation o
      SET state = 'failed', terminal_at = CASE WHEN o.state = 'prepared' THEN o.accept_until ELSE o.commit_by END,
        lease_id = NULL, lease_expires_at = NULL, fence_version = fence_version + 1, updated_at = clock_timestamp()
      FROM public.chatbot_discovery_flow f WHERE f.subject_type = o.subject_type AND f.subject_key = o.subject_key
        AND f.flow_id = o.flow_id AND ((o.state = 'prepared' AND o.accept_until <= clock_timestamp())
          OR (o.state = 'pending' AND o.commit_by <= clock_timestamp() AND f.stage = 'failed'))`);
    // Lock terminal parent flows before deleting their child operations. Choice
    // processing also locks flow before operation; keeping that order avoids a cycle.
    await client.query(`SELECT flow_id FROM public.chatbot_discovery_flow
      WHERE terminal_at IS NOT NULL AND terminal_at <= clock_timestamp() - interval '24 hours'
      ORDER BY subject_type, subject_key, flow_id FOR UPDATE`);
    await client.query(`DELETE FROM public.chatbot_discovery_operation
      WHERE terminal_at IS NOT NULL AND terminal_at <= clock_timestamp() - interval '24 hours'`);
    await client.query(`DELETE FROM public.chatbot_discovery_flow f
      WHERE f.terminal_at IS NOT NULL AND f.terminal_at <= clock_timestamp() - interval '24 hours'
        AND NOT EXISTS (SELECT 1 FROM public.chatbot_discovery_operation o
          WHERE o.subject_type = f.subject_type AND o.subject_key = f.subject_key AND o.flow_id = f.flow_id)`);
  });
}

module.exports = { ChatbotStoreError, getQuota, getSimpleQuota, deleteExpiredRequests, admitTurn, releaseTurn, turnQuota,
  SIMPLE_MEMBER_LIMIT, GUEST_DEVICE_LIMIT, GUEST_IP_LIMIT };
