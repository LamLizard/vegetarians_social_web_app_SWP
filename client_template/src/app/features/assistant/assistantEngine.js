// =====================================================================
//  MẦM – TRỢ LÝ AI (BẢN GIẢ LẬP cho demo giao diện)
//  Trả lời theo từ khoá, có độ trễ giống gọi API thật.
//  Câu trả lời gồm chữ + "thẻ" (cards) để giao diện vẽ thành component thật:
//    { type: 'meals' }            → 4 thẻ MealCard (thực đơn 1 ngày)
//    { type: 'micros' }           → danh sách vi chất tuần này
//    { type: 'macros' }           → tiến độ đạm/carbs/béo/xơ hôm nay
//    { type: 'places' }           → quán chay đã xác minh
//    { type: 'dishes', ids: [] }  → thẻ món ăn từ mục Khám phá
//  Khi nối backend: thay thân getReply() bằng fetch('/api/assistant', …),
//  giữ nguyên dạng { text, followUps, cards }.
// =====================================================================

export const ASSISTANT_NAME = 'Mầm';
export const DAILY_LIMIT = 20;

// Bỏ dấu tiếng Việt để so khớp từ khoá dễ hơn: "Đạm" → "dam"
const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
// Bỏ dấu câu, thêm khoảng trắng 2 đầu → so khớp được cả từ nguyên vẹn: " hi "
const clean = (s) => ` ${normalize(s).replace(/[^a-z0-9]+/g, ' ')} `;

// Bộ lọc từ khoá (bản thật do quản trị viên cấu hình). So khớp theo từ nguyên vẹn.
const BLOCKED = ['dm', 'dmm', 'vcl', 'vkl', 'clgt', 'thuoc giam can', 'thuoc xo', 'nhin an 7 ngay'];

export function isBlocked(text) {
  const t = clean(text);
  return BLOCKED.some((w) => t.includes(` ${w} `));
}

