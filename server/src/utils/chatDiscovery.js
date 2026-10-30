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

module.exports = { parseDiscoveryIntent };
