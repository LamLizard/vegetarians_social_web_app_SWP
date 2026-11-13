// Khoi's code (14/11/2026): chạy bằng node --test src/utils/chatSession.test.js
// Phiên lưu có nhãn "Gợi ý do AI tạo" (reason) phải đọc lại được — trước đây bị coi là hỏng.
import assert from 'node:assert/strict';
import test from 'node:test';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => { store.set(key, String(value)); },
  removeItem: (key) => { store.delete(key); },
};
const { readChatSession, writeChatSession } = await import('./chatSession.js');

const bot = (source) => ({ sender: 'bot', content: 'Gợi ý thêm: canh cà chua.', status: 'complete', source });

test('readChatSession: nhãn ai-generated có hoặc không có reason đều hợp lệ', () => {
  writeChatSession('acc:1', 'token', [{ sender: 'user', content: 'món cà chua' }, bot({ kind: 'ai-generated', reason: 'suggestions' })]);
  assert.equal(readChatSession('acc:1').messages[1].source.reason, 'suggestions');
  writeChatSession('acc:1', 'token', [bot({ kind: 'ai-generated' })]);
  assert.equal(readChatSession('acc:1').messages.length, 1);
});

test('readChatSession: reason lạ hoặc khoá thừa vẫn bị từ chối', () => {
  writeChatSession('acc:2', 'token', [bot({ kind: 'ai-generated', reason: 'other' })]);
  assert.throws(() => readChatSession('acc:2'));
  writeChatSession('acc:2', 'token', [bot({ kind: 'ai-generated', extra: 1 })]);
  assert.throws(() => readChatSession('acc:2'));
});
