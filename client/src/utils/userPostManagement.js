// Duy's Code: Chuyển action kiểm duyệt hiện có thành nhãn riêng cho trang Bài của tôi.
export function getMyPostDisplayStatus(post) {
  if (post?.status !== 'deleted') return post?.status;
  if (post.moderationAction === 'REJECT') return 'rejected';
  if (post.moderationAction === 'REMOVE') return 'removed';
  return 'deleted';
}

// Duy's Code: Chỉ bài công khai/bị báo cáo mới cho phép tương tác theo chính sách API.
export function canInteractWithManagedPost(post) {
  return ['public', 'reported'].includes(post?.status);
}
