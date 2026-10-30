const { createHmac, randomUUID } = require('node:crypto');
const pool = require('../config/db');
const { signReceipt, verifyReceipt, signFlow, verifyFlow } = require('../utils/chatDiscoveryToken');

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
      // V1 and v2 reserve against the same locked quota row when v2 is provisioned.
      const { rows: [schema] } = await client.query(`SELECT
        to_regclass('public.chatbot_discovery_operation') IS NOT NULL
        AND to_regclass('public.chatbot_discovery_flow') IS NOT NULL AS available`);
      let v2Reserved = 0;
      if (schema.available) {
        await expireV2Flows(client, actor, day.day);
        const { rows: [v2] } = await client.query(`
          SELECT
            (SELECT count(*) FROM public.chatbot_discovery_operation o
             WHERE o.subject_type = 'account' AND o.subject_key = $1 AND o.quota_date = $2::date
               AND o.flow_id IS NULL AND ((o.state = 'prepared' AND o.accept_until > now())
                 OR (o.state = 'pending' AND o.commit_by > now()))) +
            (SELECT count(*) FROM public.chatbot_discovery_flow f
             WHERE f.subject_type = 'account' AND f.subject_key = $1 AND f.quota_date = $2::date
               AND f.stage IN ('awaiting_choice', 'search_pending', 'uncertain')) AS reserved
        `, [actor.key, day.day]);
        v2Reserved = Number(v2.reserved);
      }
      if (used + Number(row.count) + v2Reserved >= MEMBER_LIMIT) throw new ChatbotStoreError('QUOTA_EXCEEDED');
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

// V2 records are created before a receipt is returned. Cleanup must be the only
// normal deletion path: it deletes terminal records only after 24 hours.
const V2_ACCEPT_SECONDS = 120;
const V2_COMMIT_SECONDS = 300;

async function lockQuotaDay(client, actor, quotaDate) {
  if (actor.type !== 'account') return;
  await client.query(`INSERT INTO public.daily_quota (subject_type, subject_key, quota_date)
    VALUES ('account', $1, $2::date) ON CONFLICT DO NOTHING`, [actor.key, quotaDate]);
  await client.query(`SELECT 1 FROM public.daily_quota
    WHERE subject_type = 'account' AND subject_key = $1 AND quota_date = $2::date FOR UPDATE`,
  [actor.key, quotaDate]);
}

async function expireV2ForActor(client, actor, quotaDate) {
  await client.query(`
    UPDATE public.chatbot_discovery_operation
    SET state = 'failed', terminal_at = CASE WHEN state = 'prepared' THEN accept_until ELSE commit_by END,
      lease_id = NULL, lease_expires_at = NULL, fence_version = fence_version + 1, updated_at = clock_timestamp()
    WHERE subject_type = $1 AND subject_key = $2 AND flow_id IS NULL
      AND ($3::date IS NULL OR quota_date = $3::date)
      AND ((state = 'prepared' AND accept_until <= clock_timestamp()) OR (state = 'pending' AND commit_by <= clock_timestamp()))
  `, [actor.type, actor.key, quotaDate]);
}

async function expireV2Flows(client, actor, quotaDate) {
  await client.query(`UPDATE public.chatbot_discovery_flow SET stage = 'expired', charge_intent = false,
    terminal_at = choice_deadline, updated_at = clock_timestamp()
    WHERE subject_type = $1 AND subject_key = $2 AND quota_date = $3::date
      AND stage = 'awaiting_choice' AND choice_deadline <= clock_timestamp()`, [actor.type, actor.key, quotaDate]);
  await client.query(`UPDATE public.chatbot_discovery_flow f SET stage = 'failed', charge_intent = false,
    terminal_at = o.commit_by, updated_at = clock_timestamp() FROM public.chatbot_discovery_operation o
    WHERE f.subject_type = $1 AND f.subject_key = $2 AND f.quota_date = $3::date
      AND o.subject_type = f.subject_type AND o.subject_key = f.subject_key AND o.flow_id = f.flow_id
      AND f.stage = 'search_pending' AND o.state = 'pending' AND o.commit_by <= clock_timestamp()`,
  [actor.type, actor.key, quotaDate]);
  await client.query(`UPDATE public.chatbot_discovery_operation o SET state = 'failed',
    terminal_at = CASE WHEN o.state = 'prepared' THEN o.accept_until ELSE o.commit_by END,
    lease_id = NULL, lease_expires_at = NULL, fence_version = fence_version + 1, updated_at = clock_timestamp()
    FROM public.chatbot_discovery_flow f WHERE f.subject_type = $1 AND f.subject_key = $2 AND f.quota_date = $3::date
      AND o.subject_type = f.subject_type AND o.subject_key = f.subject_key AND o.flow_id = f.flow_id
      AND ((o.state = 'prepared' AND o.accept_until <= clock_timestamp())
        OR (o.state = 'pending' AND o.commit_by <= clock_timestamp() AND f.stage = 'failed'))`,
  [actor.type, actor.key, quotaDate]);
}

