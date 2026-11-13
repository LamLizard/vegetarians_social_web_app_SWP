// Khoi's code (11/11/2026): không vẽ lại hàng thẻ công thức/quán Y HỆT lượt trả lời ngay trước đó
// (hai lượt liên tiếp cùng 3 thẻ làm khung chat dài và rối). Chỉ ẩn lúc hiển thị, dữ liệu lượt vẫn giữ nguyên.

const cardKey = (cards) => {
  const items = Array.isArray(cards?.items) ? cards.items : [];
  if (!items.length || (cards.kind !== 'recipes' && cards.kind !== 'shops')) return null;
  // Khoi's code (13/11/2026): tính cả dòng món của thẻ quán — cùng quán nhưng món khớp khác thì vẫn hiện.
  return `${cards.kind}:${items.map((item) => `${item.id}${item.menuHighlight ? `#${JSON.stringify(item.menuHighlight)}` : ''}`)
    .sort().join(',')}`;
};

/** Hai hàng thẻ giống nhau khi cùng loại và cùng tập id (không xét thứ tự). */
export function sameCards(a, b) {
  const key = cardKey(a);
  return key !== null && key === cardKey(b);
}

/**
 * Vị trí các tin của Mầm có hàng thẻ trùng với tin Mầm ngay trước đó.
 * Tin trước không có thẻ (hoặc thẻ khác) thì lượt này vẫn hiện bình thường.
 */
export function repeatedCardIndexes(messages = []) {
  const repeated = new Set();
  let previous = null;
  messages.forEach((message, index) => {
    if (message?.sender !== 'bot') return;
    if (sameCards(message.cards, previous)) repeated.add(index);
    previous = message.cards ?? null;
  });
  return repeated;
}
