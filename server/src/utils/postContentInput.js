// Tùng: input và fingerprint riêng cho luồng tạo post/comment có Moderation.
const { createHash } = require('node:crypto');
const { PostInputError } = require('./postInput');

const MAX_COMMENT = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseId(value, label = 'ID') {
  const id = String(value ?? '');
  if (!/^[1-9]\d{0,17}$/.test(id)) throw new PostInputError(`${label} không hợp lệ.`);
  return id;
}

function parseRequestId(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw new PostInputError('Mã yêu cầu không hợp lệ.');
  }
  return value.toLowerCase();
}

function parseCommentInput(postId, body) {
  const content = String(body?.content ?? '').trim();
  if (!content) throw new PostInputError('Bình luận không được để trống.');
  if ([...content].length > MAX_COMMENT) {
    throw new PostInputError(`Bình luận tối đa ${MAX_COMMENT} ký tự.`);
  }
  return {
    postId: parseId(postId, 'Mã bài viết'),
    content,
    requestId: parseRequestId(body?.requestId),
  };
}

/** Chỉ nhận dữ liệu ĐÃ parse; không đưa author/status/requestId từ client vào hash. */
function submissionFingerprint(kind, input) {
  let payload;
  if (kind === 'post') {
    payload = {
      postType: input.postType,
      title: input.title,
      content: input.content,
      thumbnailUrl: input.thumbnailUrl,
      youtubeUrl: input.youtubeUrl,
      categoryIds: [...input.categoryIds].sort(),
    };
  } else if (kind === 'comment') {
    payload = { postId: input.postId, content: input.content };
  } else {
    throw new TypeError('Unknown submission kind.');
  }
  return createHash('sha256').update(JSON.stringify({ kind, payload })).digest('hex');
}

module.exports = { parseId, parseRequestId, parseCommentInput, submissionFingerprint };
