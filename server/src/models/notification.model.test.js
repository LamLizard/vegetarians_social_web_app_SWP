const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../config/db');
const model = require('./notification.model');

test('notification list and unread count are scoped to the requesting account', async () => {
  const original = pool.query;
  const calls = [];
  pool.query = async (sql, values) => {
    calls.push({ sql, values });
    if (/SELECT count\(\*\)/.test(sql)) return { rows: [{ count: 2 }] };
    return { rows: [{ id: '9', type: 'ingredient_proposal_rejected', isRead: false }] };
  };
  try {
    const result = await model.listForAccount('42');
    assert.equal(result.unreadCount, 2);
    assert.equal(result.items[0].id, '9');
    assert.ok(calls.every(({ values }) => values[0] === '42'));
    assert.ok(calls.every(({ sql }) => /account_id = \$1/.test(sql)));
  } finally { pool.query = original; }
});

test('marking read can only update a notification owned by that account', async () => {
  const original = pool.query;
  let query;
  pool.query = async (sql, values) => { query = { sql, values }; return { rows: [{ id: '9' }] }; };
  try {
    assert.deepEqual(await model.markRead('42', '9'), { id: '9', isRead: true });
    assert.match(query.sql, /WHERE account_id = \$1 AND notification_id = \$2/);
    assert.deepEqual(query.values, ['42', '9']);
  } finally { pool.query = original; }
});