async function prepareV2({ account, deviceId, operationId, payloadHash }) {
  if (!/^[0-9a-f]{64}$/.test(payloadHash)) throw new ChatbotStoreError('INVALID_INPUT');
  keyedHash('discovery-key-check'); // Verify signing configuration before reserving quota.
  const actor = actorFor(account, deviceId);
  const nonce = randomUUID();
  const row = await transaction(async (client) => {
    const day = account ? await currentDay(client) : null;
    if (day) await lockQuotaDay(client, actor, day.day);
    await expireV2ForActor(client, actor, day?.day ?? null);
    if (day) await expireV2Flows(client, actor, day.day);
    const params = [actor.type, actor.key, operationId];
    const { rows: [existing] } = await client.query(`
      SELECT payload_hash AS "payloadHash", receipt_nonce::text AS nonce,
        floor(extract(epoch FROM accept_until) * 1000)::bigint::text AS "acceptUntil",
        floor(extract(epoch FROM commit_by) * 1000)::bigint::text AS "commitBy", state
      FROM public.chatbot_discovery_operation
      WHERE subject_type = $1 AND subject_key = $2 AND operation_id = $3::uuid FOR UPDATE
    `, params);
    if (existing) {
      if (existing.payloadHash !== payloadHash) throw new ChatbotStoreError('IDEMPOTENCY_CONFLICT');
      return existing;
    }
    if (account) {
      const { rows: [count] } = await client.query(`
        SELECT q.chat_turns AS used,
          (SELECT count(*) FROM public.chatbot_request r
            WHERE r.subject_type = 'account' AND r.subject_key = $1 AND r.quota_date = $2::date
              AND r.state = 'pending' AND r.lease_expires_at > clock_timestamp()) +
          (SELECT count(*) FROM public.chatbot_discovery_operation o
            WHERE o.subject_type = 'account' AND o.subject_key = $1 AND o.quota_date = $2::date
              AND o.flow_id IS NULL AND o.state IN ('prepared', 'pending')) +
          (SELECT count(*) FROM public.chatbot_discovery_flow f
            WHERE f.subject_type = 'account' AND f.subject_key = $1 AND f.quota_date = $2::date
              AND f.stage IN ('awaiting_choice', 'search_pending', 'uncertain')) AS reserved
        FROM public.daily_quota q
        WHERE q.subject_type = 'account' AND q.subject_key = $1 AND q.quota_date = $2::date
      `, [actor.key, day.day]);
      if (Number(count.used) + Number(count.reserved) >= MEMBER_LIMIT) throw new ChatbotStoreError('QUOTA_EXCEEDED');
    }
    const { rows: [created] } = await client.query(`
      INSERT INTO public.chatbot_discovery_operation
        (subject_type, subject_key, operation_id, payload_hash, quota_date, receipt_nonce,
         state, accept_until, commit_by)
      VALUES ($1, $2, $3::uuid, $4, $5::date, $6::uuid, 'prepared',
        date_trunc('milliseconds', clock_timestamp() + ($7::int * interval '1 second')),
        date_trunc('milliseconds', clock_timestamp() + ($8::int * interval '1 second')))
      RETURNING payload_hash AS "payloadHash", receipt_nonce::text AS nonce,
        floor(extract(epoch FROM accept_until) * 1000)::bigint::text AS "acceptUntil",
        floor(extract(epoch FROM commit_by) * 1000)::bigint::text AS "commitBy", state
    `, [actor.type, actor.key, operationId, payloadHash, day?.day ?? null, nonce,
      V2_ACCEPT_SECONDS, V2_COMMIT_SECONDS]);
    return created;
  });
  const data = { operationId, nonce: row.nonce, payloadHash: row.payloadHash,
    acceptUntil: Number(row.acceptUntil), commitBy: Number(row.commitBy) };
  const state = ['prepared', 'pending'].includes(row.state) ? row.state : 'terminal';
  return { receipt: signReceipt(actor, data), state, acceptUntil: data.acceptUntil,
    commitBy: data.commitBy, serverTime: Date.now() };
}

