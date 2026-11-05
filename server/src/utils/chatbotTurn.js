// Khoi's code (05/11/2026): tách các hàm thuần của lượt v3 khỏi controller để test riêng; logic giữ nguyên.
const { parseV3Intent } = require('./chatDiscovery');

// Khoi's code (05/11/2026): giữ một nguồn regex UUID duy nhất, controller import lại từ đây.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validText(value, allowEmpty = false) {
  return typeof value === 'string' && (allowEmpty || Boolean(value.trim()))
    && Array.from(value).length <= 10000
    && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(value);
}

function validKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every((key) => keys.includes(key));
}

// Tùng: chỉ nhận các trường v3 và lịch sử theo cặp để admission không tin dữ liệu thừa.
function validateV3(body, account) {
  if (!validKeys(body, ['protocol', 'turnId', 'text', 'history', 'sessionToken', 'deviceId', 'expectedDay', 'postContext'])
    || body.protocol !== 3 || typeof body.turnId !== 'string' || !UUID.test(body.turnId)
    || (!account && (typeof body.deviceId !== 'string' || !UUID.test(body.deviceId)
      || typeof body.expectedDay !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.expectedDay)))
    || (body.deviceId !== undefined && (typeof body.deviceId !== 'string' || !UUID.test(body.deviceId)))
    || (body.expectedDay !== undefined && (typeof body.expectedDay !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.expectedDay)))
    || (body.sessionToken !== undefined && (typeof body.sessionToken !== 'string' || body.sessionToken.length > 1024))
    || !validText(body.text) || !Array.isArray(body.history) || body.history.length > 20 || body.history.length % 2
    // Khoi's code (08/11/2026): tin bot được mang thêm turnId/at/sig của server để ký lịch sử.
    || !body.history.every((entry, index) => {
      const bot = index % 2 === 1;
      return validKeys(entry, bot ? ['sender', 'content', 'turnId', 'at', 'sig'] : ['sender', 'content'])
        && entry.sender === (bot ? 'bot' : 'user') && validText(entry.content)
        && (!bot || ((entry.turnId === undefined || (typeof entry.turnId === 'string' && UUID.test(entry.turnId)))
          && (entry.at === undefined || Number.isSafeInteger(entry.at))
          && (entry.sig === undefined || (typeof entry.sig === 'string' && entry.sig.length <= 128))));
    })) return null;
  const context = body.postContext;
  if (context !== undefined && (!validKeys(context, ['state', 'subject', 'seenIds'])
    || Object.keys(context).length !== 3 || !['known', 'unknown'].includes(context.state)
    || (context.subject !== null && !validText(context.subject)) || !Array.isArray(context.seenIds)
    || !context.seenIds.every((id) => typeof id === 'string' && /^[1-9]\d{0,17}$/.test(id))
    || new Set(context.seenIds).size !== context.seenIds.length
    || (context.state === 'unknown' && context.seenIds.length)
    || (context.subject === null && context.seenIds.length))) return null;
  return { ...body, text: body.text.trim() };
}

