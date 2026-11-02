// Tùng: contract mới chỉ cho tạo post và đọc/tạo comment; giữ post.service/api.js nguyên trạng.
import { apiFetch } from './api';

const POST_OUTCOMES = { public: 'approved', reported: 'approved', pending: 'manual_pending', deleted: 'rejected' };
const COMMENT_OUTCOMES = new Set(['accepted', 'rejected', 'accepted_unfiltered', 'not_visible']);

function invalidResponse() {
  return new Error('Phản hồi gửi nội dung chưa hợp lệ. Vui lòng tải lại hoặc thử lại cùng bản nháp.');
}

function publicCount(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value))) {
    throw invalidResponse();
  }
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) throw invalidResponse();
  return count;
}

function warnings(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((warning) => warning?.code === 'animal' && typeof warning.message === 'string')
    .map(({ code, message }) => ({ code, message }));
}

function normalizeComment(comment, { allowNotVisible = false } = {}) {
  const outcome = comment?.moderation?.outcome;
  if (!comment?.id || !COMMENT_OUTCOMES.has(outcome) || typeof comment.isOwner !== 'boolean') {
    throw invalidResponse();
  }
  if (outcome === 'not_visible') {
    if (!allowNotVisible || comment.displayable !== false) throw invalidResponse();
    // Replay sau khi Admin ẩn/xóa: không mang lại body/author cũ vào UI.
    return { id: comment.id, status: comment.status, isOwner: comment.isOwner,
      displayable: false, moderation: { outcome, reason: null, warnings: [] } };
  }
  const rejected = outcome === 'rejected';
  if (comment.displayable === false || typeof comment.content !== 'string' || !comment.author
      || (rejected && (comment.status !== 'hidden' || !comment.isOwner
        || typeof comment.moderation.reason !== 'string' || !comment.moderation.reason.trim()))
      || (!rejected && comment.status !== 'public')) {
    throw invalidResponse();
  }
  return {
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt,
    author: comment.author,
    isOwner: comment.isOwner,
    status: comment.status,
    displayable: true,
    moderation: {
      outcome,
      reason: rejected ? comment.moderation.reason : null,
      warnings: comment.isOwner ? warnings(comment.moderation.warnings) : [],
    },
  };
}

const postContentService = {
  async createPost(data, { signal } = {}) {
    // Chuỗi body được tạo một lần, apiFetch retry vẫn gửi cùng requestId.
    const result = await apiFetch('/posts', { method: 'POST', body: JSON.stringify(data), signal });
    const post = result?.post;
    const outcome = Object.hasOwn(POST_OUTCOMES, post?.status) ? POST_OUTCOMES[post.status] : null;
    if (!post?.id || !outcome || result.outcome !== outcome || typeof result.replayed !== 'boolean') {
      throw invalidResponse();
    }
    return {
      message: result.message,
      post: {
        id: post.id, status: post.status, createdAt: post.createdAt, publishedAt: post.publishedAt,
        moderationNote: typeof post.moderationNote === 'string' ? post.moderationNote : null,
      },
      outcome,
      warnings: warnings(result.warnings),
      replayed: result.replayed,
    };
  },

  async getComments(postId, { signal } = {}) {
    const result = await apiFetch(`/posts/${encodeURIComponent(postId)}/comments`, {
      signal, cache: 'no-store',
    });
    if (!Array.isArray(result?.items)) throw invalidResponse();
    return {
      items: result.items.map((comment) => normalizeComment(comment)),
      publicCommentCount: publicCount(result.publicCommentCount),
    };
  },

  async addComment(postId, content, { requestId, signal } = {}) {
    const result = await apiFetch(`/posts/${encodeURIComponent(postId)}/comments`, {
      method: 'POST', body: JSON.stringify({ content, requestId }), signal,
    });
    if (typeof result?.replayed !== 'boolean') throw invalidResponse();
    return {
      ...normalizeComment(result, { allowNotVisible: true }),
      publicCommentCount: publicCount(result.publicCommentCount),
      replayed: result.replayed,
    };
  },

  async deleteComment(commentId, { signal } = {}) {
    const result = await apiFetch(`/posts/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE', signal });
    if (result?.deleted !== true) throw invalidResponse();
    return { publicCommentCount: publicCount(result.publicCommentCount) };
  },
};

export default postContentService;
