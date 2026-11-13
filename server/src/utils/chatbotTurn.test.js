// Khoi's code (05/11/2026): test các hàm thuần của lượt chatbot v3 (tách từ chatbot.controller.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateV3, parseScopedV3Intent, isStandaloneArithmetic, vietnamDay, healthForChat, alreadyWarnedProfile,
} = require('./chatbotTurn');

const TURN_ID = '11111111-1111-4111-8111-111111111111';
const DEVICE_ID = '22222222-2222-4222-8222-222222222222';
const ACCOUNT = { id: 7 };

function memberBody(overrides = {}) {
  return {
    protocol: 3, turnId: TURN_ID, text: '  Chào Mầm  ', history: [], sessionToken: 'session-token', ...overrides,
  };
}

function guestBody(overrides = {}) {
  return memberBody({ deviceId: DEVICE_ID, expectedDay: '2026-11-05', ...overrides });
}

// Classifier v3 trả đúng mười khoá; helper này dựng JSON hợp lệ rồi cho phép ghi đè từng khoá.
function classifierRaw(overrides = {}) {
  return JSON.stringify({
    intent: 'chat', subject: null, hasOtherAllowedQuestion: false, needsPersonalization: false,
    needsWebsiteGuide: false, needsGreenBowlData: 'none', postMode: 'none', postOrder: 'none', nearTerms: [],
    scope: 'allowed', allowedParts: [], cookDish: null, shopName: null, shopDish: null, ...overrides,
  });
}

function destructure(raw, key) {
  const value = JSON.parse(raw);
  delete value[key];
  return value;
}

test('validateV3: body hợp lệ của member → nhận, text được trim', () => {
  const input = validateV3(memberBody(), ACCOUNT);
  assert.ok(input);
  assert.equal(input.text, 'Chào Mầm');
  assert.deepEqual(input.history, []);
  assert.equal(input.deviceId, undefined);
  assert.equal(input.sessionToken, 'session-token');
});

test('validateV3: member gửi kèm deviceId hợp lệ và history theo cặp vẫn qua', () => {
  const input = validateV3(memberBody({
    deviceId: DEVICE_ID,
    history: [{ sender: 'user', content: 'chào' }, { sender: 'bot', content: 'chào bạn' }],
  }), ACCOUNT);
  assert.ok(input);
  assert.equal(input.history.length, 2);
});

test('validateV3: body hợp lệ của khách cần deviceId + expectedDay và giữ deviceId', () => {
  const input = validateV3(guestBody(), null);
  assert.ok(input);
  assert.equal(input.deviceId, DEVICE_ID);
  assert.equal(input.expectedDay, '2026-11-05');
  assert.equal(validateV3(guestBody({ expectedDay: undefined }), null), null);
  assert.equal(validateV3(guestBody({ expectedDay: '05-11-2026' }), null), null);
});

test('validateV3: history lẻ → null', () => {
  assert.equal(validateV3(memberBody({ history: [{ sender: 'user', content: 'chào' }] }), ACCOUNT), null);
});

test('validateV3: history sai thứ tự user/bot → null', () => {
  assert.equal(validateV3(memberBody({
    history: [{ sender: 'bot', content: 'chào' }, { sender: 'user', content: 'ừ' }],
  }), ACCOUNT), null);
  assert.equal(validateV3(memberBody({
    history: [{ sender: 'user', content: 'ừ' }, { sender: 'user', content: 'ừ' }],
  }), ACCOUNT), null);
});

test('validateV3: text rỗng hoặc quá dài → null', () => {
  assert.equal(validateV3(memberBody({ text: '   ' }), ACCOUNT), null);
  assert.equal(validateV3(memberBody({ text: 'a'.repeat(10001) }), ACCOUNT), null);
  // Ghi nhận đúng hành vi hiện tại: v3 chặn ở 10000 ký tự (validText), KHÔNG phải 1000 như v1.
  assert.ok(validateV3(memberBody({ text: 'a'.repeat(1001) }), ACCOUNT));
});

test('validateV3: khoá thừa → null', () => {
  assert.equal(validateV3(memberBody({ operationId: TURN_ID }), ACCOUNT), null);
  assert.equal(validateV3(memberBody({ history: [{ sender: 'user', content: 'chào', extra: 1 }] }), ACCOUNT), null);
});

