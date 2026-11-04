// Tùng: rule riêng cho text post/comment; không đổi animalWords của Recipe.
const { MODERATION_CATEGORIES } = require('./openaiModeration');

const COMMENT_CATEGORIES = new Set(['harassment', 'harassment/threatening', 'hate', 'hate/threatening']);
const REASONS = {
  spam: 'Nội dung chứa từ cấm hoặc spam.',
  harassment: 'Nội dung quấy rối hoặc xúc phạm.',
  'harassment/threatening': 'Nội dung đe dọa hoặc quấy rối.',
  hate: 'Nội dung thù ghét.',
  'hate/threatening': 'Nội dung thù ghét có đe dọa.',
  illicit: 'Nội dung cổ vũ hành vi trái pháp luật.',
  'illicit/violent': 'Nội dung cổ vũ hành vi trái pháp luật có bạo lực.',
  'self-harm': 'Nội dung liên quan tự gây hại.',
  'self-harm/intent': 'Nội dung thể hiện ý định tự gây hại.',
  'self-harm/instructions': 'Nội dung hướng dẫn tự gây hại.',
  sexual: 'Nội dung tình dục.',
  'sexual/minors': 'Nội dung tình dục liên quan người chưa thành niên.',
  violence: 'Nội dung bạo lực.',
  'violence/graphic': 'Nội dung bạo lực phản cảm.',
  flagged: 'Nội dung vi phạm chính sách kiểm duyệt.',
};
function rejectionReason(groups) {
  const reason = groups.map((group) => REASONS[group]).join(' ');
  const chars = [...reason];
  return chars.length > 255 ? `${chars.slice(0, 252).join('')}...` : reason;
}

/** Chỉ controller gọi với kết quả từ adapter; status trong body client không có giá trị. */
async function evaluateRules({ kind, text, providerResult }) {
  if (kind !== 'post' && kind !== 'comment') throw new TypeError('Unknown submission kind.');
  if (typeof text !== 'string' || !text.trim()) throw new TypeError('Rules require text.');
  const evaluatedAt = new Date().toISOString();

  // OFF và provider lỗi không gọi thêm bộ lọc từ khóa.
  if (providerResult?.status === 'disabled' || providerResult?.status === 'unavailable') {
    const disabled = providerResult.status === 'disabled';
    const outcome = kind === 'post' ? 'manual_pending' : 'accepted_unfiltered';
    return {
      decision: kind === 'post' ? 'pending' : 'approve',
      reason: null,
      warnings: [],
      receipt: {
        version: 1, origin: disabled ? 'ai_disabled' : 'provider_unavailable', outcome, evaluatedAt,
        ...(!disabled ? { failureCode: providerResult.code } : {}),
      },
    };
  }
  if (providerResult?.status !== 'checked') throw new TypeError('Rules require a validated provider result.');
  let groups;
  if (providerResult.provider === 'openai') {
    if (typeof providerResult.flagged !== 'boolean'
      || MODERATION_CATEGORIES.some((group) => typeof providerResult.categories?.[group] !== 'boolean')) {
      throw new TypeError('Invalid OpenAI moderation result.');
    }
    // OpenAI has no dedicated spam/advertising category; do not infer a match
    // from its aggregate flag or turn unrelated categories into post rejection.
    groups = MODERATION_CATEGORIES.filter((group) => providerResult.categories[group]
      && COMMENT_CATEGORIES.has(group));
  } else if (providerResult.provider === 'groq') {
    const allowed = kind === 'comment'
      ? new Set(['spam', ...COMMENT_CATEGORIES])
      : new Set(['spam', 'harassment', 'harassment/threatening', 'hate', 'hate/threatening', 'flagged']);
    if (!['allow', 'reject', 'uncertain'].includes(providerResult.decision)
      || !Array.isArray(providerResult.categories)
      || !providerResult.categories.every((group) => allowed.has(group))
      || (providerResult.decision === 'reject' && !providerResult.categories.length)) {
      throw new TypeError('Invalid Groq moderation result.');
    }
    groups = providerResult.decision === 'reject' ? providerResult.categories : [];
  } else {
    throw new TypeError('Unknown moderation provider.');
  }

  const rejected = groups.length > 0;
  const outcome = rejected ? 'rejected' : kind === 'post' ? 'manual_pending' : 'accepted';
  return {
    decision: rejected ? 'reject' : kind === 'post' ? 'pending' : 'approve',
    reason: rejected ? rejectionReason(groups) : null,
    warnings: [],
    receipt: {
      version: 1,
      origin: 'ai',
      outcome,
      evaluatedAt,
      model: providerResult.model,
      categories: groups,
      rules: [],
      warnings: [],
    },
  };
}

module.exports = { evaluateRules };
