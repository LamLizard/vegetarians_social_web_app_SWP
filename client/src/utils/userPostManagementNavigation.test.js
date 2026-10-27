import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findNotificationPost, getMyPostListOptions, getNotificationPostId, removeNotificationPostId,
  resolveNotificationPost, shouldLoadNotificationPost,
} from './userPostManagementNavigation.js';

test('notification postId never enters visible-list request options', () => {
  const postId = getNotificationPostId('?postId=42');
  assert.deepEqual(getMyPostListOptions({ status: 'all', type: 'all', page: 1, postId }), {
    status: 'all', type: 'all', page: 1,
  });
});

test('changing filters and returning to all removes notification postId from the list URL', () => {
  const location = { pathname: '/me/posts', search: '?postId=42&tab=posts', hash: '#list' };
  const withoutTarget = removeNotificationPostId(location);
  assert.equal(withoutTarget, '/me/posts?tab=posts#list');
  assert.deepEqual(getMyPostListOptions({ status: 'public', type: 'blog', page: 1 }), {
    status: 'public', type: 'blog', page: 1,
  });
  assert.deepEqual(getMyPostListOptions({ status: 'all', type: 'all', page: 1 }), {
    status: 'all', type: 'all', page: 1,
  });
  assert.equal(getNotificationPostId(new URL(withoutTarget, 'https://example.test').search), null);
});

test('closing a target popup removes only postId from the URL', () => {
  assert.equal(removeNotificationPostId({ pathname: '/me/posts', search: '?postId=42', hash: '' }), '/me/posts');
});

test('missing notification posts resolve without mutating the visible list', () => {
  const items = [{ id: '7', title: 'Bài vẫn trong danh sách' }];
  assert.deepEqual(resolveNotificationPost(items, '42'), { post: null, missing: true });
  assert.deepEqual(items, [{ id: '7', title: 'Bài vẫn trong danh sách' }]);
  assert.deepEqual(getMyPostListOptions({ status: 'all', type: 'all', page: 1 }), {
    status: 'all', type: 'all', page: 1,
  });
});

test('a changed URL target X to Y is treated as a new popup request', () => {
  const search = '?postId=Y';
  const postId = getNotificationPostId(search);
  const items = [{ id: 'X' }, { id: 'Y' }];
  assert.equal(shouldLoadNotificationPost(postId, 'X'), true);
  assert.deepEqual(findNotificationPost(items, postId), { id: 'Y' });
  assert.equal(shouldLoadNotificationPost(postId, 'Y'), false);
  assert.equal(shouldLoadNotificationPost(null, 'Y'), false);
});
