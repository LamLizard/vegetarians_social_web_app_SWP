// Khoi's code: Test kiểm tra dữ liệu Đăng bài. Chạy: node --test src/utils/postInput.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePostInput, getYouTubeId, PostInputError } = require('./postInput');

const CLOUD = 'demo-cloud';
const IMG = `https://res.cloudinary.com/${CLOUD}/image/upload/v1/greenbowl/posts/abc.jpg`;
const blog = (over = {}) => ({ postType: 'blog', title: 'Salad đậu', content: 'Trộn **đều**', categoryIds: ['2'], ...over });
const video = (over = {}) => ({ ...blog(), postType: 'video', youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', ...over });
const parse = (body) => parsePostInput(body, { cloudName: CLOUD });
const rejects = (body, re) => assert.throws(() => parse(body), (e) => e instanceof PostInputError && re.test(e.message));

test('blog hợp lệ: cắt khoảng trắng, không có link YouTube, ảnh bìa để trống được', () => {
  assert.deepEqual(parse(blog({ title: '  Salad đậu  ' })), {
    postType: 'blog', title: 'Salad đậu', content: 'Trộn **đều**', thumbnailUrl: null, youtubeUrl: null, categoryIds: ['2'],
  });
});

test('blog bỏ qua youtubeUrl gửi kèm', () => {
  assert.equal(parse(blog({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' })).youtubeUrl, null);
});

test('video: lưu link YouTube dạng chuẩn', () => {
  assert.equal(parse(video()).youtubeUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(parse(video({ youtubeUrl: 'https://www.youtube.com/shorts/dQw4w9WgXcQ?si=x' })).youtubeUrl,
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
});

test('video thiếu hoặc sai link YouTube bị từ chối', () => {
  for (const youtubeUrl of [undefined, '', 'https://vimeo.com/123', 'https://youtube.com/watch?v=short', 'javascript:alert(1)']) {
    rejects(video({ youtubeUrl }), /Link YouTube/);
  }
});

test('loại bài phải là blog hoặc video', () => {
  for (const postType of [undefined, 'recipe', 'BLOG', ['blog']]) rejects(blog({ postType }), /Blog hoặc Video/);
});

test('tiêu đề: bắt buộc, tối đa 255 ký tự (đếm cả chữ có dấu)', () => {
  rejects(blog({ title: '   ' }), /tiêu đề/);
  rejects(blog({ title: 123 }), /tiêu đề/);
  assert.equal(parse(blog({ title: 'ă'.repeat(255) })).title.length, 255);
  rejects(blog({ title: 'ă'.repeat(256) }), /255/);
});

test('nội dung bắt buộc, không giới hạn độ dài; video báo thiếu mô tả', () => {
  rejects(blog({ content: '  ' }), /nội dung/);
  rejects(video({ content: '' }), /mô tả/);
  assert.equal(parse(blog({ content: 'x'.repeat(50000) })).content.length, 50000);
});

test('ảnh bìa chỉ nhận link Cloudinary của nhóm', () => {
  assert.equal(parse(blog({ thumbnailUrl: IMG })).thumbnailUrl, IMG);
  for (const thumbnailUrl of ['https://evil.com/a.jpg', 'https://res.cloudinary.com/other/image/upload/a.jpg', 42]) {
    rejects(blog({ thumbnailUrl }), /Ảnh bìa/);
  }
  assert.throws(() => parsePostInput(blog({ thumbnailUrl: IMG }), {}), PostInputError); // thiếu cloudName trong .env
});

test('tag: ít nhất 1, số nguyên dương, bỏ trùng', () => {
  assert.deepEqual(parse(blog({ categoryIds: ['3', 3, '7'] })).categoryIds, ['3', '7']);
  for (const categoryIds of [undefined, [], '3', ['0'], ['-1'], ['1 OR 1=1'], [null]]) {
    assert.throws(() => parse(blog({ categoryIds })), PostInputError);
  }
});

test('không nhận status hay tác giả do client gửi', () => {
  const out = parse(blog({ status: 'public', accountId: '1' }));
  assert.equal('status' in out, false);
  assert.equal('accountId' in out, false);
});

test('getYouTubeId giống phía client', () => {
  assert.equal(getYouTubeId('https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10'), 'dQw4w9WgXcQ');
  assert.equal(getYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(getYouTubeId('not a url'), null);
});