function verifyV2Receipt(account, deviceId, operationId, receipt) {
  const actor = actorFor(account, deviceId);
  const payload = verifyReceipt(receipt, actor);
  if (!payload || payload.operationId !== operationId) throw new ChatbotStoreError('INVALID_INPUT');
  return { actor, payload };
}

async function claimV2({ account, deviceId, operationId, receipt, payloadHash }) {
  const { actor, payload } = verifyV2Receipt(account, deviceId, operationId, receipt);
  if (payload.payloadHash !== payloadHash) throw new ChatbotStoreError('IDEMPOTENCY_CONFLICT');
  const leaseId = randomUUID();
  return transaction(async (client) => {
    const { rows: [row] } = await client.query(`
      UPDATE public.chatbot_discovery_operation
      SET state = 'pending', lease_id = $5::uuid, lease_expires_at = commit_by,
        fence_version = fence_version + 1, updated_at = clock_timestamp()
      WHERE subject_type = $1 AND subject_key = $2 AND operation_id = $3::uuid
        AND receipt_nonce = $4::uuid AND payload_hash = $6 AND flow_id IS NULL
        AND state = 'prepared' AND accept_until > clock_timestamp() AND commit_by > clock_timestamp()
      RETURNING quota_date::text AS "quotaDate", fence_version::text AS fence
    `, [actor.type, actor.key, operationId, payload.nonce, leaseId, payloadHash]);
    if (!row) throw new ChatbotStoreError('IN_PROGRESS');
    return { actor, operationId, nonce: payload.nonce, leaseId, fence: row.fence, quotaDate: row.quotaDate };
  });
}

async function finishV2(reservation, outcome) {
  if (!['success', 'login_required', 'found', 'empty', 'failed', 'cancelled'].includes(outcome)) {
    throw new ChatbotStoreError('INVALID_INPUT');
  }
  const charged = ['success', 'login_required', 'found', 'cancelled'].includes(outcome);
  await transaction(async (client) => {
    const { actor } = reservation;
    if (actor.type === 'account') await lockQuotaDay(client, actor, reservation.quotaDate);
    const { rowCount } = await client.query(`
      UPDATE public.chatbot_discovery_operation SET state = $1, terminal_at = clock_timestamp(), updated_at = clock_timestamp(),
        lease_id = NULL, lease_expires_at = NULL
      WHERE subject_type = $2 AND subject_key = $3 AND operation_id = $4::uuid
        AND receipt_nonce = $5::uuid AND lease_id = $6::uuid AND fence_version = $7::bigint
        AND state = 'pending' AND commit_by > clock_timestamp() AND flow_id IS NULL
    `, [outcome, actor.type, actor.key, reservation.operationId, reservation.nonce,
      reservation.leaseId, reservation.fence]);
    if (!rowCount) throw new ChatbotStoreError('RESULT_UNAVAILABLE');
    if (charged && actor.type === 'account') {
      const updated = await client.query(`UPDATE public.daily_quota SET chat_turns = chat_turns + 1, updated_at = clock_timestamp()
        WHERE subject_type = 'account' AND subject_key = $1 AND quota_date = $2::date AND chat_turns < $3`,
      [actor.key, reservation.quotaDate, MEMBER_LIMIT]);
      if (!updated.rowCount) throw new ChatbotStoreError('QUOTA_EXCEEDED');
    }
  });
}

