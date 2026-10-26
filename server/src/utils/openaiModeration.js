// Tùng: giới hạn lỗi provider trong adapter, không nuốt lỗi input/DB/dictionary.
// Contract: https://developers.openai.com/api/reference/resources/moderations/methods/create
const MODERATION_MODEL = 'omni-moderation-latest';
const TIMEOUT_MS = 10_000;
const MODERATION_CATEGORIES = Object.freeze([
  'harassment', 'harassment/threatening', 'hate', 'hate/threatening',
  'illicit', 'illicit/violent', 'self-harm', 'self-harm/intent',
  'self-harm/instructions', 'sexual', 'sexual/minors', 'violence', 'violence/graphic',
]);

function unavailable(code) {
  console.warn('[postContent.moderation]', code);
  return { status: 'unavailable', code };
}

/** Một request text, không retry; timeout bao gồm cả đọc response body. */
async function moderateText(text) {
  if (typeof text !== 'string' || !text.trim()) throw new TypeError('Moderation requires text.');
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return unavailable('MISSING_KEY');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let response;
    try {
      response = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: MODERATION_MODEL, input: text }),
        signal: controller.signal,
        redirect: 'error',
      });
    } catch {
      return unavailable(controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR');
    }
    if (!response.ok) return unavailable('HTTP_ERROR');

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      return unavailable(controller.signal.aborted
        ? 'TIMEOUT'
        : error instanceof SyntaxError ? 'INVALID_RESPONSE' : 'NETWORK_ERROR');
    }
    const result = payload?.results?.[0];
    const categories = result?.categories;
    if (!Array.isArray(payload?.results) || payload.results.length !== 1
        || typeof result?.flagged !== 'boolean'
        || !categories || typeof categories !== 'object' || Array.isArray(categories)
        || MODERATION_CATEGORIES.some((name) => typeof categories[name] !== 'boolean')
        || typeof payload.model !== 'string' || !payload.model.trim() || payload.model.length > 200) {
      return unavailable('INVALID_RESPONSE');
    }
    return {
      status: 'checked',
      flagged: result.flagged,
      categories: Object.fromEntries(MODERATION_CATEGORIES.map((name) => [name, categories[name]])),
      model: payload.model,
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { moderateText, MODERATION_CATEGORIES };
