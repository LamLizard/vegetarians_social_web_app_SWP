const INTENTS = new Set(['chat', 'clarify', 'post', 'recipe', 'cancel', 'planner']);

// The classifier response is untrusted: no provider-supplied IDs or permissions
// are accepted. Flow ownership and authorization are checked by the caller.
function parseDiscoveryIntent(raw) {
  let value;
  try { value = JSON.parse(raw); } catch { throw Object.assign(new Error('MODEL_UNAVAILABLE'), { code: 'MODEL_UNAVAILABLE' }); }
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !INTENTS.has(value.intent) || typeof value.offerPlanner !== 'boolean') {
    throw Object.assign(new Error('MODEL_UNAVAILABLE'), { code: 'MODEL_UNAVAILABLE' });
  }
  const needsSubject = ['clarify', 'post', 'recipe'].includes(value.intent);
  let subject = null;
  if (needsSubject) {
    if (typeof value.subject !== 'string' || !value.subject.trim()
      || Array.from(value.subject).length > 10000
      || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(value.subject)) {
      throw Object.assign(new Error('MODEL_UNAVAILABLE'), { code: 'MODEL_UNAVAILABLE' });
    }
    subject = value.subject.trim().normalize('NFC');
  }
  return { intent: value.intent, subject, offerPlanner: value.offerPlanner };
}

function parseSimpleIntent(raw) {
  let value;
  try { value = JSON.parse(raw); } catch { throw Object.assign(new Error('MODEL_UNAVAILABLE'), { code: 'MODEL_UNAVAILABLE' }); }
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !['chat', 'post'].includes(value.intent)
    || (value.subject !== null && typeof value.subject !== 'string')) {
    throw Object.assign(new Error('MODEL_UNAVAILABLE'), { code: 'MODEL_UNAVAILABLE' });
  }
  const subject = typeof value.subject === 'string' ? value.subject.trim().normalize('NFC') : null;
  if (subject && (Array.from(subject).length > 10000
    || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(subject))) {
    throw Object.assign(new Error('MODEL_UNAVAILABLE'), { code: 'MODEL_UNAVAILABLE' });
  }
  return { intent: value.intent, subject: subject || null };
}

// Tùng: classifier v3 chỉ đề xuất ý định; quyền và dữ liệu do server quyết định.
function parseV3Intent(raw) {
  // Tùng: phân nhóm lỗi cố định để chẩn đoán mà không ghi dữ liệu classifier.
  const invalid = (diagnostic) => Object.assign(new Error('MODEL_UNAVAILABLE'), { code: 'MODEL_UNAVAILABLE', diagnostic });
  let value;
  // Tùng: phân biệt nội dung rỗng với JSON sai mà không ghi phản hồi thô.
  try { value = JSON.parse(raw); } catch {
    throw invalid(typeof raw === 'string' && !raw.trim() ? 'CLASSIFIER_JSON_EMPTY' : 'CLASSIFIER_JSON_INVALID');
  }
  const keys = ['intent', 'subject', 'hasOtherAllowedQuestion', 'needsPersonalization', 'needsWebsiteGuide',
    'postMode', 'postOrder', 'nearTerms'];
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid('CLASSIFIER_OBJECT_INVALID');
  if (Object.keys(value).length !== keys.length || Object.keys(value).some((key) => !keys.includes(key))) {
    throw invalid('CLASSIFIER_KEYS_INVALID');
  }
  if (!['chat', 'post'].includes(value.intent)) throw invalid('CLASSIFIER_INTENT_INVALID');
  if ((value.subject !== null && typeof value.subject !== 'string')
    || !['hasOtherAllowedQuestion', 'needsPersonalization', 'needsWebsiteGuide'].every((key) => typeof value[key] === 'boolean')) {
    throw invalid('CLASSIFIER_TYPES_INVALID');
  }
  const subject = value.subject?.trim().normalize('NFC') || null;
  if (subject && (Array.from(subject).length > 10000
    || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(subject))) {
    throw invalid('CLASSIFIER_SUBJECT_INVALID');
  }
  const validTerm = (term) => typeof term === 'string' && Boolean(term.trim())
    && Array.from(term).length <= 10000
    && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(term);
  if (!['new', 'continue', 'reference', 'clarify', 'none'].includes(value.postMode)
    || !['votes', 'comments', 'none'].includes(value.postOrder)
    || !Array.isArray(value.nearTerms) || value.nearTerms.length > 8 || !value.nearTerms.every(validTerm)
    || new Set(value.nearTerms.map((term) => term.trim().normalize('NFC').toLowerCase())).size !== value.nearTerms.length
    || (value.intent === 'chat' && (value.postMode !== 'none' || value.postOrder !== 'none' || value.nearTerms.length))
    || (value.intent === 'post' && (value.postMode === 'none'
      || (['new', 'continue'].includes(value.postMode) && (!subject || value.postOrder === 'none'))
      || (['reference', 'clarify'].includes(value.postMode) && value.postOrder !== 'none')))) {
    throw invalid('CLASSIFIER_TYPES_INVALID');
  }
  return { ...value, subject, nearTerms: value.nearTerms.map((term) => term.trim().normalize('NFC')) };
}

module.exports = { parseDiscoveryIntent, parseSimpleIntent, parseV3Intent };
