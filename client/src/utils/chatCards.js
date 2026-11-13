// Khoi's code (11/11/2026): không vẽ lại hàng thẻ công thức/quán Y HỆT lượt trả lời ngay trước đó
// (hai lượt liên tiếp cùng 3 thẻ làm khung chat dài và rối). Chỉ ẩn lúc hiển thị, dữ liệu lượt vẫn giữ nguyên.

const cardKey = (cards) => {
  const items = Array.isArray(cards?.items) ? cards.items : [];
  if (!items.length || (cards.kind !== 'recipes' && cards.kind !== 'shops')) return null;
  // Khoi's code (13/11/2026): tính cả dòng món của thẻ quán — cùng quán nhưng món khớp khác thì vẫn hiện.
  return `${cards.kind}:${items.map((item) => `${item.id}${item.menuHighlight ? `#${JSON.stringify(item.menuHighlight)}` : ''}`)
    .sort().join(',')}`;
};

// Khoi's code (14/11/2026): id các công thức đã hiện thẻ (gợi ý + nguồn) trong cuộc trò chuyện, mới nhất giữ lại,
// tối đa 60 — gửi server để "thêm món khác" không gợi ý lặp lại.
export function seenRecipeIds(messages = [], max = 60) {
  const ids = [];
  for (const message of messages) {
    if (message?.sender !== 'bot') continue;
    if (message.cards?.kind === 'recipes' && Array.isArray(message.cards.items)) {
      ids.push(...message.cards.items.map((item) => String(item?.id ?? '')));
    }
    if (message.source?.kind === 'recipe-source' && message.source.item?.id) ids.push(String(message.source.item.id));
  }
  const unique = [...new Set(ids.reverse().filter((id) => /^[1-9]\d{0,17}$/.test(id)))].slice(0, max);
  return unique.reverse();
}

// Khoi's code (14/11/2026): kể từ lần cuối có thẻ công thức, Mầm đã từng tự gợi ý món (nhãn "Gợi ý do AI tạo") chưa.
// Đúng → server trả câu "đã gợi ý hết" và hoàn lượt khi người dùng hỏi lại lúc đã hết công thức.
export function aiSuggestedSinceCards(messages = []) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.sender !== 'bot' || message.status !== 'complete') continue;
    if (message.cards?.kind === 'recipes' && message.cards.items?.length) return false;
    if (message.source?.kind === 'ai-generated' && message.source.reason === 'suggestions') return true;
  }
  return false;
}

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
