const pool = require('../config/db');

// Tùng: status is local to this process and contains no request/user content.
const providerStatus = {
  openai: { state: 'unknown', observedAt: null, code: null },
  groq: { state: 'unknown', observedAt: null, code: null },
  // Tùng: tách trạng thái chatbot DeepSeek khỏi dịch vụ kiểm duyệt Groq.
  deepseek: { state: 'unknown', observedAt: null, code: null },
};

function snapshot(row) {
  if (!row) throw Object.assign(new Error('AI_CONFIG_UNAVAILABLE'), { code: 'CONFIG_UNAVAILABLE' });
  return {
    comment: { enabled: row.comment_enabled, provider: row.comment_provider },
    post: { enabled: row.post_enabled, provider: row.post_provider },
    // Tùng: phản ánh model chatbot theo plan, không đổi cấu hình kiểm duyệt.
    chatbot: { enabled: row.chatbot_enabled, provider: 'deepseek', model: 'deepseek-flash' },
    version: row.version,
    updatedAt: row.updated_at,
  };
}

async function getConfig() {
  const { rows } = await pool.query(`
    SELECT comment_enabled, comment_provider, post_enabled, post_provider,
      chatbot_enabled, version, updated_at
    FROM public.ai_configuration WHERE id = 1
  `);
  return snapshot(rows[0]);
}

async function updateConfig(input, actorId) {
  const { rows } = await pool.query(`
    UPDATE public.ai_configuration
    SET comment_enabled = $1, comment_provider = $2,
        post_enabled = $3, post_provider = $4, chatbot_enabled = $5,
        version = version + 1, updated_at = now(), updated_by = $6
    WHERE id = 1 AND version = $7
    RETURNING comment_enabled, comment_provider, post_enabled, post_provider,
      chatbot_enabled, version, updated_at
  `, [input.comment.enabled, input.comment.provider, input.post.enabled,
    input.post.provider, input.chatbot.enabled, actorId, input.version]);
  if (!rows[0]) {
    // Distinguish an unavailable singleton from a concurrent change.
    await getConfig();
    throw Object.assign(new Error('AI_CONFIG_CHANGED'), { code: 'CONFIG_CHANGED' });
  }
  return snapshot(rows[0]);
}

function recordProviderError(provider, code) {
  if (!Object.hasOwn(providerStatus, provider)) return;
  const safeCode = ['RATE_LIMITED', 'UNAVAILABLE'].includes(code) ? code : 'UNAVAILABLE';
  providerStatus[provider] = {
    state: safeCode === 'RATE_LIMITED' ? 'rate_limited' : 'unavailable',
    observedAt: new Date().toISOString(),
    code: safeCode,
  };
}

function clearProviderError(provider) {
  if (Object.hasOwn(providerStatus, provider)) {
    providerStatus[provider] = { state: 'unknown', observedAt: null, code: null };
  }
}

function getProviderStatus() {
  return { openai: { ...providerStatus.openai }, groq: { ...providerStatus.groq }, deepseek: { ...providerStatus.deepseek } };
}

module.exports = { getConfig, updateConfig, recordProviderError, clearProviderError, getProviderStatus };
