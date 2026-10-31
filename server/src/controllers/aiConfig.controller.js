const aiConfig = require('../models/aiConfig.model');

const PROVIDERS = new Set(['openai', 'groq']);
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

function parseConfig(body) {
  if (!exactKeys(body, ['comment', 'post', 'chatbot', 'version'])
    || !exactKeys(body.comment, ['enabled', 'provider'])
    || !exactKeys(body.post, ['enabled', 'provider'])
    || !exactKeys(body.chatbot, ['enabled'])
    || typeof body.comment.enabled !== 'boolean' || !PROVIDERS.has(body.comment.provider)
    || typeof body.post.enabled !== 'boolean' || !PROVIDERS.has(body.post.provider)
    || typeof body.chatbot.enabled !== 'boolean'
    || !Number.isSafeInteger(body.version) || body.version < 1) return null;
  return body;
}

async function read(req, res) {
  res.set('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  try {
    return res.json({ config: await aiConfig.getConfig(), providerStatus: aiConfig.getProviderStatus() });
  } catch {
    return res.status(503).json({ code: 'CONFIG_UNAVAILABLE', message: 'Không thể tải cấu hình AI.' });
  }
}

async function update(req, res) {
  res.set('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  const input = parseConfig(req.body);
  if (!input) return res.status(400).json({ code: 'INVALID_CONFIG', message: 'Cấu hình AI không hợp lệ.' });
  try {
    const config = await aiConfig.updateConfig(input, req.account.id);
    return res.json({ config, providerStatus: aiConfig.getProviderStatus() });
  } catch (error) {
    if (error.code === 'CONFIG_CHANGED') {
      return res.status(409).json({ code: 'CONFIG_CHANGED', message: 'Cấu hình đã thay đổi. Vui lòng tải lại.' });
    }
    return res.status(503).json({ code: 'CONFIG_UNAVAILABLE', message: 'Không thể lưu cấu hình AI.' });
  }
}

module.exports = { read, update };
