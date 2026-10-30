// Khoi's code 28/10/2026: test hàm dựng điều kiện tìm kiếm Bảng tin (không cần DB). 29/10: hashtag → chủ đề.
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSearch, VI_FROM, VI_TO, SEARCH_SCOPES } = require('./postSearch');

// Bỏ dấu giống translate() của SQL, để kiểm tra bảng chữ
const foldJs = (s) => [...s.toLowerCase()].map((c) => { const i = [...VI_FROM].indexOf(c); return i < 0 ? c : [...VI_TO][i]; }).join('');

test('bảng bỏ dấu: đủ 67 chữ thường + 67 chữ hoa, khớp từng cặp', () => {
  assert.equal([...VI_FROM].length, 134);
  assert.equal([...VI_TO].length, 134);
  assert.equal(foldJs('Bánh Bao Đậu Hũ Chiên Giòn'), 'banh bao dau hu chien gion');
  assert.equal(foldJs('NGUYỄN THẢO LINH'), 'nguyen thao linh');
  assert.equal(foldJs('ầấậẩẫ ờớợởỡ ừứựửữ ỳýỵỷỹ'), 'aaaaa ooooo uuuuu yyyyy');
});

test('phạm vi hợp lệ', () => {
  assert.deepEqual(SEARCH_SCOPES, ['all', 'title', 'author', 'topic']);
});

test('title / author / topic: chỉ bật đúng điều kiện, escape % và _', () => {
  assert.deepEqual(buildSearch('canh', 'title'), { titleLike: '%canh%', authorLike: null, topicLike: null });
  assert.deepEqual(buildSearch('linh', 'author'), { titleLike: null, authorLike: '%linh%', topicLike: null });
  assert.deepEqual(buildSearch('kinh nghiem', 'topic'), { titleLike: null, authorLike: null, topicLike: '%kinh nghiem%' });
  assert.equal(buildSearch('50%_off', 'title').titleLike, '%50\\%\\_off%');
});

test('all: tiêu đề + tác giả + chủ đề; gõ "#tên" → chỉ chủ đề', () => {
  assert.deepEqual(buildSearch('canh chua', 'all'), { titleLike: '%canh chua%', authorLike: '%canh chua%', topicLike: '%canh chua%' });
  assert.deepEqual(buildSearch('#Món chính', 'all'), { titleLike: null, authorLike: null, topicLike: '%Món chính%' });
  assert.equal(buildSearch('#salad', 'topic').topicLike, '%salad%');
});

test('rỗng hoặc chỉ "#" → không lọc', () => {
  const none = { titleLike: null, authorLike: null, topicLike: null };
  assert.deepEqual(buildSearch('   ', 'all'), none);
  assert.deepEqual(buildSearch('#', 'all'), none);
});
