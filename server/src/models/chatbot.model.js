const { createHmac, randomUUID } = require('node:crypto');
const pool = require('../config/db');

const MEMBER_LIMIT = 20;
const LEASE_SECONDS = 120;

class ChatbotStoreError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function keyedHash(value) {
  const key = process.env.CHATBOT_REQUEST_HMAC_KEY?.trim();
  if (!key) throw new ChatbotStoreError('STORE_UNAVAILABLE');
  return createHmac('sha256', key).update(value).digest('hex');
}

function actorFor(account, deviceId) {
  return account
    ? { type: 'account', key: String(account.id) }
    : { type: 'device', key: keyedHash(deviceId) };
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

async function currentDay(client) {
  const { rows: [row] } = await client.query(`
    SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS day,
      (((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 1)::timestamp
        AT TIME ZONE 'Asia/Ho_Chi_Minh') AS "resetAt"
  `);
  return row;
}

function quotaView(used, resetAt) {
  const count = Number(used);
  return { used: count, limit: MEMBER_LIMIT, remaining: Math.max(0, MEMBER_LIMIT - count), resetAt };
}

async function getQuota(accountId) {
  const { rows: [row] } = await pool.query(`
    WITH local_day AS (
      SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS quota_date
    )
    SELECT COALESCE(q.chat_turns, 0) AS used,
      ((local_day.quota_date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AS "resetAt"
    FROM local_day LEFT JOIN public.daily_quota q
      ON q.subject_type = 'account' AND q.subject_key = $1 AND q.quota_date = local_day.quota_date
  `, [String(accountId)]);
  return quotaView(row.used, row.resetAt);
}

async function reserveRequest({ account, deviceId, operationId, payload }) {
  const actor = actorFor(account, deviceId);
  const payloadHash = keyedHash(JSON.stringify(payload));
  const leaseId = randomUUID();
  return transaction(async (client) => {
    let day = null;
    let used = 0;
    if (account) {
      day = await currentDay(client);
      await client.query(`
        INSERT INTO public.daily_quota (subject_type, subject_key, quota_date)
        VALUES ('account', $1, $2::date) ON CONFLICT DO NOTHING
      `, [actor.key, day.day]);
      const { rows: [row] } = await client.query(`
        SELECT chat_turns AS used FROM public.daily_quota
        WHERE subject_type = 'account' AND subject_key = $1 AND quota_date = $2::date
        FOR UPDATE
      `, [actor.key, day.day]);
      used = Number(row.used);
    }

    const { rows: [existing] } = await client.query(`
      SELECT payload_hash AS "payloadHash", state, lease_expires_at > now() AS active
      FROM public.chatbot_request
      WHERE subject_type = $1 AND subject_key = $2 AND operation_id = $3::uuid
    `, [actor.type, actor.key, operationId]);
    if (existing) {
      if (existing.payloadHash !== payloadHash) throw new ChatbotStoreError('IDEMPOTENCY_CONFLICT');
      throw new ChatbotStoreError(existing.state === 'pending' && existing.active ? 'IN_PROGRESS' : 'RESULT_UNAVAILABLE');
    }

    if (account) {
      await client.query(`
        UPDATE public.chatbot_request SET state = 'failed', updated_at = lease_expires_at
        WHERE subject_type = 'account' AND subject_key = $1 AND quota_date = $2::date
          AND state = 'pending' AND lease_expires_at <= now()
      `, [actor.key, day.day]);
      const { rows: [row] } = await client.query(`
        SELECT count(*)::int AS count FROM public.chatbot_request
        WHERE subject_type = 'account' AND subject_key = $1 AND quota_date = $2::date
          AND state = 'pending' AND lease_expires_at > now()
      `, [actor.key, day.day]);
      if (used + row.count >= MEMBER_LIMIT) throw new ChatbotStoreError('QUOTA_EXCEEDED');
    }

    const { rowCount } = await client.query(`
      INSERT INTO public.chatbot_request
        (subject_type, subject_key, operation_id, payload_hash, quota_date, state, lease_id, lease_expires_at)
      VALUES ($1, $2, $3::uuid, $4, $5::date, 'pending', $6::uuid,
        now() + ($7::int * interval '1 second'))
      ON CONFLICT DO NOTHING
    `, [actor.type, actor.key, operationId, payloadHash, day?.day ?? null, leaseId, LEASE_SECONDS]);
    if (!rowCount) {
      const { rows: [conflict] } = await client.query(`
        SELECT payload_hash AS "payloadHash", state, lease_expires_at > now() AS active
        FROM public.chatbot_request
        WHERE subject_type = $1 AND subject_key = $2 AND operation_id = $3::uuid
      `, [actor.type, actor.key, operationId]);
      if (conflict && conflict.payloadHash !== payloadHash) throw new ChatbotStoreError('IDEMPOTENCY_CONFLICT');
      throw new ChatbotStoreError(conflict?.state === 'pending' && conflict.active ? 'IN_PROGRESS' : 'RESULT_UNAVAILABLE');
    }
    return { actor, operationId, leaseId, quotaDate: day?.day ?? null };
  });
}

async function finishRequest(reservation, success) {
  return transaction(async (client) => {
    if (reservation.actor.type === 'account') {
      await client.query(`
        SELECT 1 FROM public.daily_quota
        WHERE subject_type = 'account' AND subject_key = $1 AND quota_date = $2::date
        FOR UPDATE
      `, [reservation.actor.key, reservation.quotaDate]);
    }
    const { rowCount } = await client.query(`
      UPDATE public.chatbot_request SET state = $1, updated_at = now()
      WHERE subject_type = $2 AND subject_key = $3 AND operation_id = $4::uuid
        AND state = 'pending' AND lease_id = $5::uuid AND lease_expires_at > now()
    `, [success ? 'success' : 'failed', reservation.actor.type, reservation.actor.key,
      reservation.operationId, reservation.leaseId]);
    if (!rowCount) throw new ChatbotStoreError('RESULT_UNAVAILABLE');
    if (success && reservation.actor.type === 'account') {
      const result = await client.query(`
        UPDATE public.daily_quota SET chat_turns = chat_turns + 1, updated_at = now()
        WHERE subject_type = 'account' AND subject_key = $1 AND quota_date = $2::date
          AND chat_turns < $3
      `, [reservation.actor.key, reservation.quotaDate, MEMBER_LIMIT]);
      if (!result.rowCount) throw new ChatbotStoreError('QUOTA_EXCEEDED');
    }
  });
}

async function getRequestState({ account, deviceId, operationId }) {
  const actor = actorFor(account, deviceId);
  const { rows: [snapshot] } = await pool.query(`
    SELECT state, quota_date::text AS "quotaDate", lease_expires_at > now() AS active
    FROM public.chatbot_request
    WHERE subject_type = $1 AND subject_key = $2 AND operation_id = $3::uuid
  `, [actor.type, actor.key, operationId]);
  if (!snapshot) return 'unknown';
  if (snapshot.state !== 'pending' || snapshot.active) return snapshot.state;

  // Match finishRequest's lock order before concluding that an expired lease failed.
  return transaction(async (client) => {
    await client.query("SET LOCAL lock_timeout = '2s'");
    if (actor.type === 'account') {
      await client.query(`
        SELECT 1 FROM public.daily_quota
        WHERE subject_type = 'account' AND subject_key = $1 AND quota_date = $2::date
        FOR UPDATE
      `, [actor.key, snapshot.quotaDate]);
    }
    const { rows: [row] } = await client.query(`
      SELECT state, lease_expires_at > now() AS active FROM public.chatbot_request
      WHERE subject_type = $1 AND subject_key = $2 AND operation_id = $3::uuid
      FOR UPDATE
    `, [actor.type, actor.key, operationId]);
    if (!row) return 'unknown';
    return row.state === 'pending' && !row.active ? 'failed' : row.state;
  });
}

async function deleteExpiredRequests() {
  // An abandoned reservation ends when its lease expires; live leases are never removed.
  await pool.query(`
    DELETE FROM public.chatbot_request
    WHERE (state IN ('success', 'failed') AND updated_at <= now() - interval '24 hours')
       OR (state = 'pending' AND lease_expires_at <= now() - interval '24 hours')
  `);
}

module.exports = { ChatbotStoreError, getQuota, reserveRequest, finishRequest, getRequestState, deleteExpiredRequests };
