// Khoi's code (11/11/2026): chạy bằng node --test src/utils/chatCards.test.js
import assert from 'node:assert/strict';
import test from 'node:test';
import { aiSuggestedSinceCards, repeatedCardIndexes, sameCards, seenRecipeIds } from './chatCards.js';

const recipes = (...ids) => ({ kind: 'recipes', items: ids.map((id) => ({ id: String(id), title: `Món ${id}` })) });
const bot = (cards) => ({ sender: 'bot', content: 'x', ...(cards ? { cards } : {}) });
const user = { sender: 'user', content: 'hỏi' };

test('sameCards: cùng loại, cùng tập id (không xét thứ tự)', () => {
  assert.equal(sameCards(recipes(1, 2, 3), recipes(3, 1, 2)), true);
  assert.equal(sameCards(recipes(1, 2, 3), recipes(1, 2)), false);
  assert.equal(sameCards(recipes(1, 2, 3), recipes(1, 2, 4)), false);
  assert.equal(sameCards(recipes(1), { kind: 'shops', items: [{ id: '1' }] }), false);
  assert.equal(sameCards(undefined, undefined), false);
  assert.equal(sameCards({ kind: 'recipes', items: [] }, { kind: 'recipes', items: [] }), false);
});

test('repeatedCardIndexes: lượt thứ hai cùng 3 thẻ bị đánh dấu, lượt đầu thì không', () => {
  const messages = [user, bot(recipes(46, 47, 44)), user, bot(recipes(46, 47, 44))];
  assert.deepEqual([...repeatedCardIndexes(messages)], [3]);
});

test('repeatedCardIndexes: khác một thẻ hoặc cách một lượt không có thẻ thì vẫn hiện', () => {
  assert.deepEqual([...repeatedCardIndexes([user, bot(recipes(1, 2, 3)), user, bot(recipes(1, 2, 4))])], []);
  assert.deepEqual([...repeatedCardIndexes([user, bot(recipes(1, 2, 3)), user, bot(), user, bot(recipes(1, 2, 3))])], []);
});

test('repeatedCardIndexes: ba lượt liên tiếp giống nhau → ẩn lượt 2 và 3', () => {
  const messages = [user, bot(recipes(1, 2)), user, bot(recipes(2, 1)), user, bot(recipes(1, 2))];
  assert.deepEqual([...repeatedCardIndexes(messages)], [3, 5]);
  assert.deepEqual([...repeatedCardIndexes([])], []);
});

// Khoi's code (13/11/2026): cùng quán nhưng dòng món khác (hỏi menu rồi hỏi một món) → không coi là lặp.
test('sameCards: thẻ quán cùng id nhưng menuHighlight khác thì không trùng', () => {
  const menu = { kind: 'shops', items: [{ id: '39', menuHighlight: { kind: 'menu', count: 4, minPrice: 49000 } }] };
  const dish = { kind: 'shops', items: [{ id: '39', menuHighlight: { kind: 'dish', name: 'Cơm chiên', price: 60000, more: 0 } }] };
  assert.equal(sameCards(menu, dish), false);
  assert.equal(sameCards(dish, { ...dish }), true);
});

// Khoi's code (14/11/2026): id công thức đã hiện (thẻ gợi ý + thẻ nguồn), không trùng, giới hạn số lượng.
test('seenRecipeIds: gom thẻ công thức + thẻ nguồn của Mầm, bỏ quán/tin người dùng, giữ mới nhất', () => {
  const messages = [user, bot(recipes(40, 61)), bot({ kind: 'shops', items: [{ id: '39' }] }),
    { sender: 'bot', content: 'x', source: { kind: 'recipe-source', item: { id: '12' } } }, bot(recipes(61, 70))];
  assert.deepEqual(seenRecipeIds(messages), ['40', '12', '61', '70']);
  assert.deepEqual(seenRecipeIds(messages, 2), ['61', '70']);
  assert.deepEqual(seenRecipeIds([]), []);
});

// Khoi's code (14/11/2026): đã tự gợi ý kể từ lần cuối có thẻ công thức (bỏ qua tin báo hết, tin lỗi).
test('aiSuggestedSinceCards: true sau nhãn gợi ý AI, giữ qua tin báo hết; false khi có thẻ công thức mới hơn', () => {
  const done = (extra) => ({ sender: 'bot', content: 'x', status: 'complete', ...extra });
  const suggested = done({ source: { kind: 'ai-generated', reason: 'suggestions' } });
  const cards = done({ cards: recipes(40) });
  const notice = done({});
  assert.equal(aiSuggestedSinceCards([cards, suggested]), true);
  assert.equal(aiSuggestedSinceCards([cards, suggested, notice, { sender: 'bot', content: 'x', status: 'failed' }]), true);
  assert.equal(aiSuggestedSinceCards([suggested, cards]), false);
  assert.equal(aiSuggestedSinceCards([done({ source: { kind: 'ai-generated', reason: 'recipe' } })]), false);
  assert.equal(aiSuggestedSinceCards([]), false);
});
