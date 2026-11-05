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
    || !body.history.every((entry, index) => validKeys(entry, ['sender', 'content'])
      && entry.sender === (index % 2 ? 'bot' : 'user') && validText(entry.content))) return null;
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

function healthForChat(profile) {
  if (!profile) return null;
  const fields = ['gender', 'dateOfBirth', 'heightCm', 'weightKg', 'bmi', 'bmiCategory',
    'activityLevel', 'healthGoal', 'tdeeKcal', 'targetCaloriesKcal'];
  return { ...Object.fromEntries(fields.map((field) => [field, profile[field] ?? null])),
    allergies: Array.isArray(profile.allergies) ? profile.allergies.map(({ name }) => name) : null };
}

// Tùng: chỉ chặn phép tính độc lập khớp toàn câu, không chặn số trong câu hỏi món ăn.
function isStandaloneArithmetic(text) {
  const expression = text.trim().replace(/^(?:(?:hãy|hay)\s+)?(?:tính|tinh)\s+(?:(?:giúp|giup)\s+)?(?:(?:mình|minh|tôi|toi|em)\s+)?/iu, '');
  return /^[+-]?\d+(?:[.,]\d+)?(?:\s*(?:\+|-|×|x|\*|\/|:|nhân|nhan|chia|cộng|cong|trừ|tru)\s*[+-]?\d+(?:[.,]\d+)?)+\s*[?!.]*$/iu.test(expression);
}

// Tùng: policy có hai khóa riêng; parser v3 vẫn nhận đúng tám khóa như cũ.
function parseScopedV3Intent(raw, text) {
  const invalid = () => Object.assign(new Error('MODEL_UNAVAILABLE'), { code: 'MODEL_UNAVAILABLE' });
  let value;
  try { value = JSON.parse(raw); } catch { throw invalid(); }
  const keys = ['intent', 'subject', 'hasOtherAllowedQuestion', 'needsPersonalization', 'needsWebsiteGuide',
    'postMode', 'postOrder', 'nearTerms', 'scope', 'allowedParts'];
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

module.exports = { UUID, validKeys, validText, validateV3, vietnamDay, healthForChat, isStandaloneArithmetic, parseScopedV3Intent };
