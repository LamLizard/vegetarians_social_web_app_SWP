const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../config/db');
const { decideAccountReportCase, listPendingAccountReports } = require('./admin-member.model');

async function withDatabase(steps, run) {
  const calls = [];
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  let released = false;
  const query = async (sql, values = []) => {
    calls.push({ sql, values });
    const next = steps.shift();
    assert.ok(next, `Unexpected query: ${sql}`);
    assert.match(sql, next.sql);
    if (next.error) throw next.error;
    return { rows: next.rows || [], rowCount: (next.rows || []).length };
  };
  const client = { query, release: () => { released = true; } };
  pool.query = query;
  pool.connect = async () => client;

  try {
    await run({ calls, verify: () => {
      assert.equal(steps.length, 0);
      assert.equal(released, true);
    } });
  } finally {
    pool.query = originalQuery;
    pool.connect = originalConnect;
  }
}

test('account report list uses pending account cases and name/email search', async () => {
  await withDatabase([
    { sql: /FROM public\.report_case[\s\S]*target_type = 'account'[\s\S]*status = 'pending'/, rows: [{ caseId: '5', id: '20' }] },
  ], async ({ calls }) => {
    const rows = await listPendingAccountReports({ keyword: 'Lan' });
    assert.equal(rows.length, 1);
    assert.deepEqual(calls[0].values, ['Lan']);
    assert.match(calls[0].sql, /json_agg/);
  });
});

test('accept locks the member and updates the case and pending reports atomically', async () => {
  await withDatabase([
    { sql: /BEGIN/ },
    { sql: /FROM public\.report_case[\s\S]*FOR UPDATE/, rows: [{ id: '5', targetId: '20', status: 'pending' }] },
    { sql: /FROM public\.account[\s\S]*FOR UPDATE/, rows: [{ id: '20', status: 'active' }] },
    { sql: /FROM public\.report[\s\S]*FOR UPDATE/, rows: [{ id: '31', reporterId: '22', status: 'pending' }] },
    { sql: /UPDATE public\.account/ },
    { sql: /INSERT INTO public\.admin_log/ },
    { sql: /UPDATE public\.report_case/ },
    { sql: /UPDATE public\.report/ },
    { sql: /INSERT INTO public\.admin_log/ },
    { sql: /COMMIT/ },
  ], async ({ calls, verify }) => {
    const result = await decideAccountReportCase({ caseId: '5', action: 'accept', adminId: '1' });
    assert.deepEqual(result, { accountId: '20', status: 'locked', reportStatus: 'accepted' });
    assert.equal(calls.filter((call) => /UPDATE public\.report/.test(call.sql)).length, 2);
    verify();
  });
});

test('reject closes the account case but restores a reported account to active', async () => {
  await withDatabase([
    { sql: /BEGIN/ },
    { sql: /FROM public\.report_case[\s\S]*FOR UPDATE/, rows: [{ id: '5', targetId: '20', status: 'pending' }] },
    { sql: /FROM public\.account[\s\S]*FOR UPDATE/, rows: [{ id: '20', status: 'reported' }] },
    { sql: /FROM public\.report[\s\S]*FOR UPDATE/, rows: [{ id: '31', reporterId: '22', status: 'pending' }] },
    { sql: /UPDATE public\.account/ },
    { sql: /INSERT INTO public\.admin_log/ },
    { sql: /UPDATE public\.report_case/ },
    { sql: /UPDATE public\.report/ },
    { sql: /INSERT INTO public\.admin_log/ },
    { sql: /COMMIT/ },
  ], async ({ calls, verify }) => {
    const result = await decideAccountReportCase({ caseId: '5', action: 'reject', adminId: '1' });
    assert.deepEqual(result, { accountId: '20', status: 'active', reportStatus: 'rejected' });
    assert.equal(calls.some((call) => /UPDATE public\.account/.test(call.sql)), true);
    verify();
  });
});

test('missing account report case returns 404 and rolls back', async () => {
  await withDatabase([
    { sql: /BEGIN/ },
    { sql: /FROM public\.report_case[\s\S]*FOR UPDATE/, rows: [] },
    { sql: /ROLLBACK/ },
  ], async ({ verify }) => {
    await assert.rejects(
      decideAccountReportCase({ caseId: '999', action: 'accept', adminId: '1' }),
      { status: 404 },
    );
    verify();
  });
});