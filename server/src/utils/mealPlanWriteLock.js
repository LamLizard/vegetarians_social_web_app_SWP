// Writers hold a shared transaction lock; an AI confirm must hold the
// corresponding exclusive transaction lock before it reads or writes. Every
// participating writer must acquire it before touching the affected tables.
const LOCK_KEYS = [1886685745, 1464421425];

async function lockMealPlanWriter(client) {
  await client.query('SELECT pg_advisory_xact_lock_shared($1::integer, $2::integer)', LOCK_KEYS);
}

async function lockMealPlanConfirm(client) {
  await client.query('SELECT pg_advisory_xact_lock($1::integer, $2::integer)', LOCK_KEYS);
}

module.exports = { lockMealPlanWriter, lockMealPlanConfirm };
