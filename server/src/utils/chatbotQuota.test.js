// Khoi's code (05/11/2026): test hàm tạo subject_key theo IP cho hạn mức khách.
const test = require('node:test');
const assert = require('node:assert/strict');
const { ipSubjectKey, FALLBACK_SUBJECT_KEY } = require('./chatbotQuota');

test('ipSubjectKey: ổn định, đúng định dạng và không lộ IP gốc', () => {
  const first = ipSubjectKey('203.0.113.9', 'secret-key');
  assert.equal(first, ipSubjectKey('203.0.113.9', 'secret-key'));
  assert.match(first, /^ip:[0-9a-f]{32}$/);
  assert.equal(first.length, 35);
  assert.equal(first.includes('203.0.113.9'), false);
  assert.equal(first.includes('secret-key'), false);
});

test('ipSubjectKey: khác IP hoặc khác khoá → khoá khác', () => {
  const base = ipSubjectKey('203.0.113.9', 'secret-key');
  assert.notEqual(base, ipSubjectKey('203.0.113.10', 'secret-key'));
  assert.notEqual(base, ipSubjectKey('203.0.113.9', 'other-key'));
  assert.notEqual(base, ipSubjectKey('2001:db8::1', 'secret-key'));
});

test('ipSubjectKey: thiếu khoá → dùng chuỗi cố định, vẫn ổn định', () => {
  const fallback = ipSubjectKey('203.0.113.9', undefined);
  assert.match(fallback, /^ip:[0-9a-f]{32}$/);
  assert.equal(fallback, ipSubjectKey('203.0.113.9', ''));
  assert.equal(fallback, ipSubjectKey('203.0.113.9', '   '));
  assert.equal(fallback, ipSubjectKey('203.0.113.9', null));
  assert.notEqual(fallback, ipSubjectKey('203.0.113.9', `${FALLBACK_SUBJECT_KEY}-khac`));
});

test('ipSubjectKey: chuẩn hoá khoảng trắng và giá trị rỗng', () => {
  assert.equal(ipSubjectKey(' 203.0.113.9 ', 'secret-key'), ipSubjectKey('203.0.113.9', 'secret-key'));
  assert.equal(ipSubjectKey(undefined, 'secret-key'), ipSubjectKey('', 'secret-key'));
});
