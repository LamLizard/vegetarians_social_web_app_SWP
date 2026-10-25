import test from 'node:test';
import assert from 'node:assert/strict';
import getNotificationTarget from './getNotificationTarget.js';

// Duy's Code: Chỉ notification gắn post_id mới tạo deep link, không nhầm ingredient cùng type.
test('maps member post notifications to the owned post in management', () => {
  assert.equal(getNotificationTarget({ type: 'post_approved', refType: 'post', refId: '42' }), '/me/posts?postId=42');
  assert.equal(getNotificationTarget({ type: 'post_removed', refType: 'post', refId: '42' }), '/me/posts?postId=42');
});

test('keeps other notification types and roles non-clickable', () => {
  assert.equal(getNotificationTarget({ type: 'post_rejected', refType: null, refId: null }), null);
  assert.equal(getNotificationTarget({ type: 'report_result', refType: 'report', refId: '9' }), null);
  assert.equal(getNotificationTarget({ type: 'post_approved', refType: 'post', refId: '42' }, 'admin'), null);
});
