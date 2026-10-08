// Khoi's code: Kiểm tra dữ liệu form Đăng bài (POST /api/posts) — hàm thuần, không gọi DB, dễ test.
// Theo "Quyết định Sprint 2 – Đăng bài": D-05 blog + video · D-11 tiêu đề ≤ 255, nội dung bắt buộc
// · D-12 ít nhất 1 Category · D-13 ảnh bìa không bắt buộc · D-14 video bắt buộc mô tả.
// Không nhận status / accountId từ client: bài mới luôn 'pending', tác giả lấy từ token.

const MAX_TITLE = 255;
const MAX_URL = 255;
const POST_TYPES = ['blog', 'video'];

/** Lỗi dữ liệu đầu vào → controller đổi thành HTTP 400 */
class PostInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PostInputError';
  }
}

/** Đếm theo ký tự (tiếng Việt có dấu, emoji) giống VARCHAR của PostgreSQL */
const charCount = (s) => [...s].length;

/** Giống getYouTubeId ở client/src/utils/validate.js — FE và BE chấp nhận cùng loại link. */
function getYouTubeId(url) {
  try {
    const u = new URL(String(url).trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    const host = u.hostname.replace(/^www\.|^m\./, '');
    let id = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com' || host === 'music.youtube.com') {
      id = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/)?.[1] ?? null;
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Ảnh bìa chỉ nhận link do chính API upload của mình trả về (kho Cloudinary của nhóm). */
function parseThumbnailUrl(value, cloudName) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new PostInputError('Ảnh bìa không hợp lệ.');
  const url = value.trim();
  const prefix = `https://res.cloudinary.com/${cloudName}/image/upload/`;
  if (!cloudName || !url.startsWith(prefix) || charCount(url) > MAX_URL) {
    throw new PostInputError('Ảnh bìa không hợp lệ, vui lòng tải ảnh lên lại.');
  }
  return url;
}

/** ["3","7",3] → ["3","7"]: số nguyên dương, bỏ trùng, giữ chuỗi để không mất độ chính xác BIGINT */
function parseCategoryIds(value) {
  if (!Array.isArray(value) || value.length === 0) throw new PostInputError('Chọn ít nhất 1 tag cho bài viết.');
  const ids = value.map((v) => String(v ?? '').trim());
  if (ids.some((s) => !/^[1-9]\d{0,17}$/.test(s))) throw new PostInputError('Tag không hợp lệ.');
  return [...new Set(ids)];
}

/**
 * @param {object} body  req.body
 * @param {{ cloudName?: string }} options
 * @returns {{ postType, title, content, thumbnailUrl, youtubeUrl, categoryIds }}
 */
function parsePostInput(body, { cloudName } = {}) {
  const b = body ?? {};

  const postType = b.postType;
  if (!POST_TYPES.includes(postType)) throw new PostInputError('Chọn loại bài: Blog hoặc Video.');

  if (typeof b.title !== 'string' || !b.title.trim()) throw new PostInputError('Vui lòng nhập tiêu đề.');
  const title = b.title.trim();
  if (charCount(title) > MAX_TITLE) throw new PostInputError(`Tiêu đề tối đa ${MAX_TITLE} ký tự.`);

  // Nội dung lưu dạng Markdown (**đậm**, *nghiêng*) — không giới hạn độ dài (D-11), chỉ bắt buộc có chữ.
  if (typeof b.content !== 'string' || !b.content.trim()) {
    throw new PostInputError(postType === 'video' ? 'Vui lòng nhập mô tả cho video.' : 'Vui lòng nhập nội dung bài viết.');
  }
  const content = b.content.trim();

  let youtubeUrl = null;
  if (postType === 'video') {
    const id = typeof b.youtubeUrl === 'string' ? getYouTubeId(b.youtubeUrl) : null;
    if (!id) throw new PostInputError('Link YouTube chưa đúng, ví dụ https://www.youtube.com/watch?v=...');
    youtubeUrl = `https://www.youtube.com/watch?v=${id}`; // lưu một dạng chuẩn, bỏ tham số thừa
  }

  const thumbnailUrl = parseThumbnailUrl(b.thumbnailUrl, cloudName);
  const categoryIds = parseCategoryIds(b.categoryIds);

  return { postType, title, content, thumbnailUrl, youtubeUrl, categoryIds };
}

module.exports = { parsePostInput, getYouTubeId, PostInputError, MAX_TITLE };