function vietnamDay(at) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const part = (type) => parts.find((entry) => entry.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

// Khoi's code (05/11/2026): bỏ giá trị hồ sơ vô lý trước khi gửi AI và gắn cờ profileWarnings.
const HEALTH_LIMITS = [
  { field: 'heightCm', flag: 'height', min: 100, max: 230 },
  { field: 'weightKg', flag: 'weight', min: 25, max: 300 },
  { field: 'bmi', flag: 'bmi', min: 12, max: 60 },
];

function healthForChat(profile) {
  if (!profile) return null;
  const fields = ['gender', 'dateOfBirth', 'heightCm', 'weightKg', 'bmi', 'bmiCategory',
    'activityLevel', 'healthGoal', 'tdeeKcal', 'targetCaloriesKcal'];
  const view = Object.fromEntries(fields.map((field) => [field, profile[field] ?? null]));
  const profileWarnings = [];
  for (const { field, flag, min, max } of HEALTH_LIMITS) {
    if (view[field] === null || view[field] === undefined) continue;
    const value = Number(view[field]);
    if (!Number.isFinite(value) || value < min || value > max) { view[field] = null; profileWarnings.push(flag); }
    else view[field] = value;
  }
  return { ...view,
    allergies: Array.isArray(profile.allergies) ? profile.allergies.map(({ name }) => name) : null,
    profileWarnings };
}

// Khoi's code (05/11/2026): Mầm đã nhắc "cập nhật hồ sơ" trong hội thoại chưa (chỉ tính tin của bot).
function alreadyWarnedProfile(history) {
  return Array.isArray(history) && history.some((entry) => entry && entry.sender === 'bot'
    && typeof entry.content === 'string' && entry.content.includes('cập nhật hồ sơ'));
}

// Tùng: chỉ chặn phép tính độc lập khớp toàn câu, không chặn số trong câu hỏi món ăn.
// Khoi's code (05/11/2026): nhận thêm đuôi "bằng mấy" và "=?" ("25 nhân 17 bằng mấy", "25*17=?").
function isStandaloneArithmetic(text) {
  const expression = text.trim().replace(/^(?:(?:hãy|hay)\s+)?(?:tính|tinh)\s+(?:(?:giúp|giup)\s+)?(?:(?:mình|minh|tôi|toi|em)\s+)?/iu, '');
  const sum = /^[+-]?\d+(?:[.,]\d+)?(?:\s*(?:\+|-|×|x|\*|\/|:|nhân|nhan|chia|cộng|cong|trừ|tru)\s*[+-]?\d+(?:[.,]\d+)?)+/iu.exec(expression);
  if (!sum) return false;
  const tail = expression.slice(sum[0].length);
  return /^\s*(?:(?:=|bằng|bang|ra)\s*(?:(?:mấy|may|bao\s*nhiêu|bao\s*nhieu|gì|gi)\s*)?\??)?\s*[?!.]*$/iu.test(tail);
}

// Tùng: policy có hai khóa riêng; parser v3 vẫn nhận đúng tám khóa như cũ.
function parseScopedV3Intent(raw, text) {
  const invalid = () => Object.assign(new Error('MODEL_UNAVAILABLE'), { code: 'MODEL_UNAVAILABLE' });
  let value;
  try { value = JSON.parse(raw); } catch { throw invalid(); }
  const keys = ['intent', 'subject', 'hasOtherAllowedQuestion', 'needsPersonalization', 'needsWebsiteGuide',
    'needsGreenBowlData', 'postMode', 'postOrder', 'nearTerms', 'scope', 'allowedParts'];
  if (!validKeys(value, keys) || Object.keys(value).length !== keys.length
    || !['allowed', 'outside', 'mixed', 'uncertain'].includes(value.scope)
    || !Array.isArray(value.allowedParts) || value.allowedParts.length > 8) throw invalid();
  const { scope, allowedParts, ...intentValue } = value;
  const intent = parseV3Intent(JSON.stringify(intentValue));
  if (scope !== 'mixed') {
    if (allowedParts.length) throw invalid();
    return { scope, intent, allowedText: text };
  }
  if (!allowedParts.length || (allowedParts.length === 1 && allowedParts[0] === text)) {
    return { scope: 'uncertain', intent, allowedText: null };
  }
  let cursor = 0;
  const seen = new Set();
  for (const part of allowedParts) {
    if (!validText(part) || seen.has(part)) return { scope: 'uncertain', intent, allowedText: null };
    const index = text.indexOf(part, cursor);
    if (index < 0) return { scope: 'uncertain', intent, allowedText: null };
    seen.add(part);
    cursor = index + part.length;
  }
  return { scope, intent, allowedText: allowedParts.join('\n') };
}

module.exports = { UUID, validKeys, validText, validateV3, vietnamDay, healthForChat, alreadyWarnedProfile,
  isStandaloneArithmetic, parseScopedV3Intent };
