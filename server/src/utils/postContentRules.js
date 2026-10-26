// Tùng: rule riêng cho text post/comment; không đổi animalWords của Recipe.
const { getKeywords } = require('../models/bannedKeyword.model');
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
const normalize = (value) => String(value).normalize('NFC').toLowerCase();
const tokens = (value) => normalize(value).match(/[\p{L}\p{N}]+/gu) ?? [];
const matches = (text, at, phrase) => phrase.every((word, offset) => text[at + offset] === word);

// Ngoại lệ hữu hạn theo BA: không dùng một chữ "chay" để miễn toàn đoạn.
const EXCEPTIONS = [
  'trứng chim cút', 'trứng đà điểu', 'trứng gà', 'trứng vịt', 'trứng ngỗng',
  'trứng cút', 'trứng cá', 'sữa bò', 'sữa dê', 'sữa trâu', 'trứng', 'sữa',
].map(tokens).sort((a, b) => b.length - a.length);

function hasAnimalMention(text, keywords) {
  const phrases = keywords.map(tokens).filter((phrase) => phrase.length)
    .sort((a, b) => b.length - a.length);
  let found = false;
  // Không nối "bò. Chay" hoặc tên món ở hai vế khác nhau thành "bò chay".
  const segments = normalize(text).split(/[,;:.!?()\r\n]+/u);
  for (const segment of segments) {
    const words = tokens(segment);
    for (let at = 0; at < words.length;) {
      const exception = EXCEPTIONS.find((phrase) => matches(words, at, phrase));
      if (exception) {
        at += exception.length;
        continue;
      }
      const phrase = phrases.find((candidate) => matches(words, at, candidate));
      if (!phrase) {
        at += 1;
        continue;
      }
      if (words[at + phrase.length] !== 'chay') found = true;
      at += phrase.length;
    }
  }
  return found;
}

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

  // Quan trọng: trả trước mọi query/matching nội dung, kể cả keyword cũ.
  if (providerResult?.status === 'unavailable') {
    const outcome = kind === 'post' ? 'manual_pending' : 'accepted_unfiltered';
    return {
      decision: kind === 'post' ? 'pending' : 'approve',
      reason: null,
      warnings: [],
      receipt: {
        version: 1, origin: 'provider_unavailable', outcome, evaluatedAt,
        failureCode: providerResult.code,
      },
    };
  }
  if (providerResult?.status !== 'checked' || typeof providerResult.flagged !== 'boolean'
      || MODERATION_CATEGORIES.some((group) => typeof providerResult.categories?.[group] !== 'boolean')) {
    throw new TypeError('Rules require a validated provider result.');
  }

  // Dictionary errors propagate as send failures; they are never provider outages.
  const [spamKeywords, animalKeywords] = await Promise.all([getKeywords('spam'), getKeywords('animal')]);
  const normalized = normalize(text);
  const spam = spamKeywords.some((keyword) => normalize(keyword).trim()
    && normalized.includes(normalize(keyword)));
  const categories = MODERATION_CATEGORIES.filter((group) => providerResult.categories[group]
    && (kind === 'post' || COMMENT_CATEGORIES.has(group)));
  const groups = spam ? ['spam', ...categories] : [...categories];
  if (kind === 'post' && providerResult.flagged && categories.length === 0) groups.push('flagged');
  const rejected = groups.length > 0;
  const warnings = hasAnimalMention(text, animalKeywords)
    ? [{ code: 'animal', message: 'Nội dung có nhắc đến món từ động vật.' }]
    : [];
  const outcome = rejected ? 'rejected' : kind === 'post' ? 'approved' : 'accepted';
  return {
    decision: rejected ? 'reject' : 'approve',
    reason: rejected ? rejectionReason(groups) : null,
    warnings,
    receipt: {
      version: 1,
      origin: categories.length || (kind === 'post' && providerResult.flagged) ? 'ai' : 'rules',
      outcome,
      evaluatedAt,
      model: providerResult.model,
      categories,
      rules: spam ? ['spam'] : [],
      warnings: warnings.map((warning) => warning.code),
    },
  };
}

module.exports = { evaluateRules };
