import assert from 'node:assert/strict';
import test from 'node:test';
import { canInteractWithManagedPost, getMyPostDisplayStatus } from './userPostManagement.js';

// Duy's Code: Kiểm thử phân loại nhãn từ post_status + admin_log mà không sửa schema.
test('deleted posts use existing admin_log action to distinguish rejected and removed', () => {
  assert.equal(getMyPostDisplayStatus({ status: 'deleted', moderationAction: 'REJECT' }), 'rejected');
  assert.equal(getMyPostDisplayStatus({ status: 'deleted', moderationAction: 'REMOVE' }), 'removed');
  assert.equal(getMyPostDisplayStatus({ status: 'deleted', moderationAction: null }), 'deleted');
});

// Duy's Code: Chỉ trạng thái feed-visible được bật like/bình luận trong popup.
test('only public and reported posts allow interaction', () => {
  for (const status of ['public', 'reported']) assert.equal(canInteractWithManagedPost({ status }), true);
  for (const status of ['pending', 'deleted']) assert.equal(canInteractWithManagedPost({ status }), false);
  assert.equal(canInteractWithManagedPost(null), false);
});