test('validateV3: protocol và turnId sai → null', () => {
  assert.equal(validateV3(memberBody({ protocol: 2 }), ACCOUNT), null);
  assert.equal(validateV3(memberBody({ turnId: 'abc' }), ACCOUNT), null);
});

test('validateV3: postContext phải đủ ba khoá và nhất quán state/seenIds', () => {
  const ok = validateV3(memberBody({
    postContext: { state: 'known', subject: 'đậu hũ', seenIds: ['12', '13'] },
  }), ACCOUNT);
  assert.ok(ok);
  assert.equal(ok.postContext.seenIds.length, 2);
  assert.equal(validateV3(memberBody({
    postContext: { state: 'known', subject: 'đậu hũ', seenIds: ['12', '12'] },
  }), ACCOUNT), null);
  assert.equal(validateV3(memberBody({
    postContext: { state: 'unknown', subject: null, seenIds: ['12'] },
  }), ACCOUNT), null);
});

test('parseScopedV3Intent: scope allowed → giữ nguyên câu gốc, intent đã parse', () => {
  const text = 'Gợi ý món chay từ đậu hũ và tính 25 nhân 17';
  const result = parseScopedV3Intent(classifierRaw(), text);
  assert.equal(result.scope, 'allowed');
  assert.equal(result.allowedText, text);
  assert.equal(result.intent.intent, 'chat');
  assert.deepEqual(result.intent.nearTerms, []);
});

test('parseScopedV3Intent: scope outside → trả scope outside', () => {
  const text = 'Tính 25 nhân 17';
  const result = parseScopedV3Intent(classifierRaw({ scope: 'outside' }), text);
  assert.equal(result.scope, 'outside');
  assert.equal(result.allowedText, text);
});

test('parseScopedV3Intent: mixed có đoạn chép nguyên văn → allowedText là các đoạn đó', () => {
  const text = 'Gợi ý món chay từ đậu hũ và tính 25 nhân 17';
  const result = parseScopedV3Intent(classifierRaw({
    scope: 'mixed', allowedParts: ['Gợi ý món chay từ đậu hũ'],
  }), text);
  assert.equal(result.scope, 'mixed');
  assert.equal(result.allowedText, 'Gợi ý món chay từ đậu hũ');
});

test('parseScopedV3Intent: mixed mà đoạn không có trong câu gốc → uncertain', () => {
  const text = 'Gợi ý món chay từ đậu hũ và tính 25 nhân 17';
  const missing = parseScopedV3Intent(classifierRaw({
    scope: 'mixed', allowedParts: ['món chay hấp'],
  }), text);
  assert.equal(missing.scope, 'uncertain');
  assert.equal(missing.allowedText, null);
  const whole = parseScopedV3Intent(classifierRaw({ scope: 'mixed', allowedParts: [text] }), text);
  assert.equal(whole.scope, 'uncertain');
  assert.equal(whole.allowedText, null);
});

test('parseScopedV3Intent: needsGreenBowlData nhận giá trị hợp lệ, giá trị lạ → throw', () => {
  const result = parseScopedV3Intent(classifierRaw({ needsGreenBowlData: 'recipes' }), 'Gợi ý món chay');
  assert.equal(result.intent.needsGreenBowlData, 'recipes');
  assert.equal(parseScopedV3Intent(classifierRaw(), 'chào').intent.needsGreenBowlData, 'none');
  assert.throws(() => parseScopedV3Intent(classifierRaw({ needsGreenBowlData: 'posts' }), 'chào'),
    (error) => error.code === 'MODEL_UNAVAILABLE');
});

test('parseScopedV3Intent: JSON thiếu khoá → throw MODEL_UNAVAILABLE', () => {
  const missingKey = JSON.stringify(destructure(classifierRaw(), 'allowedParts'));
  assert.throws(() => parseScopedV3Intent(missingKey, 'chào Mầm'), (error) => error.code === 'MODEL_UNAVAILABLE');
  const extraKey = JSON.stringify({ ...JSON.parse(classifierRaw()), note: 'x' });
  assert.throws(() => parseScopedV3Intent(extraKey, 'chào Mầm'), (error) => error.code === 'MODEL_UNAVAILABLE');
  assert.throws(() => parseScopedV3Intent('không phải JSON', 'chào Mầm'), (error) => error.code === 'MODEL_UNAVAILABLE');
});