const RULES = [
  {
    keys: ['xin chao', 'chao ban', 'chao mam', 'hello', ' hi ', ' alo '],
    reply: ({ name }) => ({
      text: `Chào ${name}! Mình là Mầm, trợ lý dinh dưỡng của cộng đồng. Mình gợi ý món chay, lên thực đơn, xem bạn còn thiếu vi chất nào, hoặc tìm quán chay đã được xác minh.`,
      followUps: ['Lên thực đơn hôm nay cho mình', 'Người ăn chay lấy đạm từ đâu?'],
    }),
  },
  {
    keys: ['phan tich', 'thuan chay hoa', 'bao nhieu dam', 'bao nhieu calo'],
    reply: () => ({
      text: 'Mình ước tính một phần món này khoảng 400-450 kcal, đạm 20-24g, phần lớn từ đậu hũ và nấm. Dưới đây là mức bạn đã nạp hôm nay, ăn thêm món này là gần đủ đạm cho cả ngày.\n\nMuốn thuần chay hoá: thay nước mắm bằng nước tương nấm, thay bơ động vật bằng dầu mè.',
      followUps: ['Gợi ý món ăn kèm cho đủ chất xơ', 'Món này hợp bữa tối không?'],
      cards: [{ type: 'macros' }],
    }),
  },
  {
    keys: ['b12'],
    reply: () => ({
      text: 'Vitamin B12 gần như chỉ có trong thực phẩm động vật, nên người ăn chay dễ thiếu nhất.\n\nNguồn B12 cho người ăn chay:\n• Sữa hạt, sữa đậu nành có bổ sung B12 (xem nhãn)\n• Ngũ cốc ăn sáng tăng cường B12\n• Men dinh dưỡng (nutritional yeast)\n• Trứng, sữa nếu bạn ăn chay có trứng sữa\n\nTuần này bạn đang thiếu B12. Nếu ăn thuần chay lâu năm, hãy hỏi bác sĩ về viên uống bổ sung nhé.',
      followUps: ['Dấu hiệu thiếu B12 là gì?', 'Gợi ý bữa sáng giàu B12'],
      cards: [{ type: 'micros' }],
    }),
  },
  {
    keys: ['dam', 'protein', 'tap gym'],
    reply: () => ({
      text: 'Nguồn đạm thực vật dễ tìm (tính trên 100g):\n• Đậu hũ: 8-10g\n• Tempeh: 19g\n• Đậu gà, đậu lăng nấu chín: 8-9g\n• Hạt bí, hạt hướng dương: 19-21g\n• Sữa đậu nành: 3g/100ml\n\nHôm nay bạn mới nạp 46/75g đạm. Một bát buddha bowl đậu gà buổi tối là đủ bù phần còn thiếu.',
      followUps: ['Công thức buddha bowl đậu gà', 'Tối nay nên ăn gì cho đủ đạm?'],
      cards: [{ type: 'macros' }, { type: 'dishes', ids: ['d2'] }],
    }),
  },
  {
    keys: ['sat', 'thieu mau', 'iron'],
    reply: () => ({
      text: 'Sắt từ thực vật hấp thu kém hơn, nhưng có mẹo:\n• Ăn kèm vitamin C: vắt chanh, thêm cà chua, ổi, ớt chuông\n• Tránh uống trà, cà phê ngay sau bữa ăn\n• Nguồn sắt tốt: rau dền, rau bina, đậu lăng, mè đen, nấm rơm\n\nTuần này bạn hơi thiếu sắt. Ly sinh tố cải kale bên dưới vừa có sắt vừa có vitamin C.',
      followUps: ['Món nào giàu sắt dễ nấu?', 'Có cần uống viên sắt không?'],
      cards: [{ type: 'micros' }, { type: 'dishes', ids: ['d8'] }],
    }),
  },
  {
    keys: ['canxi', 'calcium', 'loang xuong'],
    reply: () => ({
      text: 'Canxi cho người ăn chay:\n• Đậu hũ làm bằng thạch cao: khoảng 350mg/100g\n• Mè (vừng): khoảng 975mg/100g, rắc lên cơm, salad\n• Cải bó xôi, cải xoăn, bông cải xanh\n• Sữa đậu nành có bổ sung canxi\n\nNhu cầu khoảng 1.000mg/ngày. Ra nắng 15 phút buổi sáng để có vitamin D giúp hấp thu canxi.',
      followUps: ['Gợi ý món nhiều canxi'],
      cards: [{ type: 'dishes', ids: ['d4'] }],
    }),
  },
  {
    keys: ['thuc don', 'len menu', 'menu', '7 ngay', 'ca tuan'],
    reply: ({ diet }) => ({
      text: `Đây là thực đơn gợi ý cho hôm nay, khoảng 1.590 kcal và 61g đạm${diet ? `, hợp chế độ ${diet.toLowerCase()}` : ''}. Bạn muốn đổi món nào thì cứ nói nhé.`,
      followUps: ['Đổi bữa tối ít calo hơn', 'Lập danh sách đi chợ cho thực đơn này'],
      cards: [{ type: 'meals' }],
    }),
  },
  {
    keys: ['bua sang', 'an sang', 'buoi sang'],
    reply: () => ({
      text: 'Hai món sáng làm dưới 10 phút, chuẩn bị tối hôm trước là sáng chỉ việc lấy ra ăn:',
      followUps: ['Công thức yến mạch ngâm qua đêm'],
      cards: [{ type: 'dishes', ids: ['d5', 'd8'] }],
    }),
  },
  {
    keys: ['an vat', 'doi bung', 'no lau', 'buoi chieu'],
    reply: () => ({
      text: 'Đói bụng về chiều là chuyện rất hay gặp khi mới ăn chay, thường do bữa trưa thiếu đạm và chất béo tốt. Thử:\n• Một nắm hạt điều hoặc hạnh nhân + 1 quả chuối\n• Sữa đậu nành không đường\n• Bánh yến mạch chuối nướng (làm 1 lần ăn cả tuần)\n\nVà nhớ thêm đậu hũ hoặc đậu gà vào bữa trưa nhé.',
      followUps: ['Bữa trưa nào giúp no lâu?'],
    }),
  },
  {
    keys: ['it calo', 'giam can', 'calo', 'kcal', 'bua toi'],
    reply: () => ({
      text: 'Hai gợi ý bữa tối dưới 400 kcal mà vẫn đủ đạm:',
      followUps: ['Công thức đậu hũ non hấp hành'],
      cards: [{ type: 'dishes', ids: ['d4', 'd7'] }],
    }),
  },
  {
    keys: ['quan chay', 'quan an', 'nha hang', 'an o dau', 'xac minh'],
    reply: () => ({
      text: 'Các quán chay đã được quản trị viên xác minh giấy tờ và thực đơn:',
      followUps: ['Quán chay gần Thủ Đức'],
      cards: [{ type: 'places' }],
    }),
  },
  {
    keys: ['moi an chay', 'bat dau', 'nguoi moi', 'tap an chay'],
    reply: () => ({
      text: 'Chào mừng bạn đến với hành trình ăn chay! Vài lời khuyên cho người mới:\n1. Bắt đầu từ 1-2 ngày mỗi tuần (như ăn chay kỳ mùng 1, rằm), rồi tăng dần\n2. Mỗi bữa nên có: tinh bột nguyên cám + đạm (đậu, nấm) + rau xanh\n3. Để ý 3 vi chất dễ thiếu: B12, sắt, omega-3\n4. Mang theo đồ ăn vặt lành mạnh để khỏi đói\n5. Đừng ngại hỏi cộng đồng, mọi người rất nhiệt tình!',
      followUps: ['Người ăn chay lấy đạm từ đâu?', 'Có cần bổ sung B12 không?'],
    }),
  },
  {
    keys: ['cong thuc', 'cach nau', 'cach lam', 'dau hu'],
    reply: () => ({
      text: 'Đậu hũ non hấp hành (2 người, 15 phút)\n\n1. Đậu hũ non cắt khối, hấp 8 phút\n2. Phi hành lá với dầu ăn thành mỡ hành chay\n3. Pha 2 thìa xì dầu nấm, 1 thìa nước, chút đường\n4. Rưới sốt và mỡ hành lên đậu, rắc tiêu\n\nGhi chú thành phần: thuần chay, không trứng, không sữa.',
      followUps: ['Món này bao nhiêu gram đạm?'],
      cards: [{ type: 'dishes', ids: ['d4'] }],
    }),
  },
  {
    keys: ['cam on', 'thanks', 'thank'],
    reply: () => ({ text: 'Không có gì nè! Chúc bạn ăn ngon, sống lành.', followUps: [] }),
  },
];

