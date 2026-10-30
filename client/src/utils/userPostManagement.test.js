import assert from 'node:assert/strict';
import test from 'node:test';
import { canEdit, canInteractWithManagedPost, getMyPostDisplayStatus, getMyPostModerationMessage } from './userPostManagement.js';

// Duy's Code: Kiểm thử phân loại nhãn từ post_status + admin_log mà không sửa schema.
test('deleted posts use existing admin_log action to distinguish rejected and removed', () => {
  assert.equal(getMyPostDisplayStatus({ status: 'deleted', moderationAction: 'REJECT' }), 'rejected');
  assert.equal(getMyPostDisplayStatus({ status: 'deleted', moderationAction: 'REMOVE' }), 'removed');
  assert.equal(getMyPostDisplayStatus({ status: 'deleted', moderationAction: null }), 'deleted');
});

test('deleted post banners only show the latest effective moderation reason', () => {
  const reason = 'Sai quy định cộng đồng.';
  const latestAction = (entries, deletedAt) => entries
    .filter((entry) => entry.createdAt <= deletedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)[0];
  const deletedPost = (entries, deletedAt) => {
    const latest = latestAction(entries, deletedAt);
    const post = { status: 'deleted', deletedAt, moderationAction: latest?.action ?? null, moderationNote: latest?.reason ?? null };
    return { status: getMyPostDisplayStatus(post), message: getMyPostModerationMessage(post) };
  };
  const deletedAt = '2026-08-31T04:00:00Z';

  assert.deepEqual(deletedPost([{ id: 1, action: 'REMOVE', reason, createdAt: '2026-08-31T03:00:00Z' }], deletedAt), {
    status: 'removed', message: reason,
  });
  assert.deepEqual(deletedPost([{ id: 1, action: 'REJECT', reason, createdAt: '2026-08-31T03:00:00Z' }], deletedAt), {
    status: 'rejected', message: reason,
  });
  assert.deepEqual(deletedPost([{ id: 1, action: 'APPROVE', reason, createdAt: '2026-08-31T03:00:00Z' }], deletedAt), {
    status: 'deleted', message: 'Bạn đã xóa bài viết này.',
  });
  assert.deepEqual(deletedPost([], deletedAt), {
    status: 'deleted', message: 'Bạn đã xóa bài viết này.',
  });
  assert.deepEqual(deletedPost([
    { id: 1, action: 'APPROVE', reason: 'Ghi chú duyệt cũ.', createdAt: '2026-08-31T01:00:00Z' },
    { id: 2, action: 'REMOVE', reason, createdAt: '2026-08-31T03:00:00Z' },
  ], deletedAt), { status: 'removed', message: reason });
  assert.deepEqual(deletedPost([
    { id: 1, action: 'REMOVE', reason, createdAt: '2026-08-31T01:00:00Z' },
    { id: 2, action: 'APPROVE', reason: 'Đã khôi phục.', createdAt: '2026-08-31T03:00:00Z' },
  ], deletedAt), { status: 'deleted', message: 'Bạn đã xóa bài viết này.' });
});

// Duy's Code: Chỉ trạng thái feed-visible được bật like/bình luận trong popup.
test('only public and reported posts allow interaction', () => {
  for (const status of ['public', 'reported']) assert.equal(canInteractWithManagedPost({ status }), true);
  for (const status of ['pending', 'deleted']) assert.equal(canInteractWithManagedPost({ status }), false);
  assert.equal(canInteractWithManagedPost(null), false);
});

test('only public posts can be edited', () => {
  assert.equal(canEdit({ status: 'public' }), true);
  for (const status of ['pending', 'reported', 'deleted']) assert.equal(canEdit({ status }), false);
  assert.equal(canEdit(null), false);
});