// Khoi's code (06/11/2026): khoá cookDish — món người dùng muốn cách làm.
test('parseScopedV3Intent: cookDish hợp lệ, ép needsGreenBowlData = recipes', () => {
  const result = parseScopedV3Intent(classifierRaw({ cookDish: '  nấm kho nước dừa ' }), 'chỉ tao nấm kho nước dừa');
  assert.equal(result.intent.cookDish, 'nấm kho nước dừa');
  assert.equal(result.intent.needsGreenBowlData, 'recipes');
  assert.equal(parseScopedV3Intent(classifierRaw(), 'chào').intent.cookDish, null);
  assert.equal(parseScopedV3Intent(classifierRaw({ cookDish: '   ' }), 'chào').intent.cookDish, null);
});

test('parseScopedV3Intent: cookDish sai kiểu/quá dài/thiếu khoá → throw; lượt tìm bài bỏ cookDish', () => {
  const fail = (raw) => assert.throws(() => parseScopedV3Intent(raw, 'chào'), (error) => error.code === 'MODEL_UNAVAILABLE');
  fail(classifierRaw({ cookDish: 5 }));
  fail(classifierRaw({ cookDish: 'a'.repeat(81) }));
  fail(JSON.stringify(destructure(classifierRaw(), 'cookDish')));
  const post = parseScopedV3Intent(classifierRaw({ intent: 'post', subject: 'đậu hũ', postMode: 'new', postOrder: 'votes',
    cookDish: 'đậu hũ' }), 'tìm bài đậu hũ');
  assert.equal(post.intent.cookDish, null);
  assert.equal(post.intent.needsGreenBowlData, 'none');
});

test('isStandaloneArithmetic: chỉ chặn phép tính đứng riêng', () => {
  assert.equal(isStandaloneArithmetic('tính 25 x 17'), true);
  assert.equal(isStandaloneArithmetic('25 nhân 17'), true);
  assert.equal(isStandaloneArithmetic('200g đậu hũ bao nhiêu calo'), false);
  assert.equal(isStandaloneArithmetic('chào Mầm'), false);
});

test('isStandaloneArithmetic: nhận thêm đuôi "bằng mấy" và dạng "=?"', () => {
  assert.equal(isStandaloneArithmetic('25 nhân 17 bằng mấy'), true);
  assert.equal(isStandaloneArithmetic('25 nhân 17 bằng mấy?'), true);
  assert.equal(isStandaloneArithmetic('tính 25 nhân 17 bằng mấy'), true);
  assert.equal(isStandaloneArithmetic('25*17=?'), true);
  assert.equal(isStandaloneArithmetic('25 x 17 = ?'), true);
  assert.equal(isStandaloneArithmetic('25 nhân 17 bằng 425'), false);
  assert.equal(isStandaloneArithmetic('gợi ý món chay 25 x 17'), false);
  assert.equal(isStandaloneArithmetic('đậu hũ 200g bao nhiêu đạm'), false);
});

test('vietnamDay: 18:00 UTC đã sang ngày mới ở Việt Nam', () => {
  assert.equal(vietnamDay(new Date('2026-11-04T17:00:00.000Z')), '2026-11-05');
  assert.equal(vietnamDay(new Date('2026-11-04T16:59:00.000Z')), '2026-11-04');
});

test('healthForChat: chỉ lấy trường liên quan và đổi dị ứng thành tên', () => {
  assert.equal(healthForChat(null), null);
  const view = healthForChat({ gender: 'female', heightCm: 160, allergies: [{ name: 'đậu phộng' }], extra: 'x' });
  assert.deepEqual(Object.keys(view), ['gender', 'dateOfBirth', 'heightCm', 'weightKg', 'bmi', 'bmiCategory',
    'activityLevel', 'healthGoal', 'tdeeKcal', 'targetCaloriesKcal', 'allergies', 'profileWarnings']);
  assert.equal(view.gender, 'female');
  assert.equal(view.weightKg, null);
  assert.deepEqual(view.allergies, ['đậu phộng']);
  assert.deepEqual(view.profileWarnings, []);
});