async function statusV2({ account, deviceId, operationId, receipt }) {
  const { actor, payload } = verifyV2Receipt(account, deviceId, operationId, receipt);
  return transaction(async (client) => {
    // This SELECT must use the authoritative writer, not a lagging replica.
    const { rows: [row] } = await client.query(`
      SELECT receipt_nonce::text AS nonce, state, flow_id::text AS "flowId",
        quota_date::text AS "quotaDate", accept_until <= clock_timestamp() AS "acceptExpired",
        commit_by <= clock_timestamp() AS "commitExpired", terminal_at <= clock_timestamp() - interval '24 hours' AS "retainedOut",
        CASE WHEN state = 'prepared' THEN accept_until ELSE commit_by END <= clock_timestamp() - interval '24 hours' AS "deadlineRetainedOut"
      FROM public.chatbot_discovery_operation
      WHERE subject_type = $1 AND subject_key = $2 AND operation_id = $3::uuid FOR UPDATE
    `, [actor.type, actor.key, operationId]);
    if (!row) return { state: 'expired', charged: null, serverTime: Date.now() };
    if (row.nonce !== payload.nonce) throw new ChatbotStoreError('IDEMPOTENCY_CONFLICT');
    if (row.retainedOut) {
      await client.query(`DELETE FROM public.chatbot_discovery_operation
        WHERE subject_type = $1 AND subject_key = $2 AND operation_id = $3::uuid`,
      [actor.type, actor.key, operationId]);
      return { state: 'expired', charged: null, serverTime: Date.now() };
    }
    if (!row.flowId && ((row.state === 'prepared' && row.acceptExpired)
      || (row.state === 'pending' && row.commitExpired))) {
      if (row.deadlineRetainedOut) {
        await client.query(`DELETE FROM public.chatbot_discovery_operation
          WHERE subject_type = $1 AND subject_key = $2 AND operation_id = $3::uuid`,
        [actor.type, actor.key, operationId]);
        return { state: 'expired', charged: null, serverTime: Date.now() };
      }
      await client.query(`UPDATE public.chatbot_discovery_operation SET state = 'failed',
        terminal_at = CASE WHEN state = 'prepared' THEN accept_until ELSE commit_by END,
        lease_id = NULL, lease_expires_at = NULL, fence_version = fence_version + 1, updated_at = clock_timestamp()
        WHERE subject_type = $1 AND subject_key = $2 AND operation_id = $3::uuid`,
      [actor.type, actor.key, operationId]);
      return { state: 'failed', charged: actor.type === 'account' ? false : null, serverTime: Date.now() };
    }
    const state = row.state;
    const charged = actor.type !== 'account' || ['prepared', 'pending', 'clarify'].includes(state) ? null
      : ['success', 'login_required', 'found', 'cancelled'].includes(state);
    return { state, charged, serverTime: Date.now() };
  });
}

// Transfer the generic reservation into a clarification flow atomically.
// Only hashes of the session token and subject are retained on the server.
async function beginClarification(reservation, sessionToken, subject, offerPlanner = false) {
  if (reservation.actor.type !== 'account' || typeof sessionToken !== 'string'
    || typeof subject !== 'string' || !subject.trim()) throw new ChatbotStoreError('INVALID_INPUT');
  const flowId = randomUUID();
  const sessionHash = keyedHash(`discovery-session:${sessionToken}`);
  const subjectHash = keyedHash(`discovery-subject:${subject.trim().normalize('NFC')}`);
  await transaction(async (client) => {
    await lockQuotaDay(client, reservation.actor, reservation.quotaDate);
    const { rowCount } = await client.query(`
      UPDATE public.chatbot_discovery_operation SET state = 'clarify', terminal_at = clock_timestamp(),
        lease_id = NULL, lease_expires_at = NULL, updated_at = clock_timestamp()
      WHERE subject_type = $1 AND subject_key = $2 AND operation_id = $3::uuid
        AND receipt_nonce = $4::uuid AND lease_id = $5::uuid AND fence_version = $6::bigint
        AND state = 'pending' AND flow_id IS NULL AND commit_by > clock_timestamp()
    `, [reservation.actor.type, reservation.actor.key, reservation.operationId, reservation.nonce,
      reservation.leaseId, reservation.fence]);
    if (!rowCount) throw new ChatbotStoreError('RESULT_UNAVAILABLE');
    await client.query(`
      INSERT INTO public.chatbot_discovery_flow
        (subject_type, subject_key, flow_id, session_scope_hash, subject_hash, quota_date,
         stage, choice_deadline, flow_expires_at)
      VALUES ($1, $2, $3::uuid, $4, $5, $6::date, 'awaiting_choice',
        clock_timestamp() + interval '10 minutes', clock_timestamp() + interval '10 minutes')
    `, [reservation.actor.type, reservation.actor.key, flowId, sessionHash, subjectHash, reservation.quotaDate]);
  });
  return signFlow(reservation.actor, { flowId, sessionHash, subjectHash, offerPlanner });
}

