// Duy's Code: Một điểm ánh xạ duy nhất; chỉ notification gắn trực tiếp với bài có thể điều hướng.
const POST_NOTIFICATION_TYPES = new Set(['post_approved', 'post_rejected', 'post_hidden', 'post_removed']);

export default function getNotificationTarget(notification, role = 'member') {
  if (role !== 'member' || notification?.refType !== 'post'
    || !POST_NOTIFICATION_TYPES.has(notification.type) || !notification.refId) return null;
  return `/me/posts?postId=${encodeURIComponent(notification.refId)}`;
}
