const test = require('node:test');
const assert = require('node:assert/strict');
let rules = {};
try { rules = require('./postModeration'); } catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
}

test('feature exposes validation and moderation rules', () => {
  assert.equal(typeof rules.parseListQuery, 'function');
  assert.equal(typeof rules.parseDecision, 'function');
  assert.equal(typeof rules.parseId, 'function');
  assert.equal(typeof rules.getPostDecision, 'function');
  assert.equal(typeof rules.canRestorePost, 'function');
});

test('IDs retain full PostgreSQL BIGINT precision and reject malformed values', () => {
  assert.equal(rules.parseId('9223372036854775807'), '9223372036854775807');
  for (const value of ['0', '-1', '1.5', '1 OR 1=1', '9223372036854775808', ['1']]) {
    assert.throws(() => rules.parseId(value), { status: 400 });
  }
});

test('filters default to pending and reject invalid types, paging and excessive search', () => {
  assert.deepEqual(rules.parseListQuery({}, 'post'), {
    status: 'pending', postType: 'all', search: '', page: 1, limit: 20, stale: false,
  });
  for (const query of [{ status: 'hidden' }, { page: '-1' }, { page: '1.5' },
    { limit: '101' }, { search: ['a', 'b'] }, { postType: 'recipe' }, { stale: '2' },
    { search: 'x'.repeat(256) }, { page: '9007199254740992' }]) {
    assert.throws(() => rules.parseListQuery(query, 'post'), { status: 400 });
  }
  assert.equal(rules.parseListQuery({ status: 'accepted' }, 'report').status, 'accepted');
});

test('reject and accept report require trimmed notes, max 255 characters', () => {
  assert.deepEqual(rules.parseDecision({ action: 'reject', note: '  Sai chủ đề  ' }, 'post'),
    { action: 'reject', note: 'Sai chủ đề' });
  for (const body of [{ action: 'reject' }, { action: 'reject', note: '  ' },
    { action: 'accept' }, { action: 'accept', note: 'x'.repeat(256) },
    { action: 'hide', note: 'Sai chủ đề' }, { action: 'approve', note: {} }]) {
    assert.throws(() => rules.parseDecision(body, 'report'), { status: 400 });
  }
  assert.deepEqual(rules.parseDecision({ action: 'approve' }, 'post'), { action: 'approve', note: null });
});

test('post rejection uses deleted with REJECT and post_rejected', () => {
  assert.deepEqual(rules.getPostDecision('pending', 'reject'), {
    status: 'deleted', logAction: 'REJECT', notificationType: 'post_rejected',
  });
  assert.deepEqual(rules.getPostDecision('pending', 'approve'), {
    status: 'public', logAction: 'APPROVE', notificationType: 'post_approved',
  });
  for (const status of ['public', 'reported', 'deleted']) {
    assert.throws(() => rules.getPostDecision(status, 'approve'), { status: 409 });
  }
});

test('restoration requires reported, previously published and no blocking report/decision', () => {
  const post = { status: 'reported', publishedAt: '2026-09-20T00:00:00Z' };
  assert.equal(rules.canRestorePost(post, false, false), true);
  assert.equal(rules.canRestorePost({ ...post, status: 'deleted' }, false, false), false);
  assert.equal(rules.canRestorePost({ ...post, publishedAt: null }, false, false), false);
  assert.equal(rules.canRestorePost(post, true, false), false);
  assert.equal(rules.canRestorePost(post, false, true), false);
});