const FALLBACK = () => ({
  text: 'Mình chưa chắc đã hiểu đúng ý bạn. Mình giỏi nhất ở: dinh dưỡng chay (đạm, B12, sắt, canxi), lên thực đơn, công thức và quán chay đã xác minh. Bạn thử hỏi cụ thể hơn nhé!',
  followUps: ['Lên thực đơn hôm nay cho mình', 'Món nào giàu B12?', 'Gợi ý bữa sáng 10 phút'],
});

const findRule = (text) => {
  const t = clean(text);
  return RULES.find((r) => r.keys.some((k) => t.includes(k)));
};

/**
 * Lấy câu trả lời của trợ lý.
 * @param {string} text
 * @param {{name?:string, diet?:string}} ctx  thông tin người dùng để cá nhân hoá
 * @returns {Promise<{text:string, followUps:string[], cards?:object[]}>}  reject khi "lỗi gọi AI"
 */
export function getReply(text, ctx = {}) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Giả lập lỗi để xem giao diện: mất mạng, hoặc gõ "thử lỗi"
      if (!navigator.onLine || clean(text).includes('thu loi')) {
        reject(new Error('AI_UNAVAILABLE'));
        return;
      }
      resolve((findRule(text)?.reply ?? FALLBACK)(ctx));
    }, 700 + Math.random() * 700);
  });
}

/** Trả lời ngay (không chờ) – dùng cho ô "Mầm trả lời nhanh" dưới bài hỏi đáp. */
export const quickAnswer = (text) => (findRule(text)?.reply ?? FALLBACK)({}).text;

// Câu hỏi gợi ý – dùng ở khung chat trống, trang Mầm, bảng lệnh
export const STARTER_PROMPTS = [
  { icon: 'calendar-week', text: 'Lên thực đơn hôm nay cho mình' },
  { icon: 'egg', text: 'Người ăn chay lấy đạm từ đâu?' },
  { icon: 'capsule', text: 'Có cần bổ sung B12 không?' },
  { icon: 'droplet-half', text: 'Ăn gì để không thiếu sắt?' },
  { icon: 'sunrise', text: 'Gợi ý bữa sáng 10 phút' },
  { icon: 'shop', text: 'Quán chay nào đã được xác minh?' },
];
