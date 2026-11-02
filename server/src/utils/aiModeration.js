const { getKeywords } = require('../models/bannedKeyword.model');
const { moderateText } = require('./openaiModeration');
const { moderateWithGroq } = require('./groqModeration');
const { recordProviderError, clearProviderError } = require('../models/aiConfig.model');

async function moderate({ kind, text, settings }) {
  if (!settings.enabled) return { status: 'disabled' };
  let result;
  if (settings.provider === 'openai') {
    result = await moderateText(text);
    if (result.status === 'checked') result = { ...result, provider: 'openai' };
  } else if (settings.provider === 'groq') {
    // Keyword data helps the model evaluate context; matching never decides by itself.
    const keywords = await getKeywords('spam');
    result = await moderateWithGroq({ kind, text, keywords });
  } else {
    throw new TypeError('Unknown moderation provider.');
  }
  if (result.status === 'unavailable') recordProviderError(settings.provider,
    result.code === 'RATE_LIMITED' ? 'RATE_LIMITED' : 'UNAVAILABLE');
  else clearProviderError(settings.provider);
  return result;
}

module.exports = { moderate };
