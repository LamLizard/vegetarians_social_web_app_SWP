const test = require('node:test');
const assert = require('node:assert/strict');
let createModel;
try { ({ createPostModerationModel: createModel } = require('./postModeration.model')); } catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
}

// pg là phụ thuộc I/O: trả kết quả theo từng bước SQL, không kết nối DB dùng chung.
function database(steps) {
  const calls = [];
  let released = false;
  const client = {
    async query(sql, values = []) {
      calls.push({ sql, values });
      const next = steps.shift();
      assert.ok(next, `Unexpected query: ${sql}`);
      assert.match(sql, next.sql);
      if (next.error) throw next.error;
      return { rows: next.rows || [], rowCount: (next.rows || []).length };
    },
    release() { released = true; },
  };
  return {
    pool: { connect: async () => client, query: client.query }, calls,
    verify() { assert.equal(steps.length, 0); assert.equal(released, true); },
  };
}
const post = { id: '16', accountId: '7', title: 'Bài thử nghiệm', status: 'pending', publishedAt: null };
const report = { id: '2', reporterId: '8', targetId: '16', status: 'pending', targetType: 'post' };
const admin = { id: '1', ip: '127.0.0.1' };

test('model factory exists', () => { assert.equal(typeof createModel, 'function'); });

test('reject stores deleted and audit REJECT and post_rejected in one transaction', async () => {
  const db = database([
    { sql: /BEGIN/ }, { sql: /FROM post[\s\S]*FOR UPDATE/, rows: [post] },
    { sql: /UPDATE post/, rows: [{ ...post, status: 'deleted' }] },
    { sql: /INSERT INTO admin_log/ }, { sql: /INSERT INTO notification/ }, { sql: /COMMIT/ },
  ]);
  const result = await createModel(db.pool).decidePost('16', { action: 'reject', note: 'Sai chủ đề' }, admin);
  assert.equal(result.status, 'deleted');
  const log = db.calls.find(c => /INSERT INTO admin_log/.test(c.sql));
  assert.equal(log.values[1], 'REJECT');
  assert.equal(log.values[2], 'post');
  assert.equal(JSON.parse(log.values[4]).status, 'pending');
  assert.equal(JSON.parse(log.values[5]).status, 'deleted');
  const notification = db.calls.find(c => /INSERT INTO notification/.test(c.sql));
  assert.equal(notification.values[0], '7');
  assert.equal(notification.values[1], 'post_rejected');
  assert.match(db.calls.find(c => /UPDATE post/.test(c.sql)).sql, /deleted_at/);
  db.verify();
});

test('notification failure rolls back instead of committing a partial decision', async () => {
  const failure = new Error('Notification insert failed');
  const db = database([
    { sql: /BEGIN/ }, { sql: /FROM post[\s\S]*FOR UPDATE/, rows: [post] },
    { sql: /UPDATE post/, rows: [{ ...post, status: 'public' }] },
    { sql: /INSERT INTO admin_log/ }, { sql: /INSERT INTO notification/, error: failure },
    { sql: /ROLLBACK/ },
  ]);
  await assert.rejects(createModel(db.pool).decidePost('16', { action: 'approve', note: null }, admin), failure);
  assert.equal(db.calls.some(c => /COMMIT/.test(c.sql)), false);
  db.verify();
});

test('post already handled returns conflict without writing audit or notification', async () => {
  const db = database([
    { sql: /BEGIN/ }, { sql: /FROM post[\s\S]*FOR UPDATE/, rows: [{ ...post, status: 'public' }] },
    { sql: /ROLLBACK/ },
  ]);
  await assert.rejects(createModel(db.pool).decidePost('16', { action: 'reject', note: 'Sai chủ đề' }, admin), { status: 409 });
  db.verify();
});

