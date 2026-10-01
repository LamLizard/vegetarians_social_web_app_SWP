// Quy tắc nội dung – dùng chung cho form đăng bài (chặn trước) và trang duyệt (gợi ý cho quản trị viên).

/** BR-01: ghi chú thành phần phải nói rõ món có trứng/sữa hay không */
export const mentionsEggMilk = (s = '') => /trứng|sữa|trung|sua|thuần chay|thuan chay|vegan/i.test(s);

// Dấu hiệu quảng cáo / bán hàng
const AD_RE = /inbox|giảm \d+ ?kg|detox|thải độc|viên uống|giá sỉ|liên hệ mua|zalo|chốt đơn/i;
// Nguyên liệu mặn đứng thành từ riêng (tránh bắt nhầm "các", "cà")
const MEAT_RE = /(^|[\s,.(])(thịt|cá|tôm|cua|mực|mỡ heo|mỡ lợn|gà|bò|heo|lợn|nước mắm(?! chay))(?=$|[\s,.!?)])/i;

/**
 * Kiểm tra tự động cho 1 bài viết.
 * @returns {{ok:boolean, soft?:boolean, label:string}[]}  soft = chỉ để tham khảo, không phải lỗi
 */
export function postChecks(post) {
  const text = `${post.content} ${post.recipe?.title ?? ''} ${post.recipe?.ingredientsNote ?? ''}`;
  const checks = [];
  if (post.type === 'recipe') {
    const ok = mentionsEggMilk(post.recipe?.ingredientsNote);
    checks.push({ ok, label: ok ? 'Ghi chú thành phần đã nêu rõ trứng/sữa (BR-01)' : 'Ghi chú thành phần chưa nêu rõ có trứng/sữa hay không (BR-01)' });
  }
  const ad = AD_RE.test(text);
  checks.push({ ok: !ad, label: ad ? 'Có dấu hiệu quảng cáo, bán hàng' : 'Không có dấu hiệu quảng cáo, spam' });
  const meat = MEAT_RE.test(text);
  checks.push({ ok: !meat, label: meat ? 'Có nhắc tới nguyên liệu mặn, cần đọc kỹ' : 'Không nhắc tới nguyên liệu mặn' });
  if (post.type === 'review') {
    checks.push({ ok: !!post.restaurant?.address, label: post.restaurant?.address ? 'Có tên và địa chỉ quán' : 'Thiếu địa chỉ quán' });
  }
  checks.push({ ok: !!post.image, soft: true, label: post.image ? 'Có ảnh minh hoạ' : 'Không có ảnh (không bắt buộc)' });
  return checks;
}

export const warningCount = (checks) => checks.filter((c) => !c.ok && !c.soft).length;
