// Khoi's code: Kiểm tra video YouTube có PHÁT ĐƯỢC trên trang của mình không, trước khi lưu bài viết / công thức (15/10/2026).
// Hỏi oEmbed công khai của YouTube (không cần API key):
//   200        → video tồn tại và cho nhúng (kèm tên video, tên kênh)
//   401 / 403  → chủ video tắt nhúng, hoặc video để riêng tư  → CHẶN
//   400 / 404  → không có video này (đã xoá, link sai)        → CHẶN
//   lỗi mạng, quá 4 giây, mã lạ → 'unknown' → VẪN CHO ĐĂNG (YouTube trục trặc thì không chặn người dùng)
const { getYouTubeId } = require('./postInput');

const TIMEOUT_MS = 4000;
const CACHE_MS = 10 * 60 * 1000; // nhớ kết quả 10 phút: gõ lại / bấm gửi không phải hỏi YouTube lần nữa
const CACHE_MAX = 500;
const cache = new Map(); // videoId → { at, result }

const MESSAGES = {
  invalid: 'Link YouTube không hợp lệ. Dán link dạng youtube.com/watch?v=… hoặc youtu.be/…',
  blocked: 'Video này không phát được trên trang khác (chủ video tắt nhúng hoặc để riêng tư). Hãy chọn video khác.',
  missing: 'Không tìm thấy video này (có thể đã bị xoá). Hãy kiểm tra lại link.',
  unknown: 'Chưa kiểm tra được video lúc này. Bạn vẫn gửi được.',
};

/** Trạng thái phải chặn gửi */
const REJECTED = new Set(['invalid', 'blocked', 'missing']);

/**
 * @param {string} url  link YouTube người dùng dán
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number, now?: () => number }} [deps]  thay được khi test
 * @returns {Promise<{ status: 'ok'|'invalid'|'blocked'|'missing'|'unknown', videoId?: string,
 *                     title?: string|null, author?: string|null, message?: string }>}
 */
async function checkYouTubeVideo(url, { fetchImpl = globalThis.fetch, timeoutMs = TIMEOUT_MS, now = Date.now } = {}) {
  const videoId = getYouTubeId(url);
  if (!videoId) return { status: 'invalid', message: MESSAGES.invalid };

  const hit = cache.get(videoId);
  if (hit && now() - hit.at < CACHE_MS) return hit.result;

  let result;
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetchImpl(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
      { signal: AbortSignal.timeout(timeoutMs) },
    );
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      result = { status: 'ok', videoId, title: data.title ?? null, author: data.author_name ?? null };
    } else if (res.status === 401 || res.status === 403) {
      result = { status: 'blocked', videoId, message: MESSAGES.blocked };
    } else if (res.status === 400 || res.status === 404) {
      result = { status: 'missing', videoId, message: MESSAGES.missing };
    } else {
      console.warn(`[youtubeCheck] oEmbed trả mã ${res.status} cho ${videoId} — vẫn cho đăng`);
      return { status: 'unknown', videoId, message: MESSAGES.unknown }; // không lưu cache: lần sau hỏi lại
    }
  } catch (error) {
    console.warn(`[youtubeCheck] Không hỏi được YouTube cho ${videoId}: ${error.name} — vẫn cho đăng`);
    return { status: 'unknown', videoId, message: MESSAGES.unknown };
  }

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value); // bỏ kết quả cũ nhất
  cache.set(videoId, { at: now(), result });
  return result;
}

/** Dùng ở controller: video không phát được → trả câu lỗi để báo 400; được (hoặc chưa kiểm tra được) → null */
async function youTubeRejectMessage(url, deps) {
  const result = await checkYouTubeVideo(url, deps);
  return REJECTED.has(result.status) ? result.message : null;
}

module.exports = { checkYouTubeVideo, youTubeRejectMessage, MESSAGES, _cache: cache };