test('healthForChat: giá trị vô lý → null và gắn cờ', () => {
  const view = healthForChat({ heightCm: 250, weightKg: 60, bmi: 9.6 });
  assert.equal(view.heightCm, null);
  assert.equal(view.weightKg, 60);
  assert.equal(view.bmi, null);
  assert.deepEqual(view.profileWarnings, ['height', 'bmi']);
  const nan = healthForChat({ heightCm: 'cao', weightKg: 60, bmi: null });
  assert.equal(nan.heightCm, null);
  assert.deepEqual(nan.profileWarnings, ['height']);
});

test('healthForChat: biên 100/230 cm, 25/300 kg, 12/60 BMI', () => {
  const lower = healthForChat({ heightCm: 100, weightKg: 25, bmi: 12 });
  assert.deepEqual(lower.profileWarnings, []);
  assert.deepEqual([lower.heightCm, lower.weightKg, lower.bmi], [100, 25, 12]);
  const upper = healthForChat({ heightCm: 230, weightKg: 300, bmi: 60 });
  assert.deepEqual(upper.profileWarnings, []);
  assert.deepEqual([upper.heightCm, upper.weightKg, upper.bmi], [230, 300, 60]);
  const below = healthForChat({ heightCm: 99, weightKg: 24, bmi: 11.9 });
  assert.deepEqual(below.profileWarnings, ['height', 'weight', 'bmi']);
  assert.deepEqual([below.heightCm, below.weightKg, below.bmi], [null, null, null]);
  const above = healthForChat({ heightCm: 231, weightKg: 301, bmi: 60.1 });
  assert.deepEqual(above.profileWarnings, ['height', 'weight', 'bmi']);
  assert.deepEqual([above.heightCm, above.weightKg, above.bmi], [null, null, null]);
});

test('alreadyWarnedProfile: chỉ tính tin của bot có nhắc cập nhật hồ sơ', () => {
  assert.equal(alreadyWarnedProfile([]), false);
  assert.equal(alreadyWarnedProfile(undefined), false);
  assert.equal(alreadyWarnedProfile([{ sender: 'user', content: 'cập nhật hồ sơ ở đâu?' }]), false);
  assert.equal(alreadyWarnedProfile([{ sender: 'bot', content: 'Bạn cập nhật hồ sơ để Mầm tư vấn chính xác hơn nhé.' }]), true);
  assert.equal(alreadyWarnedProfile([{ sender: 'user', content: 'chào' }, { sender: 'bot', content: 'Chào bạn.' }]), false);
});

// Khoi's code (13/11/2026): shopName/shopDish — hỏi quán cụ thể hoặc quán có món → needsGreenBowlData = shops.
test('parseScopedV3Intent: shopName/shopDish hợp lệ, ép shops; cookDish vẫn ưu tiên recipes', () => {
  const byName = parseScopedV3Intent(classifierRaw({ shopName: ' Mộc Nhiên ' }), 'quán Mộc Nhiên có món gì');
  assert.equal(byName.intent.shopName, 'Mộc Nhiên');
  assert.equal(byName.intent.needsGreenBowlData, 'shops');
  const byDish = parseScopedV3Intent(classifierRaw({ shopDish: 'bánh mì' }), 'quán nào có bánh mì chay');
  assert.equal(byDish.intent.shopDish, 'bánh mì');
  assert.equal(byDish.intent.needsGreenBowlData, 'shops');
  const both = parseScopedV3Intent(classifierRaw({ cookDish: 'bánh canh', shopDish: 'bánh canh' }), 'x');
  assert.equal(both.intent.needsGreenBowlData, 'recipes');
  assert.throws(() => parseScopedV3Intent(classifierRaw({ shopDish: 7 }), 'x'));
  const withoutKeys = JSON.parse(classifierRaw());
  delete withoutKeys.shopName;
  assert.throws(() => parseScopedV3Intent(JSON.stringify(withoutKeys), 'x'));
});