test('report acceptance locks post before report and removes content once', async () => {
  const current = { ...post, status: 'reported', publishedAt: '2026-09-20T00:00:00Z' };
  const db = database([
    { sql: /BEGIN/ }, { sql: /FROM report/, rows: [{ targetId: '16' }] },
    { sql: /FROM post[\s\S]*FOR UPDATE/, rows: [current] },
    { sql: /FROM report[\s\S]*FOR UPDATE/, rows: [report] },
    { sql: /UPDATE report/, rows: [{ ...report, status: 'accepted' }] },
    { sql: /UPDATE post/, rows: [{ ...current, status: 'deleted' }] },
    { sql: /INSERT INTO admin_log/ }, { sql: /INSERT INTO notification/ },
    { sql: /INSERT INTO admin_log/ }, { sql: /INSERT INTO notification/ }, { sql: /COMMIT/ },
  ]);
  const result = await createModel(db.pool).decideReport('2', { action: 'accept', note: 'Vi phạm chủ đề' }, admin);
  assert.equal(result.status, 'accepted');
  assert.equal(result.postStatus, 'deleted');
  const notices = db.calls.filter(c => /INSERT INTO notification/.test(c.sql));
  assert.deepEqual(notices.map(c => c.values[1]), ['post_removed', 'report_result']);
  db.verify();
});

for (const blocked of [true, false]) {
  test(`reject report ${blocked ? 'keeps reported when another report remains' : 'restores eligible reported post'}`, async () => {
    const current = { ...post, status: 'reported', publishedAt: '2026-09-20T00:00:00Z' };
    const steps = [
      { sql: /BEGIN/ }, { sql: /FROM report/, rows: [{ targetId: '16' }] },
      { sql: /FROM post[\s\S]*FOR UPDATE/, rows: [current] },
      { sql: /FROM report[\s\S]*FOR UPDATE/, rows: [report] },
      { sql: /UPDATE report/, rows: [{ ...report, status: 'rejected' }] },
      { sql: /EXISTS/, rows: [{ hasBlockingReport: blocked, hasBlockingDecision: false }] },
    ];
    if (!blocked) steps.push(
      { sql: /UPDATE post/, rows: [{ ...current, status: 'public' }] },
      { sql: /INSERT INTO admin_log/ }, { sql: /INSERT INTO notification/ },
    );
    steps.push({ sql: /INSERT INTO admin_log/ }, { sql: /INSERT INTO notification/ }, { sql: /COMMIT/ });
    const db = database(steps);
    const result = await createModel(db.pool).decideReport('2', { action: 'reject', note: 'Không đủ bằng chứng' }, admin);
    assert.equal(result.postStatus, blocked ? 'reported' : 'public');
    db.verify();
  });
}

test('reject report never restores a deleted post', async () => {
  const db = database([
    { sql: /BEGIN/ }, { sql: /FROM report/, rows: [{ targetId: '16' }] },
    { sql: /FROM post[\s\S]*FOR UPDATE/, rows: [{ ...post, status: 'deleted' }] },
    { sql: /FROM report[\s\S]*FOR UPDATE/, rows: [report] },
    { sql: /UPDATE report/, rows: [{ ...report, status: 'rejected' }] },
    { sql: /INSERT INTO admin_log/ }, { sql: /INSERT INTO notification/ }, { sql: /COMMIT/ },
  ]);
  const result = await createModel(db.pool).decideReport('2', { action: 'reject', note: 'Không đủ bằng chứng' }, admin);
  assert.equal(result.postStatus, 'deleted');
  assert.equal(db.calls.some(c => /UPDATE post/.test(c.sql)), false);
  db.verify();
});

test('report already decided returns conflict without a second decision', async () => {
  const db = database([
    { sql: /BEGIN/ }, { sql: /FROM report/, rows: [{ targetId: '16' }] },
    { sql: /FROM post[\s\S]*FOR UPDATE/, rows: [post] },
    { sql: /FROM report[\s\S]*FOR UPDATE/, rows: [{ ...report, status: 'accepted' }] },
    { sql: /ROLLBACK/ },
  ]);
  await assert.rejects(createModel(db.pool).decideReport('2', { action: 'reject', note: 'Sai' }, admin), { status: 409 });
  db.verify();
});

test('missing polymorphic post target returns 404 and rolls back', async () => {
  const db = database([
    { sql: /BEGIN/ }, { sql: /FROM report/, rows: [{ targetId: '16' }] },
    { sql: /FROM post[\s\S]*FOR UPDATE/, rows: [] }, { sql: /ROLLBACK/ },
  ]);
  await assert.rejects(createModel(db.pool).decideReport('2', { action: 'accept', note: 'Sai' }, admin), { status: 404 });
  db.verify();
});
