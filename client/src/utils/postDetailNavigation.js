// Tùng: chỉ lưu nguồn nội bộ hợp lệ, không tin referrer hay URL bên ngoài.
const SOURCES = new Set(['/feed', '/chatbot', '/recipes', '/profile', '/meal-plan', '/shops', '/me/posts']);

function validSource(source) {
  if (typeof source !== 'string' || source.length > 2048 || !source.startsWith('/') || source.startsWith('//')) return null;
  try {
    const url = new URL(source, window.location.origin);
    if (url.origin !== window.location.origin || !SOURCES.has(url.pathname)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return null; }
}

export function openPostDetail(event, postId) {
  if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  if (!/^[1-9]\d{0,17}$/.test(String(postId))) return;
  const source = validSource(`${window.location.pathname}${window.location.search}${window.location.hash}`);
  if (!source) return;
  event.preventDefault();
  window.history.pushState({ postDetail: { version: 1, postId: String(postId), source } }, '', `/posts/${postId}`);
  window.location.reload();
}

export function postDetailBack(postId) {
  const marker = window.history.state?.postDetail;
  if (marker?.version !== 1 || marker.postId !== String(postId)) return '/feed';
  return validSource(marker.source) || '/feed';
}