function validateChoiceToken(account, token, sessionToken) {
  if (!account || typeof sessionToken !== 'string') throw new ChatbotStoreError('INVALID_INPUT');
  const actor = actorFor(account);
  const value = verifyFlow(token, actor);
  if (!value || value.sessionHash !== keyedHash(`discovery-session:${sessionToken}`)) {
    throw new ChatbotStoreError('SESSION_EXPIRED');
  }
  return { actor, value };
}

async function prepareChoice({ account, operationId, payloadHash, flowToken, sessionToken, allowCreate = true }) {
  if (!/^[0-9a-f]{64}$/.test(payloadHash)) throw new ChatbotStoreError('INVALID_INPUT');
  const { actor, value } = validateChoiceToken(account, flowToken, sessionToken);
  const { rows: [snapshot] } = await pool.query(`SELECT quota_date::text AS "quotaDate"
    FROM public.chatbot_discovery_flow WHERE subject_type = $1 AND subject_key = $2 AND flow_id = $3::uuid`,
  [actor.type, actor.key, value.flowId]);
  if (!snapshot) throw new ChatbotStoreError('RESULT_UNAVAILABLE');
  const row = await transaction(async (client) => {
    await lockQuotaDay(client, actor, snapshot.quotaDate);
    const { rows: [flow] } = await client.query(`
      SELECT stage, choice_deadline > clock_timestamp() AS active,
        session_scope_hash AS "sessionHash", subject_hash AS "subjectHash"
      FROM public.chatbot_discovery_flow WHERE subject_type = $1 AND subject_key = $2 AND flow_id = $3::uuid FOR UPDATE
    `, [actor.type, actor.key, value.flowId]);
    if (!flow || flow.sessionHash !== value.sessionHash || flow.subjectHash !== value.subjectHash) {
      throw new ChatbotStoreError('RESULT_UNAVAILABLE');
    }
    const { rows: [existing] } = await client.query(`
      SELECT payload_hash AS "payloadHash", receipt_nonce::text AS nonce,
        floor(extract(epoch FROM accept_until) * 1000)::bigint::text AS "acceptUntil",
        floor(extract(epoch FROM commit_by) * 1000)::bigint::text AS "commitBy", state, flow_id::text AS "flowId"
      FROM public.chatbot_discovery_operation WHERE subject_type = $1 AND subject_key = $2 AND operation_id = $3::uuid
      FOR UPDATE
    `, [actor.type, actor.key, operationId]);
    if (existing) {
      if (existing.payloadHash !== payloadHash || existing.flowId !== value.flowId) {
        throw new ChatbotStoreError('IDEMPOTENCY_CONFLICT');
      }
      return existing;
    }
    if (!allowCreate) throw new ChatbotStoreError('SESSION_EXPIRED');
    if (flow.stage !== 'awaiting_choice' || !flow.active) throw new ChatbotStoreError('RESULT_UNAVAILABLE');
    await client.query(`UPDATE public.chatbot_discovery_operation SET state = 'failed', terminal_at = accept_until,
      updated_at = clock_timestamp(), fence_version = fence_version + 1
      WHERE subject_type = $1 AND subject_key = $2 AND flow_id = $3::uuid
        AND state = 'prepared' AND accept_until <= clock_timestamp()`, [actor.type, actor.key, value.flowId]);
    const { rows: [busy] } = await client.query(`SELECT EXISTS (
      SELECT 1 FROM public.chatbot_discovery_operation WHERE subject_type = $1 AND subject_key = $2
        AND flow_id = $3::uuid AND state IN ('prepared', 'pending')
    ) AS active`, [actor.type, actor.key, value.flowId]);
    if (busy.active) throw new ChatbotStoreError('IN_PROGRESS');
    const nonce = randomUUID();
    const { rows: [created] } = await client.query(`
      INSERT INTO public.chatbot_discovery_operation
        (subject_type, subject_key, operation_id, flow_id, payload_hash, quota_date, receipt_nonce,
         state, accept_until, commit_by)
      SELECT $1, $2, $3::uuid, $4::uuid, $5, $6::date, $7::uuid, 'prepared',
        LEAST(choice_deadline, date_trunc('milliseconds', clock_timestamp() + interval '2 minutes')),
        date_trunc('milliseconds', clock_timestamp() + interval '5 minutes')
      FROM public.chatbot_discovery_flow WHERE subject_type = $1 AND subject_key = $2 AND flow_id = $4::uuid
      RETURNING payload_hash AS "payloadHash", receipt_nonce::text AS nonce,
        floor(extract(epoch FROM accept_until) * 1000)::bigint::text AS "acceptUntil",
        floor(extract(epoch FROM commit_by) * 1000)::bigint::text AS "commitBy", state
    `, [actor.type, actor.key, operationId, value.flowId, payloadHash, snapshot.quotaDate, nonce]);
    return created;
  });
  const receipt = signReceipt(actor, { operationId, nonce: row.nonce, payloadHash: row.payloadHash,
    acceptUntil: Number(row.acceptUntil), commitBy: Number(row.commitBy) });
  return { receipt, state: ['prepared', 'pending'].includes(row.state) ? row.state : 'terminal',
    acceptUntil: Number(row.acceptUntil), commitBy: Number(row.commitBy), serverTime: Date.now() };
}

