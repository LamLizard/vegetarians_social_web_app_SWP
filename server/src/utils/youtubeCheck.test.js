// Khoi's code: Test kiểm tra video YouTube (giả lập YouTube, không gọi mạng). Chạy: node --test src/utils/youtubeCheck.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkYouTubeVideo, youTubeRejectMessage, _cache } = require('./youtubeCheck');

const URL_OK = 'https://youtu.be/dQw4w9WgXcQ';
/** fetch giả: trả mã `status` (và body nếu 200), đếm số lần gọi */
const fakeFetch = (status, body = {}) => {
  const f = async () => { f.calls += 1; return { ok: status === 200, status, json: async () => body }; };
  f.calls = 0;
  return f;
};

test.beforeEach(() => _cache.clear());

test('200 → ok, có tên video và kênh; lần 2 lấy từ bộ nhớ, không hỏi lại', async () => {
  const f = fakeFetch(200, { title: 'Gỏi cuốn chay', author_name: 'Bếp Chay' });
  const r = await checkYouTubeVideo(URL_OK, { fetchImpl: f });
  assert.deepEqual(r, { status: 'ok', videoId: 'dQw4w9WgXcQ', title: 'Gỏi cuốn chay', author: 'Bếp Chay' });
  await checkYouTubeVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10', { fetchImpl: f });
  assert.equal(f.calls, 1);
});

test('401/403 → blocked (tắt nhúng / riêng tư); 404/400 → missing — đều chặn', async () => {
  for (const code of [401, 403]) {
    _cache.clear();
    assert.equal((await checkYouTubeVideo(URL_OK, { fetchImpl: fakeFetch(code) })).status, 'blocked');
  }
  for (const code of [404, 400]) {
    _cache.clear();
    assert.equal((await checkYouTubeVideo(URL_OK, { fetchImpl: fakeFetch(code) })).status, 'missing');
  }
  _cache.clear();
  assert.match(await youTubeRejectMessage(URL_OK, { fetchImpl: fakeFetch(401) }), /không phát được trên trang khác/);
});

test('lỗi mạng / quá giờ / mã lạ → unknown, VẪN CHO ĐĂNG và không lưu bộ nhớ', async () => {
  const down = async () => { throw Object.assign(new Error('timeout'), { name: 'TimeoutError' }); };
  assert.equal((await checkYouTubeVideo(URL_OK, { fetchImpl: down })).status, 'unknown');
  assert.equal(await youTubeRejectMessage(URL_OK, { fetchImpl: down }), null);
  assert.equal((await checkYouTubeVideo(URL_OK, { fetchImpl: fakeFetch(500) })).status, 'unknown');
  assert.equal(_cache.size, 0);
});

test('link không phải YouTube → invalid, không gọi mạng', async () => {
  const f = fakeFetch(200);
  assert.equal((await checkYouTubeVideo('https://vimeo.com/123', { fetchImpl: f })).status, 'invalid');
  assert.equal(f.calls, 0);
});
