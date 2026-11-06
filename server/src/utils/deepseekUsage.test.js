// Khoi's code (07/11/2026): thống kê phải có loại gọi 'verifier' của lớp duyệt đầu ra.
const test = require('node:test');
const assert = require('node:assert/strict');
const usage = require('./deepseekUsage');

test('begin/getUsage: ghi nhận riêng loại gọi verifier', () => {
  usage.activate();
  const day = usage.vietnamDate();
  const groupOf = (date) => usage.getUsage(date).groups.find((group) => group.kind === 'verifier');

  assert.equal(groupOf(day), undefined);
  const observation = usage.begin('verifier');
  observation.usage({ prompt_tokens: 40, completion_tokens: 12, total_tokens: 52 });
  observation.finish(false);
  const group = groupOf(day);
  assert.equal(group.attempts, 1);
  assert.equal(group.errors, 0);
  assert.equal(group.inFlight, 0);
  assert.equal(group.promptTokens, 40);
  assert.equal(group.completionTokens, 12);
  assert.equal(group.totalTokens, 52);
});

test('begin: loại gọi lạ không tạo nhóm và đánh dấu thiếu dữ liệu', () => {
  assert.equal(usage.begin('unknown-kind'), null);
  assert.equal(usage.getUsage(usage.vietnamDate()).coverage.state, 'partial');
});