async function claimChoice({ account, operationId, receipt, payloadHash, flowToken, sessionToken }) {
  const { actor, payload } = verifyV2Receipt(account, undefined, operationId, receipt);
  const flow = validateChoiceToken(account, flowToken, sessionToken).value;
  if (payload.payloadHash !== payloadHash) throw new ChatbotStoreError('IDEMPOTENCY_CONFLICT');
  const { rows: [snapshot] } = await pool.query(`SELECT quota_date::text AS "quotaDate"
    FROM public.chatbot_discovery_operation WHERE subject_type = $1 AND subject_key = $2
      AND operation_id = $3::uuid AND flow_id = $4::uuid`, [actor.type, actor.key, operationId, flow.flowId]);
  if (!snapshot) throw new ChatbotStoreError('RESULT_UNAVAILABLE');
  const leaseId = randomUUID();
  return transaction(async (client) => {
    await lockQuotaDay(client, actor, snapshot.quotaDate);
    const { rows: [active] } = await client.query(`SELECT stage, choice_deadline > clock_timestamp() AS active,
      session_scope_hash AS "sessionHash", subject_hash AS "subjectHash" FROM public.chatbot_discovery_flow
      WHERE subject_type = $1 AND subject_key = $2 AND flow_id = $3::uuid FOR UPDATE`,
    [actor.type, actor.key, flow.flowId]);
    if (!active || active.stage !== 'awaiting_choice' || !active.active
      || active.sessionHash !== flow.sessionHash || active.subjectHash !== flow.subjectHash) {
      throw new ChatbotStoreError('RESULT_UNAVAILABLE');
    }
    const { rows: [row] } = await client.query(`UPDATE public.chatbot_discovery_operation
      SET state = 'pending', lease_id = $5::uuid, lease_expires_at = commit_by,
        fence_version = fence_version + 1, updated_at = clock_timestamp()
      WHERE subject_type = $1 AND subject_key = $2 AND operation_id = $3::uuid
        AND receipt_nonce = $4::uuid AND payload_hash = $6 AND flow_id = $7::uuid
        AND state = 'prepared' AND accept_until > clock_timestamp() AND commit_by > clock_timestamp()
      RETURNING fence_version::text AS fence`,
    [actor.type, actor.key, operationId, payload.nonce, leaseId, payloadHash, flow.flowId]);
    if (!row) throw new ChatbotStoreError('IN_PROGRESS');
    await client.query(`UPDATE public.chatbot_discovery_flow SET stage = 'search_pending',
      updated_at = clock_timestamp() WHERE subject_type = $1 AND subject_key = $2 AND flow_id = $3::uuid`,
    [actor.type, actor.key, flow.flowId]);
    return { actor, operationId, nonce: payload.nonce, leaseId, fence: row.fence,
      quotaDate: snapshot.quotaDate, flowId: flow.flowId, subjectHash: flow.subjectHash,
      offerPlanner: flow.offerPlanner === true };
  });
}

function matchesFlowSubject(reservation, subject) {
  return typeof subject === 'string' && Boolean(subject.trim())
    && reservation.subjectHash === keyedHash(`discovery-subject:${subject.trim().normalize('NFC')}`);
}

