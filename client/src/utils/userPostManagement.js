// Duy's Code: Chuyển action kiểm duyệt hiện có thành nhãn riêng cho trang Bài của tôi.
export function getMyPostDisplayStatus(post) {
  if (post?.status !== 'deleted') return post?.status;
  if (post.moderationAction === 'REJECT' || post.moderationSource === 'ai') return 'rejected';
  if (post.moderationAction === 'REMOVE') return 'removed';
  return 'deleted';
}

// Deleted posts only show a moderation reason while REJECT/REMOVE was still the latest action at deletion time.
export function getMyPostModerationMessage(post) {
  if (post?.status === 'deleted') {
    if (['REJECT', 'REMOVE'].includes(post.moderationAction) || post.moderationSource === 'ai') return post.moderationNote || '';
    return '';
  }
  return post?.moderationNote || '';
}

// Duy's Code: Chỉ bài đang công khai được gửi sửa để kiểm duyệt lại.
export function canEdit(post) {
  return post?.status === 'public';
}

// Duy's Code: Chỉ bài công khai/bị báo cáo mới cho phép tương tác theo chính sách API.
export function canInteractWithManagedPost(post) {
  return ['public', 'reported'].includes(post?.status);
}
