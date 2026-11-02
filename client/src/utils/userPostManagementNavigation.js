export function getMyPostListOptions({ status = 'all', type = 'all', page = 1 } = {}) {
  return { status, type, page };
}

export function getNotificationPostId(search = '') {
  return new URLSearchParams(search).get('postId') || null;
}

export function removeNotificationPostId(location) {
  const params = new URLSearchParams(location.search);
  params.delete('postId');
  const query = params.toString();
  return `${location.pathname}${query ? `?${query}` : ''}${location.hash || ''}`;
}

export function shouldLoadNotificationPost(postId, handledPostId) {
  return Boolean(postId) && postId !== handledPostId;
}

export function findNotificationPost(items, postId) {
  return items.find((post) => String(post.id) === String(postId)) ?? null;
}

export function resolveNotificationPost(items, postId) {
  const post = findNotificationPost(items, postId);
  return { post, missing: !post || typeof post.content !== 'string' };
}