async function finishChoice(reservation, outcome) {
  if (!['found', 'empty', 'failed', 'cancelled'].includes(outcome)) throw new ChatbotStoreError('INVALID_INPUT');
  const charged = outcome === 'found' || outcome === 'cancelled';
  await transaction(async (client) => {
    const { actor } = reservation;
    await lockQuotaDay(client, actor, reservation.quotaDate);
    const { rows: [flow] } = await client.query(`SELECT stage FROM public.chatbot_discovery_flow
      WHERE subject_type = $1 AND subject_key = $2 AND flow_id = $3::uuid FOR UPDATE`,
    [actor.type, actor.key, reservation.flowId]);
    if (!flow || flow.stage !== 'search_pending') throw new ChatbotStoreError('RESULT_UNAVAILABLE');
    const { rowCount } = await client.query(`UPDATE public.chatbot_discovery_operation
      SET state = $1, terminal_at = clock_timestamp(), updated_at = clock_timestamp(),
        lease_id = NULL, lease_expires_at = NULL
      WHERE subject_type = $2 AND subject_key = $3 AND operation_id = $4::uuid AND receipt_nonce = $5::uuid
        AND lease_id = $6::uuid AND fence_version = $7::bigint AND flow_id = $8::uuid
        AND state = 'pending' AND commit_by > clock_timestamp()`,
    [outcome, actor.type, actor.key, reservation.operationId, reservation.nonce,
      reservation.leaseId, reservation.fence, reservation.flowId]);
    if (!rowCount) throw new ChatbotStoreError('RESULT_UNAVAILABLE');
    await client.query(`UPDATE public.chatbot_discovery_flow SET stage = $1, charge_intent = $2,
      terminal_at = clock_timestamp(), updated_at = clock_timestamp()
      WHERE subject_type = $3 AND subject_key = $4 AND flow_id = $5::uuid`,
    [outcome, charged, actor.type, actor.key, reservation.flowId]);
    if (charged) {
      const updated = await client.query(`UPDATE public.daily_quota SET chat_turns = chat_turns + 1,
        updated_at = clock_timestamp() WHERE subject_type = 'account' AND subject_key = $1
          AND quota_date = $2::date AND chat_turns < $3`, [actor.key, reservation.quotaDate, MEMBER_LIMIT]);
      if (!updated.rowCount) throw new ChatbotStoreError('QUOTA_EXCEEDED');
    }
  });
}

async function reaskChoice(reservation) {
  await transaction(async (client) => {
    const { actor } = reservation;
    await lockQuotaDay(client, actor, reservation.quotaDate);
    const { rows: [flow] } = await client.query(`SELECT stage, choice_deadline > clock_timestamp() AS active
      FROM public.chatbot_discovery_flow WHERE subject_type = $1 AND subject_key = $2 AND flow_id = $3::uuid FOR UPDATE`,
    [actor.type, actor.key, reservation.flowId]);
    if (!flow || flow.stage !== 'search_pending' || !flow.active) throw new ChatbotStoreError('RESULT_UNAVAILABLE');
    const { rowCount } = await client.query(`UPDATE public.chatbot_discovery_operation
      SET state = 'clarify', terminal_at = clock_timestamp(), updated_at = clock_timestamp(),
        lease_id = NULL, lease_expires_at = NULL
      WHERE subject_type = $1 AND subject_key = $2 AND operation_id = $3::uuid AND receipt_nonce = $4::uuid
        AND lease_id = $5::uuid AND fence_version = $6::bigint AND flow_id = $7::uuid
        AND state = 'pending' AND commit_by > clock_timestamp()`,
    [actor.type, actor.key, reservation.operationId, reservation.nonce,
      reservation.leaseId, reservation.fence, reservation.flowId]);
    if (!rowCount) throw new ChatbotStoreError('RESULT_UNAVAILABLE');
    await client.query(`UPDATE public.chatbot_discovery_flow SET stage = 'awaiting_choice',
      updated_at = clock_timestamp() WHERE subject_type = $1 AND subject_key = $2 AND flow_id = $3::uuid`,
    [actor.type, actor.key, reservation.flowId]);
  });
}

module.exports = { ChatbotStoreError, getQuota, reserveRequest, finishRequest, getRequestState, deleteExpiredRequests,
  prepareV2, claimV2, finishV2, statusV2, beginClarification, prepareChoice, validateChoiceToken, claimChoice, matchesFlowSubject, finishChoice, reaskChoice };
